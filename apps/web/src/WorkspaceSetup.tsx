import { useEffect, useState } from 'react';
import type { BotBridgeClient } from '@hermes-client/protocol';
import { workspaceState } from './workspace';
import type { Appearance, WorkspaceState } from './workspace';
import { AvatarChooser } from './AgentAvatar';
export function WorkspaceSetup({
  client,
  onComplete,
}: {
  client: BotBridgeClient;
  onComplete: (state: WorkspaceState, profile: string, welcome: boolean) => void;
}) {
  const [profile, setProfile] = useState('');
  const [handle, setHandle] = useState('hermes');
  const [revision, setRevision] = useState(0);
  const [look, setLook] = useState<Appearance>({ kind: 'shape', shape: 'pebble', color: 'iris' });
  const [photo, setPhoto] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [welcome, setWelcome] = useState(true);
  useEffect(() => {
    let live = true;
    void client
      .invoke('workspace.detect_primary', {})
      .then((data) => {
        if (!live) return;
        const d = data as {
          complete: boolean;
          profile: string;
          revision: number;
          bot: { handle: string; appearance: Appearance };
        };
        if (!d.complete)
          throw new Error(
            'Your installer must confirm the primary Hermes profile before setup can continue. No agent has been changed.',
          );
        setProfile(d.profile);
        setRevision(d.revision);
        setHandle(d.bot.handle);
        setLook(d.bot.appearance);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : 'Could not detect your primary agent.');
      });
    return () => {
      live = false;
    };
  }, [client]);
  async function finish(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = workspaceState(
        await client.invoke('workspace.initialize', {
          profile,
          handle,
          appearance: look,
          photo: look.kind === 'photo' ? photo || null : null,
          expected_revision: revision,
        }),
      );
      onComplete(data, profile, welcome);
    } catch {
      setError(
        'Setup could not be confirmed. Refresh to check the saved state before trying again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workspace-setup">
      <div className="setup-intro">
        <p className="eyebrow">LET’S BRING YOUR HERMES IN</p>
        <h1>Your agent. A new place to work.</h1>
        <p>
          We found your primary Hermes agent. They’ll be your orchestrator, helping you build and
          coordinate the rest of your team. Their personality, memory and skills stay with them.
        </p>
      </div>
      <form onSubmit={(e) => void finish(e)}>
        <label>
          What should we call them here?
          <span className="handle-input">
            <span>@</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
              minLength={2}
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
            />
          </span>
          <small>
            By default, Hermes calls its primary bot @hermes. Choose a different handle here, or
            change it later in Settings.
          </small>
        </label>
        <h2>Give them a look.</h2>
        <AvatarChooser
          look={look}
          onChange={setLook}
          photo={photo}
          onPhoto={setPhoto}
          client={client}
          profile={profile}
          onBusyChange={setPhotoBusy}
        />
        <label className="welcome-choice">
          <input type="checkbox" checked={welcome} onChange={(e) => setWelcome(e.target.checked)} />
          Ask my agent to introduce themselves when we start.
          <small>This sends one welcome request using your Hermes model.</small>
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy || photoBusy || !profile}>
          {busy ? 'Bringing your agent in…' : `Open ${handle ? '@' + handle : 'my workspace'}`}
        </button>
      </form>
    </section>
  );
}
