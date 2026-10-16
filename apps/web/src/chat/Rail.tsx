import { useLayoutEffect, useRef, useState } from 'react';
import { AgentAvatar } from '../AgentAvatar';
import { Icon } from './Icon';
import { Menu } from '../ui/primitives';
import type { MenuItem } from '../ui/primitives';
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
      revision={workspace?.revision}
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
              <AgentAvatar
                id={b.id}
                look={b.appearance}
                client={client}
                profile={profile}
                revision={workspace?.revision}
              />
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
  onNewCrew,
  onEditCrew,
  onEdit,
  pendingPins,
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
  onNewCrew: () => void;
  onEditCrew: (id: string) => void;
  onEdit: (profile: string) => void;
  pendingPins: Record<string, boolean>;
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
  const motion = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    motion.current?.querySelectorAll<HTMLElement>('[data-motion-id]').forEach((node) => {
      const id = node.dataset.motionId!,
        bounds = node.getBoundingClientRect(),
        previous = positions.current.get(id);
      next.set(id, bounds);
      if (
        previous &&
        !reduce &&
        (Math.abs(previous.x - bounds.x) > 1 ||
          Math.abs(previous.y - bounds.y) > 1 ||
          previous.width !== bounds.width)
      ) {
        node.getAnimations().forEach((a) => a.cancel());
        node.animate(
          [
            {
              transform: `translate(${previous.x - bounds.x}px,${previous.y - bounds.y}px) scale(${previous.width / bounds.width})`,
              transformOrigin: 'top left',
            },
            { transform: 'none', transformOrigin: 'top left' },
          ],
          { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
        );
      }
    });
    positions.current = next;
  }, [
    bots,
    workspace?.revision,
    pinOrder.join(','),
    JSON.stringify(pendingPins),
    query,
    search,
    hidden,
  ]);
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
    if (!row) return null;
    const items: MenuItem[] = [
      {
        label: pinned(b) ? 'Unpin' : 'Pin',
        action: () => onPin(row, !pinned(b)),
        disabled: !!pendingPins[row.id],
      },
      { label: 'Edit pebble', action: () => onEdit(b.profile) },
      { label: b.hidden ? 'Unhide' : 'Hide', action: () => onVisibility(row, !b.hidden) },
    ];
    if (b.profile !== 'default' && workspace?.orchestrator !== b.profile)
      items.push({ label: 'Delete…', action: () => onDelete(row), danger: true });
    if (position != null && position > 0)
      items.push({
        label: 'Move earlier',
        action: () => {
          const ids = pins.map((p) => identity(p)!.id);
          [ids[position - 1], ids[position]] = [ids[position]!, ids[position - 1]!];
          onOrder(ids);
        },
      });
    return (
      <Menu className="pebble-menu" label={`Actions for ${b.name}`} items={items}>
        <span aria-hidden>···</span>
      </Menu>
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
        <Menu
          label="New"
          disabled={!online}
          items={[
            { label: 'New pebble', action: onAdd },
            { label: 'New crew', action: onNewCrew },
          ]}
        >
          <Icon name="plus" />
        </Menu>
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
      <div className="rail-scroll" ref={motion}>
        <nav aria-label="Pebbles">
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
                    <span className="motion-avatar" data-motion-id={identity(b)?.id}>
                      {avatar(b, true)}
                    </span>
                    <strong>{b.name}</strong>
                    {pendingPins[identity(b)?.id ?? ''] && (
                      <span className="pin-saving" role="status">
                        Saving…
                      </span>
                    )}
                    {identity(b)?.role.title && (
                      <span className="role-chip">{identity(b)?.role.title}</span>
                    )}
                    {identity(b)?.unread && (
                      <>
                        <span className="unread-dot" aria-hidden />
                        <span className="sr-only">Unread messages</span>
                      </>
                    )}
                  </button>
                  {controls(b, i)}
                </div>
              ))}
            </div>
          )}
          {sections.map((section) => {
            const members = regular.filter((b) => (identity(b)?.team ?? null) === section.id);
            return (
              (members.length > 0 || section.id != null) && (
                <section key={section.id ?? 'unsectioned'} className="rail-section">
                  <div className="crew-heading">
                    <h2>{section.name}</h2>
                    {section.id && (
                      <Menu
                        label={`Actions for ${section.name}`}
                        items={[{ label: 'Edit crew', action: () => onEditCrew(section.id!) }]}
                      >
                        <span aria-hidden>···</span>
                      </Menu>
                    )}
                  </div>
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
                        <span className="motion-avatar" data-motion-id={identity(b)?.id}>
                          {avatar(b)}
                        </span>
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
                        {identity(b)?.unread && (
                          <>
                            <span className="unread-dot" aria-hidden />
                            <span className="sr-only">Unread messages</span>
                          </>
                        )}
                      </button>
                      {controls(b)}
                    </div>
                  ))}
                </section>
              )
            );
          })}
        </nav>
        <nav aria-label="Group chats" className="rail-section">
          {rooms.length > 0 && <h2>Group chats</h2>}
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
                {r.unread === true && (
                  <>
                    <span className="unread-dot" aria-hidden />
                    <span className="sr-only">Unread messages</span>
                  </>
                )}
              </button>
            ))}
        </nav>
        {!all.length && (
          <div className="rail-empty">
            <p>No pebbles yet.</p>
            <button onClick={onAdd}>Add existing agents</button>
          </div>
        )}
        {!pins.length &&
          !regular.length &&
          !rooms.some((r) =>
            String(r.name ?? '')
              .toLowerCase()
              .includes(query.toLowerCase()),
          ) &&
          all.length > 0 && <p className="empty-note">No matches.</p>}
      </div>
      <footer className="rail-footer">
        <Menu
          className="owner-menu"
          label="Your account"
          upward
          items={[
            ...(workspace
              ? [
                  { label: 'Settings', action: onSettings },
                  { label: 'Show hidden', checked: hidden, action: () => setHidden(!hidden) },
                ]
              : []),
            { label: owner ? 'Sign out' : 'Disconnect', action: onLogout },
          ]}
        >
          <span className="owner-mark" aria-hidden>
            <Icon name="account" />
          </span>
        </Menu>
        <span className={`connection-dot ${online ? 'live' : 'lost'}`} aria-hidden />
        <span className="connection-label">{online ? 'Hermes connected' : 'Reconnecting…'}</span>
      </footer>
    </>
  );
}
