import { test, expect } from '@playwright/test';
import { connect } from './helpers';

const messages = [
  {
    role: 'assistant',
    text: '## Ready\n\n- **Preserved identity**\n- Existing tools\n\n```sh\necho "hello"\n```\n\n![Do not load](https://tracker.invalid/pixel)\n\n[Reference](https://example.test/docs)',
  },
  ...Array.from({ length: 25 }, (_, index) => ({
    role: 'assistant',
    text: `Earlier response ${index + 1}\n\n${'Some synthetic conversation history. '.repeat(12)}`,
  })),
];

test('chat keeps per-agent drafts, grows the composer and restores keyboard focus after sending', async ({
  page,
}) => {
  let sends = 0;
  await page.route('**/v1/rpc', async (route) => {
    if (route.request().postDataJSON().operation === 'chat.send') {
      sends++;
      await route.fulfill({ json: { result: { status: 'accepted' } } });
    } else await route.continue();
  });
  await connect(page);
  const input = page.getByLabel('Message', { exact: true });
  await expect(input).toBeFocused();
  const small = (await input.boundingBox())!.height;
  const alpha = 'Draft for Alpha\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';
  await input.fill(alpha);
  expect((await input.boundingBox())!.height).toBeGreaterThan(small);
  await page.getByRole('button', { name: 'Beta Bot Chat', exact: true }).click();
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue('');
  await input.fill('Draft for Beta');
  await page.getByRole('button', { name: 'Alpha Bot Chat', exact: true }).click();
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue(alpha);
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
  expect(sends).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: 'Working…' })).toBeVisible();
  await page.getByRole('button', { name: 'Beta Bot Chat', exact: true }).click();
  await expect(input).toHaveValue('Draft for Beta');
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
});

test('chat renders safe rich responses and respects reading position when history changes', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  let history = messages;
  const contacted: string[] = [];
  page.on('request', (request) => contacted.push(request.url()));
  await page.route('**/v1/rpc', async (route) => {
    const operation = route.request().postDataJSON().operation;
    if (operation === 'bot.open') {
      const response = await route.fetch();
      const data = await response.json();
      await route.fulfill({
        response,
        json: { ...data, result: { ...data.result, messages: history } },
      });
    } else if (operation === 'chat.history')
      await route.fulfill({ json: { result: { messages: history } } });
    else await route.continue();
  });
  await connect(page);
  const log = page.getByRole('log');
  await expect(log.locator('img')).toHaveCount(0);
  await expect(log.getByRole('heading', { name: 'Ready', exact: true })).toBeAttached();
  await expect(log.locator('pre')).toHaveText('echo "hello"\n');
  await log.hover();
  await page.mouse.wheel(0, -100000);
  await expect.poll(() => log.evaluate((node) => node.scrollTop)).toBe(0);
  await expect(page.getByRole('button', { name: '↓ Latest messages', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Copy code', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('echo "hello"\n');
  history = [
    ...history,
    { role: 'assistant', text: 'New response while reading earlier history. '.repeat(20) },
  ];
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(log).toContainText('New response while reading');
  expect(await log.evaluate((node) => node.scrollTop)).toBe(0);
  await page.screenshot({ path: 'artifacts/chat-rich-history.png' });
  await page.getByRole('button', { name: '↓ Latest messages', exact: true }).click();
  await expect
    .poll(() => log.evaluate((node) => node.scrollHeight - node.clientHeight - node.scrollTop))
    .toBeLessThan(2);
  history = [
    ...history,
    { role: 'assistant', text: 'Another response follows automatically. '.repeat(10) },
  ];
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(log).toContainText('Another response follows');
  await expect
    .poll(() => log.evaluate((node) => node.scrollHeight - node.clientHeight - node.scrollTop))
    .toBeLessThan(2);
  expect(contacted.some((url) => url.includes('tracker.invalid'))).toBe(false);
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
});
