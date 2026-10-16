import { safeError } from '@hermes-client/core';
import { useEffect, useRef, useState } from 'react';
import type { BotBridgeClient } from '@hermes-client/protocol';
import { workspaceState } from './workspace';
import type { WorkspaceState, WorkspaceBot } from './workspace';
import { OwnerAccount } from './OwnerAccount';
import { ConnectionCard } from './ConnectionCard';
import { RequestReview } from './chat/RequestReview';
import { PebbleEditor } from './PebbleEditor';
import { PageHeader, Notice, FormSection, Tabs } from './ui/primitives';
type Row = Record<string, unknown>;
export function WorkspaceSettings({
  client,
  state,
  onChange,
  onClose,
  owner = false,
  initialTab = 'account',
  initialProfile,
  onDirtyChange,
}: {
  onDirtyChange: (dirty: boolean) => void;
  owner?: boolean;
  initialTab?: 'agents' | 'requests' | 'connections' | 'account';
  initialProfile?: string | undefined;
  client: BotBridgeClient;
  state: WorkspaceState;
  onChange: (s: WorkspaceState) => void;
  onClose: () => void;
}) {
  const originalEditor = useRef<WorkspaceBot | undefined>(
    state.bots.find((b) => b.profile === initialProfile),
  );
  const [tab, setTab] = useState(
    initialTab === 'agents'
      ? 'agents'
      : !owner && initialTab === 'account'
        ? 'connections'
        : initialTab,
  );
  const [profile, setProfile] = useState(
    initialProfile ?? state.orchestrator ?? state.bots[0]?.profile ?? '',
  );
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<Row[]>([]),
    [servers, setServers] = useState<Row[]>([]),
    [catalog, setCatalog] = useState<Row[]>([]);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    setError('');
    setNotice('');
    if (tab === 'requests') {
      setLoading(true);
      const load = async () => {
        try {
          const data = (await client.invoke('requests.list', {})) as { requests: Row[] };
          if (live) {
            setRequests(data.requests);
            setLoading(false);
          }
        } catch {
          if (live) {
            setError('Requests could not be loaded.');
            setLoading(false);
          }
        } finally {
          if (live) timer = setTimeout(() => void load(), 5000);
        }
      };
      void load();
    } else if (tab === 'connections' && profile) {
      setServers([]);
      setCatalog([]);
      setLoading(true);
      void Promise.all([
        client.invoke('connections.list', { profile }),
        client.invoke('services.catalog', { profile }),
      ])
        .then(([a, b]) => {
          if (!live) return;
          const list = (a as { servers: Row[] }).servers,
            recipes = (b as { servers: Row[] }).servers;
          if (!Array.isArray(list) || !Array.isArray(recipes)) throw new Error();
          setServers(list);
          setCatalog(recipes);
        })
        .catch(() => {
          if (live) setError('Connections could not be loaded.');
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    } else setLoading(false);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [client, tab, profile, refresh]);
  async function decide(r: Row, approve: boolean, confirmation?: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = (await client.invoke(approve ? 'requests.approve' : 'requests.deny', {
        id: r.id,
        fingerprint: r.fingerprint,
        ...(confirmation == null ? {} : { confirmation }),
      })) as Row;
      onChange(workspaceState(await client.invoke('workspace.describe', {})));
      setNotice(
        result.state === 'completed'
          ? 'Change completed.'
          : result.state === 'denied'
            ? 'Request denied.'
            : `Request ${String(result.state)}. Review its outcome before retrying.`,
      );
      setRefresh((x) => x + 1);
    } catch (e) {
      setError(safeError(e).message);
    } finally {
      setBusy(false);
    }
  }
  if (tab === 'agents') {
    const current = state.bots.find((b) => b.profile === profile);
    const retired =
      !current || current.available === false || current.id !== originalEditor.current?.id;
    if (!retired) originalEditor.current = current;
    const bot = originalEditor.current;
    return bot ? (
      <PebbleEditor
        retired={retired}
        key={bot.id}
        client={client}
        bot={bot}
        state={state}
        onChange={onChange}
        onClose={onClose}
        onDirtyChange={onDirtyChange}
      />
    ) : (
      <section className="entity-page">
        <PageHeader title="Pebble unavailable" onClose={onClose} />
        <Notice>This pebble is no longer available.</Notice>
      </section>
    );
  }
  return (
    <section className="settings-panel entity-page" aria-label="Settings">
      <PageHeader title="Settings" onClose={onClose} />
      <Tabs
        tabs={[
          ...(owner ? [{ id: 'account', label: 'Account' }] : []),
          { id: 'connections', label: 'Connections' },
          { id: 'requests', label: 'Requests' },
        ]}
        value={tab}
        onChange={(id) => setTab(id as typeof tab)}
      >
        {error && (
          <Notice error>
            {error}{' '}
            <button className="text-button" onClick={() => setRefresh((x) => x + 1)}>
              Try again
            </button>
          </Notice>
        )}
        {notice && <Notice>{notice}</Notice>}
        {loading && <Notice>Loading…</Notice>}
        {tab === 'account' && owner && <OwnerAccount />}
        {tab === 'requests' && !loading && (
          <>
            {!requests.length && !error && (
              <div className="ui-empty">
                <h2>No requests</h2>
                <p>Changes proposed by your pebbles appear here.</p>
              </div>
            )}
            {requests.map((r) => (
              <RequestReview
                key={String(r.id)}
                request={r}
                busy={busy}
                onDecision={(a, c) => void decide(r, a, c)}
                onInspect={() => {
                  void client
                    .invoke('requests.reconcile', { id: r.id })
                    .then((value) => setNotice(String((value as Row).message)))
                    .catch((e) => setError(safeError(e).message));
                }}
              />
            ))}
          </>
        )}
        {tab === 'connections' && (
          <>
            <label className="scope-field">
              Pebble
              <select value={profile} onChange={(e) => setProfile(e.target.value)}>
                {state.bots
                  .filter((b) => b.available !== false)
                  .map((b) => (
                    <option key={b.id} value={b.profile}>
                      {b.name} · @{b.handle}
                    </option>
                  ))}
              </select>
            </label>
            {!loading && !error && (
              <>
                <FormSection title="Connected services">
                  {!servers.length && (
                    <p className="empty-note">No services connected to this pebble.</p>
                  )}
                  {servers.map((s) => (
                    <ConnectionCard
                      key={`${profile}:${String(s.name)}`}
                      client={client}
                      profile={profile}
                      server={s}
                    />
                  ))}
                </FormSection>
                <FormSection title="Add a connection">
                  <div className="service-grid">
                    {catalog.map((s) => (
                      <article className="service-card" key={String(s.name)}>
                        <div>
                          <h3>{String(s.name)}</h3>
                          <p>{String(s.description ?? '')}</p>
                        </div>
                        {['http', 'sse', 'streamable-http'].includes(String(s.transport)) ||
                        s.installed ? (
                          <button
                            disabled={busy || servers.some((x) => x.name === s.name)}
                            onClick={async () => {
                              const target = profile;
                              setBusy(true);
                              setError('');
                              try {
                                await client.invoke('connections.add', {
                                  profile: target,
                                  recipe: s.name,
                                  name: s.name,
                                  expected_revision: state.revision,
                                });
                                setRefresh((x) => x + 1);
                              } catch {
                                setError(
                                  'This service needs setup in Hermes before it can be added.',
                                );
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            {servers.some((x) => x.name === s.name) ? 'Added' : 'Add service'}
                          </button>
                        ) : (
                          <span className="field-hint">Set up in Hermes first</span>
                        )}
                      </article>
                    ))}
                  </div>
                  {!catalog.length && (
                    <p className="empty-note">No additional services available.</p>
                  )}
                </FormSection>
              </>
            )}
          </>
        )}
      </Tabs>
    </section>
  );
}
