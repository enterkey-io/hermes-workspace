export type MessageReaction = { emoji: string; author: 'user' | 'agent' };

export function messageReactions(value: unknown): MessageReaction[] {
  if (!Array.isArray(value)) return [];
  const authors = new Map<MessageReaction['author'], MessageReaction>();
  for (const entry of value.slice(0, 100)) {
    if (
      entry &&
      typeof entry === 'object' &&
      'emoji' in entry &&
      typeof entry.emoji === 'string' &&
      entry.emoji.length > 0 &&
      entry.emoji.length <= 64 &&
      'author' in entry &&
      (entry.author === 'user' || entry.author === 'agent')
    )
      authors.set(entry.author, { emoji: entry.emoji, author: entry.author });
  }
  return [...authors.values()];
}

export function reactionReceipt(value: unknown): { id: string; reactions: MessageReaction[] } {
  if (
    !value ||
    typeof value !== 'object' ||
    !('row_id' in value) ||
    typeof value.row_id !== 'number' ||
    !Number.isSafeInteger(value.row_id) ||
    value.row_id <= 0 ||
    !('reactions' in value) ||
    !Array.isArray(value.reactions)
  )
    throw new Error('Invalid reaction receipt');
  return { id: String(value.row_id), reactions: messageReactions(value.reactions) };
}

export const reactionChoices = [
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '🎉', label: 'Celebrate' },
  { emoji: '😮', label: 'Surprised' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '👀', label: 'Eyes' },
  { emoji: '🙏', label: 'Thank you' },
] as const;
