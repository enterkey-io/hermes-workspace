import { describe, it, expect } from 'vitest';
import { nativeMessages, roomMessages, messageDate } from './conversation';
describe('native conversation projection', () => {
  it('retains durable identities and native timestamps without fabricating them', () => {
    const messages = nativeMessages([
      { role: 'assistant', text: 'Hello', row_id: 21, timestamp: 1700000000 },
      { role: 'user', text: 'Hi' },
      { role: 'system', text: 'private context' },
    ]);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ id: '21', timestamp: 1700000000 });
    expect(messages[1]?.timestamp).toBeUndefined();
    expect(messageDate(1700000000)?.toISOString()).toBe('2023-11-14T22:13:20.000Z');
    expect(messageDate('invalid')).toBeUndefined();
  });
  it('uses actual crew participant identity and excludes control events', () => {
    const messages = roomMessages([
      {
        event_id: 'm1',
        kind: 'message.member',
        actor: { id: 'member-1', profile: 'research' },
        payload: { text: 'Ready' },
        created_at: 1700000000,
      },
      { event_id: 'control', kind: 'task.completed', payload: { text: 'Do not show as chat' } },
      { event_id: 'u1', kind: 'message.user', payload: { text: 'Start' }, created_at: 1700000001 },
    ]);
    expect(messages.map((m) => m.id)).toEqual(['m1', 'u1']);
    expect(messages[0]?.author).toBe('research');
    expect(messages[1]?.role).toBe('user');
  });
});
