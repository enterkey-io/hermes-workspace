import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function connect(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Connect my Hermes', exact: true }).click();
  await page.getByLabel('Hermes connection address').fill('https://127.0.0.1:8788');
  await page.getByRole('button', { name: 'Request browser access', exact: true }).click();
  const code = await page.getByLabel('Browser approval code').innerText();
  const approval = await page.request.post('https://127.0.0.1:8788/v1/pairing/approve', {
    headers: { Origin: 'https://127.0.0.1:5443', Authorization: 'Bearer ' + 'f'.repeat(43) },
    data: { code },
  });
  expect(approval.status()).toBe(200);
  await expect(page.getByRole('navigation', { name: 'Bots' })).toBeVisible();
  await page.getByRole('button', { name: 'Alpha Bot Chat' }).click();
  await expect(page.getByRole('heading', { name: 'Alpha', exact: true })).toBeVisible();
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
}

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
  await connect(page);
  await page.getByLabel('Message', { exact: true }).fill('Must not be submitted');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Disconnect and reconnect');
  await page.getByRole('button', { name: 'Disconnect' }).click();
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
