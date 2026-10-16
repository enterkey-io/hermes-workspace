import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';

async function settled(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    );
  });
}
test.beforeEach(async ({ page }) => {
  await page.goto('/ui-lab.html');
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeVisible();
  await settled(page);
});

test('rail actions have their own space; search preserves layout and returns focus', async ({
  page,
}) => {
  for (const selector of ['.review-row', '.review-pin']) {
    const regions = await page.locator(selector).evaluateAll((rows) =>
      rows.map((row) => {
        const action = row.querySelector('[aria-haspopup="menu"]')!.getBoundingClientRect();
        const content = row.querySelector('.agent-avatar')!.getBoundingClientRect();
        return {
          overlapX: Math.min(action.right, content.right) - Math.max(action.left, content.left),
          overlapY: Math.min(action.bottom, content.bottom) - Math.max(action.top, content.top),
        };
      }),
    );
    for (const r of regions) expect(r.overlapX <= 0 || r.overlapY <= 0).toBe(true);
  }
  const before = await page.locator('.review-rail-header').boundingBox();
  await page.getByRole('button', { name: 'Search Pebble Crew', exact: true }).click();
  await page.getByRole('combobox').fill('launch');
  await expect(
    page.getByRole('option', { name: 'The launch brief is ready Arlo · Today' }),
  ).toBeVisible();
  await expect(page.getByText('Sample results', { exact: true })).toBeVisible();
  expect(await page.locator('.review-rail-header').boundingBox()).toEqual(before);
  await page.keyboard.press('Escape');
  await settled(page);
  await expect(page.getByRole('button', { name: 'Search Pebble Crew', exact: true })).toBeFocused();
});

test('settings uses shared fields; search preserves settings and its invoking field', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Your account', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await settled(page);
  await page.getByLabel('Name', { exact: true }).fill('My draft');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog', { name: 'Search Pebble Crew' })).toBeVisible();
  await page.keyboard.press('Escape');
  await settled(page);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('My draft');
  await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
  await page.screenshot({ path: 'test-results/ui-review/settings-main.png' });
});

test('picker identity and selections survive filtering and compact resize', async ({ page }) => {
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Add existing pebbles', exact: true }).click();
  await settled(page);
  await page.getByRole('checkbox', { name: 'Add Indigo', exact: true }).check();
  const label = page
    .locator('.review-existing-item')
    .filter({ has: page.getByRole('checkbox', { name: 'Add Indigo', exact: true }) });
  const original = await label.textContent();
  await page.getByLabel('Find an existing agent').fill('Indigo');
  expect(await label.textContent()).toBe(original);
  await expect(page.getByRole('checkbox', { name: 'Add Indigo', exact: true })).toBeChecked();
  await page.setViewportSize({ width: 320, height: 568 });
  await settled(page);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Add 1 pebble', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'test-results/ui-review/picker-320.png' });
});

test('edge sheet fills compact viewport; controls stay reachable and restore focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 829 });
  await settled(page);
  await page.getByRole('button', { name: 'Show details', exact: true }).click();
  await settled(page);
  const box = await page.getByRole('dialog', { name: 'Arlo details' }).boundingBox();
  expect(box?.x).toBeCloseTo(880, 0);
  expect(box?.y).toBeCloseTo(0, 0);
  expect(box?.height).toBeCloseTo(829, 0);
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await expect(page.getByText('Launch brief.pdf', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/ui-review/details-1200.png' });
  await page.keyboard.press('Escape');
  await settled(page);
  await expect(page.getByRole('button', { name: 'Show details', exact: true })).toBeFocused();
});

test('send has one stable bubble and immediate metadata; attachments use File and Photo', async ({
  page,
}) => {
  await page.getByLabel('Message', { exact: true }).fill('A stable preview message');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  const bubble = page.locator('.review-message').filter({ hasText: 'A stable preview message' });
  const id = await bubble.getAttribute('data-message-id');
  const time = await bubble.locator('time').textContent();
  expect(time).toBeTruthy();
  await expect(page.getByText('This is the interaction preview.', { exact: false })).toBeVisible();
  expect(await bubble.getAttribute('data-message-id')).toBe(id);
  expect(await bubble.locator('time').textContent()).toBe(time);
  await page.getByRole('button', { name: 'Add attachment', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'File', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Photo', exact: true })).toBeVisible();
});

test('desktop shell width and panel travel share one clock in both directions', async ({
  page,
}) => {
  async function record(label: string) {
    const recording = page.evaluate(
      () =>
        new Promise<{ t: number; mainRight: number; slotWidth: number; panelLeft: number }[]>(
          (resolve) => {
            const frames: { t: number; mainRight: number; slotWidth: number; panelLeft: number }[] =
              [];
            const start = performance.now();
            const frame = () => {
              const main = document.querySelector('.review-main')!.getBoundingClientRect(),
                slot = document.querySelector('.review-details-slot')!.getBoundingClientRect(),
                panel = document.querySelector('.review-details-fixed')!.getBoundingClientRect();
              frames.push({
                t: performance.now() - start,
                mainRight: main.right,
                slotWidth: slot.width,
                panelLeft: panel.left,
              });
              if (performance.now() - start < 420) requestAnimationFrame(frame);
              else resolve(frames);
            };
            requestAnimationFrame(frame);
          },
        ),
    );
    await page.getByRole('button', { name: label, exact: true }).click();
    return recording;
  }
  const close = await record('Hide details');
  const open = await record('Show details');
  for (const frames of [close, open]) {
    expect(frames.filter((f) => f.slotWidth > 2 && f.slotWidth < 318).length).toBeGreaterThan(2);
    for (const f of frames) {
      expect(Math.abs(f.mainRight + f.slotWidth - 1440)).toBeLessThan(1.1);
      expect(Math.abs(f.panelLeft - f.mainRight)).toBeLessThan(1.1);
    }
  }
  await mkdir('artifacts/ui-reset/reference', { recursive: true });
  await writeFile(
    'artifacts/ui-reset/reference/shell-motion.json',
    JSON.stringify({ close, open }, null, 2),
  );
});

test('avatars turn both directions with asymmetric eyes; reduced motion stays static', async ({
  page,
}) => {
  const row = page.locator('.review-row').first(),
    svg = row.locator('svg.avatar');
  async function pose() {
    return svg.evaluate((node) =>
      [...node.querySelectorAll('rect')].map((rect) => {
        const m = rect.getCTM()!;
        return { x: m.e, y: m.f, height: Math.hypot(m.c, m.d) };
      }),
    );
  }
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  const left = await pose();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  const right = await pose();
  expect(right[0]!.x + right[1]!.x).toBeGreaterThan(left[0]!.x + left[1]!.x + 10);
  expect(right[0]!.height / right[1]!.height).toBeGreaterThan(1.15);
  expect(left[1]!.height / left[0]!.height).toBeGreaterThan(1.15);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(80);
  const rest = await pose();
  await page.mouse.move(box.x + 2, box.y + 2);
  await page.waitForTimeout(150);
  expect(await pose()).toEqual(rest);
});
