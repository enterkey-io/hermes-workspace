import type { BrowserContext, Page } from '@playwright/test';
import type { WorkspaceState } from '../../apps/web/src/workspace';
export const names = [
  'Arlo',
  'Mica',
  'Rowan',
  'Sage',
  'Ember',
  'Cleo',
  'Lumen',
  'Indigo',
  'Fern',
  'Quinn',
  'Sol',
  'Wren',
];
export function fixtureState(): WorkspaceState {
  return {
    id: 'synthetic-owner',
    revision: 1,
    initialized: true,
    orchestrator: 'arlo',
    teams: [
      { id: 'operations', name: 'Operations' },
      { id: 'research', name: 'Research' },
    ],
    bots: names.map((name, i) => ({
      id: `identity-${i}`,
      profile: name.toLowerCase(),
      name,
      handle: name.toLowerCase(),
      description: '',
      managed: true,
      enrolled: true,
      canonical: true,
      manager: i ? 'arlo' : null,
      team: i > 5 ? 'research' : i > 1 ? 'operations' : null,
      appearance: {
        kind: 'shape',
        shape: (['pebble', 'beacon', 'petal', 'kite', 'arch'] as const)[i % 5]!,
        color: ['white', 'sky', 'iris', 'rose', 'clay', 'lagoon', 'citron'][i % 7]!,
      },
      role: {
        title: ['Team lead', 'Executive assistant', 'Operations', 'Researcher'][i % 4]!,
        description: '',
        responsibilities: '',
        boundaries: '',
        expectedOutputs: '',
      },
      pinned: i < 2,
      pin_configured: true,
      preview: [
        'The research brief is ready for your review.',
        'I found three useful sources.',
        'The weekly report is ready.',
      ][i % 3]!,
      cursor: 28,
      read_key: `read-${i}`,
      unread: i === 4,
    })),
  };
}
export const history = Array.from({ length: 28 }, (_, i) => ({
  row_id: i + 1,
  role: i % 4 === 3 ? 'user' : 'assistant',
  timestamp: 1700000000 + i * 600,
  text:
    i % 4 === 3
      ? 'Please prepare a short overview.'
      : i === 26
        ? '## Research update\n\nThe draft is ready. Here are the next steps:\n\n- Review the sources\n- Pick the priorities\n- Share your notes\n\n```js\nconst ready = true;\n```'
        : 'Here is the latest update on the project. The source material is organized and ready to review. We can work through the remaining decisions together.',
}));
export async function installFixture(context: BrowserContext) {
  await context.route('http://127.0.0.1:8093/', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy':
          "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https:;",
      },
    });
  });
  let state = fixtureState();
  let prefs = { revision: 0, pin_order: ['identity-0', 'identity-1'] };
  let requests: Record<string, unknown>[] = [];
  let routines = [
    {
      job_id: 'routine-1',
      name: 'Weekly research brief',
      schedule: 'Every Monday at 9:00 AM',
      enabled: true,
    },
  ];
  let leaseCounter = 0;
  const leases = new Map<string, Set<string>>();
  const read = new Map<string, number>();
  let approvals: Record<string, unknown>[] = [];
  await context.addInitScript(() => {
    const original = window.fetch;
    const streams = new Set<ReadableStreamDefaultController<Uint8Array>>();
    Object.assign(window, {
      __chatEvent: (event: unknown) => {
        for (const stream of streams)
          stream.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n\n'));
      },
      __breakStream: () => {
        for (const stream of streams) stream.close();
        streams.clear();
      },
    });
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/v1/events')) {
        let controller: ReadableStreamDefaultController<Uint8Array>;
        let timer: ReturnType<typeof setInterval>;
        const body = new ReadableStream<Uint8Array>({
          start(c) {
            controller = c;
            streams.add(c);
            c.enqueue(new TextEncoder().encode('{"type":"bridge.ready"}\n\n'));
            timer = setInterval(
              () => c.enqueue(new TextEncoder().encode('{"type":"bridge.heartbeat"}\n\n')),
              1000,
            );
          },
          cancel() {
            clearInterval(timer);
            streams.delete(controller);
          },
        });
        init?.signal?.addEventListener('abort', () => {
          clearInterval(timer);
          streams.delete(controller);
          try {
            controller.close();
          } catch {
            /* already ended */
          }
        });
        return new Response(body, { headers: { 'content-type': 'application/x-ndjson' } });
      }
      return original(input, init);
    };
  });
  await context.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const value =
      path === '/api/instance/status'
        ? { setupRequired: false }
        : path === '/api/hermes/ticket'
          ? { ticket: 'f'.repeat(43), bridgeUrl: 'https://hermes.fixture.invalid' }
          : { user: { id: 'owner' } };
    await route.fulfill({ json: value });
  });
  await context.route('https://hermes.fixture.invalid/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/v1/connect') {
      const connection = String(++leaseCounter).padStart(43, 'c');
      leases.set(connection, new Set());
      await route.fulfill({
        json: {
          protocol: 'hermes-bot-web.v1',
          connection,
          capabilities: { workspace: true, existing_agents: true },
        },
      });
      return;
    }
    if (path === '/v1/renew') {
      await route.fulfill({ json: { renewed: true } });
      return;
    }
    const { operation, params } = route.request().postDataJSON();
    const lease = leases.get(route.request().headers()['x-bot-connection'] ?? '');
    if (operation.startsWith('chat.') && !lease?.has(params.session_id)) {
      await route.fulfill({ status: 400, json: { code: 'INVALID_PARAMETERS' } });
      return;
    }
    if (operation === 'bot.open') lease?.add(`session-${params.profile}`);
    let result: unknown = {};
    if (operation === 'workspace.snapshot')
      result = {
        workspace: state,
        bots: state.bots.filter((b) => b.managed && !b.hidden),
        rooms: [
          {
            room_id: 'crew-1',
            name: 'Research crew',
            members: state.bots
              .slice(0, 4)
              .map((b) => ({ profile: b.profile, member_id: b.profile })),
            created_at: 1700000000,
            cursor: 2,
            read_key: 'crew-read',
          },
        ],
        preferences: prefs,
      };
    if (operation === 'workspace.describe') result = state;
    if (operation === 'requests.list') result = { requests };
    if (operation === 'presentation.read') {
      read.set(params.key, Math.max(read.get(params.key) ?? 0, params.cursor));
      const bot = state.bots.find((b) => b.read_key === params.key);
      if (bot) bot.unread = false;
    }
    if (operation === 'bot.open')
      result = { session_id: `session-${params.profile}`, messages: history, running: false };
    if (operation === 'chat.history') result = { messages: history };
    if (operation === 'chat.approvals') result = { approvals };
    if (operation === 'chat.approve')
      approvals = approvals.filter((a) => a.request_id !== params.request_id);
    if (operation === 'routines.list') result = { jobs: routines };
    if (operation === 'routines.set_enabled') {
      routines = routines.map((r) => ({ ...r, enabled: params.enabled }));
      result = { success: true };
    }
    if (operation === 'agent.pin')
      state.bots.find((b) => b.id === params.id)!.pinned = params.pinned;
    if (operation === 'agent.hide')
      state.bots.find((b) => b.id === params.id)!.hidden = params.hidden;
    if (operation === 'presentation.order')
      prefs = { revision: prefs.revision + 1, pin_order: params.ids };
    if (operation === 'room.log')
      result = {
        events:
          params.since_seq === 0
            ? [
                {
                  seq: 1,
                  event_id: 'room-m1',
                  kind: 'message.member',
                  actor: { id: 'arlo', profile: 'arlo' },
                  created_at: 1700000000,
                  payload: { text: 'I can coordinate this discussion.' },
                },
                {
                  seq: 2,
                  event_id: 'room-m2',
                  kind: 'message.member',
                  actor: { id: 'mica', profile: 'mica' },
                  created_at: 1700000100,
                  payload: { text: 'I have the notes ready.' },
                },
              ]
            : [],
        cursor: 2,
        has_more: false,
      };
    if (operation === 'room.state')
      result = { driver_status: { working: false, pending_actions: [] } };
    if (operation === 'agent.propose') {
      requests = [
        {
          id: 'delete-request',
          action: params.action,
          spec: params.spec,
          fingerprint: 'exact-spec',
          actor: 'owner',
          state: 'pending',
        },
      ];
      result = { request_id: 'delete-request', state: 'pending' };
    }
    if (operation === 'requests.approve') {
      const request = requests[0]!;
      const spec = request.spec as { id: string };
      state.bots = state.bots.filter((b) => b.id !== spec.id);
      request.state = 'completed';
      result = { state: 'completed' };
    }
    if (operation === 'requests.deny') requests[0]!.state = 'denied';
    await route.fulfill({ json: { result } });
  });
  return {
    setApprovals(value: Record<string, unknown>[]) {
      approvals = value;
    },
    get state() {
      return state;
    },
    set state(value: WorkspaceState) {
      state = value;
    },
    hide(profile: string) {
      state.bots.find((b) => b.profile === profile)!.hidden = true;
    },
    replace(profile: string) {
      const old = state.bots.find((b) => b.profile === profile)!;
      state.bots = state.bots.map((b) =>
        b === old
          ? {
              ...old,
              id: old.id + '-new',
              handle: profile + '-new',
              read_key: old.read_key + '-new',
            }
          : b,
      );
    },
    remove(profile: string) {
      state.bots = state.bots.filter((b) => b.profile !== profile);
    },
  };
}
export async function emit(
  page: Page,
  type: string,
  payload: Record<string, unknown> = {},
  profile = 'arlo',
) {
  await page.evaluate(
    ({ type, payload, profile }) =>
      (window as unknown as { __chatEvent: (e: unknown) => void }).__chatEvent({
        type,
        payload,
        session_id: `session-${profile}`,
      }),
    { type, payload, profile },
  );
}
