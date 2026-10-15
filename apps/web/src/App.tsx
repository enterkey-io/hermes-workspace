import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { normalizeEndpoint, safeError } from '@hermes-client/core';
import { BotBridgeClient } from '@hermes-client/protocol';
import type { BridgeEvent } from '@hermes-client/protocol';
import { FirstRun } from './FirstRun';
import { AgentPicker } from './AgentPicker';
import { MessageBody, CopyMessage } from './MessageBody';
import type { OwnerConnection } from './OwnerShell';
import { WorkspaceSetup } from './WorkspaceSetup';
import { WorkspaceSettings } from './WorkspaceSettings';
import { AgentAvatar } from './AgentAvatar';
import { workspaceState } from './workspace';
import type { WorkspaceState } from './workspace';
import type { Activity } from './avatar-lab/engine';

type Row = Record<string, unknown>;
type Bot = { profile: string; name: string; description: string; canonical: boolean };
type Message = { role: string; text: string };
type Selection = { kind: 'bot'; bot: Bot; sessionId: string } | { kind: 'room'; room: Row };

function object(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid data');
  return value as Row;
}
function rows(value: unknown): Row[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('Invalid data');
  return value.map(object);
}
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function transcript(value: unknown): Message[] {
  return rows(value)
    .filter((m) => ['user', 'assistant', 'tool'].includes(text(m.role)))
    .map((m) => ({ role: text(m.role), text: text(m.text) || text(m.name) }));
}

export function App({ owner }: { owner?: OwnerConnection }) {
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const [workspace, setWorkspace] = useState<WorkspaceState>();
  const [settings, setSettings] = useState(false);
  const [agentStates, setAgentStates] = useState<Record<string, Activity>>({});
  const sessionProfiles = useRef(new Map<string, string>());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const renewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectAttempt = useRef(0);
  const connectGeneration = useRef(0);
  const autoOpened = useRef(false);
  const restoreProfile = useRef('');
  const restoreRoom = useRef('');
  const welcomeProfile = useRef('');
  const disposed = useRef(false);
  const [client, setClient] = useState<BotBridgeClient>();
  const current = useRef<BotBridgeClient | undefined>(undefined);
  const selected = useRef<Selection | undefined>(undefined);
  const selectGeneration = useRef(0);
  const eventVersion = useRef(0);
  const [bots, setBots] = useState<Bot[]>([]);
  const [rooms, setRooms] = useState<Row[]>([]);
  const [selection, setSelection] = useState<Selection>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [routines, setRoutines] = useState<Row[]>([]);
  const [approvals, setApprovals] = useState<Row[]>([]);
  const [draft, setDraft] = useState('');
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  const [stream, setStream] = useState('');
  const [activity, setActivity] = useState('Ready');
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [streamState, setStreamState] = useState<'opening' | 'live' | 'lost'>('opening');
  const [error, setError] = useState('');
  const [nav, setNav] = useState(false);
  const [pickingAgents, setPickingAgents] = useState(false);
  const transcriptPane = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const followLatest = useRef(true);
  const focusOnReady = useRef(false);
  const drafts = useRef(new Map<string, string>());
  const [showLatest, setShowLatest] = useState(false);
  const draftKey = (target: Selection) =>
    target.kind === 'bot' ? `bot:${target.bot.profile}` : `room:${text(target.room.room_id)}`;

  function fail(error: unknown) {
    setError(safeError(error).message);
  }
  function disconnect() {
    connectGeneration.current++;
    clearTimeout(reconnectTimer.current);
    clearTimeout(renewTimer.current);
    setWorkspace(undefined);
    setAgentStates({});
    sessionProfiles.current.clear();
    setSettings(false);
    selectGeneration.current++;
    current.current?.disconnect();
    current.current = undefined;
    selected.current = undefined;
    setClient(undefined);
    setSelection(undefined);
    setBots([]);
    setRooms([]);
    setMessages([]);
    setRoutines([]);
    setApprovals([]);
    setStream('');
    setDraft('');
    setRunning(false);
    setBusy(false);
    setBlocked(false);
    setStreamState('opening');
    setError('');
    setPickingAgents(false);
    drafts.current.clear();
    focusOnReady.current = false;
    followLatest.current = true;
    setShowLatest(false);
  }
  useEffect(() => {
    disposed.current = false;
    if (ownerRef.current) void connectOwner();
    const recover = () => {
      if (ownerRef.current) scheduleReconnect();
    };
    window.addEventListener('online', recover);
    window.addEventListener('offline', recover);
    return () => {
      window.removeEventListener('online', recover);
      window.removeEventListener('offline', recover);
      disposed.current = true;
      connectGeneration.current++;
      clearTimeout(reconnectTimer.current);
      clearTimeout(renewTimer.current);
      current.current?.disconnect();
    };
  }, []);
  async function connectOwner() {
    const generation = ++connectGeneration.current;
    try {
      const credential = await ownerRef.current!.ticket();
      if (disposed.current || generation !== connectGeneration.current) return;
      await connect(credential.bridgeUrl, credential.ticket);
      if (disposed.current || generation !== connectGeneration.current) return;
      reconnectAttempt.current = 0;
      scheduleRenew();
    } catch {
      if (!disposed.current && generation === connectGeneration.current) scheduleReconnect();
    }
  }
  function scheduleRenew() {
    clearTimeout(renewTimer.current);
    renewTimer.current = setTimeout(async () => {
      const connection = current.current;
      if (!connection || !ownerRef.current || disposed.current) return;
      try {
        const next = await ownerRef.current.ticket();
        if (current.current !== connection) return;
        await connection.renew(next.ticket);
        scheduleRenew();
      } catch {
        if (current.current === connection) scheduleReconnect();
      }
    }, 240000);
  }
  function scheduleReconnect() {
    if (!ownerRef.current || disposed.current) return;
    connectGeneration.current++;
    clearTimeout(renewTimer.current);
    clearTimeout(reconnectTimer.current);
    setBlocked(true);
    setStreamState('lost');
    setActivity('Reconnecting to Hermes…');
    const target = selected.current;
    if (target) {
      restoreProfile.current = target.kind === 'bot' ? target.bot.profile : '';
      restoreRoom.current = target.kind === 'room' ? text(target.room.room_id) : '';
      drafts.current.set(draftKey(target), currentDraft.current);
    }
    const delay = Math.min(30000, 1000 * 2 ** Math.min(reconnectAttempt.current++, 5));
    reconnectTimer.current = setTimeout(() => {
      if (disposed.current) return;
      current.current?.disconnect();
      current.current = undefined;
      autoOpened.current = false;
      void connectOwner();
    }, delay);
  }
  useEffect(() => {
    if (!client || streamState !== 'live' || busy || autoOpened.current || !workspace?.initialized)
      return;
    if (restoreRoom.current) {
      const room = rooms.find((r) => text(r.room_id) === restoreRoom.current);
      restoreRoom.current = '';
      if (room) {
        autoOpened.current = true;
        openRoom(room);
        return;
      }
    }
    const profile = restoreProfile.current || workspace.orchestrator;
    const bot = bots.find((b) => b.profile === profile);
    if (!bot) return;
    autoOpened.current = true;
    restoreProfile.current = '';
    void open(bot).then(async () => {
      if (welcomeProfile.current === bot.profile) {
        welcomeProfile.current = '';
        try {
          await client.invoke('workspace.welcome', { profile: bot.profile });
          await loadRoster(client);
        } catch {
          setError(
            'Your agent’s welcome could not be confirmed. Check the chat before asking again.',
          );
        }
      }
    });
  }, [client, streamState, busy, workspace, bots, rooms]);
  useLayoutEffect(() => {
    const pane = transcriptPane.current;
    if (pane && followLatest.current && !pickingAgents) pane.scrollTop = pane.scrollHeight;
  }, [messages, stream, pickingAgents, running]);
  useLayoutEffect(() => {
    const input = composer.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 170)}px`;
  }, [draft, selection, pickingAgents]);
  useLayoutEffect(() => {
    if (
      focusOnReady.current &&
      !busy &&
      !blocked &&
      !pickingAgents &&
      composer.current &&
      !composer.current.disabled
    ) {
      focusOnReady.current = false;
      composer.current.focus();
    }
  }, [busy, blocked, pickingAgents, selection]);
  function jumpToLatest() {
    followLatest.current = true;
    setShowLatest(false);
    const pane = transcriptPane.current;
    if (pane) pane.scrollTop = pane.scrollHeight;
  }

  async function refreshHistory(connection: BotBridgeClient, target: Selection) {
    if (target.kind !== 'bot') return;
    const data = object(await connection.invoke('chat.history', { session_id: target.sessionId }));
    if (current.current === connection && selected.current === target)
      setMessages(transcript(data.messages));
  }

  async function receive(connection: BotBridgeClient, event: BridgeEvent) {
    if (current.current !== connection) return;
    if (event.type === 'bridge.ready') {
      setStreamState('live');
      setBlocked(false);
      setActivity('Ready');
      return;
    }
    const profile = sessionProfiles.current.get(event.session_id ?? '');
    if (profile) {
      const state: Activity | undefined =
        event.type === 'approval.request'
          ? 'attention'
          : event.type === 'message.start' || event.type === 'tool.start'
            ? 'working'
            : event.type === 'message.complete'
              ? event.payload?.status === 'error'
                ? 'attention'
                : 'done'
              : undefined;
      if (state) setAgentStates((old) => ({ ...old, [profile]: state }));
    }
    const target = selected.current;
    if (event.type === 'bridge.resync') {
      setBlocked(true);
      setStreamState('lost');
      setActivity('Live updates disconnected');
      setError('Live updates were interrupted. Reconnecting and checking the conversation…');
      if (ownerRef.current) scheduleReconnect();
      return;
    }
    if (!target || target.kind !== 'bot' || event.session_id !== target.sessionId) return;
    eventVersion.current++;
    const payload = event.payload ?? {};
    if (event.type === 'message.start') {
      setRunning(true);
      setStream('');
      setActivity('Working');
    }
    if (event.type === 'message.delta') setStream((old) => old + text(payload.text));
    if (event.type === 'message.complete') {
      setRunning(false);
      setStream('');
      setActivity(payload.status === 'error' ? 'Turn failed' : 'Ready');
      if (payload.status === 'error')
        setError('Hermes reported a failed turn. Refresh to inspect its history.');
      await refreshHistory(connection, target);
    }
    if (event.type === 'tool.start') setActivity(`Using ${text(payload.name) || 'a tool'}`);
    if (event.type === 'tool.complete') setActivity(`Finished ${text(payload.name) || 'a tool'}`);
    if (event.type === 'status.update') setActivity(text(payload.text).slice(0, 500) || 'Working');
    if (event.type === 'approval.request') {
      const data = object(
        await connection.invoke('chat.approvals', { session_id: target.sessionId }),
      );
      if (selected.current === target) setApprovals(rows(data.approvals));
    }
    if (event.type === 'error') setError('Hermes reported an error. Refresh before retrying.');
  }

  async function loadRoster(connection: BotBridgeClient) {
    const roster = object(await connection.invoke('bots.list', {}));
    const managed = rows(roster.bots).map((b) => ({
      profile: text(b.profile),
      name: text(b.name),
      description: text(b.description),
      canonical: b.canonical === true,
    }));
    const nativeRooms = object(await connection.invoke('rooms.list', {}));
    const loadedRooms = rows(nativeRooms.rooms);
    if (current.current !== connection) return;
    setBots(managed);
    setRooms(loadedRooms);
    if (connection.supportsWorkspace) {
      const state = workspaceState(await connection.invoke('workspace.describe', {}));
      if (current.current === connection) setWorkspace(state);
    }
  }

  async function reloadRoster() {
    if (!client || busy) return;
    setBusy(true);
    setError('');
    try {
      await loadRoster(client);
    } catch (error) {
      if (current.current === client) fail(error);
    } finally {
      if (current.current === client) setBusy(false);
    }
  }

  async function connect(endpoint: string, token: string) {
    setBusy(true);
    setError('');
    setStreamState('opening');
    setActivity('Connecting live updates…');
    setBlocked(true);
    let connection: BotBridgeClient | undefined;
    try {
      connection = new BotBridgeClient(normalizeEndpoint(endpoint, import.meta.env.DEV), token);
      current.current = connection;
      autoOpened.current = false;
      await connection.connect();
      await loadRoster(connection);
      if (current.current !== connection) return;
      setClient(connection);
      const established = connection;
      void connection
        .events((event) => {
          void receive(established, event).catch(fail);
        })
        .catch(() => {
          if (current.current === established) {
            setBlocked(true);
            setStreamState('lost');
            setActivity('Live updates disconnected');
            if (ownerRef.current) {
              setError('Hermes is temporarily unreachable. Reconnecting automatically…');
              scheduleReconnect();
              return;
            }
            setError(
              'Live updates were interrupted. This older preview connection needs to be reopened. The owner-login update adds automatic recovery.',
            );
          }
        });
    } catch (error) {
      connection?.disconnect();
      if (current.current === connection) current.current = undefined;
      fail(error);
      throw safeError(error);
    } finally {
      setBusy(false);
    }
  }

  async function open(bot: Bot) {
    if (!client || streamState !== 'live' || !bot.canonical) return;
    const generation = ++selectGeneration.current;
    selected.current = undefined;
    setSelection(undefined);
    setMessages([]);
    setStream('');
    setApprovals([]);
    setRoutines([]);
    setError('');
    setBusy(true);
    setNav(false);
    setPickingAgents(false);
    followLatest.current = true;
    setShowLatest(false);
    setDraft(drafts.current.get(`bot:${bot.profile}`) ?? '');
    try {
      const data = object(await client.invoke('bot.open', { profile: bot.profile }));
      if (generation !== selectGeneration.current || current.current !== client) return;
      const target: Selection = { kind: 'bot', bot, sessionId: text(data.session_id) };
      sessionProfiles.current.set(target.sessionId, bot.profile);
      setAgentStates((old) => ({
        ...old,
        [bot.profile]: data.running === true ? 'working' : 'ready',
      }));
      selected.current = target;
      setSelection(target);
      setMessages(transcript(data.messages));
      const inflight = data.inflight ? object(data.inflight) : {};
      setRunning(data.running === true);
      setStream(text(inflight.assistant));
      setActivity(data.running === true ? 'Working' : 'Ready');
      const ownedRoutines = object(await client.invoke('routines.list', { profile: bot.profile }));
      if (current.current !== client || selected.current !== target) return;
      setRoutines(rows(ownedRoutines.jobs ?? []));
      const pending = object(
        await client.invoke('chat.approvals', { session_id: target.sessionId }),
      );
      if (selected.current === target) setApprovals(rows(pending.approvals));
      // Reconcile the open/routine-fetch interval against a fresh native snapshot.
      const version = eventVersion.current;
      const snapshot = object(await client.invoke('bot.open', { profile: bot.profile }));
      if (
        current.current === client &&
        selected.current === target &&
        version === eventVersion.current
      ) {
        setMessages(transcript(snapshot.messages));
        setRunning(snapshot.running === true);
        setStream(snapshot.inflight ? text(object(snapshot.inflight).assistant) : '');
      }
    } catch (error) {
      if (generation === selectGeneration.current) fail(error);
    } finally {
      if (generation === selectGeneration.current) {
        focusOnReady.current = matchMedia('(pointer: fine)').matches;
        setBusy(false);
      }
    }
  }

  function openRoom(room: Row) {
    setPickingAgents(false);
    selectGeneration.current++;
    const target: Selection = { kind: 'room', room };
    selected.current = target;
    setSelection(target);
    setDraft(drafts.current.get(draftKey(target)) ?? '');
    followLatest.current = true;
    setShowLatest(false);
    setMessages([]);
    setStream('');
    setApprovals([]);
    setRoutines([]);
    setRunning(false);
    setBusy(false);
    setActivity('Native room driver');
    setError('');
    setNav(false);
  }
  useEffect(() => {
    if (!client || selection?.kind !== 'room') return;
    let disposed = false;
    let cursor = 0;
    const events = new Map<number, Row>();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        let more = true;
        let pages = 0;
        while (more && pages++ < 100 && !disposed) {
          const data = object(
            await client!.invoke('room.log', {
              room_id: text(selection!.kind === 'room' ? selection!.room.room_id : ''),
              since_seq: cursor,
            }),
          );
          if (disposed) return;
          for (const row of rows(data.events ?? [])) {
            if (typeof row.seq !== 'number') throw new Error('Invalid room sequence');
            events.set(row.seq, row);
          }
          if (typeof data.cursor !== 'number' || data.cursor < cursor)
            throw new Error('Invalid cursor');
          if (data.has_more === true && data.cursor === cursor) throw new Error('Room log stalled');
          cursor = data.cursor;
          more = data.has_more === true;
        }
        // Bound browser memory while continuing from the native monotonic cursor.
        while (events.size > 1000) events.delete(events.keys().next().value!);
        const state = object(
          await client!.invoke('room.state', {
            room_id: text(selection!.kind === 'room' ? selection!.room.room_id : ''),
          }),
        );
        if (disposed) return;
        const driver = object(state.driver_status ?? {});
        const actions = rows(driver.pending_actions ?? []);
        setApprovals(actions.filter((action) => action.kind === 'approval'));
        setActivity(
          driver.blocked === true
            ? 'Room recovery needed · Inspect in Hermes'
            : driver.working === true
              ? 'Room members are working'
              : 'Native room driver ready',
        );
        setMessages(
          [...events.values()]
            .filter((e) => text(object(e.payload).text))
            .map((e) => ({
              role: text(e.kind) === 'message.user' ? 'user' : 'assistant',
              text: text(object(e.payload).text),
            })),
        );
      } catch (error) {
        if (!disposed) fail(error);
      }
      if (!disposed)
        timer = setTimeout(() => {
          void poll();
        }, 2000);
    }
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [client, selection]);

  async function send() {
    if (!client || !selection || !draft.trim() || busy || running || blocked) return;
    const connection = client;
    const target = selection;
    const generation = selectGeneration.current;
    const owns = () =>
      current.current === connection &&
      selected.current === target &&
      generation === selectGeneration.current;
    setBusy(true);
    setError('');
    const message = draft;
    followLatest.current = true;
    setShowLatest(false);
    setMessages((old) => [...old, { role: 'user', text: message }]);
    if (target.kind === 'bot') {
      setRunning(true);
      setActivity('Working');
    }
    try {
      if (selection.kind === 'bot') {
        await client.invoke('chat.send', { session_id: selection.sessionId, text: message });
      } else
        await client.invoke('room.send', {
          room_id: text(selection.room.room_id),
          event_id: crypto.randomUUID(),
          text: message,
        });
      if (owns()) {
        drafts.current.delete(draftKey(target));
        setDraft('');
      }
    } catch (error) {
      if (current.current === connection) setBlocked(true);
      if (owns())
        setError(
          `${safeError(error).message} The send outcome is uncertain. Reconnect and inspect history before another send.`,
        );
    } finally {
      if (generation === selectGeneration.current && current.current === connection) {
        focusOnReady.current = true;
        setBusy(false);
      }
    }
  }
  async function stop() {
    if (!client || !selection) return;
    const connection = client,
      target = selection;
    try {
      await client.invoke(
        selection.kind === 'bot' ? 'chat.stop' : 'room.stop',
        selection.kind === 'bot'
          ? { session_id: selection.sessionId }
          : { room_id: text(selection.room.room_id) },
      );
      if (current.current === connection && selected.current === target)
        setActivity('Stop requested');
    } catch (error) {
      if (current.current === connection && selected.current === target) fail(error);
    }
  }
  async function approve(approval: Row, choice: string) {
    if (!client || !selection || blocked) return;
    const requestId = text(approval.request_id);
    const connection = client,
      target = selection;
    try {
      if (target.kind === 'bot') {
        await client.invoke('chat.approve', {
          session_id: target.sessionId,
          request_id: requestId,
          choice,
        });
      } else
        await client.invoke('room.approve', {
          room_id: text(target.room.room_id),
          member_id: text(approval.member_id),
          task_id: text(approval.task_id),
          execution_generation: approval.execution_generation,
          request_id: requestId,
          choice,
        });
      if (current.current === connection && selected.current === target)
        setApprovals((old) => old.filter((a) => a.request_id !== requestId));
    } catch (error) {
      if (current.current === connection && selected.current === target) fail(error);
    }
  }

  const detailsContent = (
    <>
      <p className="section-label">ACTIVITY</p>
      <p className="activity">{activity}</p>
      {approvals.map((approval) => (
        <section className="approval" key={text(approval.request_id)}>
          <h2>Approval needed</h2>
          <p>
            {text(approval.command) ||
              text(approval.description) ||
              (approval.approval
                ? text(object(approval.approval).command) ||
                  text(object(approval.approval).description)
                : '') ||
              'Hermes requested permission for an action.'}
          </p>
          <div>
            <button disabled={blocked} onClick={() => void approve(approval, 'deny')}>
              Deny
            </button>
            <button disabled={blocked} onClick={() => void approve(approval, 'once')}>
              Allow once
            </button>
          </div>
        </section>
      ))}
      <p className="section-label">
        ROUTINES <span>{routines.length}</span>
      </p>
      {routines.map((routine, i) => (
        <section className="routine" key={text(routine.id) || i}>
          <strong>{text(routine.name) || 'Routine'}</strong>
          <p>{text(routine.schedule_display) || text(routine.schedule)}</p>
          <small>{routine.enabled === false ? 'Paused' : 'Scheduled by Hermes'}</small>
        </section>
      ))}
      {!routines.length && (
        <p className="empty-note">
          {selection?.kind === 'bot'
            ? 'No routines on this bot’s profile.'
            : 'Choose a bot to see its routines.'}
        </p>
      )}
    </>
  );

  if (!client)
    return owner ? (
      <main className="owner-entry">
        <div className="owner-card">
          <h1>Connecting…</h1>
          <p role="status">{activity}</p>
          {error && <p className="error">{error}</p>}
          <button onClick={() => void owner.logout()}>Sign out</button>
        </div>
      </main>
    ) : (
      <FirstRun onConnect={connect} />
    );

  if (client.supportsWorkspace && workspace && !workspace.initialized)
    return (
      <main className="onboarding-shell">
        <header>
          {owner && (
            <button
              onClick={() => {
                disconnect();
                void owner.logout();
              }}
            >
              Sign out
            </button>
          )}
        </header>
        <WorkspaceSetup
          client={client}
          onComplete={(state, profile, welcome) => {
            setWorkspace(state);
            restoreProfile.current = profile;
            welcomeProfile.current = welcome ? profile : '';
            autoOpened.current = false;
            void loadRoster(client).catch(fail);
          }}
        />
      </main>
    );

  const title =
    selection?.kind === 'bot'
      ? selection.bot.name
      : selection?.kind === 'room'
        ? text(selection.room.name)
        : 'Chats';
  return (
    <main className="workspace">
      <aside className={`sidebar ${nav ? 'visible' : ''}`}>
        <div className="sidebar-title">Pebble Crew</div>
        <button
          onClick={() => {
            setPickingAgents(true);
            setNav(false);
          }}
          disabled={busy || streamState !== 'live'}
        >
          Add existing agents
        </button>
        {client.supportsWorkspace && (
          <button
            onClick={() => {
              setSettings(true);
              setPickingAgents(false);
              setNav(false);
            }}
          >
            Settings
          </button>
        )}
        <p className="section-label">
          YOUR BOTS <span>{bots.length}</span>
        </p>
        <nav aria-label="Bots">
          {[...bots]
            .sort((a, b) => {
              const team = (p: string) =>
                workspace?.teams.findIndex(
                  (t) => t.id === workspace.bots.find((x) => x.profile === p)?.team,
                ) ?? -1;
              return team(a.profile) - team(b.profile);
            })
            .map((bot, index, all) => (
              <div key={bot.profile}>
                {workspace &&
                  (() => {
                    const teamId = workspace.bots.find((b) => b.profile === bot.profile)?.team;
                    const previous = index
                      ? workspace.bots.find((b) => b.profile === all[index - 1]?.profile)?.team
                      : null;
                    return teamId && teamId !== previous ? (
                      <p className="section-label">
                        {workspace.teams.find((t) => t.id === teamId)?.name}
                      </p>
                    ) : null;
                  })()}
                <button
                  key={bot.profile}
                  className={
                    selection?.kind === 'bot' && selection.bot.profile === bot.profile
                      ? 'selected bot'
                      : 'bot'
                  }
                  onClick={() => {
                    if (bot.canonical) void open(bot);
                    else {
                      setPickingAgents(true);
                      setNav(false);
                    }
                  }}
                  disabled={busy || streamState !== 'live'}
                >
                  {workspace?.bots.find((b) => b.profile === bot.profile) ? (
                    <AgentAvatar
                      id={workspace.bots.find((b) => b.profile === bot.profile)!.id}
                      profile={bot.profile}
                      client={client}
                      look={workspace.bots.find((b) => b.profile === bot.profile)!.appearance}
                      orchestrator={workspace.orchestrator === bot.profile}
                      state={agentStates[bot.profile] ?? 'ready'}
                    />
                  ) : (
                    <span className="avatar" aria-hidden>
                      {bot.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span>
                    <strong>{bot.name}</strong>
                    {workspace && (
                      <small>
                        @{workspace.bots.find((b) => b.profile === bot.profile)?.handle}
                      </small>
                    )}
                    <small>
                      {!bot.canonical ? 'Set up Bot Chat' : bot.description || 'Bot Chat'}
                    </small>
                  </span>
                </button>
              </div>
            ))}
        </nav>
        {!bots.length && (
          <p className="empty-note">Choose Add existing agents to bring your Hermes agents here.</p>
        )}
        <button disabled={busy || streamState !== 'live'} onClick={() => void reloadRoster()}>
          Refresh bots
        </button>
        <p className="section-label">
          ROOMS <span>{rooms.length}</span>
        </p>
        <nav aria-label="Rooms">
          {rooms.map((room) => (
            <button
              key={text(room.room_id)}
              className={
                selection?.kind === 'room' && selection.room.room_id === room.room_id
                  ? 'selected room'
                  : 'room'
              }
              disabled={busy || streamState !== 'live'}
              onClick={() => openRoom(room)}
            >
              # <span>{text(room.name) || text(room.room_id)}</span>
            </button>
          ))}
        </nav>
        {!rooms.length && (
          <p className="empty-note">Your existing Hermes rooms will appear here.</p>
        )}
        <div className="connection">
          <span className={`connection-dot ${streamState}`} />
          {streamState === 'live'
            ? 'Connected to Hermes'
            : streamState === 'lost'
              ? 'Live updates disconnected'
              : 'Connecting live updates…'}{' '}
          <button
            onClick={() => {
              disconnect();
              if (owner) void owner.logout();
            }}
          >
            {owner ? 'Sign out' : 'Disconnect'}
          </button>
        </div>
      </aside>
      <section className="conversation">
        {client.supportsWorkspace && workspace && (!workspace.initialized || settings) ? (
          !workspace.initialized ? (
            <WorkspaceSetup
              client={client}
              onComplete={(state, profile, welcome) => {
                setWorkspace(state);
                restoreProfile.current = profile;
                welcomeProfile.current = welcome ? profile : '';
                autoOpened.current = false;
                void loadRoster(client).catch(fail);
              }}
            />
          ) : (
            <WorkspaceSettings
              client={client}
              owner={!!owner}
              state={workspace}
              onChange={(state) => {
                setWorkspace(state);
                void loadRoster(client).catch(fail);
              }}
              onClose={() => setSettings(false)}
            />
          )
        ) : (
          <>
            <header>
              <button
                className="mobile-nav"
                aria-label="Toggle navigation"
                onClick={() => setNav(!nav)}
              >
                ☰
              </button>
              <div>
                <h1>{title}</h1>
                <p>
                  {selection?.kind === 'room'
                    ? 'Hermes drives this discussion'
                    : 'Ongoing conversation · History on your Hermes'}
                </p>
              </div>
              {selection?.kind === 'bot' && (
                <button
                  onClick={() => {
                    void refreshHistory(client, selection).catch(fail);
                  }}
                >
                  Refresh
                </button>
              )}
            </header>
            {(error || (blocked && streamState !== 'opening')) && (
              <div className="error banner" role="alert">
                {error ||
                  'Event continuity was lost. Disconnect and reconnect before sending again.'}
                {streamState === 'lost' && (
                  <button onClick={owner ? scheduleReconnect : disconnect}>
                    {owner ? 'Try reconnecting now' : 'Disconnect and reconnect'}
                  </button>
                )}
              </div>
            )}
            <div
              ref={transcriptPane}
              onScroll={(event) => {
                if (pickingAgents) return;
                const pane = event.currentTarget;
                const nearBottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 96;
                followLatest.current = nearBottom;
                setShowLatest(!nearBottom);
              }}
              className={`transcript ${pickingAgents ? 'choosing-agents' : ''}`}
              role={pickingAgents ? undefined : 'log'}
              aria-live={pickingAgents ? undefined : 'polite'}
            >
              {pickingAgents ? (
                <AgentPicker
                  client={client}
                  connected={streamState === 'live'}
                  onClose={() => setPickingAgents(false)}
                  onDone={async () => {
                    await loadRoster(client);
                    if (current.current === client) setPickingAgents(false);
                  }}
                />
              ) : (
                !selection && (
                  <div className="welcome">
                    <p className="eyebrow">
                      {streamState === 'live'
                        ? 'CONNECTED TO YOUR HERMES'
                        : streamState === 'lost'
                          ? 'CONNECTION NEEDS ATTENTION'
                          : 'STARTING LIVE UPDATES'}
                    </p>
                    {streamState !== 'live' ? (
                      <>
                        <h2>
                          {streamState === 'lost'
                            ? 'Live updates are disconnected.'
                            : 'Connecting…'}
                        </h2>
                        <p>
                          {streamState === 'lost'
                            ? 'Pairing and the initial lists worked. The live connection needs to work before you can chat.'
                            : 'Browser access is approved. Waiting for the live connection before you can chat.'}
                        </p>
                      </>
                    ) : !rooms.length && !bots.some((bot) => bot.canonical) ? (
                      <>
                        <h2>Choose your Hermes agents.</h2>
                        <p>
                          Your existing agents keep their SOUL, memory and skills. Choose which ones
                          you want to use here.
                        </p>
                        <button onClick={() => setPickingAgents(true)}>Add existing agents</button>
                      </>
                    ) : (
                      <>
                        <h2>Who’s up next?</h2>
                        <p>
                          Choose a bot for its ongoing conversation,
                          <br />
                          or open a room to work together.
                        </p>
                      </>
                    )}
                  </div>
                )
              )}
              {!pickingAgents && selection && !messages.length && !stream && (
                <p className="empty-chat">Your conversation is ready.</p>
              )}
              {!pickingAgents &&
                messages.map((message, i) => (
                  <article key={i} className={`message ${message.role}`}>
                    <small>
                      {message.role === 'user' ? 'You' : message.role === 'tool' ? 'Tool' : title}
                    </small>
                    {message.role === 'user' ? (
                      <p>{message.text}</p>
                    ) : (
                      <MessageBody text={message.text} />
                    )}
                    <CopyMessage text={message.text} />
                  </article>
                ))}
              {!pickingAgents && stream && (
                <article className="message assistant">
                  <small>{title}</small>
                  <MessageBody text={stream} />
                  <span className="caret" aria-hidden>
                    ▍
                  </span>
                </article>
              )}
              {!pickingAgents && running && !stream && (
                <p className="thinking" role="status">
                  Working…
                </p>
              )}
            </div>
            {!pickingAgents && (
              <>
                {showLatest && (
                  <button className="jump-latest" onClick={jumpToLatest}>
                    ↓ Latest messages
                  </button>
                )}
                <details className="compact-details" open={approvals.length > 0 ? true : undefined}>
                  <summary>
                    Activity & routines{approvals.length ? ' · Approval needed' : ''}
                  </summary>
                  {detailsContent}
                </details>
                <div className="composer">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void send();
                    }}
                  >
                    <textarea
                      ref={composer}
                      rows={1}
                      aria-label="Message"
                      placeholder={
                        selection ? `Message ${title}…` : 'Choose a bot or room to begin'
                      }
                      value={draft}
                      disabled={!selection || busy || blocked || pickingAgents}
                      maxLength={16000}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDraft(value);
                        if (selected.current) drafts.current.set(draftKey(selected.current), value);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter' &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          void send();
                        }
                      }}
                    />
                    <div className="composer-actions">
                      <span>{running ? 'Hermes is working' : 'Shift + Enter for a new line'}</span>
                      {(running || selection?.kind === 'room') && (
                        <button type="button" onClick={() => void stop()}>
                          Stop
                        </button>
                      )}
                      <button
                        className="primary"
                        disabled={
                          !selection || !draft.trim() || busy || running || blocked || pickingAgents
                        }
                        aria-label="Send message"
                      >
                        ↑
                      </button>
                    </div>
                  </form>
                  <p className="composer-note">Direct connection · History lives on your server</p>
                </div>
              </>
            )}
          </>
        )}
      </section>
      <aside className="details-panel">{detailsContent}</aside>
    </main>
  );
}
