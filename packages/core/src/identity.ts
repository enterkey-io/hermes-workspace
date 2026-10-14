import { ClientError } from './errors';

export interface BotOwner {
  readonly connectionId: string;
  readonly profile: string;
}

export function ownerKey(owner: BotOwner): string {
  if (!owner.connectionId || !/^[a-z0-9][a-z0-9_-]{0,63}$/iu.test(owner.profile)) {
    throw new ClientError('INVALID_RESPONSE');
  }
  return JSON.stringify([owner.connectionId, owner.profile]);
}

/** Every delayed result is checked against the current in-memory generation. */
export class ConnectionLifetime {
  #generation = 0;
  #closed = false;

  capture(): number {
    if (this.#closed) throw new ClientError('DISCONNECTED');
    return this.#generation;
  }

  assertCurrent(generation: number): void {
    if (this.#closed || generation !== this.#generation) throw new ClientError('DISCONNECTED');
  }

  close(): void {
    this.#closed = true;
    this.#generation += 1;
  }
}
