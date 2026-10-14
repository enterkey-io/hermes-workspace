import {
  ClientError,
  ConnectionLifetime,
  endpointUrl,
  hasControlOrSpace,
  safeError,
} from '@hermes-client/core';
import type { Endpoint } from '@hermes-client/core';
import { readBoundedJson } from './json';

export interface HttpOptions {
  readonly endpoint: Endpoint;
  readonly key: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
}

/** This transport authenticates the agent REST interface only. */
export class AgentHttpClient {
  readonly #options: HttpOptions;
  readonly #lifetime = new ConnectionLifetime();
  readonly #active = new Set<AbortController>();
  #key: string;

  constructor(options: HttpOptions) {
    if (!options.key || hasControlOrSpace(options.key)) {
      throw new ClientError('INVALID_CREDENTIAL');
    }
    // The options object must not retain the secret after disconnect.
    const { key, ...withoutKey } = options;
    this.#options = { ...withoutKey, key: '' };
    this.#key = key;
  }

  async request(route: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<unknown> {
    const generation = this.#lifetime.capture();
    const url = endpointUrl(this.#options.endpoint, route);
    const controller = new AbortController();
    this.#active.add(controller);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#options.timeoutMs ?? 10_000);
    try {
      const response = await (this.#options.fetch ?? fetch)(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.#key}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
      this.#lifetime.assertCurrent(generation);
      if (timedOut) throw new ClientError('REQUEST_TIMEOUT');
      if (response.url && new URL(response.url).href !== url.href) {
        await response.body?.cancel();
        throw new ClientError('REQUEST_FAILED');
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new ClientError(
          response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : 'REQUEST_FAILED',
        );
      }
      const data = await readBoundedJson(response, this.#options.maxBytes ?? 1_048_576);
      this.#lifetime.assertCurrent(generation);
      return data;
    } catch (error) {
      this.#lifetime.assertCurrent(generation);
      if (timedOut) throw new ClientError('REQUEST_TIMEOUT');
      throw safeError(error);
    } finally {
      clearTimeout(timeout);
      this.#active.delete(controller);
    }
  }

  disconnect(): void {
    this.#key = '';
    this.#lifetime.close();
    for (const controller of this.#active) controller.abort();
    this.#active.clear();
  }
}
