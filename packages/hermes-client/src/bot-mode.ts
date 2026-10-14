import { ClientError, ownerKey, safeError } from '@hermes-client/core';
import type { BotOwner } from '@hermes-client/core';
import { record } from './json';

/** A transport implementation must pass the authentication gate before use. */
export interface NativeRpc {
  request(method: string, params: Readonly<Record<string, unknown>>): Promise<unknown>;
}

export interface ManagedBot {
  readonly owner: BotOwner;
  readonly name: string;
  readonly description: string;
}

export function parseManagedBots(value: unknown, connectionId: string): readonly ManagedBot[] {
  const response = record(value);
  if (!Array.isArray(response.profiles) || response.profiles.length > 1000) {
    throw new ClientError('INVALID_RESPONSE');
  }
  const seen = new Set<string>();
  const bots: ManagedBot[] = [];
  for (const raw of response.profiles) {
    const profile = record(raw);
    const metadata = profile.ui_meta === undefined ? {} : record(profile.ui_meta);
    // Every profile is not automatically a Bot Mode managed bot.
    if (!Object.hasOwn(metadata, 'hermes-bots')) continue;
    const bot = record(metadata['hermes-bots']);
    if (typeof profile.name !== 'string') throw new ClientError('INVALID_RESPONSE');
    const owner = Object.freeze({ connectionId, profile: profile.name });
    const identity = ownerKey(owner);
    if (seen.has(identity)) throw new ClientError('INVALID_RESPONSE');
    seen.add(identity);
    const name = bot.title ?? profile.display_name ?? profile.name;
    const description = bot.description ?? profile.description ?? '';
    if (
      typeof name !== 'string' ||
      name.length > 256 ||
      typeof description !== 'string' ||
      description.length > 4096
    ) {
      throw new ClientError('INVALID_RESPONSE');
    }
    bots.push(Object.freeze({ owner, name: name || profile.name, description }));
  }
  return bots;
}

/** Read-only native inventory; it does not implement or simulate coordination. */
export async function readNativeInventory(
  rpc: NativeRpc,
  connectionId: string,
): Promise<{
  readonly bots: readonly ManagedBot[];
  readonly nativeRoomDriverAvailable: boolean;
  readonly botModeCertified: false;
}> {
  try {
    const profiles = await rpc.request('profiles.list', { include_sessions: true });
    const groups = record(await rpc.request('groups.capabilities', {}));
    if (typeof groups.driver !== 'boolean') throw new ClientError('INVALID_RESPONSE');
    return {
      bots: parseManagedBots(profiles, connectionId),
      nativeRoomDriverAvailable: groups.driver,
      botModeCertified: false,
    };
  } catch (error) {
    throw safeError(error);
  }
}
