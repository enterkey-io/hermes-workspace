import { safeError } from '@hermes-client/core';
import { useEffect, useState } from 'react';
import type { BotBridgeClient } from '@hermes-client/protocol';
import { workspaceState } from './workspace';
import type { WorkspaceState, WorkspaceBot, Appearance, Role } from './workspace';
import { OwnerAccount } from './OwnerAccount';
import { ConnectionCard } from './ConnectionCard';
import { AvatarChooser } from './AgentAvatar';
type Row = Record<string, unknown>;
export function WorkspaceSettings({
  client,
  state,
  onChange,
  onClose,
  owner = false,
}: {
  owner?: boolean;
  client: BotBridgeClient;
  state: WorkspaceState;
  onChange: (s: WorkspaceState) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'agents' | 'teams' | 'requests' | 'connections' | 'account'>(
    'agents',
  );
  const [profile, setProfile] = useState(state.orchestrator ?? state.bots[0]?.profile ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [requests, setRequests] = useState<Row[]>([]);
  const [servers, setServers] = useState<Row[]>([]);
  const [catalog, setCatalog] = useState<Row[]>([]);
  const [teamName, setTeamName] = useState('');
  const bot = state.bots.find((b) => b.profile === profile);
  useEffect(() => {
    if (tab === 'requests')
      void client
        .invoke('requests.list', {})
        .then((d) => setRequests((d as { requests: Row[] }).requests))
        .catch(() => setError('Could not load requests.'));
    if (tab === 'connections' && profile) {
      setServers([]);
      setCatalog([]);
      void Promise.all([
        client.invoke('connections.list', { profile }),
        client.invoke('services.catalog', { profile }),
      ])
        .then(([a, b]) => {
          setServers((a as { servers: Row[] }).servers);
          setCatalog((b as { servers: Row[] }).servers);
        })
        .catch(() => setError('Could not load native connections.'));
    }
  }, [tab, profile, client]);
  async function mutate(operation: string, params: Row) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = (await client.invoke(operation, params)) as Row;
      onChange(workspaceState(await client.invoke('workspace.describe', {})));
      if (operation.startsWith('requests.')) {
        const updated = (await client.invoke('requests.list', {})) as { requests: Row[] };
        setRequests(updated.requests);
      }
      setNotice(
        result.state === 'partial'
          ? 'Part of this change was saved. Review the result before using the agent; do not submit the same creation again.'
          : result.state === 'uncertain'
            ? 'Hermes could not confirm the result. The request is recorded for review; do not submit the same creation again.'
            : result.state === 'denied'
              ? 'Request denied. No changes were applied.'
              : 'Saved on your Hermes.',
      );
    } catch (error) {
      setError(safeError(error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-panel" aria-label="Workspace settings">
      <header>
        <div>
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h1>Settings</h1>
        </div>
        <button onClick={onClose}>Done</button>
      </header>
      <nav className="settings-tabs">
        {(
          [
            'agents',
            'teams',
            'requests',
            'connections',
            ...(owner ? ['account' as const] : []),
          ] as const
        ).map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            onClick={() => {
              setTab(t);
              setError('');
              setNotice('');
            }}
          >
            {t}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {(tab === 'agents' || tab === 'connections') && (
        <label>
          Agent
          <select value={profile} onChange={(e) => setProfile(e.target.value)}>
            {state.bots.map((b) => (
              <option key={b.id} value={b.profile}>
                @{b.handle}
                {b.profile === state.orchestrator ? ' · Orchestrator' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {tab === 'agents' && bot && (
        <BotEditor
          key={bot.profile + ':' + state.revision}
          client={client}
          bot={bot}
          state={state}
          busy={busy}
          mutate={mutate}
        />
      )}
      {tab === 'teams' && (
        <>
          <p>
            Teams organize the sidebar. Reporting relationships are set separately on each agent.
          </p>
          {state.teams.map((t, index) => (
            <TeamEditor
              key={t.id + ':' + t.name}
              team={t}
              index={index}
              teams={state.teams}
              busy={busy}
              onSave={(teams) =>
                void mutate('teams.save', { teams, expected_revision: state.revision })
              }
            />
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void mutate('teams.save', {
                teams: [...state.teams, { id: crypto.randomUUID(), name: teamName }],
                expected_revision: state.revision,
              });
              setTeamName('');
            }}
          >
            <label>
              New team name
              <input
                required
                maxLength={80}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </label>
            <button disabled={busy}>Create team</button>
          </form>
        </>
      )}
      {tab === 'requests' && (
        <>
          <p>
            Your agents can propose changes. Review the exact request before approving it. They
            cannot approve their own changes.
          </p>
          {!requests.length && <p>No team requests yet.</p>}
          {requests.map((r) => (
            <article className="request-card" key={String(r.id)}>
              <h3>
                {String(r.action)} · {String(r.actor)}
              </h3>
              <p>Status: {String(r.state)}</p>
              <pre>{JSON.stringify(r.spec, null, 2)}</pre>
              {r.result != null && <pre>{JSON.stringify(r.result, null, 2)}</pre>}
              {r.state === 'pending' && (
                <div className="choice-row">
                  <button
                    disabled={busy}
                    onClick={() =>
                      void mutate('requests.deny', { id: r.id, fingerprint: r.fingerprint })
                    }
                  >
                    Deny
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void mutate('requests.approve', {
                        id: r.id,
                        fingerprint: r.fingerprint,
                      })
                    }
                  >
                    Approve exact request
                  </button>
                </div>
              )}
            </article>
          ))}
        </>
      )}
      {tab === 'connections' && (
        <>
          <p>
            Connections and credentials belong to this Hermes profile. A saved connection still
            needs a successful test and reviewed tool access.
          </p>
          {!servers.length && <p>This agent has no configured services yet.</p>}
          {servers.map((s) => (
            <ConnectionCard
              key={profile + ':' + String(s.name)}
              client={client}
              profile={profile}
              server={s}
            />
          ))}
          <h2>Services available in Hermes</h2>
          <div className="service-grid">
            {catalog.map((s) => (
              <article key={String(s.name)}>
                <h3>{String(s.name)}</h3>
                <p>{String(s.description ?? '')}</p>
                <small>{s.installed ? 'Installed in Hermes' : 'Native setup required'}</small>
                {['http', 'sse', 'streamable-http'].includes(String(s.transport)) || s.installed ? (
                  <button
                    disabled={busy || servers.some((x) => x.name === s.name)}
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        await client.invoke('connections.add', {
                          profile,
                          recipe: s.name,
                          name: s.name,
                          expected_revision: state.revision,
                        });
                        setServers(
                          (
                            (await client.invoke('connections.list', { profile })) as {
                              servers: Row[];
                            }
                          ).servers,
                        );
                        setNotice(
                          'Service configured with no tools granted. Complete authorization, test it, then choose tools.',
                        );
                      } catch {
                        setError(
                          'This service needs native Hermes setup before it can be added here.',
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {servers.some((x) => x.name === s.name) ? 'Added' : 'Add service'}
                  </button>
                ) : (
                  <small>Install this service through Hermes first.</small>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      {tab === 'account' && owner && <OwnerAccount />}
    </section>
  );
}
function BotEditor({
  client,
  bot,
  state,
  busy,
  mutate,
}: {
  client: BotBridgeClient;
  bot: WorkspaceBot;
  state: WorkspaceState;
  busy: boolean;
  mutate: (operation: string, params: Row) => Promise<void>;
}) {
  const [capabilities, setCapabilities] = useState<{ skills: Row[]; toolsets: Row[] }>();
  const [skills, setSkills] = useState<string[]>([]);
  const [toolsets, setToolsets] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    void client
      .invoke('agent.capabilities', { profile: bot.profile })
      .then((v) => {
        if (!live) return;
        const c = v as { skills: Row[]; toolsets: Row[] };
        setCapabilities(c);
        setSkills(c.skills.filter((s) => s.enabled).map((s) => String(s.name)));
        setToolsets(c.toolsets.filter((t) => t.enabled).map((t) => String(t.name)));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [client, bot.profile]);
  const [handle, setHandle] = useState(bot.handle);
  const [look, setLook] = useState<Appearance>(bot.appearance);
  const [photo, setPhoto] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [role, setRole] = useState<Role>(bot.role);
  const [manager, setManager] = useState(bot.manager ?? '');
  const [team, setTeam] = useState(bot.team ?? '');
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void mutate('bots.update_handle', {
            profile: bot.profile,
            handle,
            expected_revision: state.revision,
          });
        }}
      >
        <label>
          Public handle
          <input
            required
            minLength={2}
            maxLength={32}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </label>
        <button disabled={busy}>Save handle</button>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void mutate('bots.appearance.update', {
            profile: bot.profile,
            appearance: look,
            photo: look.kind === 'photo' ? photo || null : null,
            expected_revision: state.revision,
          });
        }}
      >
        <h2>Avatar</h2>
        <AvatarChooser
          look={look}
          onChange={setLook}
          photo={photo}
          onPhoto={setPhoto}
          client={client}
          profile={bot.profile}
          onBusyChange={setPhotoBusy}
        />
        <button disabled={busy || photoBusy}>Save avatar</button>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void mutate('roles.update', {
            profile: bot.profile,
            role,
            manager: bot.profile === state.orchestrator ? null : manager || state.orchestrator,
            team: team || null,
            expected_revision: state.revision,
          });
        }}
      >
        <h2>Role & reporting</h2>
        {(Object.keys(role) as (keyof Role)[]).map((key) => (
          <label key={key}>
            {
              {
                title: 'Role title',
                description: 'Description',
                responsibilities: 'Responsibilities',
                boundaries: 'Boundaries',
                expectedOutputs: 'Expected outputs',
              }[key]
            }
            {key === 'title' ? (
              <input
                maxLength={1000}
                value={role[key]}
                onChange={(e) => setRole({ ...role, [key]: e.target.value })}
              />
            ) : (
              <textarea
                maxLength={1000}
                rows={3}
                value={role[key]}
                onChange={(e) => setRole({ ...role, [key]: e.target.value })}
              />
            )}
          </label>
        ))}
        {bot.profile !== state.orchestrator && (
          <label>
            Reports to
            <select
              value={manager || state.orchestrator || ''}
              onChange={(e) => setManager(e.target.value)}
            >
              {state.bots
                .filter((b) => b.enrolled && b.id !== bot.id)
                .map((b) => (
                  <option key={b.id} value={b.profile}>
                    @{b.handle}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          Team
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">No team</option>
            {state.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy}>Save role & reporting</button>
      </form>
      {bot.profile !== 'default' && state.model_grant && (
        <section className="model-grant">
          <h2>Model access</h2>
          <p>
            Use @{state.bots.find((b) => b.profile === 'default')?.handle ?? 'hermes'}’s selected{' '}
            {state.model_grant.provider} model, {state.model_grant.model}. This grants only that
            provider’s supported authorization, not its other service credentials or personality.
          </p>
          {state.model_grant.supported ? (
            <button
              disabled={busy}
              onClick={() =>
                void mutate('agent.model', {
                  profile: bot.profile,
                  source: 'default',
                  expected: state.model_grant!.fingerprint,
                  expected_revision: state.revision,
                })
              }
            >
              Grant this model to @{bot.handle}
            </button>
          ) : (
            <p>
              This provider needs its own native Hermes authorization. No credential pool or OAuth
              refresh token is copied.
            </p>
          )}
          <small>
            Changing a saved model does not interrupt active work. Runtime availability is checked
            when Hermes opens the agent.
          </small>
        </section>
      )}
      {capabilities && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void mutate('agent.attach', {
              profile: bot.profile,
              skills,
              toolsets,
              expected_revision: state.revision,
            });
          }}
        >
          <h2>Tools & skills</h2>
          <p>
            Choose installed capabilities for this agent. Saved changes require Hermes to refresh
            its runtime before they are reported ready.
          </p>
          <fieldset>
            <legend>Toolsets</legend>
            {capabilities.toolsets.map((t) => (
              <label className="capability-choice" key={String(t.name)}>
                <input
                  type="checkbox"
                  checked={toolsets.includes(String(t.name))}
                  onChange={(e) =>
                    setToolsets(
                      e.target.checked
                        ? [...toolsets, String(t.name)]
                        : toolsets.filter((x) => x !== t.name),
                    )
                  }
                />
                <span>
                  {String(t.label || t.name)}
                  <small>{String(t.description || '')}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Skills</legend>
            {capabilities.skills.map((t) => (
              <label className="capability-choice" key={String(t.name)}>
                <input
                  type="checkbox"
                  checked={t.required === true || skills.includes(String(t.name))}
                  disabled={t.required === true}
                  onChange={(e) =>
                    setSkills(
                      e.target.checked
                        ? [...skills, String(t.name)]
                        : skills.filter((x) => x !== t.name),
                    )
                  }
                />
                {String(t.name)}
                {t.required === true ? ' · Required by Hermes' : ''}
              </label>
            ))}
          </fieldset>
          <button disabled={busy || !toolsets.length}>Save tools & skills</button>
        </form>
      )}
      {bot.enrolled && bot.profile !== state.orchestrator && (
        <details>
          <summary>Change orchestrator</summary>
          <p>
            Make @{bot.handle} the workspace orchestrator. The current orchestrator will report to
            this agent. Existing subteams keep their reporting relationships.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void mutate('workspace.set_orchestrator', {
                profile: bot.profile,
                expected_revision: state.revision,
              })
            }
          >
            Make @{bot.handle} orchestrator
          </button>
        </details>
      )}
    </>
  );
}

function TeamEditor({
  team,
  index,
  teams,
  busy,
  onSave,
}: {
  team: { id: string; name: string };
  index: number;
  teams: { id: string; name: string }[];
  busy: boolean;
  onSave: (teams: { id: string; name: string }[]) => void;
}) {
  const [name, setName] = useState(team.name);
  function move(delta: number) {
    const next = [...teams];
    [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
    onSave(next);
  }
  return (
    <div className="team-edit">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(teams.map((t) => (t.id === team.id ? { ...t, name } : t)));
        }}
      >
        <label>
          Team name
          <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button disabled={busy || name === team.name}>Rename</button>
      </form>
      <div className="choice-row">
        <button
          disabled={busy || index === 0}
          aria-label={`Move ${team.name} up`}
          onClick={() => move(-1)}
        >
          ↑
        </button>
        <button
          disabled={busy || index === teams.length - 1}
          aria-label={`Move ${team.name} down`}
          onClick={() => move(1)}
        >
          ↓
        </button>
        <button disabled={busy} onClick={() => onSave(teams.filter((t) => t.id !== team.id))}>
          Remove team
        </button>
      </div>
    </div>
  );
}
