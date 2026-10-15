import { request } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

const routes = new Map([
  ['/v1/connect', ['POST', 'DELETE']],
  ['/v1/renew', ['POST']],
  ['/v1/rpc', ['POST']],
  ['/v1/avatar', ['POST']],
  ['/v1/events', ['GET']],
  ['/v1/oauth/callback', ['GET']],
]);

/** Fixed loopback destination and narrow protocol routes; never a general proxy. */
export function proxyBridge(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  origin: string,
  port: number,
) {
  const url = new URL(incoming.url!, origin);
  const callback = url.pathname === '/v1/oauth/callback';
  const suppliedOrigin = incoming.headers.origin;
  if (
    !routes.get(url.pathname)?.includes(incoming.method ?? '') ||
    (!callback && url.search) ||
    (suppliedOrigin && suppliedOrigin !== origin) ||
    (!callback && !suppliedOrigin && incoming.headers['sec-fetch-site'] !== 'same-origin')
  ) {
    outgoing.writeHead(403).end();
    return;
  }
  const limit = url.pathname === '/v1/avatar' ? 3_000_000 : 65_536;
  if (Number(incoming.headers['content-length'] ?? 0) > limit) {
    outgoing.writeHead(413).end();
    return;
  }
  const headers: Record<string, string | string[]> = { host: new URL(origin).host };
  for (const name of [
    'origin',
    'authorization',
    'content-type',
    'content-length',
    'x-bot-connection',
    'sec-fetch-site',
  ]) {
    const value = incoming.headers[name];
    if (value) headers[name] = value;
  }
  const upstream = request(
    {
      hostname: '127.0.0.1',
      port,
      method: incoming.method,
      path: url.pathname + url.search,
      headers,
    },
    (response) => {
      // The integration cannot set owner-login cookies or replace security headers.
      const responseHeaders: Record<string, string | string[]> = {};
      for (const name of ['content-type', 'location', 'retry-after']) {
        const value = response.headers[name];
        if (value) responseHeaders[name] = value;
      }
      responseHeaders['cache-control'] = 'no-store, no-transform';
      responseHeaders['x-accel-buffering'] = 'no';
      outgoing.writeHead(response.statusCode ?? 502, responseHeaders);
      outgoing.flushHeaders();
      response.on('error', () => outgoing.end());
      response.pipe(outgoing);
      outgoing.on('close', () => response.destroy());
    },
  );
  upstream.setTimeout(45000, () => upstream.destroy());
  upstream.on('error', () => {
    if (!outgoing.headersSent) outgoing.writeHead(503, { 'Retry-After': '2' });
    outgoing.end();
  });
  outgoing.on('close', () => upstream.destroy());
  let consumed = 0;
  incoming.on('data', (chunk: Buffer) => {
    consumed += chunk.length;
    if (consumed > limit) {
      if (!outgoing.headersSent) outgoing.writeHead(413);
      outgoing.end();
      upstream.destroy();
      incoming.unpipe(upstream);
      incoming.destroy();
    }
  });
  incoming.on('aborted', () => upstream.destroy());
  incoming.pipe(upstream);
}
