import type { ChatMessage } from '../conversation';

/** Correlates only native receipts; repeated message text is never an identity. */
export class SendProjection {
  private aliases = new Map<
    string,
    { renderKey: string; timestamp: string | number | undefined }
  >();
  reply = this.newReply();
  replying = false;
  private newReply() {
    return { renderKey: `reply-${crypto.randomUUID()}`, timestamp: new Date().toISOString() };
  }
  beginReply() {
    this.reply = this.newReply();
    this.replying = true;
  }
  completeReply(nativeId: unknown) {
    if (typeof nativeId === 'number' || typeof nativeId === 'string')
      this.aliases.set(String(nativeId), this.reply);
  }
  private pending:
    | {
        message: ChatMessage & { id: string; renderKey: string };
        before: Set<string>;
        nativeId?: string;
        acknowledged?: boolean;
        completed?: boolean;
      }
    | undefined;
  private latest: ChatMessage[] = [];
  begin(message: ChatMessage & { id: string; renderKey: string }, existing: ChatMessage[]) {
    this.pending = { message, before: new Set(existing.flatMap((m) => (m.id ? [m.id] : []))) };
    this.latest = existing;
    return [...existing, message];
  }
  acknowledge(nativeId: unknown) {
    if (this.pending) this.pending.acknowledged = true;
    if (this.pending && (typeof nativeId === 'number' || typeof nativeId === 'string')) {
      const id = String(nativeId);
      this.pending.nativeId = id;
      this.aliases.set(id, {
        renderKey: this.pending.message.renderKey,
        timestamp: this.pending.message.timestamp,
      });
    }
    return this.project(this.latest);
  }
  project(incoming: ChatMessage[], complete = false): ChatMessage[] {
    if (complete) this.replying = false;
    this.latest = incoming;
    const pending = this.pending;
    let rows = incoming;
    if (pending) {
      const found = pending.nativeId && incoming.some((m) => m.id === pending.nativeId);
      if (complete) pending.completed = true;
      if (found || (pending.completed && pending.acknowledged && !pending.nativeId))
        this.pending = undefined;
      else {
        // A native history event may beat its acknowledgement. Defer newly seen
        // user rows until that receipt rather than displaying a duplicate or
        // guessing that identical text came from this browser.
        rows = incoming.filter((m) => m.role !== 'user' || (m.id && pending.before.has(m.id)));
        const index = rows.findIndex((m) => m.id && !pending.before.has(m.id));
        rows = [...rows];
        rows.splice(index < 0 ? rows.length : index, 0, pending.message);
      }
    }
    return rows.map((m) => {
      const alias = m.id ? this.aliases.get(m.id) : undefined;
      return alias
        ? { ...m, renderKey: alias.renderKey, timestamp: alias.timestamp ?? m.timestamp }
        : m;
    });
  }
}
