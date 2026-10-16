import { useEffect, useRef, useState } from 'react';
import type { BotBridgeClient } from '@hermes-client/protocol';

type Agent = {
  profile: string;
  name: string;
  description: string;
  managed: boolean;
  canonical: boolean;
};

export function AgentPicker({
  client,
  onDone,
  onClose,
  connected,
}: {
  client: BotBridgeClient;
  onDone: () => Promise<void>;
  onClose: () => void;
  connected: boolean;
}) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    search.current?.focus();
    return () => {
      live.current = false;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    setError('');
    setChosen([]);
    try {
      const result = (await client.invoke('agents.list', {})) as { agents?: unknown };
      if (!Array.isArray(result?.agents) || result.agents.length > 10000)
        throw new Error('Invalid roster');
      const found = result.agents.map((value: unknown) => {
        if (!value || typeof value !== 'object') throw new Error('Invalid agent');
        const row = value as Record<string, unknown>;
        if (typeof row.profile !== 'string' || typeof row.name !== 'string')
          throw new Error('Invalid agent');
        return {
          profile: row.profile,
          name: row.name,
          description: typeof row.description === 'string' ? row.description : '',
          managed: row.managed === true,
          canonical: row.canonical === true,
        };
      });
      if (live.current) setAgents(found);
    } catch {
      if (live.current)
        setError('Could not load your Hermes agents. Check the connection and refresh.');
    } finally {
      if (live.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (client.supportsExistingAgents) void refresh();
    else setLoading(false);
  }, [client]);

  async function add() {
    if (working || loading || error || !connected || !chosen.length) return;
    setWorking(true);
    try {
      for (const profile of chosen) {
        if (!live.current) return;
        await client.invoke('agent.enable', { profile, initialize_chat: true });
      }
      if (live.current) await onDone();
    } catch {
      if (live.current)
        setError(
          'Could not confirm every agent was added. Refresh this list to see what completed before trying again. No new profile or replacement personality is created.',
        );
    } finally {
      if (live.current) setWorking(false);
    }
  }

  const filter = query.trim().toLocaleLowerCase();
  const visible = agents.filter((agent) =>
    `${agent.name} ${agent.profile} ${agent.description}`.toLocaleLowerCase().includes(filter),
  );

  return (
    <section className="agent-picker" aria-labelledby="agent-picker-title">
      <div className="agent-picker-heading">
        <div>
          <h2 id="agent-picker-title">Add existing pebbles</h2>
        </div>
        <button onClick={onClose} disabled={working}>
          Close
        </button>
      </div>
      <p className="field-hint">
        Choose existing Hermes agents. Their personality and memory stay with them.
      </p>
      {!client.supportsExistingAgents ? (
        <p role="status">
          Your integration needs an update to add existing agents here. Your current bots can still
          be used. <a href="/install">Agent update instructions</a>
        </p>
      ) : (
        <>
          {loading && <p role="status">Loading your Hermes agents…</p>}
          {!loading && !agents.length && !error && (
            <p>
              No existing profiles were returned by this Hermes connection. Check which Hermes home
              the integration uses. Setup will not create a placeholder agent.
            </p>
          )}
          <label className="agent-search">
            <span>Find a pebble</span>
            <input
              ref={search}
              type="search"
              placeholder="Search pebbles…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <p className="agent-result-count" role="status">
            {loading
              ? 'Loading…'
              : `${visible.length} of ${agents.length} agents${chosen.length ? ` · ${chosen.length} selected` : ''}`}
          </p>
          <div
            className="agent-options"
            role="region"
            aria-label="Available Hermes agents"
            tabIndex={0}
          >
            {!loading && !!agents.length && !visible.length && <p>No agents match your search.</p>}
            {visible.map((agent) => {
              const ready = agent.managed && agent.canonical;
              return (
                <label className="agent-option" key={agent.profile}>
                  <input
                    type="checkbox"
                    checked={ready || chosen.includes(agent.profile)}
                    disabled={ready || working || loading || !connected}
                    onChange={(event) =>
                      setChosen((old) =>
                        event.target.checked
                          ? [...old, agent.profile]
                          : old.filter((profile) => profile !== agent.profile),
                      )
                    }
                  />
                  <span>
                    <strong>{agent.name}</strong>
                    <small>{agent.description || agent.profile}</small>
                  </span>
                  <small>
                    {ready ? 'Added' : agent.canonical ? 'Existing Bot Chat' : 'Not added'}
                  </small>
                </label>
              );
            })}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="agent-picker-actions">
            <button onClick={() => void refresh()} disabled={working || loading || !connected}>
              Refresh pebbles
            </button>
            <button
              className="primary"
              onClick={() => void add()}
              disabled={!chosen.length || working || loading || !!error || !connected}
            >
              {working
                ? 'Adding selected agents…'
                : `Add selected pebbles${chosen.length ? ` (${chosen.length})` : ''}`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
