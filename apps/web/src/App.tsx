import { useEffect, useRef, useState } from 'react';
import { normalizeEndpoint, safeError } from '@hermes-client/core';
import { BotBridgeClient } from '@hermes-client/protocol';
import type { BridgeEvent } from '@hermes-client/protocol';
import { FirstRun } from './FirstRun';

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

export function App() {
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
  const [stream, setStream] = useState('');
  const [activity, setActivity] = useState('Ready');
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [streamState, setStreamState] = useState<'opening' | 'live' | 'lost'>('opening');
  const [error, setError] = useState('');
  const [nav, setNav] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  function fail(error: unknown) {
    setError(safeError(error).message);
  }
  function disconnect() {
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
  }
  useEffect(() => () => current.current?.disconnect(), []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages, stream]);

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
    const target = selected.current;
    if (event.type === 'bridge.resync') {
      setBlocked(true);
      setStreamState('lost');
      setActivity('Live updates disconnected');
      setError('Event continuity was lost. Disconnect and reconnect before sending again.');
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
      await connection.connect();
      await loadRoster(connection);
      if (current.current !== connection) return;
      setClient(connection);
      const established = connection;
      void connection
        .events((event) => {
          void receive(established, event).catch(fail);
        })
        .catch((error) => {
          if (current.current === established) {
            setBlocked(true);
            setStreamState('lost');
            setActivity('Live updates disconnected');
            setError(
              `Browser access was approved and the bot list loaded, but live updates stopped (${safeError(error).code}). Your Hermes agent needs to check the /v1/events stream through your connection route. Disconnect and reconnect before sending again.`,
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
    try {
      const data = object(await client.invoke('bot.open', { profile: bot.profile }));
      if (generation !== selectGeneration.current || current.current !== client) return;
      const target: Selection = { kind: 'bot', bot, sessionId: text(data.session_id) };
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
      if (generation === selectGeneration.current) setBusy(false);
    }
  }

  function openRoom(room: Row) {
    selectGeneration.current++;
    const target: Selection = { kind: 'room', room };
    selected.current = target;
    setSelection(target);
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
      if (owns()) setDraft('');
    } catch (error) {
      if (current.current === connection) setBlocked(true);
      if (owns())
        setError(
          `${safeError(error).message} The send outcome is uncertain. Reconnect and inspect history before another send.`,
        );
    } finally {
      if (generation === selectGeneration.current && current.current === connection) setBusy(false);
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
      <p className="native-note">
        Your bots use Hermes’s native tools and teammate messaging. Hermes owns execution and
        memory.
      </p>
    </>
  );

  if (!client) return <FirstRun onConnect={connect} />;

  const title =
    selection?.kind === 'bot'
      ? selection.bot.name
      : selection?.kind === 'room'
        ? text(selection.room.name)
        : 'Your workspace';
  return (
    <main className="workspace">
      <aside className={`sidebar ${nav ? 'visible' : ''}`}>
        <div className="wordmark">Workspace</div>
        <p className="section-label">
          YOUR BOTS <span>{bots.length}</span>
        </p>
        <nav aria-label="Bots">
          {bots.map((bot) => (
            <button
              key={bot.profile}
              className={
                selection?.kind === 'bot' && selection.bot.profile === bot.profile
                  ? 'selected bot'
                  : 'bot'
              }
              onClick={() => void open(bot)}
              disabled={busy || streamState !== 'live' || !bot.canonical}
            >
              <span className="avatar" aria-hidden>
                {bot.name.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>{bot.name}</strong>
                <small>
                  {!bot.canonical ? 'Bot Chat needs setup' : bot.description || 'Bot Chat'}
                </small>
              </span>
            </button>
          ))}
        </nav>
        {!bots.length && (
          <p className="empty-note">
            Hermes returned no managed bots. Ask your agent to finish Bot Mode setup.
          </p>
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
          <button onClick={disconnect}>Disconnect</button>
        </div>
      </aside>
      <section className="conversation">
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
            {error || 'Event continuity was lost. Disconnect and reconnect before sending again.'}
            {streamState === 'lost' && (
              <button onClick={disconnect}>Disconnect and reconnect</button>
            )}
          </div>
        )}
        <div className="transcript" role="log" aria-live="polite">
          {!selection && (
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
                    {streamState === 'lost' ? 'Live updates are disconnected.' : 'Connecting…'}
                  </h2>
                  <p>
                    {streamState === 'lost'
                      ? 'Pairing and the initial lists worked. The live connection needs to work before you can chat.'
                      : 'Browser access is approved. Waiting for the live connection before you can chat.'}
                  </p>
                </>
              ) : !rooms.length && !bots.some((bot) => bot.canonical) ? (
                <>
                  <h2>{bots.length ? 'Your bots need a Bot Chat.' : 'Set up your first bot.'}</h2>
                  <p>
                    {bots.length
                      ? 'Hermes returned your bots, but their native Bot Chats are not initialized.'
                      : 'The connection works. Hermes returned no bots managed by Bot Mode; ordinary agent profiles may still exist.'}
                  </p>
                  <p>
                    Send your Hermes agent: “Finish native Bot Mode setup for this web app. Check
                    the Hermes home used by the bridge. Reuse my managed bots, or create one starter
                    bot if none exist, using my existing model settings. Initialize its native Bot
                    Chat without sending a model prompt, preserve existing chats, and verify it
                    appears in the bridge roster.”
                  </p>
                  <p>When your agent finishes, select Refresh bots.</p>
                  <a href="/install">Agent setup instructions</a>
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
          )}
          {selection && !messages.length && !stream && (
            <p className="empty-chat">Your conversation is ready.</p>
          )}
          {messages.map((message, i) => (
            <article key={i} className={`message ${message.role}`}>
              <small>
                {message.role === 'user' ? 'You' : message.role === 'tool' ? 'Tool' : title}
              </small>
              <p>{message.text}</p>
            </article>
          ))}
          {stream && (
            <article className="message assistant">
              <small>{title}</small>
              <p>
                {stream}
                <span className="caret" aria-hidden>
                  ▍
                </span>
              </p>
            </article>
          )}
          <div ref={bottom} />
        </div>
        <details className="compact-details" open={approvals.length > 0 ? true : undefined}>
          <summary>Activity & routines{approvals.length ? ' · Approval needed' : ''}</summary>
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
              aria-label="Message"
              placeholder={selection ? `Message ${title}…` : 'Choose a bot or room to begin'}
              value={draft}
              disabled={!selection || busy || blocked}
              maxLength={16000}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
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
                disabled={!selection || !draft.trim() || busy || running || blocked}
                aria-label="Send message"
              >
                ↑
              </button>
            </div>
          </form>
          <p className="composer-note">Direct connection · History lives on your server</p>
        </div>
      </section>
      <aside className="details-panel">{detailsContent}</aside>
    </main>
  );
}
