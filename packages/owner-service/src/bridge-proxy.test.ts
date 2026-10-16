import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { request } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { proxyBridgeUpgrade } from './bridge-proxy';
vi.mock('node:http', () => ({ request: vi.fn() }));
function socket() {
  return Object.assign(new EventEmitter(), {
    end: vi.fn(),
    write: vi.fn(),
    destroy: vi.fn(),
    pipe: vi.fn(),
  }) as unknown as Socket;
}
function incoming(changes: Record<string, unknown> = {}) {
  return {
    method: 'GET',
    url: '/v1/computer/stream?ticket=' + 't'.repeat(43),
    headers: {
      host: 'owner.test',
      origin: 'https://owner.test',
      upgrade: 'websocket',
      connection: 'Upgrade',
      'sec-websocket-version': '13',
      'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
      cookie: 'OWNER_SESSION',
      authorization: 'Bearer NEVER_FORWARD',
    },
    rawHeaders: [
      'Host',
      'owner.test',
      'Origin',
      'https://owner.test',
      'Sec-WebSocket-Key',
      'dGhlIHNhbXBsZSBub25jZQ==',
    ],
    ...changes,
  } as unknown as IncomingMessage;
}
describe('fixed Computer websocket proxy', () => {
  beforeEach(() => vi.mocked(request).mockReset());
  it('rejects arbitrary paths, destinations, duplicate headers, non-websocket requests and token-shaped extras', () => {
    for (const change of [
      { url: 'https://evil.test/other' },
      { url: '/v1/computer/stream?ticket=' + 't'.repeat(43) + '&token=bad' },
      { headers: { ...incoming().headers, origin: 'https://evil.test' } },
      { rawHeaders: [...incoming().rawHeaders, 'Origin', 'https://owner.test'] },
      { headers: { ...incoming().headers, upgrade: 'different' } },
    ]) {
      const client = socket();
      proxyBridgeUpgrade(incoming(change), client, Buffer.alloc(0), 'https://owner.test', 8798);
      expect(client.end).toHaveBeenCalledWith(expect.stringContaining('403'));
    }
    expect(request).not.toHaveBeenCalled();
  });
  it('forwards only the exact fixed-loopback handshake and binary head; never cookies or authorization', () => {
    const upstream = Object.assign(new EventEmitter(), {
      setTimeout: vi.fn(),
      destroy: vi.fn(),
      end: vi.fn(),
    });
    vi.mocked(request).mockReturnValue(upstream as never);
    const client = socket(),
      peer = socket();
    proxyBridgeUpgrade(incoming(), client, Buffer.from('client-head'), 'https://owner.test', 8798);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: '127.0.0.1',
        port: 8798,
        headers: {
          Host: 'owner.test',
          Origin: 'https://owner.test',
          Upgrade: 'websocket',
          Connection: 'Upgrade',
          'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
          'Sec-WebSocket-Version': '13',
        },
      }),
    );
    upstream.emit(
      'upgrade',
      { statusCode: 101, headers: { 'sec-websocket-accept': 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=' } },
      peer,
      Buffer.from('server-head'),
    );
    expect(client.write).toHaveBeenCalledWith(Buffer.from('server-head'));
    expect(peer.write).toHaveBeenCalledWith(Buffer.from('client-head'));
    expect(client.pipe).toHaveBeenCalledWith(peer);
    expect(peer.pipe).toHaveBeenCalledWith(client);
  });
});
