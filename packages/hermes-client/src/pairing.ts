import { ClientError, endpointUrl, safeError } from '@hermes-client/core';
import type { Endpoint } from '@hermes-client/core';
import { readBoundedJson, record } from './json';

export async function pairBrowser(
  endpoint: Endpoint,
  signal: AbortSignal,
  onCode: (code: string) => void,
  fetcher = fetch,
): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  async function request(route: string, body: unknown) {
    const url = endpointUrl(endpoint, route);
    const response = await fetcher(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    });
    if (!response.ok || (response.url && response.url !== url.href))
      throw new ClientError('REQUEST_FAILED');
    return record(await readBoundedJson(response, 32768));
  }
  try {
    const pending = await request('v1/pairing/request', { challenge });
    if (
      typeof pending.request_id !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(pending.request_id) ||
      typeof pending.code !== 'string' ||
      !/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(pending.code)
    )
      throw new ClientError('INVALID_RESPONSE');
    onCode(pending.code);
    const deadline = Date.now() + 300_000;
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      const result = await request('v1/pairing/claim', {
        request_id: pending.request_id,
        verifier,
      });
      if (result.status === 'approved') {
        if (typeof result.credential !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(result.credential))
          throw new ClientError('INVALID_RESPONSE');
        return result.credential;
      }
      if (result.status !== 'pending') throw new ClientError('INVALID_RESPONSE');
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(new ClientError('DISCONNECTED'));
        };
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', abort);
          resolve();
        }, 1500);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      });
    }
    throw new ClientError('REQUEST_TIMEOUT');
  } catch (error) {
    throw safeError(error);
  }
}
