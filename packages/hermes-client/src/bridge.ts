import { ClientError, ConnectionLifetime, endpointUrl, safeError } from '@hermes-client/core';
import type { Endpoint } from '@hermes-client/core';
import { readBoundedJson, record } from './json';

export interface BridgeEvent {
  readonly type: string;
  readonly session_id?: string;
  readonly seq?: number;
  readonly payload?: Readonly<Record<string, unknown>>;
}

/** Direct connection to an optional plugin on the user's Hermes host. */
export class BotBridgeClient {
  readonly #endpoint: Endpoint;
  readonly #fetch: typeof fetch;
  readonly #lifetime = new ConnectionLifetime();
  readonly #active = new Set<AbortController>();
  #token: string;
  #connection = '';

  constructor(endpoint: Endpoint, token: string, fetcher = fetch) {
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) throw new ClientError('INVALID_CREDENTIAL');
    this.#endpoint = endpoint;
    this.#token = token;
    // Native browser fetch requires its global receiver, never the client object.
    this.#fetch = (input, init) => fetcher(input, init);
  }

  async connect(): Promise<void> {
    const data = record(await this.#request('v1/connect', 'POST'));
    if (
      data.protocol !== 'hermes-bot-web.v1' ||
      typeof data.connection !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(data.connection)
    )
      throw new ClientError('UNSUPPORTED');
    this.#connection = data.connection;
  }

  async invoke(operation: string, params: Readonly<Record<string, unknown>>): Promise<unknown> {
    if (!this.#connection) throw new ClientError('DISCONNECTED');
    return record(await this.#request('v1/rpc', 'POST', { operation, params })).result;
  }

  async #request(route: string, method: 'POST' | 'DELETE', body?: unknown): Promise<unknown> {
    const generation = this.#lifetime.capture();
    const controller = new AbortController();
    this.#active.add(controller);
    const timer = setTimeout(() => controller.abort(), 50_000);
    try {
      const url = endpointUrl(this.#endpoint, route);
      const response = await this.#fetch(url, this.#options(controller, method, body));
      this.#lifetime.assertCurrent(generation);
      this.#check(response, url);
      const data = await readBoundedJson(response, 4 * 1024 * 1024);
      this.#lifetime.assertCurrent(generation);
      return data;
    } catch (error) {
      this.#lifetime.assertCurrent(generation);
      throw safeError(error);
    } finally {
      clearTimeout(timer);
      this.#active.delete(controller);
    }
  }

  #options(controller: AbortController, method: string, body?: unknown): RequestInit {
    return {
      method,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${this.#token}`,
        'X-Bot-Connection': this.#connection,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    };
  }

  #check(response: Response, url: URL): void {
    if (!response.ok || (response.url && response.url !== url.href)) {
      void response.body?.cancel();
      throw new ClientError(
        response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : 'RPC_FAILED',
      );
    }
  }

  async events(onEvent: (event: BridgeEvent) => void): Promise<void> {
    if (!this.#connection) throw new ClientError('DISCONNECTED');
    const generation = this.#lifetime.capture();
    const controller = new AbortController();
    this.#active.add(controller);
    let idle = setTimeout(() => controller.abort(), 35_000);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const url = endpointUrl(this.#endpoint, 'v1/events');
      const response = await this.#fetch(url, this.#options(controller, 'GET'));
      this.#check(response, url);
      if (
        !response.body ||
        response.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/x-ndjson'
      )
        throw new ClientError('INVALID_RESPONSE');
      reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let pending = '';
      let ready = false;
      while (true) {
        const chunk = await reader.read();
        this.#lifetime.assertCurrent(generation);
        if (chunk.done) break;
        clearTimeout(idle);
        idle = setTimeout(() => controller.abort(), 35_000);
        pending += decoder.decode(chunk.value, { stream: true });
        if (pending.length > 4 * 1024 * 1024) throw new ClientError('RESPONSE_TOO_LARGE');
        let end: number;
        while ((end = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, end);
          pending = pending.slice(end + 1);
          if (!line) continue;
          const raw = record(JSON.parse(line));
          if (typeof raw.type !== 'string') throw new ClientError('INVALID_RESPONSE');
          if (!ready && raw.type !== 'bridge.ready') throw new ClientError('INVALID_RESPONSE');
          if (ready && raw.type === 'bridge.ready') throw new ClientError('INVALID_RESPONSE');
          ready = true;
          onEvent(raw as unknown as BridgeEvent);
        }
      }
      throw new ClientError('DISCONNECTED');
    } catch (error) {
      this.#lifetime.assertCurrent(generation);
      if (controller.signal.aborted) throw new ClientError('REQUEST_TIMEOUT');
      throw safeError(error);
    } finally {
      clearTimeout(idle);
      controller.abort();
      await reader?.cancel().catch(() => undefined);
      this.#active.delete(controller);
    }
  }

  disconnect(): void {
    if (this.#connection) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      // Capture headers before erasing credentials; independent of cancelled chat requests.
      void this.#fetch(
        endpointUrl(this.#endpoint, 'v1/connect'),
        this.#options(controller, 'DELETE'),
      )
        .then((response) => response.body?.cancel())
        .catch(() => undefined)
        .finally(() => clearTimeout(timer));
    }
    this.#lifetime.close();
    this.#token = '';
    this.#connection = '';
    for (const controller of this.#active) controller.abort();
    this.#active.clear();
  }
}
