import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installFixture, emit, history } from './fixtures';

test('native activity describes the work and a reply keeps its bubble and footer when committed', async ({
  page,
  context,
}) => {
  await installFixture(context);
  await page.goto('/');
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
  await emit(page, 'message.start');
  const activity = page.locator('.pc-activity');
  await expect(activity).toHaveText('Thinking');
  for (const [name, label] of [
    ['read_file', 'Reading files'],
    ['write_file', 'Updating files'],
    ['web_search', 'Searching the web'],
    ['terminal', 'Running a command'],
    ['message_agent', 'Coordinating agents'],
  ]) {
    await emit(page, 'tool.start', { name });
    await expect(activity).toHaveText(label!);
  }
  await emit(page, 'status.update', { kind: 'compacting', text: 'Compressing context' });
  await expect(activity).toHaveText('Compressing context');
  const reply = 'Your research is ready.';
  await emit(page, 'message.delta', { text: reply });
  await expect(activity).toHaveText('Writing');
  const streaming = page.locator('.pc-message.streaming');
  await expect(streaming.locator('time')).toBeVisible();
  await expect(streaming.locator('.caret')).toHaveCount(0);
  const bubble = (await streaming.locator('.pc-bubble').elementHandle())!;
  const before = (await bubble.boundingBox())!;
  const final = {
    row_id: 901,
    role: 'assistant',
    text: reply,
    timestamp: new Date().toISOString(),
  };
  await page.route('**/v1/rpc', async (route) => {
    if (route.request().postDataJSON().operation === 'chat.history')
      await route.fulfill({ json: { result: { messages: [...history, final] } } });
    else await route.fallback();
  });
  await emit(page, 'message.complete', {
    status: 'done',
    text: reply,
    persisted_turn: { final_assistant_row_id: 901 },
  });
  const committed = page.locator('[data-message-id="901"]');
  await expect(committed.locator('time')).toBeVisible();
  expect(await bubble.evaluate((node) => node.isConnected)).toBe(true);
  expect((await committed.locator('.pc-bubble').boundingBox())!.height).toBeCloseTo(
    before.height,
    0,
  );
  await expect(page.locator('.pc-message.streaming')).toHaveCount(0);
  await expect(activity).toHaveCount(0);
  await page.screenshot({ animations: 'disabled', path: 'test-results/reply-completed.png' });
});

test('an empty move submenu has a dimmed disabled None item', async ({ page, context }) => {
  await installFixture(context);
  await page.goto('/');
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
  await page.getByLabel('Actions for Mica', { exact: true }).click();
  await page.getByRole('menuitem', { name: 'Move to crew', exact: true }).hover();
  const empty = page.getByRole('menuitem', { name: 'None', exact: true });
  await expect(empty).toBeVisible();
  await expect(empty).toHaveAttribute('aria-disabled', 'true');
  await expect(empty).toHaveCSS('opacity', '0.5');
});

test('Connections cards, credentials and tool permissions stay structured on desktop and phone', async ({
  page,
  context,
}) => {
  await installFixture(context);
  const calls: { operation: string; params: Record<string, unknown> }[] = [];
  await page.route('**/v1/rpc', async (route) => {
    const call = route.request().postDataJSON();
    calls.push(call);
    let result: unknown;
    if (call.operation === 'connections.list')
      result = { servers: [{ name: 'Papertrail', transport: 'streamable-http', enabled: true }] };
    else if (call.operation === 'services.catalog')
      result = {
        servers: [
          { name: 'Calendar', description: 'Events and availability.', transport: 'http' },
          { name: 'Files', description: 'Find and organize documents.', transport: 'http' },
          {
            name: 'Desktop',
            description: 'Apps on your computer.',
            transport: 'stdio',
            installed: false,
          },
        ],
      };
    else if (call.operation === 'connections.permissions')
      result = {
        fingerprint: 'synthetic',
        allowed_tools: call.params.tools ?? [],
        bearer_supported: true,
        auth: 'oauth',
      };
    else if (call.operation === 'connections.test')
      result = {
        ok: true,
        tools: [{ name: 'search_documents', description: 'Search connected documents.' }],
      };
    else {
      await route.fallback();
      return;
    }
    await route.fulfill({ json: { result } });
  });
  await page.goto('/');
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Your account', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Connections', exact: true }).click();
  const card = page.getByRole('article', { name: 'Papertrail connection' });
  await card.getByRole('button', { name: 'Test connection' }).click();
  await card.getByLabel('search_documents').check();
  await card.getByRole('button', { name: 'Save selected tools' }).click();
  expect(
    calls.some(
      (c) =>
        c.operation === 'connections.permissions' &&
        JSON.stringify(c.params.tools) === '["search_documents"]',
    ),
  ).toBe(true);
  await card.locator('summary').click();
  await expect(card.getByLabel('API key', { exact: true })).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const box = (await card.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await page.screenshot({
      animations: 'disabled',
      path: `test-results/connections-${width}.png`,
    });
    await page.locator('.service-card').last().scrollIntoViewIfNeeded();
    await page.screenshot({
      animations: 'disabled',
      path: `test-results/connections-catalog-${width}.png`,
    });
  }
});
