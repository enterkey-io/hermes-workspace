import { messageReactions } from './chat/reactions';
import type { MessageReaction } from './chat/reactions';
export type Row = Record<string, unknown>;
export type ChatMessage = {
  role: string;
  text: string;
  id?: string | undefined;
  renderKey?: string | undefined;
  author?: string | undefined;
  timestamp?: string | number | undefined;
  source?: Row;
  files?: { id: string; name: string; size: number }[];
  toolName?: string;
  context?: string;
  reactions?: MessageReaction[];
};
function finalReply(value: unknown): string {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return '';
    }
  }
  if (!Array.isArray(value)) return '';
  return value
    .filter(
      (item) =>
        item?.type === 'message' &&
        item.role === 'assistant' &&
        !['analysis', 'commentary'].includes(String(item.phase ?? '').toLowerCase()),
    )
    .flatMap((item) =>
      Array.isArray(item.content)
        ? item.content
            .filter(
              (p: Row) =>
                ['output_text', 'text'].includes(String(p.type)) && typeof p.text === 'string',
            )
            .map((p: Row) => p.text)
        : [],
    )
    .join('');
}
export function nativeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('Invalid transcript');
  return value
    .filter((m) => m && ['user', 'assistant', 'tool'].includes(m.role))
    .map((m) => ({
      role: m.role,
      text:
        typeof m.text === 'string' && m.text.trim()
          ? m.text
          : m.role === 'assistant'
            ? finalReply(m.codex_message_items)
            : '',
      source: m,
      reactions: messageReactions(m.display_metadata?.reactions),
      ...(m.role === 'tool'
        ? {
            toolName: String(m.name ?? m.tool_name ?? 'Tool'),
            context: typeof m.context === 'string' ? m.context.slice(0, 1000) : '',
          }
        : {}),
      id: m.row_id == null ? undefined : String(m.row_id),
      timestamp:
        typeof m.timestamp === 'string' || typeof m.timestamp === 'number'
          ? m.timestamp
          : undefined,
    }));
}
export type TimelineItem =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'activity'; id: string; messages: ChatMessage[] };
/** Presentation never controls native history coverage or read cursors. */
export function projectTimeline(messages: ChatMessage[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const message of messages) {
    if (message.role === 'tool') {
      const previous = items.at(-1);
      if (previous?.kind === 'activity' && previous.messages.at(-1)?.author === message.author)
        previous.messages.push(message);
      else
        items.push({
          kind: 'activity',
          id: message.id ?? `activity-${items.length}`,
          messages: [message],
        });
    } else if (message.text.trim() || message.files?.length)
      items.push({ kind: 'message', message });
    else if (Array.isArray(message.source?.display_commentary)) {
      const text = message.source.display_commentary
        .filter((p: unknown) => typeof p === 'string')
        .join('\n');
      if (text.trim())
        items.push({
          kind: 'activity',
          id: message.id ?? `activity-${items.length}`,
          messages: [{ ...message, text }],
        });
    }
  }
  return items;
}
export function roomMessages(events: Row[]): ChatMessage[] {
  return events
    .filter(
      (e) =>
        (e.kind === 'message.user' || e.kind === 'message.member') &&
        typeof (e.payload as Row)?.text === 'string',
    )
    .map((e) => ({
      id: String(e.event_id ?? e.seq),
      role: e.kind === 'message.user' ? 'user' : 'assistant',
      text: String((e.payload as Row).text),
      author:
        typeof e.actor === 'string'
          ? e.actor
          : typeof (e.actor as Row)?.profile === 'string'
            ? String((e.actor as Row).profile)
            : typeof (e.actor as Row)?.id === 'string'
              ? String((e.actor as Row).id)
              : undefined,
      timestamp:
        typeof e.created_at === 'string' || typeof e.created_at === 'number'
          ? e.created_at
          : undefined,
    }));
}
export function messageDate(value?: string | number): Date | undefined {
  if (value == null) return;
  const d = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

export function withSharedFiles(
  messages: ChatMessage[],
  files: { id: string; name: string; size: number }[],
): ChatMessage[] {
  if (!files.length) return messages;
  return messages.map((message) => {
    if (message.role !== 'user') return message;
    const attached: typeof files = [];
    const text = message.text
      .replace(/@(?:file|image):(?:`[^`]+`|"[^"]+"|'[^']+'|\S+)/g, (ref) => {
        const file = files.find((f) => ref.includes(f.id + '_'));
        if (!file) return ref;
        if (!attached.some((f) => f.id === file.id)) attached.push(file);
        return '';
      })
      .trim();
    return attached.length
      ? {
          ...message,
          text: text === 'Please review the attached files.' ? '' : text,
          files: attached,
        }
      : message;
  });
}
