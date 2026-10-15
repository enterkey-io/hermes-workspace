import { useRef, useState } from 'react';
import { AgentAvatar } from '../AgentAvatar';
import { Icon } from './Icon';
import type { WorkspaceState, WorkspaceBot } from '../workspace';
import type { BotBridgeClient } from '@hermes-client/protocol';
import type { Activity } from '../avatar-lab/engine';
import type { Row } from '../conversation';
export type ChatBot = {
  profile: string;
  name: string;
  description: string;
  canonical: boolean;
  id?: string;
  preview?: string;
  hidden?: boolean;
};
export function PebbleAvatar({
  bot,
  workspace,
  client,
  state,
  large,
}: {
  bot: ChatBot;
  workspace?: WorkspaceState | undefined;
  client: BotBridgeClient;
  state?: Activity | undefined;
  large?: boolean | undefined;
}) {
  const identity = workspace?.bots.find((b) => b.profile === bot.profile);
  return identity ? (
    <AgentAvatar
      id={identity.id}
      profile={bot.profile}
      client={client}
      look={identity.appearance}
      orchestrator={workspace?.orchestrator === bot.profile}
      state={state ?? 'ready'}
      large={large ?? false}
    />
  ) : (
    <span className="avatar">{bot.name.slice(0, 1)}</span>
  );
}
export function CrewAvatar({
  room,
  workspace,
  client,
}: {
  room: Row;
  workspace?: WorkspaceState | undefined;
  client: BotBridgeClient;
}) {
  const members = Array.isArray(room.members) ? room.members : [];
  const profiles = members
    .map((m) =>
      typeof m === 'string' ? m : String(m.profile ?? m.profile_name ?? m.member_id ?? ''),
    )
    .map((p) => (p === 'hermes' ? 'default' : p));
  return (
    <span className="crew-stack" aria-label={`${members.length} members`}>
      {profiles.slice(0, 3).map((profile, i) => {
        const b = workspace?.bots.find((b) => b.profile === profile);
        return (
          <span key={`${profile}-${i}`} style={{ left: `${i * 9}px`, top: `${(i % 2) * 12}px` }}>
            {b ? (
              <AgentAvatar id={b.id} look={b.appearance} client={client} profile={profile} />
            ) : (
              <span className="crew-member-placeholder">{i + 1}</span>
            )}
          </span>
        );
      })}
      {!members.length && <span className="crew-member-placeholder">#</span>}
      {members.length > 3 && <small>+{members.length - 3}</small>}
    </span>
  );
}
export function Rail({
  bots,
  rooms,
  workspace,
  client,
  selected,
  states,
  online,
  pinOrder,
  onOpen,
  onRoom,
  onAdd,
  onSettings,
  onPin,
  onVisibility,
  onDelete,
  onOrder,
  onLogout,
  owner,
  onClose,
}: {
  bots: ChatBot[];
  rooms: Row[];
  workspace?: WorkspaceState | undefined;
  client: BotBridgeClient;
  selected?: string | undefined;
  states: Record<string, Activity>;
  online: boolean;
  pinOrder: string[];
  onOpen: (b: ChatBot) => void;
  onRoom: (r: Row) => void;
  onAdd: () => void;
  onSettings: () => void;
  onPin: (b: WorkspaceBot, pinned: boolean) => void;
  onVisibility: (b: WorkspaceBot, hidden: boolean) => void;
  onDelete: (b: WorkspaceBot) => void;
  onOrder: (ids: string[]) => void;
  onLogout: () => void;
  owner: boolean;
  onClose?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(false);
  const [hidden, setHidden] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const identity = (b: ChatBot) => workspace?.bots.find((a) => a.profile === b.profile);
  const pinned = (b: ChatBot) => {
    const row = identity(b);
    return row?.pinned || (!row?.pin_configured && workspace?.orchestrator === b.profile);
  };
  const matches = (b: ChatBot) =>
    `${b.name} ${identity(b)?.handle ?? ''} ${identity(b)?.role.title ?? ''}`
      .toLowerCase()
      .includes(query.toLowerCase());
  const all =
    hidden && workspace
      ? [
          ...bots,
          ...workspace.bots.filter(
            (b) => b.managed && b.hidden && !bots.some((a) => a.profile === b.profile),
          ),
        ]
      : bots;
  const pins = all
    .filter((b) => !b.hidden && pinned(b) && matches(b))
    .sort((a, b) => {
      const ai = pinOrder.indexOf(identity(a)?.id ?? ''),
        bi = pinOrder.indexOf(identity(b)?.id ?? '');
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
  const regular = all.filter((b) => (hidden || !b.hidden) && !pins.includes(b) && matches(b));
  const sections = [{ id: null, name: 'Pebbles' }, ...(workspace?.teams ?? [])];
  const avatar = (b: ChatBot, large = false) => (
    <PebbleAvatar
      bot={b}
      workspace={workspace}
      client={client}
      state={states[b.profile]}
      large={large}
    />
  );
  const controls = (b: ChatBot, position?: number) => {
    const row = identity(b);
    return (
      row && (
        <details className="pebble-menu">
          <summary aria-label={`Actions for ${b.name}`}>···</summary>
          <div>
            <button onClick={() => onPin(row, !pinned(b))}>{pinned(b) ? 'Unpin' : 'Pin'}</button>
            <button onClick={() => onVisibility(row, !b.hidden)}>
              {b.hidden ? 'Unhide' : 'Hide'}
            </button>
            {b.profile !== 'default' && workspace?.orchestrator !== b.profile && (
              <button className="danger-text" onClick={() => onDelete(row)}>
                Delete…
              </button>
            )}
            {position != null && position > 0 && (
              <button
                onClick={() => {
                  const ids = pins.map((p) => identity(p)!.id);
                  [ids[position - 1], ids[position]] = [ids[position]!, ids[position - 1]!];
                  onOrder(ids);
                }}
              >
                Move earlier
              </button>
            )}
          </div>
        </details>
      )
    );
  };
  return (
    <>
      <div className="rail-toolbar">
        <span className="sidebar-title">Pebble Crew</span>
        <button
          className="icon-button"
          aria-label="Search chats"
          onClick={() => {
            setSearch(!search);
            requestAnimationFrame(() => input.current?.focus());
          }}
        >
          <Icon name="search" />
        </button>
        <button
          className="icon-button"
          aria-label="Add existing agents"
          title="Add existing agents"
          onClick={onAdd}
          disabled={!online}
        >
          <Icon name="plus" />
        </button>
        {onClose && (
          <button className="icon-button" aria-label="Close navigation" onClick={onClose}>
            <Icon name="close" />
          </button>
        )}
      </div>
      {search && (
        <input
          ref={input}
          className="chat-search"
          aria-label="Search chats"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div className="rail-scroll">
        <nav aria-label="Bots">
          {!!pins.length && (
            <div className="pinned-pebbles">
              {pins.map((b, i) => (
                <div
                  className={`pinned-tile ${selected === b.profile ? 'active' : ''}`}
                  key={b.id ?? b.profile}
                >
                  <button
                    aria-label={`${b.name} Bot Chat`}
                    aria-current={selected === b.profile ? 'page' : undefined}
                    onClick={() => onOpen(b)}
                    disabled={!online}
                  >
                    {avatar(b, true)}
                    <strong>{b.name}</strong>
                    {identity(b)?.role.title && (
                      <span className="role-chip">{identity(b)?.role.title}</span>
                    )}
                    {identity(b)?.unread && <span className="unread-dot" />}
                  </button>
                  {controls(b, i)}
                </div>
              ))}
            </div>
          )}
          {sections.map((section) => {
            const members = regular.filter((b) => (identity(b)?.team ?? null) === section.id);
            return (
              members.length > 0 && (
                <section key={section.id ?? 'unsectioned'} className="rail-section">
                  <h2>{section.name}</h2>
                  {members.map((b) => (
                    <div
                      key={b.id ?? b.profile}
                      className={`pebble-row ${selected === b.profile ? 'active' : ''} ${b.hidden ? 'hidden-pebble' : ''}`}
                    >
                      <button
                        className="pebble-open"
                        aria-label={`${b.name} Bot Chat`}
                        aria-current={selected === b.profile ? 'page' : undefined}
                        disabled={!online || !!b.hidden}
                        onClick={() => onOpen(b)}
                      >
                        {avatar(b)}
                        <span className="pebble-copy">
                          <span className="pebble-heading">
                            <strong>{b.name}</strong>
                            {identity(b)?.role.title && (
                              <span className="role-chip">{identity(b)?.role.title}</span>
                            )}
                          </span>
                          <span className="chat-preview">
                            {b.hidden
                              ? 'Hidden'
                              : b.preview ||
                                identity(b)?.preview ||
                                (!b.canonical
                                  ? 'Set up Bot Chat'
                                  : identity(b)?.role.description ||
                                    b.description ||
                                    `@${identity(b)?.handle ?? b.profile}`)}
                          </span>
                        </span>
                        {identity(b)?.unread && <span className="unread-dot" />}
                      </button>
                      {controls(b)}
                    </div>
                  ))}
                </section>
              )
            );
          })}
        </nav>
        <nav aria-label="Rooms" className="rail-section">
          {rooms.length > 0 && <h2>Crews</h2>}
          {rooms
            .filter((r) =>
              String(r.name ?? '')
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((r) => (
              <button
                className={`crew-row ${selected === r.room_id ? 'active' : ''}`}
                key={String(r.room_id)}
                disabled={!online}
                onClick={() => onRoom(r)}
              >
                <CrewAvatar room={r} workspace={workspace} client={client} />
                <span className="pebble-copy">
                  <strong>{String(r.name ?? 'Crew')}</strong>
                  <span className="chat-preview">{String(r.preview ?? 'Group conversation')}</span>
                </span>
                {r.unread === true && <span className="unread-dot" />}
              </button>
            ))}
        </nav>
        {!all.length && (
          <div className="rail-empty">
            <p>No pebbles yet.</p>
            <button onClick={onAdd}>Add existing agents</button>
          </div>
        )}
        {!pins.length && !regular.length && all.length > 0 && (
          <p className="empty-note">No matches.</p>
        )}
      </div>
      <footer className="rail-footer">
        <div>
          <span className={`connection-dot ${online ? 'live' : 'lost'}`} />
          <span>{online ? 'Connected' : 'Reconnecting…'}</span>
          <button className="text-button" onClick={onLogout}>
            {owner ? 'Sign out' : 'Disconnect'}
          </button>
        </div>
        <div>
          {workspace && (
            <>
              <button onClick={onSettings}>
                <Icon name="settings" />
                Settings
              </button>
              <button
                className="text-button"
                aria-pressed={hidden}
                onClick={() => setHidden(!hidden)}
              >
                {hidden ? 'Hide hidden' : 'Show hidden'}
              </button>
            </>
          )}
        </div>
      </footer>
    </>
  );
}
