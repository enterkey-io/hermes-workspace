import { describe, expect, it } from 'vitest';
import { nativeMessages } from '../conversation';
import { messageReactions, reactionReceipt } from './reactions';

describe('native message reactions', () => {
  it('preserves both authors from native history and removes internal seen metadata', () => {
    const [message] = nativeMessages([
      {
        row_id: 12,
        role: 'assistant',
        text: 'Ready',
        display_metadata: {
          reactions: [
            { emoji: '👍', author: 'user', seen: true },
            { emoji: '❤️', author: 'agent' },
          ],
        },
      },
    ]);
    expect(message?.reactions).toEqual([
      { emoji: '👍', author: 'user' },
      { emoji: '❤️', author: 'agent' },
    ]);
    expect(
      messageReactions([{ emoji: 'x', author: 'unknown' }, null, { author: 'agent' }]),
    ).toEqual([]);
  });
  it('addresses only a durable native row and handles a cleared reaction list', () => {
    expect(reactionReceipt({ row_id: 12, reactions: [] })).toEqual({ id: '12', reactions: [] });
    for (const value of [
      { row_id: '12', reactions: [] },
      { row_id: -1, reactions: [] },
      { row_id: true, reactions: [] },
      { row_id: 12 },
    ])
      expect(() => reactionReceipt(value)).toThrow();
  });
});
