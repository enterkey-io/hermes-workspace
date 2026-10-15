import type { ReactNode } from 'react';
import type { ChatBot } from './Rail';
import { PebbleAvatar, CrewAvatar } from './Rail';
import type { WorkspaceState } from '../workspace';
import type { BotBridgeClient } from '@hermes-client/protocol';
import type { Row } from '../conversation';
export function Inspector({
  bot,
  room,
  workspace,
  client,
  activity,
  routines,
  children,
  pending,
  onToggle,
  onEdit,
}: {
  bot?: ChatBot | undefined;
  room?: Row | undefined;
  workspace?: WorkspaceState | undefined;
  client: BotBridgeClient;
  activity: string;
  routines: Row[];
  children: ReactNode;
  pending: string;
  onToggle: (r: Row) => void;
  onEdit: () => void;
}) {
  const identity = workspace?.bots.find((b) => b.profile === bot?.profile);
  return (
    <>
      <div className="identity-summary">
        {bot ? (
          <PebbleAvatar bot={bot} workspace={workspace} client={client} large />
        ) : room ? (
          <CrewAvatar room={room} workspace={workspace} client={client} />
        ) : null}
        <h2>{bot?.name ?? String(room?.name ?? 'Details')}</h2>
        {identity?.role.title && <p>{identity.role.title}</p>}
        {identity && <span className="handle">@{identity.handle}</span>}
        {identity && (
          <button className="text-button" onClick={onEdit}>
            Edit pebble
          </button>
        )}
      </div>
      <div className="inspector-body">
        <p className="live-activity" role="status">
          {activity}
        </p>
        {children}
        {bot && (
          <>
            <h3>Routines</h3>
            <div className="routine-list">
              {routines.map((r) => {
                const id = String(r.id ?? r.job_id ?? '');
                const enabled = r.enabled !== false && r.paused !== true && r.state !== 'paused';
                return (
                  <div className="routine" key={id}>
                    <div>
                      <strong>{String(r.name ?? 'Routine')}</strong>
                      <p>{String(r.schedule_display ?? r.schedule ?? '')}</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${enabled ? 'Pause' : 'Resume'} ${String(r.name ?? 'routine')}`}
                      className="routine-switch"
                      disabled={!!pending}
                      onClick={() => onToggle(r)}
                    >
                      <span />
                    </button>
                  </div>
                );
              })}
              {!routines.length && <p className="empty-note">No routines yet.</p>}
            </div>
          </>
        )}
        {identity?.role.description && (
          <section className="role-description">
            <h3>About</h3>
            <p>{identity.role.description}</p>
          </section>
        )}
        {room && Array.isArray(room.members) && (
          <section className="role-description">
            <h3>Members</h3>
            {room.members.map((member, i) => {
              const m =
                typeof member === 'string'
                  ? member
                  : String(member.profile ?? member.profile_name ?? member.member_id ?? '');
              const b = workspace?.bots.find(
                (b) => b.profile === m || (m === 'hermes' && b.profile === 'default'),
              );
              return <p key={i}>{b?.name ?? m}</p>;
            })}
          </section>
        )}
      </div>
    </>
  );
}
