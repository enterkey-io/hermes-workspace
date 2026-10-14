export const requiredBotModeEvidence = [
  'hosted-origin-auth',
  'managed-roster',
  'canonical-continuity',
  'native-teammate-delivery',
  'native-room-driver',
  'bot-owned-routines',
  'runtime-controls',
] as const;

export type EvidenceGate = (typeof requiredBotModeEvidence)[number];
export type EvidenceLevel =
  | 'source-only'
  | 'synthetic-pass'
  | 'real-runtime-pass'
  | 'browser-pass'
  | 'blocked'
  | 'unverified';

export interface CompatibilityEvidence {
  readonly revision: string;
  readonly topology: 'hosted-separate-origin' | 'self-hosted-same-origin' | 'localhost-development';
  readonly gates: Readonly<Partial<Record<EvidenceGate, EvidenceLevel>>>;
}

export function assessBotMode(evidence: CompatibilityEvidence): {
  readonly certified: boolean;
  readonly missing: readonly EvidenceGate[];
} {
  const missing = requiredBotModeEvidence.filter((gate) => {
    const value = evidence.gates[gate];
    return gate === 'hosted-origin-auth'
      ? evidence.topology !== 'hosted-separate-origin' || value !== 'browser-pass'
      : value !== 'real-runtime-pass' && value !== 'browser-pass';
  });
  return { certified: missing.length === 0, missing };
}
