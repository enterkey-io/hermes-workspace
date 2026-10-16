import { useEffect, useState } from 'react';
import type { BotBridgeClient } from '@hermes-client/protocol';
import { safeError } from '@hermes-client/core';
import type { WorkspaceState } from './workspace';
import { PageHeader, Notice } from './ui/primitives';
export function CrewEditor({
  client,
  state,
  crewId,
  onClose,
  onDone,
  onDirtyChange,
}: {
  client: BotBridgeClient;
  state: WorkspaceState;
  crewId?: string | undefined;
  onClose: () => void;
  onDone: () => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const crew = state.teams.find((t) => t.id === crewId);
  const [name, setName] = useState(crew?.name ?? ''),
    [members, setMembers] = useState(
      state.bots.filter((b) => crewId && b.team === crewId).map((b) => b.profile),
    ),
    [query, setQuery] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [chat, setChat] = useState(false);
  const original = JSON.stringify(
    state.bots
      .filter((b) => crewId && b.team === crewId)
      .map((b) => b.profile)
      .sort(),
  );
  const dirty = name !== (crew?.name ?? '') || JSON.stringify([...members].sort()) !== original;
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  const [operationId] = useState(() => crypto.randomUUID());
  const [expectedRevision] = useState(state.revision);
  async function save(remove = false) {
    setBusy(true);
    setError('');
    try {
      if (chat && !remove) {
        await client.invoke('room.create', { room_id: operationId, name, profiles: members });
        await onDone();
        return;
      }
      const result = (await client.invoke('crews.save', {
        id: crewId ?? operationId,
        name,
        members: remove ? [] : members,
        remove,
        operation_id: operationId,
        expected_revision: expectedRevision,
      })) as { state: string };
      if (result.state !== 'completed') {
        setError(
          'Only part of this change was confirmed. Close and reopen the crew to review the saved membership.',
        );
        return;
      }
      await onDone();
    } catch (e) {
      setError(safeError(e).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="crew-editor">
      <PageHeader
        title={chat ? 'New group chat' : crew ? 'Edit crew' : 'New crew'}
        onClose={onClose}
      />
      {error && <Notice error>{error}</Notice>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label>
          Name
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>
        <label>
          Members
          <input
            type="search"
            placeholder="Find a pebble"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="selection-list" role="region" aria-label="Crew members">
          {state.bots
            .filter(
              (b) =>
                b.enrolled &&
                b.available !== false &&
                `${b.name} ${b.handle}`.toLowerCase().includes(query.toLowerCase()),
            )
            .map((b) => (
              <label className="selection-row" key={b.id}>
                <input
                  type="checkbox"
                  checked={members.includes(b.profile)}
                  onChange={(e) =>
                    setMembers(
                      e.target.checked
                        ? [...members, b.profile]
                        : members.filter((p) => p !== b.profile),
                    )
                  }
                />
                <span>
                  <strong>{b.name}</strong>
                  <small>
                    {b.team && b.team !== crewId
                      ? `Moves from ${state.teams.find((t) => t.id === b.team)?.name ?? 'another crew'}`
                      : `@${b.handle}`}
                  </small>
                </span>
              </label>
            ))}
        </div>
        <div className="form-actions">
          {crew && !chat && (
            <button
              type="button"
              className="danger-text"
              disabled={busy}
              onClick={() => void save(true)}
            >
              Remove crew
            </button>
          )}
          <button
            className="primary"
            disabled={busy || (chat && (members.length < 2 || members.length > 6))}
          >
            {busy ? 'Saving…' : chat ? 'Create group chat' : crew ? 'Save crew' : 'Create crew'}
          </button>
        </div>
        {crew && (
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              setChat(!chat);
              setError('');
            }}
          >
            {chat ? '← Crew organization' : 'Start a group chat'}
          </button>
        )}
        {chat && (
          <p className="field-hint">
            Choose 2–6 pebbles. This creates a separate conversation with these participants.
          </p>
        )}
      </form>
    </section>
  );
}
