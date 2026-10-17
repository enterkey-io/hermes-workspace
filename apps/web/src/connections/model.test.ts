import { expect, it } from 'vitest';
import { permissions, policyLabel, keySaved, authFlow } from './model';
it('preserves native, deny-all and explicit policies as distinct states', () => {
  const parse = (allowed_tools: unknown) => permissions({ fingerprint: 'native', allowed_tools });
  expect(policyLabel(parse(null).policy)).toBe('Uses Hermes tool settings');
  expect(policyLabel(parse([]).policy)).toBe('No tools allowed');
  expect(parse(['read']).policy).toEqual({ kind: 'custom', names: ['read'] });
  expect(() => parse(undefined)).toThrow();
  expect(() => parse([2])).toThrow();
});
it('does not offer bearer editing for OAuth or claim a failed save succeeded', () => {
  expect(
    permissions({ fingerprint: 'native', allowed_tools: [], auth: 'oauth', bearer_supported: true })
      .bearer,
  ).toBe(false);
  expect(() => keySaved({ saved: false })).toThrow();
  expect(() => keySaved({})).toThrow();
  expect(() => keySaved({ saved: true })).not.toThrow();
  expect(() =>
    authFlow({
      id: 'flow',
      authorization_url: 'http://example.test',
      status: 'authorization_required',
    }),
  ).toThrow();
});
