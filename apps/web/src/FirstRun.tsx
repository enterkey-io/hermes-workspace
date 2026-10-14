import { useEffect, useRef, useState } from 'react';
import { normalizeEndpoint, safeError } from '@hermes-client/core';
import { pairBrowser } from '@hermes-client/protocol';
import release from '../../../release.json';

export function FirstRun({
  onConnect,
}: {
  onConnect: (endpoint: string, credential: string) => Promise<void>;
}) {
  const [view, setView] = useState<'home' | 'connect'>('home');
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const active = useRef<AbortController | undefined>(undefined);
  const installUrl = `https://raw.githubusercontent.com/${release.repository}/${release.tag}/docs/AGENT_INSTALL.md`;
  const agentMessage = `Please connect the web app at ${location.origin} to my existing Hermes, following ${installUrl}. Keep the web app on its current host. Install the published integration plugin on my Hermes host, allow exactly this web origin, and give me the private HTTPS connection address. Keep administrator credentials on the Hermes host and do not modify Hermes core. Record the installed version and update/rollback method using the guide.`;

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/connection.json', {
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const settings: unknown = await response.json();
        if (
          settings &&
          typeof settings === 'object' &&
          'bridgeUrl' in settings &&
          typeof settings.bridgeUrl === 'string'
        ) {
          const endpoint = normalizeEndpoint(settings.bridgeUrl, import.meta.env.DEV);
          setView('connect');
          setAddress(endpoint.baseUrl);
        }
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      active.current?.abort();
    };
  }, []);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setError('Clipboard access is unavailable. Select and copy the message below.');
    }
  }
  async function pair() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setError('');
    setBusy(true);
    setCode('');
    try {
      const endpoint = normalizeEndpoint(address, import.meta.env.DEV);
      const credential = await pairBrowser(endpoint, controller.signal, setCode);
      controller.signal.throwIfAborted();
      await onConnect(endpoint.baseUrl, credential);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          `${safeError(error).message} Check that your device can reach the Hermes connection address, that this web app is allowed by the integration, and that browser local-network access is permitted if requested. Your Hermes agent can check these settings.`,
        );
    } finally {
      if (active.current === controller) {
        setBusy(false);
        setCode('');
      }
    }
  }
  function cancel() {
    active.current?.abort();
    active.current = undefined;
    setBusy(false);
    setCode('');
    setError('');
  }

  return (
    <main className="first-run">
      <header className="first-header">
        <a href="/" className="wordmark">
          Workspace preview
        </a>
        <span>Independent interface for Hermes · Name to be decided</span>
        <a href="/install">Agent setup guide ↗</a>
      </header>
      {view === 'home' ? (
        <>
          <section className="first-hero">
            <p className="eyebrow">YOUR HERMES, EASIER TO USE</p>
            <h1>
              Your agents.
              <br />
              One private workspace.
            </h1>
            <p className="first-intro">
              Talk to the bots you already run in Hermes, bring them into a shared room, and follow
              their work. Your Hermes keeps the conversations and runs the agents.
            </p>
            <div className="first-actions">
              <a className="button primary" href="/install">
                Set up with my Hermes agent <span aria-hidden>↗</span>
              </a>
              <button
                onClick={() => {
                  setView('connect');
                  setError('');
                }}
              >
                Connect my Hermes
              </button>
            </div>
            <p className="preview-status">
              The web app is running here. Connect your Hermes to start using your bots.
            </p>
          </section>
          <section className="getting-started" aria-labelledby="start-title">
            <div>
              <p className="eyebrow">HOW TO GET STARTED</p>
              <h2 id="start-title">Let your agent handle the setup.</h2>
              <p>You don’t need to figure out server settings or find an API key.</p>
            </div>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <h3>Give your agent the setup page</h3>
                  <p>Send the message below to the Hermes agent you already use.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Your agent connects your Hermes</h3>
                  <p>
                    Keep this web app here, or host your own copy anywhere. Your agent sets up the
                    separate Hermes connection and gives you its address.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Connect here and approve this browser</h3>
                  <p>
                    The app shows a short code. Ask your agent to approve that code on your server.
                  </p>
                </div>
              </li>
            </ol>
          </section>
          <section className="agent-message">
            <div>
              <h2>Send this to your Hermes agent</h2>
              <button onClick={() => void copy(agentMessage)}>
                {copied ? 'Copied' : 'Copy message'}
              </button>
            </div>
            <p>{agentMessage}</p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </section>
          <section className="first-capabilities">
            <article>
              <h3>Pick up each bot’s conversation</h3>
              <p>Use Hermes’s existing Bot Chat and history.</p>
            </article>
            <article>
              <h3>Work together in rooms</h3>
              <p>Hermes runs the discussion and teammate delivery.</p>
            </article>
            <article>
              <h3>Stay in control</h3>
              <p>Follow progress, answer approvals, and stop a task.</p>
            </article>
          </section>
        </>
      ) : (
        <section className="pair-card">
          <button
            className="back-button"
            onClick={() => {
              cancel();
              setView('home');
            }}
          >
            ← Back to introduction
          </button>
          <p className="eyebrow">CONNECT DIRECTLY TO YOUR HERMES</p>
          <h1>{code ? 'Approve this browser.' : 'Connect your Hermes.'}</h1>
          {!code && (
            <>
              <p>
                Use the Hermes connection address your agent gave you. This web app stays here; your
                browser talks directly to Hermes. You do not need to paste an API key.
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void pair();
                }}
              >
                <>
                  <label htmlFor="workspace-url">Hermes connection address</label>
                  <input
                    id="workspace-url"
                    type="url"
                    required
                    placeholder="https://your-hermes-connection.example"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    disabled={busy}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </>
                <button className="primary" disabled={busy}>
                  {busy ? 'Contacting your Hermes…' : 'Request browser access'}
                </button>
              </form>
            </>
          )}
          {code && (
            <>
              <p>
                Send this code to your own Hermes agent and ask it to approve this browser. It
                expires in five minutes.
              </p>
              <p>
                Approve access from <strong>{location.origin}</strong> to <strong>{address}</strong>
                .
              </p>
              <output className="pair-code" aria-label="Browser approval code">
                {code}
              </output>
              <p className="approval-message">
                “Please approve browser code <strong>{code}</strong> for my private workspace.”
              </p>
              <p className="pair-wait" role="status">
                Waiting for your Hermes agent to approve…
              </p>
              <details>
                <summary>What will my agent do?</summary>
                <p>On your Hermes host, it runs:</p>
                <code>
                  hermes bot-web approve {code} --app-origin {location.origin}
                </code>
                <p>Only approve a code that you see in your own browser.</p>
              </details>
              <button onClick={cancel}>Cancel request</button>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="pair-privacy">
            <h2>What gets shared?</h2>
            <p>
              The approval request and bot traffic go directly to your Hermes connection, not to
              this website’s server. The address is not saved here. Browser access expires after one
              hour and stays in this tab’s memory. No account or credential vault is created on our
              systems.
            </p>
            <p>
              A web app’s code can access its own browser session. Self hosting lets you choose and
              control the build you use.
            </p>
          </div>
        </section>
      )}
      <footer className="first-footer">
        <span>Uses Hermes’s native Bot Mode · Preview {release.version}</span>
        <a href={`https://github.com/${release.repository}`}>Source on GitHub</a>
        <a href="/install">Read the agent installation guide</a>
      </footer>
    </main>
  );
}
