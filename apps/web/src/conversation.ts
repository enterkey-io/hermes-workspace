export type Row = Record<string, unknown>;
export type ChatMessage = {
  role: string;
  text: string;
  id?: string | undefined;
  author?: string | undefined;
  timestamp?: string | number | undefined;
};
export function nativeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('Invalid transcript');
  return value
    .filter((m) => m && ['user', 'assistant', 'tool'].includes(m.role))
    .map((m) => ({
      role: m.role,
      text: typeof m.text === 'string' ? m.text : String(m.name ?? ''),
      id: m.row_id == null ? undefined : String(m.row_id),
      timestamp:
        typeof m.timestamp === 'string' || typeof m.timestamp === 'number'
          ? m.timestamp
          : undefined,
    }));
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
