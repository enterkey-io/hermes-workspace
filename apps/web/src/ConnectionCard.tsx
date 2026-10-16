import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { useEffect, useState } from 'react';
import { Plug } from 'lucide-react';
import { LoadingBar } from './components/ui/loading-bar';
import type { BotBridgeClient } from '@hermes-client/protocol';
type Row = Record<string, unknown>;
type Permission = {
  fingerprint: string;
  allowed_tools: string[] | null;
  bearer_supported: boolean;
  auth: string | null;
};
type Flow = { id: string; status: string; authorization_url: string | null; error: string | null };
export function ConnectionCard({
  client,
  profile,
  server,
}: {
  client: BotBridgeClient;
  profile: string;
  server: Row;
}) {
  const name = String(server.name);
  const [permission, setPermission] = useState<Permission>();
  const [tools, setTools] = useState<{ name: string; description: string }[]>([]);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [flow, setFlow] = useState<Flow>();
  useEffect(() => {
    let live = true;
    void client
      .invoke('connections.permissions', { profile, name })
      .then((v) => {
        if (live) {
          const p = v as Permission;
          setPermission(p);
          setAllowed(p.allowed_tools ?? []);
        }
      })
      .catch(() => {
        if (live)
          setMessage('This connection is managed by a Hermes plugin or needs native setup.');
      });
    return () => {
      live = false;
    };
  }, [client, profile, name]);
  useEffect(() => {
    if (!flow || ['approved', 'error'].includes(flow.status)) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = (await client.invoke('connections.auth_status', { id: flow!.id })) as Flow;
        if (!active) return;
        setFlow(next);
        if (next.status === 'approved')
          setMessage('Signed in on Hermes. Test the connection and choose its tools.');
        if (!['approved', 'error'].includes(next.status))
          timer = setTimeout(() => void poll(), 1500);
      } catch {
        if (active) setMessage('Sign-in expired or the bridge restarted. Start sign-in again.');
      }
    }
    timer = setTimeout(() => void poll(), 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [client, flow?.id]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch {
      setMessage('The change could not be confirmed. Check the connection before retrying.');
    } finally {
      setBusy(false);
      setKey('');
    }
  }
  let authorizationUrl = '';
  try {
    const u = new URL(flow?.authorization_url ?? '');
    if (u.protocol === 'https:' && !u.username && !u.password) authorizationUrl = u.href;
  } catch {
    /* no published authorization URL yet */
  }
  return (
    <article className="connection-card" aria-label={`${name} connection`}>
      <LoadingBar active={busy} label={`Updating ${name}`} />
      <div className="connection-summary">
        <span className="connection-icon" aria-hidden="true">
          <Plug />
        </span>
        <div className="connection-identity">
          <h3>{name}</h3>
        </div>
        <span className="connection-state">
          {server.enabled === false ? 'Disabled' : 'Configured'}
        </span>
      </div>
      <div className="connection-actions">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const result = (await client.invoke('connections.test', { profile, name })) as {
                ok: boolean;
                tools: { name: string; description: string }[];
              };
              if (result.ok) {
                setTools(result.tools);
                setMessage('Connected. Choose the exact tools this agent may use.');
              } else
                setMessage(
                  'Connection needs authorization or native setup. Existing credentials were kept.',
                );
            })
          }
        >
          Test connection
        </Button>
        {permission?.auth === 'oauth' && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void run(async () =>
                setFlow((await client.invoke('connections.auth_start', { profile, name })) as Flow),
              )
            }
          >
            Sign in to {name}
          </Button>
        )}
      </div>
      {flow && (
        <div className="connection-auth-flow" role="status">
          <p>
            {flow.error ||
              (
                {
                  starting: 'Preparing sign-in…',
                  authorization_required: 'Continue in your service’s sign-in page.',
                  approved: 'Signed in.',
                  error: 'Sign-in was not completed.',
                } as Record<string, string>
              )[flow.status]}
          </p>
          {authorizationUrl && flow.status === 'authorization_required' && (
            <a
              className="button primary"
              href={authorizationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Continue sign-in ↗
            </a>
          )}
          {!['approved', 'error'].includes(flow.status) && (
            <Button
              variant="secondary"
              onClick={() =>
                void run(async () =>
                  setFlow(
                    (await client.invoke('connections.auth_cancel', { id: flow.id })) as Flow,
                  ),
                )
              }
            >
              Cancel sign-in
            </Button>
          )}
        </div>
      )}
      {permission?.bearer_supported && (
        <details className="connection-key">
          <summary>API key</summary>
          <form
            className="connection-key-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await client.invoke('connections.set_key', {
                  profile,
                  name,
                  value: key,
                  expected: permission.fingerprint,
                });
                setPermission(
                  (await client.invoke('connections.permissions', { profile, name })) as Permission,
                );
                setMessage('Key saved. Test the connection to choose its tools.');
              });
            }}
          >
            <label>
              API key
              <Input
                required
                type="password"
                autoComplete="off"
                maxLength={4096}
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </label>
            <Button variant="secondary" disabled={busy || !key}>
              Save key
            </Button>
          </form>
        </details>
      )}
      {!!tools.length && permission && (
        <form
          className="connection-tools"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const p = (await client.invoke('connections.permissions', {
                profile,
                name,
                tools: allowed,
                expected: permission.fingerprint,
              })) as Permission;
              setPermission(p);
              setMessage('Saved. Changes apply after this pebble restarts.');
            });
          }}
        >
          <fieldset aria-label={`${name} tools`}>
            <legend>Allowed tools</legend>
            {tools.map((t) => (
              <label key={t.name} className="capability-choice">
                <input
                  type="checkbox"
                  checked={allowed.includes(t.name)}
                  onChange={(e) =>
                    setAllowed(
                      e.target.checked ? [...allowed, t.name] : allowed.filter((n) => n !== t.name),
                    )
                  }
                />
                <span>
                  {t.name}
                  <small>{t.description}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <Button variant="secondary" disabled={busy}>
            Save selected tools
          </Button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </article>
  );
}
