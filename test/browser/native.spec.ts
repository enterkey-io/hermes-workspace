import { expect, test } from '@playwright/test';
import { pair, connect } from './helpers';

test('independently hosted app pairs with a separate real Hermes bridge without API-key entry', async ({
  page,
  context,
}) => {
  const requests: { url: string; auth: string | undefined; method: string; body: string | null }[] =
    [];
  page.on('request', (request) =>
    requests.push({
      url: request.url(),
      auth: request.headers().authorization,
      method: request.method(),
      body: request.postData(),
    }),
  );
  await connect(page);
  expect(new URL(page.url()).origin).toBe('https://127.0.0.1:5443');
  const bridgePage = await page.request.get('https://127.0.0.1:8788/');
  expect(bridgePage.status()).toBe(403);
  await expect(
    page.locator('.details-panel').getByText('alpha-routine', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('beta-routine', { exact: true })).toHaveCount(0);
  await page.getByLabel('Message', { exact: true }).fill('Browser native turn');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('log')).toContainText('Native fixture reply', { timeout: 45_000 });
  await expect(page.getByRole('log').getByText('Browser native turn', { exact: true })).toHaveCount(
    1,
  );
  await page.getByLabel('Message', { exact: true }).fill('Second native turn');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('log')).toContainText('Second native turn');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  expect(
    await page.evaluate(async () => ({
      local: localStorage.length,
      session: sessionStorage.length,
      databases: (await indexedDB.databases()).length,
    })),
  ).toEqual({ local: 0, session: 0, databases: 0 });
  expect(await context.cookies()).toEqual([]);
  expect(
    requests.every((request) =>
      ['https://127.0.0.1:5443', 'https://127.0.0.1:8788'].includes(new URL(request.url).origin),
    ),
  ).toBe(true);
  expect(
    requests
      .filter((request) => new URL(request.url).port === '5443')
      .every(
        (request) =>
          !request.auth &&
          !request.body &&
          request.method === 'GET' &&
          !new URL(request.url).search,
      ),
  ).toBe(true);
  expect(requests.some((request) => new URL(request.url).port === '8788' && request.auth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/web-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('log')).toBeVisible();
  await expect(page.getByText('Activity & routines', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/web-mobile.png' });
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Disconnect' }).click();
  await expect(page.getByRole('button', { name: 'Connect my Hermes', exact: true })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Connect my Hermes', exact: true }).click();
  await expect(page.getByLabel('Hermes connection address')).toHaveValue('');
});

test('public front door explains agent installation and has no credential fields', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /One private workspace/ })).toBeVisible();
  await expect(page.locator('input')).toHaveCount(0);
  await page.getByRole('link', { name: /Set up with my Hermes agent/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Give this page to your Hermes agent.' }),
  ).toBeVisible();
  const instructions = await page.request.get('/install.md');
  expect(await instructions.text()).toContain('hermes bot-web setup');
  expect(await instructions.text()).toContain('Web hosting and Hermes hosting are independent');
  await page.screenshot({ path: 'artifacts/agent-install-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto('/');
  await page.screenshot({ path: 'artifacts/first-run-mobile.png' });
});

test('unapproved web origin cannot request pairing or authenticate', async ({ page }) => {
  await page.goto('/');
  const headers = { Origin: 'https://unapproved.example.test' };
  const denied = await page.request.post('https://127.0.0.1:8788/v1/pairing/request', {
    headers,
    data: { challenge: 'a'.repeat(64) },
  });
  expect(denied.status()).toBe(403);
  expect(denied.headers()['access-control-allow-origin']).toBeUndefined();
  const preflight = await page.request.fetch('https://127.0.0.1:8788/v1/connect', {
    method: 'OPTIONS',
    headers: {
      ...headers,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization',
    },
  });
  expect(preflight.status()).toBe(403);
});

test('lost event stream blocks further sends', async ({ page }) => {
  await page.route('**/v1/events', (route) => route.abort());
  await pair(page);
  await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Disconnect and reconnect');
  await expect(page.getByRole('alert')).toContainText('live updates stopped (REQUEST_FAILED)');
  await expect(page.getByRole('heading', { name: 'Live updates are disconnected.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Alpha Bot Chat' })).toBeDisabled();
  await page.getByRole('button', { name: 'Disconnect and reconnect', exact: true }).click();
});

test('empty native roster explains setup and refreshes after the agent initializes a bot', async ({
  page,
}) => {
  test.setTimeout(75_000);
  let initialized = false;
  await page.route('**/v1/rpc', async (route) => {
    const operation = route.request().postDataJSON().operation;
    if (operation === 'bots.list' && !initialized)
      await route.fulfill({ json: { result: { bots: [] } } });
    else if (operation === 'rooms.list') await route.fulfill({ json: { result: { rooms: [] } } });
    else await route.continue();
  });
  await pair(page);
  await expect(page.getByRole('heading', { name: 'Choose your Hermes agents.' })).toBeVisible();
  await expect(page.getByText(/Your existing agents keep their SOUL/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
  await page.screenshot({ path: 'artifacts/empty-roster-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/empty-roster-mobile.png' });
  // Stay idle beyond the client's 35-second deadline: native background events must
  // not prevent bridge heartbeats even while no bot session belongs to this browser.
  await page.waitForTimeout(40_000);
  await expect(page.getByRole('heading', { name: 'Choose your Hermes agents.' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  initialized = true;
  await page.getByRole('button', { name: 'Refresh bots', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Alpha Bot Chat' })).toBeEnabled();
  await page.getByRole('button', { name: 'Alpha Bot Chat' }).click();
  await expect(page.getByRole('heading', { name: 'Alpha', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
});

test('uninitialized Bot Chats cannot be opened as if they were ready', async ({ page }) => {
  let opens = 0;
  await page.route('**/v1/rpc', async (route) => {
    const operation = route.request().postDataJSON().operation;
    if (operation === 'bots.list')
      await route.fulfill({
        json: {
          result: { bots: [{ profile: 'alpha', name: 'Alpha', canonical: false }] },
        },
      });
    else if (operation === 'rooms.list') await route.fulfill({ json: { result: { rooms: [] } } });
    else {
      if (operation === 'bot.open') opens++;
      await route.continue();
    }
  });
  await pair(page);
  await expect(page.getByRole('heading', { name: 'Choose your Hermes agents.' })).toBeVisible();
  await page.getByRole('button', { name: 'Alpha Set up Bot Chat' }).click();
  await expect(page.getByRole('heading', { name: 'Choose who appears here.' })).toBeVisible();
  expect(opens).toBe(0);
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
});

test('a failed roster request never becomes an empty connected workspace', async ({ page }) => {
  await page.route('**/v1/rpc', async (route) => {
    if (route.request().postDataJSON().operation === 'bots.list') await route.abort();
    else await route.continue();
  });
  await pair(page, false);
  await expect(page.getByRole('alert')).toContainText('request failed');
  await expect(page.getByRole('navigation', { name: 'Bots' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Choose your Hermes agents.' })).toHaveCount(0);
});

test('existing unregistered agents can be selected in the app without a new profile or persona', async ({
  page,
}) => {
  await pair(page);
  await page.getByRole('button', { name: 'Add existing agents', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose who appears here.' })).toBeVisible();
  await expect(
    page.getByText(/They keep their personality, memory, skills and settings/),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: /gamma/i }).check();
  await page.screenshot({ path: 'artifacts/existing-agents-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/existing-agents-mobile.png' });
  await page.getByRole('button', { name: 'Add selected agents (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page
    .getByRole('navigation', { name: 'Bots' })
    .getByRole('button', { name: /gamma/i })
    .click();
  await expect(page.getByRole('heading', { name: /gamma/i })).toBeVisible();
  await page.getByLabel('Message', { exact: true }).fill('Existing agent browser turn');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('log')).toContainText('Native fixture reply', { timeout: 45_000 });
  if ((page.viewportSize()?.width ?? 1440) < 650)
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
});

test('an old integration keeps its bots usable and clearly explains enrollment support', async ({
  page,
}) => {
  await page.route('**/v1/connect', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch();
    const data = await response.json();
    delete data.capabilities;
    await route.fulfill({ response, json: data });
  });
  await pair(page);
  await page.getByRole('button', { name: 'Add existing agents', exact: true }).click();
  await expect(page.getByText(/Your integration needs an update/)).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Alpha Bot Chat' }).click();
  await expect(page.getByRole('heading', { name: 'Alpha', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
});

test('accepted send with lost acknowledgment cannot be blindly retried', async ({ page }) => {
  await connect(page);
  await page.route('**/v1/rpc', async (route) => {
    if (route.request().postDataJSON().operation === 'chat.send') {
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await page.getByLabel('Message', { exact: true }).fill('Uncertain browser turn');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('alert')).toContainText('outcome is uncertain');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
  await page.getByRole('button', { name: 'Disconnect' }).click();
});

test('real native approvals and stop reach Hermes execution', async ({ page }) => {
  await connect(page);
  await page.getByLabel('Message', { exact: true }).fill('nativeapproval: require permission');
  await page.getByRole('button', { name: 'Send message' }).click();
  const approval = page.locator('.details-panel .approval');
  await expect(approval.getByRole('heading', { name: 'Approval needed' })).toBeVisible({
    timeout: 45_000,
  });
  await approval.getByRole('button', { name: 'Deny', exact: true }).click();
  await expect(approval).toHaveCount(0);
  await page.getByLabel('Message', { exact: true }).fill('nativestop: slow native reply');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled({ timeout: 45_000 });
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0, {
    timeout: 45_000,
  });
  await page.getByRole('button', { name: 'Disconnect' }).click();
});

test('28-agent picker scrolls within the viewport with reachable actions and searchable selection', async ({
  page,
}) => {
  const agents = Array.from({ length: 28 }, (_, index) => ({
    profile: `fixture-${index + 1}`,
    name: `Fixture Agent ${String(index + 1).padStart(2, '0')}`,
    description: 'Synthetic existing profile',
    managed: false,
    canonical: false,
  }));
  await page.route('**/v1/rpc', async (route) => {
    if (route.request().postDataJSON().operation === 'agents.list')
      await route.fulfill({ json: { result: { agents } } });
    else await route.continue();
  });
  await pair(page);
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    if (viewport.width < 650) await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await page.getByRole('button', { name: 'Add existing agents', exact: true }).click();
    const region = page.getByRole('region', { name: 'Available Hermes agents' });
    await expect(region.getByRole('checkbox')).toHaveCount(28);
    const bounds = await region.boundingBox();
    expect(bounds).toBeTruthy();
    expect(bounds!.height).toBeGreaterThan(40);
    expect(bounds!.y + bounds!.height).toBeLessThan(viewport.height);
    await region.hover();
    await page.mouse.wheel(0, 10000);
    await expect.poll(() => region.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    const last = region.getByRole('checkbox', { name: /Fixture Agent 28/ });
    await expect(last).toBeInViewport();
    await last.check();
    const add = page.getByRole('button', { name: 'Add selected agents (1)', exact: true });
    await expect(add).toBeInViewport();
    await expect(add).toBeEnabled();
    await page.screenshot({ path: `artifacts/agent-picker-28-list-${viewport.width}.png` });
    await page.getByRole('searchbox', { name: 'Find an agent' }).fill('Agent 01');
    await expect(region.getByRole('checkbox')).toHaveCount(1);
    await expect(add).toBeEnabled(); // Hidden selections survive filtering.
    await page.getByRole('searchbox', { name: 'Find an agent' }).fill('no matching profile');
    await expect(region).toContainText('No agents match');
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
    ).toBe(true);
    await page.screenshot({ path: `artifacts/agent-picker-28-${viewport.width}.png` });
    await page.getByRole('button', { name: 'Close', exact: true }).click();
  }
  if ((page.viewportSize()?.width ?? 1440) < 650)
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
});
