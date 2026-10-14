import { describe, expect, it, vi } from 'vitest';
import { normalizeEndpoint } from '@hermes-client/core';
import { BotBridgeClient } from './bridge';

const token = 't'.repeat(43);
const connection = 'c'.repeat(43);
const endpoint = normalizeEndpoint('https://personal.example.test/bridge');
function connectedResponse() {
  return Response.json({ protocol: 'hermes-bot-web.v1', connection });
}

describe('direct Bot Mode bridge', () => {
  it('keeps credentials in headers, refuses redirects/cookies and preserves endpoint prefix', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(connectedResponse())
      .mockResolvedValueOnce(Response.json({ result: { bots: [] } }));
    const client = new BotBridgeClient(endpoint, token, fetcher);
    await client.connect();
    await client.invoke('bots.list', {});
    expect(String(fetcher.mock.calls[0]![0])).toBe(
      'https://personal.example.test/bridge/v1/connect',
    );
    const options = fetcher.mock.calls[1]![1]!;
    expect(options).toMatchObject({
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    expect(options.headers).toMatchObject({
      Authorization: `Bearer ${token}`,
      'X-Bot-Connection': connection,
    });
    expect(options.body).not.toContain(token);
  });

  it('does not accept agent REST as a Bot Mode plugin', async () => {
    const client = new BotBridgeClient(
      endpoint,
      token,
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ features: { chat: true } })),
    );
    await expect(client.connect()).rejects.toMatchObject({ code: 'UNSUPPORTED' });
  });

  it('sanitizes remote errors without exposing credentials or private addresses', async () => {
    const client = new BotBridgeClient(
      endpoint,
      token,
      vi.fn<typeof fetch>().mockRejectedValue(new Error(`${token} personal.example.test`)),
    );
    await expect(client.connect()).rejects.toMatchObject({ code: 'REQUEST_FAILED' });
    try {
      await client.connect();
    } catch (error) {
      expect(String(error)).not.toContain(token);
      expect(String(error)).not.toContain('personal.example.test');
    }
  });

  it('decodes native events split across UTF-8 chunks', async () => {
    const encoded = new TextEncoder().encode(
      '{"type":"message.delta","session_id":"live","payload":{"text":"🤖"}}\n',
    );
    const body = new ReadableStream({
      start(controller) {
        for (const byte of encoded) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(connectedResponse())
      .mockResolvedValueOnce(new Response(body));
    const client = new BotBridgeClient(endpoint, token, fetcher);
    const observer = vi.fn();
    await client.connect();
    await expect(client.events(observer)).rejects.toMatchObject({ code: 'DISCONNECTED' });
    expect(observer).toHaveBeenCalledWith({
      type: 'message.delta',
      session_id: 'live',
      payload: { text: '🤖' },
    });
  });

  it('rejects late responses after disconnect and submits a bounded lease close', async () => {
    let resolve: (response: Response) => void = () => undefined;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(connectedResponse())
      .mockImplementationOnce(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValueOnce(Response.json({ disconnected: true }));
    const client = new BotBridgeClient(endpoint, token, fetcher);
    await client.connect();
    const pending = client.invoke('chat.send', { session_id: 'live', text: 'Hello' });
    client.disconnect();
    resolve(Response.json({ result: { accepted: true } }));
    await expect(pending).rejects.toMatchObject({ code: 'DISCONNECTED' });
    expect(fetcher.mock.calls[2]![1]).toMatchObject({ method: 'DELETE' });
    await expect(client.invoke('bots.list', {})).rejects.toMatchObject({ code: 'DISCONNECTED' });
  });
});
