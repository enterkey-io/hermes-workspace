import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
test('private first use, native onboarding, idle keepalive, reconnection, settings and ordinary login', async ({
  page,
  context,
}) => {
  await page.clock.install();
  let tickets = 0;
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/hermes/ticket') tickets++;
  });
  const proof = (
    await readFile(resolve(process.env.WORKSPACE_TEST_STATE!, 'setup-code.txt'), 'utf8')
  ).trim();
  page.on('requestfailed', (r) => {
    if (r.url().includes(':8789'))
      console.log(
        'Fixture bridge network failure',
        new URL(r.url()).pathname,
        r.failure()?.errorText,
      );
  });
  page.on('response', (r) => {
    if (r.url().includes(':8789') && !r.ok())
      console.log('Fixture bridge HTTP failure', new URL(r.url()).pathname, r.status());
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let sends = 0;
  await page.route('**/v1/rpc', async (route) => {
    const operation = route.request().postDataJSON().operation;
    if (operation === 'chat.send') sends++;
    if (operation === 'workspace.detect_primary') {
      // Reproduce native profiles advertising an existing stock avatar.
      const response = await route.fetch();
      const body = await response.json();
      body.result.bot.name = 'Aurora';
      body.result.bot.appearance = { kind: 'photo', shape: 'pebble', color: 'citron' };
      await route.fulfill({ response, json: body });
      return;
    }
    await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Create your login' })).toBeVisible();
  await page.getByLabel('Private setup code').fill(proof);
  await page.getByLabel('Username', { exact: true }).fill('owner');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-owner-password-123');
  await page.getByLabel('Confirm password').fill('synthetic-owner-password-123');
  await page.getByRole('button', { name: 'Create login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Customize Aurora' })).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByText('Your existing primary Hermes agent.', { exact: true }),
  ).toBeVisible();
  const picker = page.locator('.appearance-picker');
  await expect(picker.getByRole('button', { name: 'Animated', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(picker.getByRole('button', { name: 'Iris', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(picker.locator('.avatar-preview svg.avatar')).toHaveCount(1);
  await expect(picker.locator('.avatar-shapes button')).toHaveCount(5);
  await expect(picker.locator('.avatar-shapes')).toHaveText('');
  await expect(picker.locator('.avatar-colors')).toHaveText('');
  const face = picker.locator('.avatar-preview g[fill="#222329"]');
  const initialGaze = await face.getAttribute('transform');
  await page.clock.runFor(7100);
  expect(await face.getAttribute('transform')).not.toBe(initialGaze);
  await picker.getByRole('button', { name: 'Photo', exact: true }).click();
  await expect(picker.locator('.avatar-preview svg.avatar')).toHaveCount(0);
  await expect(picker.locator('.empty-photo')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Start chatting', exact: true })).toBeDisabled();
  await expect(picker.getByRole('button', { name: 'Upload photo', exact: true })).toBeVisible();
  await picker.getByRole('button', { name: 'Animated', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Send an introduction' }).uncheck();
  await page.locator('.handle-input input').fill('aurora');
  await page.getByRole('button', { name: 'White', exact: true }).click();
  await page.getByRole('button', { name: 'petal', exact: true }).click();
  await expect(picker.locator('.avatar-shapes path')).toHaveCount(5);
  for (const path of await picker.locator('.avatar-shapes path').all())
    await expect(path).toHaveAttribute('fill', '#f4f3ef');
  await expect(picker.locator('.avatar-preview path[fill="#f4f3ef"]')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/agent-setup-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Start chatting', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/agent-setup-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Start chatting', exact: true }).click();
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled({ timeout: 30000 });
  const sessionCookie = (await context.cookies()).find((c) => c.name.includes('session_token'));
  expect(sessionCookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict' });
  await expect(page.locator('.chat-header').getByText('@aurora', { exact: true })).toBeVisible();
  await page.waitForTimeout(2500); // accelerated server lease is 1s; authenticated heartbeats must keep it alive.
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled({ timeout: 30000 });
  expect(sends).toBe(0);
  await page.clock.fastForward(240001);
  await expect.poll(() => tickets).toBeGreaterThanOrEqual(2);
  await page.getByLabel('Message', { exact: true }).fill('Synthetic unsent draft stays here');
  await context.setOffline(true);
  // Break the browser stream explicitly: offline alone can retain an existing loopback socket.
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.waitForTimeout(1500);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled({ timeout: 30000 });
  await expect(page.getByLabel('Message', { exact: true })).toHaveValue(
    'Synthetic unsent draft stays here',
  );
  expect(sends).toBe(0);
  const restart = await page.request.post('https://127.0.0.1:8789/fixture/restart-native', {
    headers: { Origin: 'https://127.0.0.1:5445', Authorization: 'Bearer ' + 'f'.repeat(43) },
  });
  expect(restart.ok()).toBeTruthy();
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled({ timeout: 30000 });
  await expect(page.getByLabel('Message', { exact: true })).toHaveValue(
    'Synthetic unsent draft stays here',
  );
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New crew', exact: true }).click();
  const crew = page.getByRole('dialog', { name: 'New crew', exact: true });
  await crew.getByLabel('Name', { exact: true }).fill('Research');
  await crew.getByRole('button', { name: 'Create crew', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Research', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Actions for Alpha', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit pebble', exact: true }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#d9d1ff';
    context.fillRect(0, 0, 16, 16);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  await page.getByRole('button', { name: 'Photo', exact: true }).click();
  await page.getByLabel('Choose photo').setInputFiles({
    name: 'synthetic.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.getByRole('button', { name: 'Photo', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Save avatar', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Pebbles' }).locator('.agent-avatar img'),
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'Animated', exact: true }).click();
  await page.getByRole('button', { name: 'Save avatar', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Pebbles' }).locator('.agent-avatar img'),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Photo', exact: true }).click();
  await page.getByRole('button', { name: 'Save avatar', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Pebbles' }).locator('.agent-avatar img'),
  ).toHaveCount(1);
  await page.getByRole('tab', { name: 'Role', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Team lead');
  await page.getByLabel('Description', { exact: true }).fill('Coordinates synthetic research');
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Team lead');
  await page.getByRole('button', { name: 'Close Edit Alpha', exact: true }).click();
  await page.getByRole('button', { name: 'Your account' }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Current password', { exact: true }).fill('synthetic-owner-password-123');
  await page.getByLabel('New password', { exact: true }).fill('synthetic-owner-password-456');
  await page
    .getByLabel('Confirm new password', { exact: true })
    .fill('synthetic-owner-password-456');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Password changed.');
  await page.getByRole('button', { name: 'Sign out other devices', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(
    'Other devices will be signed out within five minutes.',
  );
  await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Actions for Alpha', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit pebble', exact: true }).click();
  await page.getByRole('tab', { name: 'Tools & skills', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole('button', { name: 'Save tools & skills', exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('button', { name: 'Save tools & skills', exact: true }),
  ).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Close Edit Alpha', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled({ timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Create your login' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Your account' }).click();
  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill('owner');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-owner-password-456');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled({ timeout: 30000 });
  expect(errors).toEqual([]);
  expect(sends).toBe(0);
  await page.screenshot({ path: 'test-results/owner-workspace.png' });
});
