import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeEndpoint } from '@hermes-client/core';
import { AgentHttpClient } from './http';
import { getAgentCapabilities } from './capabilities';

afterEach(() => vi.useRealTimers());

function client(
  mock: typeof fetch,
  extra: { maxBytes?: number; timeoutMs?: number } = {},
): AgentHttpClient {
  return new AgentHttpClient({
    endpoint: normalizeEndpoint('https://hermes.test/p/researcher'),
    key: 'synthetic-key',
    fetch: mock,
    ...extra,
  });
}

describe('credential-scoped HTTP transport', () => {
  it('sends only to the chosen endpoint with safe browser options', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true }));
    await client(mock).request('v1/capabilities');
    const [url, init] = mock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://hermes.test/p/researcher/v1/capabilities');
    expect(init).toMatchObject({
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { Authorization: 'Bearer synthetic-key' },
    });
  });

  it('does not retry mutations or disclose error response contents', async () => {
    const mock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('private content synthetic-key', { status: 401 }));
    await expect(
      client(mock).request('v1/runs', 'POST', { input: 'private prompt' }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'The server did not authorize this request.',
    });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('rejects a redirect even if an injected fetch implementation followed it', async () => {
    const response = Response.json({ ok: true });
    Object.defineProperty(response, 'url', { value: 'https://foreign.test/v1/capabilities' });
    await expect(
      client(vi.fn<typeof fetch>().mockResolvedValue(response)).request('v1/capabilities'),
    ).rejects.toMatchObject({ code: 'REQUEST_FAILED' });
  });

  it('bounds streaming bodies without relying on content-length', async () => {
    const mock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ large: 'x'.repeat(1000) }));
    await expect(client(mock, { maxBytes: 100 }).request('v1/capabilities')).rejects.toMatchObject({
      code: 'RESPONSE_TOO_LARGE',
    });
  });

  it('clears credentials and rejects late results after disconnect', async () => {
    let complete: ((response: Response) => void) | undefined;
    const mock = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const connection = client(mock);
    const pending = connection.request('v1/capabilities');
    const failure = expect(pending).rejects.toMatchObject({ code: 'DISCONNECTED' });
    connection.disconnect();
    complete?.(Response.json({ ok: true }));
    await failure;
    await expect(connection.request('v1/capabilities')).rejects.toMatchObject({
      code: 'DISCONNECTED',
    });
    expect(JSON.stringify(connection)).not.toContain('synthetic-key');
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('bounds a request and sanitizes network errors', async () => {
    vi.useFakeTimers();
    const mock = vi.fn<typeof fetch>().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('secret-url-and-key')));
        }),
    );
    const failure = expect(
      client(mock, { timeoutMs: 20 }).request('v1/capabilities'),
    ).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(30);
    await failure;
  });

  it('does not follow foreign URLs supplied by capability discovery', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        object: 'hermes.api_server.capabilities',
        platform: 'hermes-agent',
        features: { run_submission: true },
        endpoints: { profiles: 'https://foreign.test' },
        botModeCertified: true,
      }),
    );
    const capabilities = await getAgentCapabilities(client(mock));
    expect(capabilities).toEqual({ features: { run_submission: true }, botModeCertified: false });
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
