import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { normalizeEndpoint, safeError } from '@hermes-client/core';
import { BotBridgeClient } from '@hermes-client/protocol';
import type { BridgeEvent } from '@hermes-client/protocol';
import { FirstRun } from './FirstRun';
import { AgentPicker } from './AgentPicker';
import { nativeMessages as transcript, roomMessages } from './conversation';
import type { ChatMessage as Message } from './conversation';
import { RosterLoader } from './chat/roster';
import { Rail, PebbleAvatar, CrewAvatar } from './chat/Rail';
import type { ChatBot as Bot } from './chat/Rail';
import { Transcript } from './chat/Transcript';
import { Inspector } from './chat/Inspector';
import { Icon } from './chat/Icon';
import { Drawer } from './chat/Drawer';
import { RequestReview } from './chat/RequestReview';
import type { OwnerConnection } from './OwnerShell';
import { WorkspaceSetup } from './WorkspaceSetup';
import { WorkspaceSettings } from './WorkspaceSettings';
import { workspaceState } from './workspace';
import type { WorkspaceState, WorkspaceBot } from './workspace';
import type { Activity } from './avatar-lab/engine';

type Row = Record<string, unknown>;
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

export function App({ owner }: { owner?: OwnerConnection }) {
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const [workspace, setWorkspace] = useState<WorkspaceState>();
  const [settings, setSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'agents' | 'requests'>('agents');
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
  const selectionConnection = useRef<BotBridgeClient | undefined>(undefined);
  const selectGeneration = useRef(0);
  const eventVersion = useRef(0);
  const [bots, setBots] = useState<Bot[]>([]);
  const [rooms, setRooms] = useState<Row[]>([]);
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;
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
  const [details, setDetails] = useState(false);
  const [routinePending, setRoutinePending] = useState('');
  const [stopping, setStopping] = useState(false);
  const [pinOrder, setPinOrder] = useState<string[]>([]);
  const preferencesRevision = useRef(0);
  const [review, setReview] = useState<Row>();
  const [reviewBusy, setReviewBusy] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [removedDraft, setRemovedDraft] = useState('');
  const rosterLoader = useRef(new RosterLoader());
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const scrollPositions = useRef(new Map<string, { top: number; follow: boolean }>());
  const closeNav = useCallback(() => setNav(false), []);
  const closeDetails = useCallback(() => setDetails(false), []);
  const closeReview = useCallback(() => setReview(undefined), []);
  const [pickingAgents, setPickingAgents] = useState(false);
  const transcriptPane = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const followLatest = useRef(true);
  const focusOnReady = useRef(false);
  const drafts = useRef(new Map<string, string>());
  const [showLatest, setShowLatest] = useState(false);
  const displayedRead = useRef<{ key: string; cursor: number } | undefined>(undefined);
  const acknowledgedRead = useRef(new Map<string, number>());
  function observedHistory(target: Selection, native: unknown) {
    if (target.kind !== 'bot' || !Array.isArray(native)) return;
    const bot = workspaceRef.current?.bots.find((b) => b.id === target.bot.id);
    // Only acknowledge a native roster cursor covered by the loaded history.
    // A later background snapshot cannot mark unseen messages as read.
    if (
      bot?.read_key &&
      typeof bot.cursor === 'number' &&
      (bot.cursor_type === 'row'
        ? Math.max(0, ...native.map((m) => Number(m?.row_id) || 0))
        : native.length) >= bot.cursor
    )
      displayedRead.current = { key: bot.read_key, cursor: bot.cursor };
  }
  function acknowledgeRead() {
    const seen = displayedRead.current;
    if (
      !seen ||
      !current.current ||
      document.visibilityState !== 'visible' ||
      !followLatest.current ||
      pickingAgents ||
      settings
    )
      return;
    if ((acknowledgedRead.current.get(seen.key) ?? -1) >= seen.cursor) return;
    const connection = current.current;
    acknowledgedRead.current.set(seen.key, seen.cursor);
    void connection
      .invoke('presentation.read', seen)
      .catch(() => acknowledgedRead.current.delete(seen.key));
  }
  useEffect(() => {
    acknowledgeRead();
  }, [messages, workspace, settings, pickingAgents]);
  const draftKey = (target: Selection) =>
    target.kind === 'bot'
      ? `bot:${target.bot.id ?? target.bot.profile}`
      : `room:${text(target.room.room_id)}`;

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
    selectionConnection.current = undefined;
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
    displayedRead.current = undefined;
    acknowledgedRead.current.clear();
    scrollPositions.current.clear();
    setRemovedDraft('');
    setReview(undefined);
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
    acknowledgeRead();
  }

  async function refreshHistory(connection: BotBridgeClient, target: Selection) {
    if (target.kind !== 'bot' || selectionConnection.current !== connection) return;
    const data = object(await connection.invoke('chat.history', { session_id: target.sessionId }));
    if (current.current === connection && selected.current === target) {
      observedHistory(target, data.messages);
      setMessages(transcript(data.messages));
    }
    const saved = scrollPositions.current.get(draftKey(target));
    if (saved && !saved.follow) {
      followLatest.current = false;
      setShowLatest(true);
      requestAnimationFrame(() => {
        if (transcriptPane.current) transcriptPane.current.scrollTop = saved.top;
      });
    }
  }

  async function receive(connection: BotBridgeClient, event: BridgeEvent) {
    if (current.current !== connection) return;
    if (event.type === 'workspace.changed') {
      await loadRoster(connection, true);
      return;
    }
    if (event.type === 'tool.complete' || event.type === 'message.complete')
      void loadRoster(connection).catch(fail);
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
      setStopping(false);
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

  async function loadRoster(connection: BotBridgeClient, invalidate = false) {
    return rosterLoader.current.load(
      connection,
      async () => {
        if (connection.supportsWorkspace) {
          const data = object(await connection.invoke('workspace.snapshot', {}));
          if (current.current !== connection) return;
          const state = workspaceState(data.workspace);
          setWorkspace(state);
          workspaceRef.current = state;
          setBots(state.bots.filter((b) => b.managed && !b.hidden));
          const loadedRooms = rows(data.rooms);
          setRooms(loadedRooms);
          const prefs = object(data.preferences);
          setPinOrder(Array.isArray(prefs.pin_order) ? prefs.pin_order.map(String) : []);
          preferencesRevision.current = Number(prefs.revision) || 0;
          const target = selected.current;
          const surviving =
            target?.kind === 'bot'
              ? state.bots.find((b) => b.id === target.bot.id && b.managed && !b.hidden)
              : undefined;
          const roomSurviving =
            target?.kind === 'room'
              ? loadedRooms.some((r) => r.room_id === target.room.room_id)
              : true;
          if (
            target &&
            ((target.kind === 'bot' && !surviving) || (target.kind === 'room' && !roomSurviving))
          ) {
            selectGeneration.current++;
            selected.current = undefined;
            setSelection(undefined);
            setRemovedDraft(currentDraft.current);
            setDraft('');
            setMessages([]);
            setStream('');
            setRunning(false);
            setStopping(false);
            setApprovals([]);
            setRoutines([]);
            setError('This conversation is no longer in your sidebar.');
            autoOpened.current = true;
            restoreProfile.current = '';
            restoreRoom.current = '';
          }
          if (surviving && target?.kind === 'bot' && target.bot.profile !== surviving.profile) {
            // Reopen a proven native rename, retaining this incarnation's draft.
            restoreProfile.current = surviving.profile;
            autoOpened.current = false;
          }
          if (
            surviving &&
            target?.kind === 'bot' &&
            surviving.read_key &&
            displayedRead.current?.key === surviving.read_key &&
            typeof surviving.cursor === 'number' &&
            surviving.cursor > displayedRead.current.cursor
          ) {
            await refreshHistory(connection, target);
          }
          const req = object(await connection.invoke('requests.list', {}));
          if (current.current === connection)
            setRequestCount(rows(req.requests).filter((r) => r.state === 'pending').length);
        } else {
          const roster = object(await connection.invoke('bots.list', {}));
          const nativeRooms = object(await connection.invoke('rooms.list', {}));
          if (current.current !== connection) return;
          setBots(
            rows(roster.bots).map((b) => ({
              profile: text(b.profile),
              name: text(b.name),
              description: text(b.description),
              canonical: b.canonical === true,
            })),
          );
          setRooms(rows(nativeRooms.rooms));
        }
      },
      invalidate,
    );
  }
  useEffect(() => {
    if (!client || streamState !== 'live') return;
    let gone = false,
      timer: ReturnType<typeof setTimeout>,
      failures = 0;
    const tick = async () => {
      if (document.visibilityState === 'visible') {
        try {
          await loadRoster(client);
          failures = 0;
        } catch {
          failures = Math.min(failures + 1, 3);
        }
      }
      if (!gone) timer = setTimeout(() => void tick(), 5000 * 2 ** failures);
    };
    const focus = () => {
      if (document.visibilityState === 'visible') void loadRoster(client).catch(() => undefined);
    };
    timer = setTimeout(() => void tick(), 5000);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      gone = true;
      clearTimeout(timer);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
    };
  }, [client, streamState]);
  function rememberScroll() {
    const target = selected.current,
      pane = transcriptPane.current;
    if (target && pane)
      scrollPositions.current.set(draftKey(target), {
        top: pane.scrollTop,
        follow: followLatest.current,
      });
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
          void receive(established, event).catch((error) => {
            if (current.current === established) fail(error);
          });
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
    rememberScroll();
    const generation = ++selectGeneration.current;
    selected.current = undefined;
    setSelection(undefined);
    displayedRead.current = undefined;
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
    setDraft(drafts.current.get(`bot:${bot.id ?? bot.profile}`) ?? '');
    setRemovedDraft('');
    setStopping(false);
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
      selectionConnection.current = client;
      setSelection(target);
      observedHistory(target, data.messages);
      setMessages(transcript(data.messages));
      const saved = scrollPositions.current.get(draftKey(target));
      if (saved && !saved.follow) {
        followLatest.current = false;
        setShowLatest(true);
        requestAnimationFrame(() => {
          if (transcriptPane.current) transcriptPane.current.scrollTop = saved.top;
        });
      }
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
        observedHistory(target, snapshot.messages);
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
    rememberScroll();
    setPickingAgents(false);
    selectGeneration.current++;
    const target: Selection = { kind: 'room', room };
    selected.current = target;
    selectionConnection.current = client;
    setSelection(target);
    setDraft(drafts.current.get(draftKey(target)) ?? '');
    followLatest.current = true;
    setShowLatest(false);
    displayedRead.current = undefined;
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
        setMessages(roomMessages([...events.values()]));
        const room = roomsRef.current.find(
          (r) => r.room_id === (selection?.kind === 'room' ? selection.room.room_id : ''),
        );
        if (
          room &&
          typeof room.read_key === 'string' &&
          typeof room.cursor === 'number' &&
          cursor >= room.cursor
        )
          displayedRead.current = { key: room.read_key, cursor: room.cursor };
        setRunning(driver.working === true);
        if (driver.working !== true) setStopping(false);
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
    if (stopping) return;
    setStopping(true);
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
      if (current.current === connection && selected.current === target) {
        setStopping(false);
        fail(error);
      }
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

  async function presentationAction(operation: string, params: Row) {
    if (!client) return;
    try {
      await client.invoke(operation, params);
      await loadRoster(client, true);
    } catch (e) {
      fail(e);
    }
  }
  async function visibility(bot: WorkspaceBot, hidden: boolean) {
    await presentationAction('agent.hide', {
      profile: bot.profile,
      id: bot.id,
      expected_revision: workspace!.revision,
      hidden,
    });
  }
  async function proposeDelete(bot: WorkspaceBot) {
    if (!client || !workspace) return;
    try {
      const result = object(
        await client.invoke('agent.propose', {
          action: 'agent.delete',
          spec: { profile: bot.profile, id: bot.id, expected_revision: workspace.revision },
        }),
      );
      const list = object(await client.invoke('requests.list', {}));
      setReview(rows(list.requests).find((r) => r.id === result.request_id));
    } catch (e) {
      fail(e);
    }
  }
  async function decideReview(approve: boolean, confirmation?: string) {
    if (!client || !review) return;
    setReviewBusy(true);
    try {
      await client.invoke(approve ? 'requests.approve' : 'requests.deny', {
        id: review.id,
        fingerprint: review.fingerprint,
        ...(confirmation == null ? {} : { confirmation }),
      });
      const list = object(await client.invoke('requests.list', {}));
      setReview(rows(list.requests).find((r) => r.id === review.id));
      await loadRoster(client, true);
    } catch (e) {
      fail(e);
    } finally {
      setReviewBusy(false);
    }
  }
  async function toggleRoutine(r: Row) {
    if (!client || selection?.kind !== 'bot' || routinePending) return;
    const target = selection,
      id = text(r.job_id) || text(r.id);
    setRoutinePending(id);
    try {
      await client.invoke('routines.set_enabled', {
        profile: target.bot.profile,
        job_id: id,
        enabled: r.enabled === false || r.paused === true || r.state === 'paused',
      });
      const data = object(await client.invoke('routines.list', { profile: target.bot.profile }));
      if (selected.current === target) setRoutines(rows(data.jobs ?? []));
    } catch (e) {
      fail(e);
    } finally {
      setRoutinePending('');
    }
  }
  const detailsContent = client && (
    <Inspector
      bot={selection?.kind === 'bot' ? selection.bot : undefined}
      room={selection?.kind === 'room' ? selection.room : undefined}
      workspace={workspace}
      client={client}
      activity={activity}
      routines={routines}
      pending={routinePending}
      onToggle={(r) => void toggleRoutine(r)}
      onEdit={() => {
        setSettingsTab('agents');
        setSettings(true);
        setDetails(false);
      }}
    >
      {approvals.map((approval) => (
        <section className="approval" key={text(approval.request_id)}>
          <h3>Approval needed</h3>
          <p>
            {text(approval.command) ||
              text(approval.description) ||
              (approval.approval ? text(object(approval.approval).command) : '') ||
              'Hermes requested permission.'}
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
    </Inspector>
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
      ? (bots.find((b) => b.id === selection.bot.id && b.profile === selection.bot.profile)?.name ??
        selection.bot.name)
      : selection?.kind === 'room'
        ? text(selection.room.name)
        : 'Chats';
  const rail = (
    <Rail
      bots={bots}
      rooms={rooms}
      workspace={workspace}
      client={client}
      selected={
        selection?.kind === 'bot'
          ? selection.bot.profile
          : selection?.kind === 'room'
            ? text(selection.room.room_id)
            : undefined
      }
      states={agentStates}
      online={streamState === 'live'}
      pinOrder={pinOrder}
      onOpen={(bot) => {
        if (bot.canonical) void open(bot);
        else setPickingAgents(true);
      }}
      onRoom={openRoom}
      onAdd={() => {
        setPickingAgents(true);
        setNav(false);
        setSettings(false);
      }}
      onSettings={() => {
        setSettingsTab('agents');
        setSettings(true);
        setPickingAgents(false);
        setNav(false);
      }}
      onPin={(bot, pinned) =>
        void presentationAction('agent.pin', {
          profile: bot.profile,
          id: bot.id,
          expected_revision: workspace!.revision,
          pinned,
        })
      }
      onVisibility={(bot, hidden) => void visibility(bot, hidden)}
      onDelete={(bot) => void proposeDelete(bot)}
      onOrder={(ids) =>
        void presentationAction('presentation.order', {
          ids,
          expected_revision: preferencesRevision.current,
        })
      }
      owner={!!owner}
      onLogout={() => {
        disconnect();
        if (owner) void owner.logout();
      }}
    />
  );
  return (
    <main className={`workspace ${settings ? 'editing' : ''}`}>
      <aside className="sidebar">{rail}</aside>
      {nav && (
        <Drawer title="navigation" onClose={closeNav}>
          {rail}
        </Drawer>
      )}
      <section className="conversation" aria-label="Conversation">
        {settings && workspace ? (
          <WorkspaceSettings
            initialTab={settingsTab}
            initialProfile={selection?.kind === 'bot' ? selection.bot.profile : undefined}
            client={client}
            owner={!!owner}
            state={workspace}
            onChange={(state) => {
              setWorkspace(state);
              void loadRoster(client).catch(fail);
            }}
            onClose={() => setSettings(false)}
          />
        ) : (
          <>
            <header className="chat-header">
              <button
                className="icon-button mobile-nav"
                aria-label="Toggle navigation"
                onClick={() => setNav(true)}
              >
                <Icon name="menu" />
              </button>
              <div className="chat-title">
                {selection?.kind === 'bot' && (
                  <PebbleAvatar
                    bot={selection.bot}
                    workspace={workspace}
                    client={client}
                    state={agentStates[selection.bot.profile]}
                  />
                )}
                {selection?.kind === 'room' && (
                  <CrewAvatar room={selection.room} workspace={workspace} client={client} />
                )}
                <div>
                  <h1>{title}</h1>
                  {selection?.kind === 'bot' && (
                    <p>
                      {workspace?.bots.find((b) => b.profile === selection.bot.profile)?.role
                        .title ||
                        `@${workspace?.bots.find((b) => b.profile === selection.bot.profile)?.handle ?? selection.bot.profile}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="header-actions">
                {requestCount > 0 && (
                  <button
                    className="request-count"
                    onClick={() => {
                      setSettingsTab('requests');
                      setSettings(true);
                    }}
                  >
                    {requestCount} to review
                  </button>
                )}
                {selection?.kind === 'bot' && (
                  <button
                    className="icon-button"
                    aria-label="Refresh"
                    title="Refresh conversation"
                    onClick={() => void refreshHistory(client, selection).catch(fail)}
                  >
                    <Icon name="refresh" />
                  </button>
                )}
                <button
                  className="icon-button details-trigger"
                  aria-label="Show details"
                  onClick={() => setDetails(true)}
                >
                  <Icon name="info" />
                  {approvals.length > 0 && <span className="unread-dot" />}
                </button>
              </div>
            </header>
            {(error || (blocked && streamState !== 'opening')) && (
              <div className="error banner" role="alert">
                {error || 'Reconnecting to Hermes…'}
                {streamState === 'lost' && (
                  <button onClick={owner ? scheduleReconnect : disconnect}>
                    {owner ? 'Try reconnecting now' : 'Disconnect and reconnect'}
                  </button>
                )}
                <button
                  className="icon-button"
                  aria-label="Dismiss error"
                  onClick={() => setError('')}
                >
                  <Icon name="close" />
                </button>
              </div>
            )}
            <div
              ref={transcriptPane}
              className={`transcript ${pickingAgents ? 'choosing-agents' : ''}`}
              role={pickingAgents ? undefined : 'log'}
              aria-live={pickingAgents ? undefined : 'off'}
              onScroll={(event) => {
                if (pickingAgents) return;
                const pane = event.currentTarget;
                followLatest.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 96;
                setShowLatest(!followLatest.current);
                rememberScroll();
                acknowledgeRead();
              }}
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
                <Transcript
                  messages={messages}
                  title={title}
                  crew={selection?.kind === 'room'}
                  stream={stream}
                  running={running}
                  authorName={(name) =>
                    workspace?.bots.find(
                      (b) =>
                        b.profile === name ||
                        b.handle === name.replace('@', '') ||
                        (name === 'hermes' && b.profile === 'default'),
                    )?.name ?? name
                  }
                >
                  {!selection && (
                    <div className="welcome">
                      <h2>{streamState !== 'live' ? 'Connecting…' : 'Choose a conversation'}</h2>
                      {streamState === 'live' && !bots.length && (
                        <button onClick={() => setPickingAgents(true)}>Add existing agents</button>
                      )}
                    </div>
                  )}
                  {selection && !messages.length && !stream && !running && (
                    <p className="empty-chat">Say hello to {title}.</p>
                  )}
                  {removedDraft && (
                    <section className="recovered-draft">
                      <h3>Unsent draft</h3>
                      <p className="preserve-whitespace">{removedDraft}</p>
                      <button onClick={() => void navigator.clipboard.writeText(removedDraft)}>
                        Copy draft
                      </button>
                      <button onClick={() => setRemovedDraft('')}>Dismiss</button>
                    </section>
                  )}
                </Transcript>
              )}
            </div>
            {!pickingAgents && (
              <>
                {showLatest && (
                  <button className="jump-latest" onClick={jumpToLatest}>
                    ↓ Latest messages
                  </button>
                )}
                {approvals.length > 0 && (
                  <button className="approval-nudge" onClick={() => setDetails(true)}>
                    Approval needed · Review
                  </button>
                )}
                <div className="composer">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void send();
                    }}
                  >
                    <textarea
                      ref={composer}
                      rows={1}
                      aria-label="Message"
                      placeholder={selection ? `Message ${title}` : 'Choose a conversation'}
                      value={draft}
                      disabled={!selection || busy || blocked}
                      maxLength={16000}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        if (selected.current)
                          drafts.current.set(draftKey(selected.current), e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                    />
                    {running ? (
                      <button
                        type="button"
                        className="stop-button"
                        aria-label={stopping ? 'Stopping' : 'Stop'}
                        disabled={stopping || blocked}
                        onClick={() => void stop()}
                      >
                        <span />
                        {stopping && 'Stopping…'}
                      </button>
                    ) : (
                      <button
                        className="send-button"
                        aria-label="Send message"
                        disabled={!selection || !draft.trim() || busy || blocked}
                      >
                        <Icon name="send" />
                      </button>
                    )}
                  </form>
                </div>
              </>
            )}
          </>
        )}
      </section>
      <aside className="details-panel">{!settings && detailsContent}</aside>
      {details && (
        <Drawer title="details" onClose={closeDetails}>
          {detailsContent}
        </Drawer>
      )}
      {review && (
        <Drawer title="Review deletion" onClose={closeReview}>
          <RequestReview
            request={review}
            busy={reviewBusy}
            onDecision={(a, c) => void decideReview(a, c)}
            onInspect={() =>
              void client
                .invoke('requests.reconcile', { id: review.id })
                .then((r) => setError(text(object(r).message)))
                .catch(fail)
            }
          />
        </Drawer>
      )}
    </main>
  );
}
