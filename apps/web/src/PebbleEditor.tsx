import { useEffect, useRef, useState } from 'react';
import type { BotBridgeClient } from '@hermes-client/protocol';
import type { WorkspaceState, WorkspaceBot, Appearance, Role } from './workspace';
import { AvatarChooser } from './AgentAvatar';
import { PageHeader, FormSection, Notice, Tabs } from './ui/primitives';
import { Drawer } from './chat/Drawer';
import { safeError } from '@hermes-client/core';
type Row = Record<string, unknown>;
export function PebbleEditor({
  client,
  bot,
  state,
  onChange,
  onClose,
  onDirtyChange,
  retired = false,
}: {
  client: BotBridgeClient;
  bot: WorkspaceBot;
  state: WorkspaceState;
  onChange: (state: WorkspaceState) => void;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  retired?: boolean;
}) {
  const [tab, setTab] = useState('identity');
  const [handle, setHandle] = useState(bot.handle),
    [look, setLook] = useState<Appearance>(bot.appearance);
  const [role, setRole] = useState<Role>(bot.role),
    [manager, setManager] = useState(bot.manager ?? ''),
    [team, setTeam] = useState(bot.team ?? '');
  const [photo, setPhoto] = useState(''),
    [photoBusy, setPhotoBusy] = useState(false);
  const [pending, setBusy] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [discard, setDiscard] = useState(false);
  const [capabilities, setCapabilities] = useState<{ skills: Row[]; toolsets: Row[] }>();
  const [skills, setSkills] = useState<string[]>([]),
    [toolsets, setToolsets] = useState<string[]>([]);
  const busy = retired ? 'retired' : pending;
  const [toolsLoading, setToolsLoading] = useState(true);
  const originalTools = useRef('');
  const [conflicts, setConflicts] = useState<Record<string, boolean>>({});
  const baseline = useRef(bot);
  useEffect(() => {
    const old = baseline.current;
    const changed: Record<string, boolean> = {};
    if (old.handle !== bot.handle && handle !== old.handle && handle !== bot.handle)
      changed.handle = true;
    if (
      JSON.stringify(old.appearance) !== JSON.stringify(bot.appearance) &&
      JSON.stringify(look) !== JSON.stringify(old.appearance) &&
      JSON.stringify(look) !== JSON.stringify(bot.appearance)
    )
      changed.appearance = true;
    const before = JSON.stringify([old.role, old.manager ?? '', old.team ?? '']),
      current = JSON.stringify([role, manager, team]),
      incoming = JSON.stringify([bot.role, bot.manager ?? '', bot.team ?? '']);
    if (before !== incoming && current !== before && current !== incoming) changed.role = true;
    if (Object.keys(changed).length) setConflicts((value) => ({ ...value, ...changed }));
    setHandle((v) => (v === old.handle ? bot.handle : v));
    setLook((v) => (JSON.stringify(v) === JSON.stringify(old.appearance) ? bot.appearance : v));
    setRole((v) => (JSON.stringify(v) === JSON.stringify(old.role) ? bot.role : v));
    setManager((v) => (v === (old.manager ?? '') ? (bot.manager ?? '') : v));
    setTeam((v) => (v === (old.team ?? '') ? (bot.team ?? '') : v));
    baseline.current = bot;
  }, [bot]);
  useEffect(() => {
    let live = true;
    setToolsLoading(true);
    void client
      .invoke('agent.capabilities', { profile: bot.profile })
      .then((v) => {
        if (!live) return;
        const value = v as { skills: Row[]; toolsets: Row[] };
        if (!Array.isArray(value.skills) || !Array.isArray(value.toolsets)) throw new Error();
        setCapabilities(value);
        const s = value.skills.filter((x) => x.enabled).map((x) => String(x.name)),
          t = value.toolsets.filter((x) => x.enabled).map((x) => String(x.name));
        setSkills(s);
        setToolsets(t);
        originalTools.current = JSON.stringify([s, t]);
      })
      .catch(() => {
        if (live) setCapabilities(undefined);
      })
      .finally(() => {
        if (live) setToolsLoading(false);
      });
    return () => {
      live = false;
    };
  }, [client, bot.profile]);
  const dirty =
    handle !== bot.handle ||
    JSON.stringify(look) !== JSON.stringify(bot.appearance) ||
    !!photo ||
    JSON.stringify(role) !== JSON.stringify(bot.role) ||
    manager !== (bot.manager ?? '') ||
    team !== (bot.team ?? '') ||
    (!!capabilities && JSON.stringify([skills, toolsets]) !== originalTools.current);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  async function save(operation: string, params: Row, section: string) {
    if (busy || conflicts[section]) return;
    setBusy(section);
    setError('');
    setNotice('');
    try {
      const result = (await client.invoke(operation, {
        profile: bot.profile,
        ...params,
        expected_revision: state.revision,
      })) as Row;
      const next = (await client.invoke('workspace.describe', {})) as WorkspaceState;
      onChange(next);
      if (['uncertain', 'partial', 'denied', 'failed'].includes(String(result.state))) {
        setError(
          'The change was not fully confirmed. Review the current state before trying again.',
        );
        return;
      }
      if (section === 'appearance') setPhoto('');
      setConflicts((old) => ({ ...old, [section]: false }));
      if (section === 'tools') originalTools.current = JSON.stringify([skills, toolsets]);
      setNotice(
        `${section === 'tools' ? 'Tools and skills' : section === 'role' ? 'Role' : section === 'handle' ? 'Handle' : section === 'lead' ? 'Main Pebble' : section === 'model' ? 'Model' : 'Avatar'} saved.`,
      );
    } catch (e) {
      setError(safeError(e).message);
    } finally {
      setBusy('');
    }
  }
  const close = () => {
    if (dirty) setDiscard(true);
    else onClose();
  };
  return (
    <section className="entity-page" aria-label={`Edit ${bot.name}`}>
      <PageHeader title={`Edit ${bot.name}`} subtitle={`@${bot.handle}`} onClose={close} />
      {retired && (
        <Notice error>
          This pebble was removed or replaced. Your unsaved fields remain here to copy; changes
          cannot be saved to a different pebble.
        </Notice>
      )}
      <Tabs
        tabs={[
          { id: 'identity', label: 'Profile' },
          { id: 'role', label: 'Role' },
          { id: 'tools', label: 'Tools & skills' },
          { id: 'model', label: 'Model' },
        ]}
        value={tab}
        onChange={(id) => {
          setTab(id);
          setError('');
          setNotice('');
        }}
      >
        {error && <Notice error>{error}</Notice>}
        {notice && <Notice>{notice}</Notice>}
        {Object.entries(conflicts)
          .filter(([, conflict]) => conflict)
          .map(([section]) => (
            <Notice key={section}>
              The saved {section === 'appearance' ? 'avatar' : section} changed while you were
              editing.
              <div className="form-actions">
                <button
                  onClick={() => {
                    if (section === 'handle') setHandle(bot.handle);
                    if (section === 'appearance') {
                      setLook(bot.appearance);
                      setPhoto('');
                    }
                    if (section === 'role') {
                      setRole(bot.role);
                      setManager(bot.manager ?? '');
                      setTeam(bot.team ?? '');
                    }
                    setConflicts((old) => ({ ...old, [section]: false }));
                  }}
                >
                  Use saved version
                </button>
                <button onClick={() => setConflicts((old) => ({ ...old, [section]: false }))}>
                  Keep my edits
                </button>
              </div>
            </Notice>
          ))}
        {tab === 'identity' && (
          <>
            <FormSection title="Handle">
              <form
                className="handle-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save('bots.update_handle', { handle }, 'handle');
                }}
              >
                <label>
                  Handle
                  <span className="handle-input">
                    <span aria-hidden>@</span>
                    <input
                      aria-label="Handle"
                      required
                      minLength={2}
                      maxLength={32}
                      pattern="[a-z][a-z0-9_-]{1,31}"
                      autoCapitalize="none"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                    />
                  </span>
                </label>
                <div className="form-actions">
                  <button disabled={!!busy || !!conflicts.handle || handle === bot.handle}>
                    Save handle
                  </button>
                </div>
              </form>
            </FormSection>
            <FormSection title="Avatar">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save(
                    'bots.appearance.update',
                    { appearance: look, photo: look.kind === 'photo' ? photo || null : null },
                    'appearance',
                  );
                }}
              >
                <AvatarChooser
                  look={look}
                  onChange={setLook}
                  photo={photo}
                  onPhoto={setPhoto}
                  client={client}
                  profile={bot.profile}
                  onBusyChange={setPhotoBusy}
                  revision={state.revision}
                />
                <div className="form-actions">
                  <button disabled={!!busy || !!conflicts.appearance || photoBusy}>
                    Save avatar
                  </button>
                </div>
              </form>
            </FormSection>
          </>
        )}
        {tab === 'role' && (
          <FormSection title="Role & reporting">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save(
                  'roles.update',
                  {
                    role,
                    manager:
                      bot.profile === state.orchestrator ? null : manager || state.orchestrator,
                    team: team || null,
                  },
                  'role',
                );
              }}
            >
              <label>
                Title
                <input
                  maxLength={1000}
                  value={role.title}
                  placeholder="e.g. Chief of Staff"
                  onChange={(e) => setRole({ ...role, title: e.target.value })}
                />
              </label>
              <label>
                Description
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={role.description}
                  onChange={(e) => setRole({ ...role, description: e.target.value })}
                />
              </label>
              <details className="form-disclosure">
                <summary>Responsibilities & boundaries</summary>
                {(['responsibilities', 'boundaries', 'expectedOutputs'] as const).map((key) => (
                  <label key={key}>
                    {
                      {
                        responsibilities: 'Responsibilities',
                        boundaries: 'Boundaries',
                        expectedOutputs: 'Expected outputs',
                      }[key]
                    }
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={role[key]}
                      onChange={(e) => setRole({ ...role, [key]: e.target.value })}
                    />
                  </label>
                ))}
              </details>
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
                          {b.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                Crew
                <select value={team} onChange={(e) => setTeam(e.target.value)}>
                  <option value="">No crew</option>
                  {state.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-actions">
                <button disabled={!!busy || !!conflicts.role}>Save role</button>
              </div>
            </form>
            {bot.enrolled && bot.profile !== state.orchestrator && (
              <details className="form-disclosure">
                <summary>Make Main Pebble</summary>
                <p>
                  {bot.name} will coordinate your pebbles. The current Main Pebble will report to
                  them.
                </p>
                <button
                  disabled={!!busy}
                  onClick={() => void save('workspace.set_orchestrator', {}, 'lead')}
                >
                  Make {bot.name} Main Pebble
                </button>
              </details>
            )}
          </FormSection>
        )}
        {tab === 'tools' && (
          <FormSection title="Tools & skills">
            {!capabilities ? (
              <Notice>
                {toolsLoading
                  ? 'Loading tools and skills…'
                  : 'Tools could not be loaded. Reopen this editor to try again.'}
              </Notice>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save('agent.attach', { skills, toolsets }, 'tools');
                }}
              >
                <fieldset>
                  <legend>Tools</legend>
                  {capabilities.toolsets.map((t) => (
                    <label className="selection-row" key={String(t.name)}>
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
                        <strong>{String(t.label || t.name)}</strong>
                        <small>{String(t.description || '')}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>Skills</legend>
                  {capabilities.skills.map((t) => (
                    <label className="selection-row" key={String(t.name)}>
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
                      <span>
                        {String(t.name)}
                        {t.required === true && <small>Required by Hermes</small>}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <p className="field-hint">
                  Saved access takes effect when Hermes refreshes this pebble’s runtime.
                </p>
                <div className="form-actions">
                  <button disabled={!!busy || !toolsets.length}>Save tools & skills</button>
                </div>
              </form>
            )}
          </FormSection>
        )}
        {tab === 'model' && (
          <FormSection title="Model">
            {state.model_grant ? (
              <>
                <p>
                  {state.model_grant.provider} · {state.model_grant.model}
                </p>
                {bot.profile !== 'default' &&
                  (state.model_grant.supported ? (
                    <>
                      <p className="field-hint">
                        Use the primary profile’s selected model authorization. Other service
                        credentials are not copied.
                      </p>
                      <button
                        disabled={!!busy}
                        onClick={() =>
                          void save(
                            'agent.model',
                            { source: 'default', expected: state.model_grant!.fingerprint },
                            'model',
                          )
                        }
                      >
                        Use this model
                      </button>
                    </>
                  ) : (
                    <Notice>This model needs authorization in Hermes.</Notice>
                  ))}
              </>
            ) : (
              <Notice>Model information is unavailable.</Notice>
            )}
          </FormSection>
        )}
      </Tabs>
      {busy && (
        <span className="sr-only" role="status">
          Saving…
        </span>
      )}
      {discard && (
        <Drawer title="Unsaved changes" variant="dialog" onClose={() => setDiscard(false)}>
          <h2>Discard unsaved changes?</h2>
          <div className="form-actions">
            <button onClick={() => setDiscard(false)}>Keep editing</button>
            <button
              className="danger-text"
              onClick={() => {
                onDirtyChange(false);
                onClose();
              }}
            >
              Discard changes
            </button>
          </div>
        </Drawer>
      )}
    </section>
  );
}
