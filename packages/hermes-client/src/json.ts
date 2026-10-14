import { ClientError } from '@hermes-client/core';

export function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ClientError('INVALID_RESPONSE');
  }
  return value as Record<string, unknown>;
}

export async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  const announced = Number(response.headers.get('content-length'));
  if (Number.isFinite(announced) && announced > maxBytes) {
    await response.body?.cancel();
    throw new ClientError('RESPONSE_TOO_LARGE');
  }
  if (!response.body) throw new ClientError('INVALID_RESPONSE');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new ClientError('RESPONSE_TOO_LARGE');
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new ClientError('INVALID_RESPONSE');
  }
}
