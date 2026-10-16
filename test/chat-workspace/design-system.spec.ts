import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installFixture, emit } from './fixtures';
import type { Page } from '@playwright/test';
async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
}
async function settings(page: Page) {
  await page.getByRole('button', { name: 'Your account' }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
}
async function newItem(page: Page, name: string) {
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
async function accessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
}

test('shared design system: account settings, connections, requests, editor and keyboard menus', async ({
  page,
  context,
}) => {
  await installFixture(context);
  await ready(page);
  await accessible(page);
  await page.getByLabel('Actions for Arlo').click();
  const menu = page.getByRole('menu', { name: 'Actions for Arlo' });
  const box = (await menu.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(8);
  expect(box.x + box.width).toBeLessThanOrEqual(1440 - 8);
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Actions for Arlo')).toBeFocused();
  await settings(page);
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Account', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: 'Teams', exact: true })).toHaveCount(0);
  await accessible(page);
  await page.screenshot({ path: 'test-results/settings-account.png' });
  await page.getByRole('tab', { name: 'Connections', exact: true }).click();
  await expect(page.getByText('No services connected to this pebble.')).toBeVisible();
  await accessible(page);
  await page.getByRole('tab', { name: 'Requests', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No requests' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
  await page.getByLabel('Actions for Mica').click();
  await page.getByRole('menuitem', { name: 'Edit pebble', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit Mica' })).toBeVisible();
  await accessible(page);
  await page.screenshot({ path: 'test-results/edit-pebble-profile.png' });
  await page.getByRole('tab', { name: 'Role', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Executive coordinator');
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await expect(page.getByText('Role saved.', { exact: true })).toBeVisible();
  await accessible(page);
  await page.screenshot({ path: 'test-results/edit-pebble-role.png' });
  await page.getByRole('tab', { name: 'Tools & skills', exact: true }).click();
  await expect(page.getByLabel('Browser', { exact: true })).toBeVisible();
  await accessible(page);
});

test('editor preserves drafts across events and unrelated saves, resolves conflicts and guards navigation', async ({
  page,
  context,
}) => {
  const fixture = await installFixture(context);
  await ready(page);
  await page.getByLabel('Actions for Mica').click();
  await page.getByRole('menuitem', { name: 'Edit pebble', exact: true }).click();
  await page.getByLabel('Handle', { exact: true }).fill('my-mica');
  await page.getByRole('tab', { name: 'Role', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('My unsaved title');
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await expect(page.getByText('Role saved.', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await expect(page.getByLabel('Handle', { exact: true })).toHaveValue('my-mica');
  fixture.state.bots.find((b) => b.profile === 'mica')!.handle = 'remote-mica';
  fixture.state.revision++;
  await emit(page, 'workspace.changed');
  await expect(page.getByText('The saved handle changed while you were editing.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save handle' })).toBeDisabled();
  await page.getByRole('button', { name: 'Keep my edits' }).click();
  await page.getByRole('button', { name: 'Save handle' }).click();
  await expect(page.getByText('Handle saved.', { exact: true })).toBeVisible();
  await page.getByLabel('Handle', { exact: true }).fill('unsaved');
  await page.getByRole('button', { name: 'Arlo Bot Chat', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Unsaved changes' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Handle', { exact: true })).toHaveValue('unsaved');
  fixture.replace('mica');
  await emit(page, 'workspace.changed');
  await expect(
    page.getByText('This pebble was removed or replaced.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel('Handle', { exact: true })).toHaveValue('unsaved');
  await expect(page.getByRole('button', { name: 'Save handle' })).toBeDisabled();
  await page.getByRole('button', { name: 'Arlo Bot Chat', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Unsaved changes' });
  await dialog.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
});

test('sidebar creates and edits crews without changing relationships; fresh and existing pebble flows are distinct', async ({
  page,
  context,
}) => {
  const fixture = await installFixture(context);
  await ready(page);
  await newItem(page, 'New crew');
  let dialog = page.getByRole('dialog', { name: 'New crew', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Name', { exact: true }).fill('Studio');
  await dialog.getByLabel('Mica', { exact: false }).check();
  await dialog.getByRole('button', { name: 'Create crew', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(fixture.state.bots.find((b) => b.profile === 'mica')!.manager).toBe('arlo');
  await expect(page.getByRole('heading', { name: 'Studio', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Actions for Studio', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit crew', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Edit crew', exact: true });
  await expect(dialog.getByLabel('Mica', { exact: false })).toBeChecked();
  await dialog.getByRole('button', { name: 'Remove crew', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mica Bot Chat', exact: true })).toBeVisible();
  await newItem(page, 'New pebble');
  await accessible(page);
  await page.getByRole('button', { name: 'Create new', exact: false }).click();
  await page.getByLabel('Name', { exact: true }).fill('Nova');
  await expect(page.getByLabel('Handle', { exact: true })).toHaveValue('nova');
  await page.getByLabel('Instructions', { exact: true }).fill('You are a synthetic test pebble.');
  await page.getByRole('button', { name: 'Review pebble' }).click();
  await expect(page.getByRole('heading', { name: 'Create pebble', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Approve exact request' }).click();
  await expect(page.getByRole('button', { name: 'Nova Bot Chat', exact: true })).toBeVisible();
  await newItem(page, 'New pebble');
  await page.getByRole('button', { name: 'Add existing', exact: false }).click();
  await expect(
    page.getByRole('heading', { name: 'Add existing pebbles', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Existing example', { exact: false }).check();
  await page.getByRole('button', { name: 'Add selected pebbles (1)', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Existing example Bot Chat', exact: true }),
  ).toBeVisible();
});

test('attachments are conversation bound, can be removed, send without text, and download in Files', async ({
  page,
  context,
}) => {
  await installFixture(context);
  await ready(page);
  const picker = page.getByLabel('Choose attachments');
  await picker.setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Synthetic private note'),
  });
  await expect(page.locator('.attachment-chips')).toContainText('notes.txt');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
  await page.getByRole('button', { name: 'Mica Bot Chat', exact: true }).click();
  await expect(page.locator('.attachment-chips')).toHaveCount(0);
  await page.getByRole('button', { name: 'Arlo Bot Chat', exact: true }).click();
  await expect(page.locator('.attachment-chips')).toContainText('notes.txt');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.attachment-chips')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await expect(page.locator('.file-list')).toContainText('notes.txt');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download notes.txt', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('notes.txt');
  await accessible(page);
  await picker.setInputFiles({
    name: 'temporary.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Temporary'),
  });
  await expect(page.getByRole('button', { name: 'Remove temporary.txt' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove temporary.txt' }).click();
  await expect(page.locator('.attachment-chips')).toHaveCount(0);
});

test('tool calls are grouped, empty reasoning rows are omitted, final sidecars are visible', async ({
  page,
  context,
}) => {
  await installFixture(context);
  await page.route('**/v1/rpc', async (route) => {
    const { operation } = route.request().postDataJSON();
    if (operation === 'bot.open' || operation === 'chat.history') {
      await route.fulfill({
        json: {
          result: {
            session_id: 'session-arlo',
            running: false,
            messages: [
              { row_id: 1, role: 'assistant', text: '', reasoning: 'PRIVATE_REASONING' },
              { row_id: 2, role: 'tool', text: 'Read complete', tool_name: 'read_file' },
              { row_id: 3, role: 'assistant', text: '' },
              { row_id: 4, role: 'tool', text: 'Write complete', tool_name: 'write_file' },
              {
                row_id: 5,
                role: 'assistant',
                text: '',
                codex_message_items: [
                  {
                    type: 'message',
                    role: 'assistant',
                    phase: 'final_answer',
                    content: [{ type: 'output_text', text: 'The final answer.' }],
                  },
                ],
              },
            ],
          },
        },
      });
    } else await route.fallback();
  });
  await ready(page);
  const log = page.getByRole('log');
  await expect(log.locator('.activity-group')).toHaveCount(1);
  await expect(log.locator('.message')).toHaveCount(1);
  await expect(log).toContainText('The final answer.');
  await expect(log).not.toContainText('PRIVATE_REASONING');
  await log.getByText('2 tool calls', { exact: true }).click();
  await expect(log).toContainText('Read complete');
  await accessible(page);
});

test('small screens keep dialogs bounded, nested unsaved confirmation restores focus, reduced motion scrolls deliberately', async ({
  page,
  context,
}) => {
  await installFixture(context);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 640 });
  await ready(page);
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New crew', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New crew', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Name', { exact: true }).fill('Draft crew');
  await page.keyboard.press('Escape');
  const confirm = page.getByRole('dialog', { name: 'Unsaved changes' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Keep editing' }).click();
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Draft crew');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await accessible(page);
  await page.screenshot({ path: 'test-results/new-crew-mobile.png' });
  await page.keyboard.press('Escape');
  await page
    .getByRole('dialog', { name: 'Unsaved changes' })
    .getByRole('button', { name: 'Discard changes' })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
});

test('pin feedback is immediate and rolls back on failure; details, scroll motion and zoom keep context', async ({
  page,
  context,
}) => {
  await installFixture(context);
  await ready(page);
  let release!: () => void;
  const wait = new Promise<void>((r) => {
    release = r;
  });
  let started = false;
  await page.route('**/v1/rpc', async (route) => {
    if (route.request().postDataJSON().operation === 'agent.pin') {
      started = true;
      await wait;
      await route.fulfill({ status: 400, json: { code: 'STALE_REVISION' } });
    } else await route.fallback();
  });
  await page.getByLabel('Actions for Rowan').click();
  await page.getByRole('menuitem', { name: 'Pin', exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await expect(
    page
      .locator('.pinned-tile')
      .filter({ has: page.getByRole('button', { name: 'Rowan Bot Chat', exact: true }) }),
  ).toHaveCount(1);
  await expect(page.locator('.pin-saving')).toBeVisible();
  release();
  await expect(page.locator('.pinned-tile')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Rowan Bot Chat', exact: true })).toBeVisible();
  const log = page.getByRole('log');
  await log.evaluate((n) => {
    n.scrollTop = 0;
    n.dispatchEvent(new Event('scroll'));
  });
  await page.getByRole('button', { name: 'Hide details', exact: true }).click();
  await expect(page.locator('.details-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show details', exact: true }).click();
  expect(await log.evaluate((n) => n.scrollTop)).toBeLessThan(150);
  const samples = await page.evaluate(async () => {
    const n = document.querySelector<HTMLElement>('[role=log]')!;
    const button = document.querySelector<HTMLButtonElement>('.jump-latest')!;
    const values: number[] = [];
    button.click();
    await new Promise<void>((resolve) => {
      const start = performance.now();
      function read() {
        values.push(n.scrollTop);
        if (performance.now() - start < 350) requestAnimationFrame(read);
        else resolve();
      }
      requestAnimationFrame(read);
    });
    return { values, bottom: n.scrollHeight - n.clientHeight };
  });
  expect(samples.values.some((v) => v > 0 && v < samples.bottom - 2)).toBe(true);
  expect(samples.values.at(-1)).toBeCloseTo(samples.bottom, 0);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await accessible(page);
});

test('mobile browser Back closes the top overlay and keeps the underlying app available', async ({
  page,
  context,
}) => {
  await installFixture(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.getByRole('button', { name: 'Show details' }).click();
  await expect(page.getByRole('dialog', { name: 'details' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show details' })).toBeFocused();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(page.getByRole('dialog', { name: 'navigation' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
});

test('browser Back protects an unsaved Crew then closes only its confirmation', async ({
  page,
  context,
}) => {
  await installFixture(context);
  await page.setViewportSize({ width: 320, height: 640 });
  await ready(page);
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await newItem(page, 'New crew');
  const crew = page.getByRole('dialog', { name: 'New crew', exact: true });
  await crew.getByLabel('Name', { exact: true }).fill('Back draft');
  await expect(crew.getByRole('button', { name: 'Create crew', exact: true })).toBeInViewport();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Unsaved changes' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Unsaved changes' })).toHaveCount(0);
  await expect(crew.getByLabel('Name', { exact: true })).toHaveValue('Back draft');
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Unsaved changes' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
});

test('closing a new pebble preserves a creation draft until it is explicitly discarded', async ({
  page,
  context,
}) => {
  await installFixture(context);
  await ready(page);
  await newItem(page, 'New pebble');
  await page.getByRole('button', { name: 'Create new', exact: false }).click();
  await page.getByLabel('Name', { exact: true }).fill('Unsaved Nova');
  await page.getByRole('button', { name: 'Close New pebble', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Unsaved changes' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Unsaved Nova');
  await page.getByRole('button', { name: 'Close New pebble', exact: true }).click();
  await dialog.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
});

test('resting pebbles look away, breathe, track only the hovered row smoothly, then settle', async ({
  page,
  context,
}) => {
  await installFixture(context);
  await ready(page);
  await page.mouse.move(800, 800);
  const face = page.locator('.pinned-tile').first().locator('.avatar > g:nth-child(2) > g');
  const body = page.locator('.pinned-tile').first().locator('.avatar > g:nth-child(2)');
  await expect
    .poll(async () =>
      Number((await face.getAttribute('transform'))?.match(/translate\(([-.\d]+)/)?.[1]),
    )
    .toBeGreaterThan(2.5);
  const before = await body.getAttribute('transform');
  await expect.poll(() => body.getAttribute('transform')).not.toBe(before);
  const samples = await page.evaluate(async () => {
    const row = document.querySelector('.pinned-tile')!;
    const face = row.querySelector('.avatar > g:nth-child(2) > g')!;
    const svg = row.querySelector('svg')!.getBoundingClientRect();
    const values: number[] = [];
    row.dispatchEvent(
      new PointerEvent('pointerenter', {
        pointerType: 'mouse',
        clientX: svg.left - 80,
        clientY: svg.top + 30,
      }),
    );
    await new Promise<void>((resolve) => {
      const start = performance.now();
      function read() {
        values.push(Number(face.getAttribute('transform')!.match(/translate\(([-.\d]+)/)![1]));
        if (performance.now() - start < 400) requestAnimationFrame(read);
        else resolve();
      }
      requestAnimationFrame(read);
    });
    row.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    return values;
  });
  expect(samples.some((x) => x < 2 && x > -4)).toBe(true);
  expect(samples.at(-1)).toBeLessThan(-4);
  await expect
    .poll(async () =>
      Number((await face.getAttribute('transform'))?.match(/translate\(([-.\d]+)/)?.[1]),
    )
    .toBeGreaterThan(2.5);
  await emit(page, 'message.start');
  await emit(page, 'message.complete', { status: 'done' });
  await expect(page.locator('.pinned-tile').first().locator('svg')).toHaveAttribute(
    'data-state',
    'done',
  );
  await expect(page.locator('.pinned-tile').first().locator('svg')).toHaveAttribute(
    'data-state',
    'ready',
    { timeout: 4000 },
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(body).toHaveAttribute('transform', /^translate\(0.000 0.000\).*rotate\(0.000\)/);
  const frozen = await body.getAttribute('transform');
  await page.locator('.pinned-tile').first().hover();
  await page.waitForTimeout(350);
  expect(await body.getAttribute('transform')).toBe(frozen);
});
