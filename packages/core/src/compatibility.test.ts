import { describe, expect, it } from 'vitest';
import { assessBotMode, requiredBotModeEvidence } from './compatibility';
import type { CompatibilityEvidence, EvidenceLevel } from './compatibility';

function report(level: EvidenceLevel): CompatibilityEvidence {
  return {
    revision: 'fixture',
    topology: 'hosted-separate-origin',
    transport: 'trusted-owner-https',
    gates: Object.fromEntries(requiredBotModeEvidence.map((key) => [key, level])),
  };
}

describe('genuine Bot Mode acceptance', () => {
  it.each(['source-only', 'synthetic-pass', 'unverified', 'blocked'] as const)(
    'never certifies %s evidence',
    (level) => {
      expect(assessBotMode(report(level)).certified).toBe(false);
    },
  );

  it('requires real native behaviors and a successful hosted browser auth test', () => {
    const evidence = report('real-runtime-pass');
    expect(assessBotMode(evidence).missing).toEqual(['hosted-origin-auth']);
    expect(
      assessBotMode({
        ...evidence,
        gates: { ...evidence.gates, 'hosted-origin-auth': 'browser-pass' },
      }).certified,
    ).toBe(true);
  });

  it('requires trusted transport for either hosting mode and never certifies localhost', () => {
    expect(
      assessBotMode({
        ...report('browser-pass'),
        topology: 'self-hosted-same-origin',
        transport: 'development-test-certificate',
      }).certified,
    ).toBe(false);
    expect(
      assessBotMode({ ...report('browser-pass'), topology: 'localhost-development' }).certified,
    ).toBe(false);
  });

  it('can certify a real owner-hosted plugin only when all native and trusted route gates pass', () => {
    expect(
      assessBotMode({ ...report('browser-pass'), topology: 'self-hosted-same-origin' }).certified,
    ).toBe(true);
    expect(
      assessBotMode({
        revision: 'fixture',
        topology: 'self-hosted-same-origin',
        gates: report('browser-pass').gates,
      }).certified,
    ).toBe(false);
  });

  it('cannot replace teammate delivery with ordinary chat success', () => {
    expect(
      assessBotMode({
        ...report('browser-pass'),
        gates: { ...report('browser-pass').gates, 'native-teammate-delivery': 'synthetic-pass' },
      }).missing,
    ).toEqual(['native-teammate-delivery']);
  });
});
