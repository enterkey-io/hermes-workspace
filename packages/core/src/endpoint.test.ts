import { describe, expect, it } from 'vitest';
import { endpointUrl, normalizeEndpoint } from './endpoint';
import { ownerKey, ConnectionLifetime } from './identity';

describe('endpoint trust boundary', () => {
  it('preserves a path-prefixed endpoint and never changes its authority', () => {
    const endpoint = normalizeEndpoint('https://example.test/hermes/');
    expect(endpointUrl(endpoint, 'v1/capabilities').href).toBe(
      'https://example.test/hermes/v1/capabilities',
    );
    expect(Object.isFrozen(endpoint)).toBe(true);
  });

  it.each([
    'http://example.test',
    'javascript:alert(1)',
    'https://key:secret@example.test',
    'https://example.test?key=secret',
    'https://example.test#secret',
    'https://example.test/a/../b',
    'https://example.test/%2e%2e/b',
    'https://example.test/%252e%252e',
    'https://example.test/a%2fb',
    'https://example.test\\evil',
    'https://example.test/\nsecret',
  ])('rejects unsafe endpoint %s', (endpoint) => {
    expect(() => normalizeEndpoint(endpoint)).toThrow('Enter a trusted HTTPS endpoint');
  });

  it('requires explicit development permission for loopback HTTP', () => {
    expect(() => normalizeEndpoint('http://127.0.0.1:8000')).toThrow();
    expect(normalizeEndpoint('http://127.0.0.1:8000', true).origin).toBe('http://127.0.0.1:8000');
    expect(() => normalizeEndpoint('http://192.168.1.2', true)).toThrow();
  });

  it.each(['https://foreign.test', '//foreign.test', '/v1/models', '../secrets', 'v1//models'])(
    'rejects foreign or ambiguous route %s',
    (route) => {
      expect(() => endpointUrl(normalizeEndpoint('https://example.test'), route)).toThrow();
    },
  );
});

describe('connection and profile identity', () => {
  it('isolates same-named profiles on different connections', () => {
    expect(ownerKey({ connectionId: 'first', profile: 'researcher' })).not.toBe(
      ownerKey({ connectionId: 'second', profile: 'researcher' }),
    );
    expect(() => ownerKey({ connectionId: 'first', profile: '../default' })).toThrow();
  });

  it('invalidates pending results after disconnect', () => {
    const lifetime = new ConnectionLifetime();
    const generation = lifetime.capture();
    lifetime.close();
    expect(() => lifetime.assertCurrent(generation)).toThrow('This connection has been closed');
    expect(() => lifetime.capture()).toThrow();
  });
});
