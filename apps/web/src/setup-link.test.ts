import { describe, expect, it, vi } from 'vitest';
import { consumeSetupLink } from './setup-link';

describe('private setup links', () => {
  it('removes the proof from history and returns it only to the caller', () => {
    const replaceState = vi.fn();
    const proof = 'p'.repeat(43);
    expect(
      consumeSetupLink({ hash: '#setup=' + proof, pathname: '/', search: '' }, { replaceState }),
    ).toBe(proof);
    expect(replaceState).toHaveBeenCalledExactlyOnceWith(null, '', '/');
  });
  it('clears malformed proofs without accepting them', () => {
    for (const proof of ['short', 'p'.repeat(44), '%70'.repeat(43), 'p'.repeat(42) + '<']) {
      const replaceState = vi.fn();
      expect(
        consumeSetupLink({ hash: '#setup=' + proof, pathname: '/', search: '' }, { replaceState }),
      ).toBe('');
      expect(replaceState).toHaveBeenCalledWith(null, '', '/');
    }
  });
  it('leaves ordinary fragments alone', () => {
    const replaceState = vi.fn();
    expect(
      consumeSetupLink({ hash: '#settings', pathname: '/', search: '' }, { replaceState }),
    ).toBe('');
    expect(replaceState).not.toHaveBeenCalled();
  });
});
