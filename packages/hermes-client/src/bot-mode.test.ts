import { describe, expect, it, vi } from 'vitest';
import { parseManagedBots, readNativeInventory } from './bot-mode';
import type { NativeRpc } from './bot-mode';

const nativeProfiles = {
  profiles: [
    { name: 'default', description: 'Ordinary profile', ui_meta: {} },
    {
      name: 'researcher',
      ui_meta: { 'hermes-bots': { title: 'Researcher', description: 'Find sources' } },
    },
    { name: 'writer', ui_meta: { 'hermes-bots': {} } },
  ],
};

describe('native Bot Mode inventory', () => {
  it('does not expose remote RPC error text or credentials', async () => {
    const request = vi
      .fn<NativeRpc['request']>()
      .mockRejectedValue(new Error('private-url-and-key'));
    await expect(readNativeInventory({ request }, 'one')).rejects.toMatchObject({
      code: 'REQUEST_FAILED',
      message:
        'The request failed. Check network access, origin permissions, and server configuration.',
    });
  });
  it('uses backend-managed markers and does not invent bots for ordinary profiles', () => {
    expect(
      parseManagedBots(nativeProfiles, 'connection-one').map((bot) => bot.owner.profile),
    ).toEqual(['researcher', 'writer']);
  });

  it('rejects duplicate or malformed backend identities', () => {
    expect(() =>
      parseManagedBots(
        { profiles: [nativeProfiles.profiles[1], nativeProfiles.profiles[1]] },
        'one',
      ),
    ).toThrow();
    expect(() =>
      parseManagedBots(
        { profiles: [{ name: '../default', ui_meta: { 'hermes-bots': {} } }] },
        'one',
      ),
    ).toThrow();
  });

  it('preserves remote text as data without rendering it or fetching avatars', () => {
    expect(
      parseManagedBots(
        {
          profiles: [
            {
              name: 'bot',
              ui_meta: {
                'hermes-bots': {
                  title: '<script>steal()</script>',
                  avatar: 'https://tracking.test',
                },
              },
            },
          ],
        },
        'one',
      )[0]?.name,
    ).toBe('<script>steal()</script>');
  });

  it('uses the native read-only RPCs and does not certify synthetic transport', async () => {
    const request = vi
      .fn<NativeRpc['request']>()
      .mockResolvedValueOnce(nativeProfiles)
      .mockResolvedValueOnce({ driver: true });
    const inventory = await readNativeInventory({ request }, 'one');
    expect(request.mock.calls).toEqual([
      ['profiles.list', { include_sessions: true }],
      ['groups.capabilities', {}],
    ]);
    expect(inventory.nativeRoomDriverAvailable).toBe(true);
    expect(inventory.botModeCertified).toBe(false);
  });
});
