import { describe, expect, it } from 'vitest';
import { workspaceState } from '../../../apps/web/src/workspace';

export function workspaceFixture() {
  return {
    id: 'synthetic-workspace', revision: 2, initialized: true, orchestrator: 'default',
    teams: [{ id: 'research', name: 'Research' }],
    bots: [{ id: 'synthetic-incarnation', profile: 'default', handle: 'hermes', name: 'Hermes',
      description: '', managed: true, enrolled: true, canonical: true, manager: null,
      team: 'research', appearance: { kind: 'shape', shape: 'pebble', color: 'iris' },
      role: { title: '', description: '', responsibilities: '', boundaries: '', expectedOutputs: '' } }],
  };
}

describe('workspace boundary', () => {
  it('accepts the native required shape and additive metadata without adding omitted fields', () => {
    const value = { ...workspaceFixture(), schema: 1, future: { enabled: true } };
    const parsed = workspaceState(value);
    expect(parsed.bots[0]).not.toHaveProperty('cursor_type');
    expect(parsed.bots[0]?.team).toBe('research');
    expect(parsed.bots[0]?.role.expectedOutputs).toBe('');
  });

  it.each([
    ['missing workspace identity', (v: ReturnType<typeof workspaceFixture>) => Reflect.deleteProperty(v, 'id')],
    ['missing bot identity', (v: ReturnType<typeof workspaceFixture>) => Reflect.deleteProperty(v.bots[0]!, 'id')],
    ['array appearance', (v: ReturnType<typeof workspaceFixture>) => Reflect.set(v.bots[0]!, 'appearance', [])],
    ['string appearance', (v: ReturnType<typeof workspaceFixture>) => Reflect.set(v.bots[0]!, 'appearance', 'shape')],
    ['unknown shape', (v: ReturnType<typeof workspaceFixture>) => Reflect.set(v.bots[0]!.appearance, 'shape', 'cube')],
    ['invalid role', (v: ReturnType<typeof workspaceFixture>) => Reflect.set(v.bots[0]!, 'role', 'Research')],
    ['missing role detail', (v: ReturnType<typeof workspaceFixture>) => Reflect.deleteProperty(v.bots[0]!.role, 'boundaries')],
    ['numeric manager', (v: ReturnType<typeof workspaceFixture>) => Reflect.set(v.bots[0]!, 'manager', 42)],
    ['invalid team', (v: ReturnType<typeof workspaceFixture>) => Reflect.set(v.bots[0]!, 'team', {})],
    ['invalid optional flag', (v: ReturnType<typeof workspaceFixture>) => Reflect.set(v.bots[0]!, 'pinned', 'yes')],
    ['invalid optional cursor', (v: ReturnType<typeof workspaceFixture>) => Reflect.set(v.bots[0]!, 'cursor', -1)],
    ['invalid model grant', (v: ReturnType<typeof workspaceFixture>) => Reflect.set(v, 'model_grant', { supported: true })],
    ['invalid team entry', (v: ReturnType<typeof workspaceFixture>) => Reflect.set(v, 'teams', [{ id: 3, name: 'Research' }])],
  ])('rejects %s before replacing a valid snapshot', (_label, mutate) => {
    const value = workspaceFixture();
    let accepted = workspaceState(value);
    const malformed = structuredClone(value);
    mutate(malformed);
    expect(() => { accepted = workspaceState(malformed); }).toThrow();
    expect(accepted).toEqual(value);
  });
});
