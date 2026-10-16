import { Textarea } from './components/ui/textarea';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { useEffect, useState } from 'react';
import type { BotBridgeClient } from '@hermes-client/protocol';
import { safeError } from '@hermes-client/core';
import type { WorkspaceState } from './workspace';
import { AgentPicker } from './AgentPicker';
import { PageHeader, FormSection, Notice } from './ui/primitives';
import { RequestReview } from './chat/RequestReview';
type Row = Record<string, unknown>;
export function NewPebble({
  client,
  state,
  connected,
  onClose,
  onDone,
  onDirtyChange,
}: {
  client: BotBridgeClient;
  state: WorkspaceState;
  connected: boolean;
  onClose: () => void;
  onDone: (profile?: string) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [mode, setMode] = useState('choose'),
    [name, setName] = useState(''),
    [handle, setHandle] = useState(''),
    [description, setDescription] = useState(''),
    [soul, setSoul] = useState('');
  const [handleTouched, setHandleTouched] = useState(false);
  const [model, setModel] = useState<NonNullable<WorkspaceState['model_grant']>>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [request, setRequest] = useState<Row>();
  useEffect(() => {
    let live = true;
    void client
      .invoke('models.describe', {})
      .then((v) => {
        if (live) setModel(v as NonNullable<WorkspaceState['model_grant']>);
      })
      .catch(() => {
        if (live) setError('Model information could not be loaded.');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [client]);
  useEffect(() => {
    onDirtyChange(mode === 'create' && !request && !!(name || description || soul));
    return () => onDirtyChange(false);
  }, [mode, name, description, soul, request, onDirtyChange]);
  if (mode === 'existing')
    return (
      <div className="entity-page">
        <Button
          variant="ghost"
          className="text-button back-button"
          onClick={() => setMode('choose')}
        >
          ← New pebble
        </Button>
        <AgentPicker
          client={client}
          connected={connected}
          onClose={onClose}
          onDone={() => onDone()}
        />
      </div>
    );
  async function propose() {
    setBusy(true);
    setError('');
    try {
      const spec = {
        name: handle,
        display_name: name,
        soul:
          soul.trim() ||
          `Your name is ${name}. Follow the owner's instructions and coordinate through your available tools.`,
        role: description,
        model_source: 'default',
        model_fingerprint: model!.fingerprint,
        skills: [],
        toolsets: ['workspace', 'skills'],
        manager: state.orchestrator,
        team: null,
        expected_revision: state.revision,
      };
      const result = (await client.invoke('agent.propose', {
        action: 'agent.create',
        spec,
      })) as Row;
      const data = (await client.invoke('requests.list', {})) as { requests: Row[] };
      const found = data.requests.find((r) => r.id === result.request_id);
      if (!found) throw new Error('Request could not be confirmed.');
      setRequest(found);
    } catch (e) {
      setError(safeError(e).message);
    } finally {
      setBusy(false);
    }
  }
  async function decide(approve: boolean) {
    if (!request || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = (await client.invoke(approve ? 'requests.approve' : 'requests.deny', {
        id: request.id,
        fingerprint: request.fingerprint,
      })) as Row;
      setRequest({ ...request, ...result });
      if (result.state === 'completed') await onDone(handle);
      else if (result.state === 'denied') {
        setRequest(undefined);
      } else
        setError(
          'Creation was not fully confirmed. The request is saved in Settings → Requests; check there before creating again.',
        );
    } catch (e) {
      setError(`${safeError(e).message} Check Requests before trying creation again.`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="entity-page" aria-label="New pebble">
      <PageHeader title="New pebble" onClose={onClose} />
      {error && <Notice error>{error}</Notice>}
      {mode === 'choose' ? (
        <div className="creation-choices">
          <Button variant="secondary" onClick={() => setMode('existing')}>
            <strong>Add existing</strong>
            <span>Bring in one of your Hermes agents.</span>
          </Button>
          <Button variant="secondary" onClick={() => setMode('create')}>
            <strong>Create new</strong>
            <span>Start a fresh pebble with its own personality.</span>
          </Button>
        </div>
      ) : (
        <>
          <Button
            variant="ghost"
            className="text-button back-button"
            disabled={busy}
            onClick={() => setMode('choose')}
          >
            ← Choose another option
          </Button>
          {request ? (
            <RequestReview
              request={request}
              busy={busy}
              onDecision={(a) => void decide(a)}
              onInspect={() => void onDone()}
            />
          ) : (
            <FormSection title="Create a pebble">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void propose();
                }}
              >
                <label>
                  Name
                  <Input
                    required
                    maxLength={80}
                    autoComplete="off"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!handleTouched)
                        setHandle(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, '-')
                            .replace(/^-+/, ''),
                        );
                    }}
                  />
                </label>
                <label>
                  Handle
                  <span className="handle-input">
                    <span aria-hidden>@</span>
                    <Input
                      aria-label="Handle"
                      required
                      pattern="[a-z][a-z0-9-]{1,39}"
                      minLength={2}
                      maxLength={32}
                      autoCapitalize="none"
                      value={handle}
                      onChange={(e) => {
                        setHandleTouched(true);
                        setHandle(e.target.value);
                      }}
                    />
                  </span>
                </label>
                <label>
                  Description
                  <Textarea
                    rows={2}
                    maxLength={1000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <label>
                  Instructions
                  <Textarea
                    rows={4}
                    maxLength={12000}
                    placeholder="How should this pebble work?"
                    value={soul}
                    onChange={(e) => setSoul(e.target.value)}
                  />
                </label>
                {loading ? (
                  <Notice>Checking model access…</Notice>
                ) : model?.supported ? (
                  <p className="field-hint">
                    Uses {model.provider} · {model.model}. Starts with team-management tools; add
                    other tools after creation.
                  </p>
                ) : (
                  <Notice>
                    This model needs setup in Hermes before a new pebble can use it. You can add an
                    existing agent instead.
                  </Notice>
                )}
                <div className="form-actions">
                  <Button
                    variant="default"
                    className="primary"
                    disabled={busy || !connected || loading || !model?.supported}
                  >
                    {busy ? 'Preparing…' : 'Review pebble'}
                  </Button>
                </div>
              </form>
            </FormSection>
          )}
        </>
      )}
    </section>
  );
}
