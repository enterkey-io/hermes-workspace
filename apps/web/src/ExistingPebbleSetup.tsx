import { useEffect, useRef, useState } from 'react';
import type { BotBridgeClient } from '@hermes-client/protocol';
import { workspaceState } from './workspace';
import type { WorkspaceBot } from './workspace';
import { PebbleProfileFields, RoleBasics } from './ui/pebble-profile-fields';
import type { ProfileDraft } from './ui/pebble-profile-fields';
import { Button } from './components/ui/button';
import { LoadingBar } from './components/ui/loading-bar';
import { Notice } from './ui/primitives';
export function ExistingPebbleSetup({
  client,
  profile,
  onDone,
  onDirtyChange,
}: {
  client: BotBridgeClient;
  profile: string;
  onDone: (profile: string, introduce: boolean) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const identity = useRef<string | undefined>(undefined);
  const [bot, setBot] = useState<WorkspaceBot>(),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [retired, setRetired] = useState(false),
    [avatarBusy, setAvatarBusy] = useState(false),
    [introduce, setIntroduce] = useState(true);
  const [value, setValue] = useState<ProfileDraft>({
    name: '',
    handle: '',
    appearance: { kind: 'shape', shape: 'pebble', color: 'iris' },
    photo: '',
  });
  const [role, setRole] = useState({ title: '', description: '' });
  useEffect(() => {
    let live = true;
    void client
      .invoke('workspace.describe', {})
      .then((data) => {
        const next = workspaceState(data),
          found = next.bots.find((b) => b.profile === profile && b.available !== false);
        if (!found) throw new Error();
        if (live) {
          if (identity.current && identity.current !== found.id) throw new Error();
          const first = !identity.current;
          identity.current = found.id;
          setBot(found);
          setRevision(next.revision);
          if (first)
            setValue({
              name: found.name,
              handle: found.handle,
              appearance: found.appearance,
              photo: '',
            });
          if (first)
            setRole({
              title: found.role.title,
              description: found.role.description || found.description,
            });
        }
      })
      .catch(() => {
        if (live) {
          setRetired(true);
          setError('This agent is unavailable. Go back and refresh the list.');
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [client, profile]);
  useEffect(() => {
    const dirty =
      !!bot &&
      (value.name !== bot.name ||
        value.handle !== bot.handle ||
        !!value.photo ||
        JSON.stringify(value.appearance) !== JSON.stringify(bot.appearance) ||
        role.title !== bot.role.title ||
        role.description !== (bot.role.description || bot.description));
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [bot, value, role, onDirtyChange]);
  async function add() {
    if (busy || !bot || retired) return;
    setBusy(true);
    setError('');
    try {
      await client.invoke('agent.onboard', {
        profile,
        id: bot.id,
        name: value.name,
        handle: value.handle,
        appearance: value.appearance,
        photo: value.appearance.kind === 'photo' ? value.photo || null : null,
        role,
        expected_revision: revision,
      });
      await onDone(profile, introduce);
    } catch {
      setError('Could not finish adding this agent. Your profile is preserved.');
      try {
        const current = workspaceState(await client.invoke('workspace.describe', {}));
        setRevision(current.revision);
      } catch {
        /* The draft stays local while offline. */
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="profile-form"
      aria-label="Configure existing agent"
      onSubmit={(event) => {
        event.preventDefault();
        void add();
      }}
      aria-busy={busy || loading}
    >
      <LoadingBar active={loading || busy} label={busy ? 'Adding agent' : 'Loading profile'} />
      <div className="profile-content" inert={busy}>
        {error && <Notice error>{error}</Notice>}
        {!loading && bot && (
          <PebbleProfileFields
            value={value}
            onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
            client={client}
            profile={profile}
            onAvatarBusy={setAvatarBusy}
            revision={revision}
          >
            <RoleBasics {...role} onChange={(patch) => setRole((r) => ({ ...r, ...patch }))} />
          </PebbleProfileFields>
        )}
      </div>
      <footer className="profile-footer">
        <label className="intro-choice">
          <input
            type="checkbox"
            checked={introduce}
            onChange={(e) => setIntroduce(e.target.checked)}
          />
          Introduce them in chat
        </label>
        <Button disabled={loading || busy || !bot || retired || avatarBusy}>Add pebble</Button>
      </footer>
    </form>
  );
}
