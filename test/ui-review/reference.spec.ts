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

test('details stays docked on tablet, keeps chat usable and has a single header toggle', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 829 });
  await settled(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(async () => (await page.locator('.review-details-slot').boundingBox())?.width)
    .toBeCloseTo(288, 0);
  const geometry = await page.evaluate(() => ({
    panel: document.querySelector('.review-details')!.getBoundingClientRect().toJSON(),
    main: document.querySelector('.review-main')!.getBoundingClientRect().toJSON(),
  }));
  expect(geometry.panel.x).toBeCloseTo(geometry.main.right, 0);
  expect(geometry.panel.height).toBeCloseTo(829, 0);
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Show details', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await expect(page.getByText('Launch brief.pdf', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open Mica', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Mica details' })).toBeVisible();
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  await settled(page);
  await expect(page.getByRole('button', { name: 'Mica details', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Mica details', exact: true }).click();
  await settled(page);
  expect((await page.locator('.review-details-slot').boundingBox())?.width).toBeCloseTo(288, 0);
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
  await expect(page.getByText('This is the interaction preview.', { exact: false })).toBeVisible({
    timeout: 10000,
  });
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
  const close = await record('Arlo details');
  const open = await record('Arlo details');
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

test('editor frame and title stay fixed across tabs; only the content scrolls', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Actions for Arlo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit pebble', exact: true }).click();
  await settled(page);
  const dialog = page.getByRole('dialog', { name: 'Edit Arlo' }),
    before = await dialog.boundingBox(),
    heading = await dialog.getByRole('heading').boundingBox();
  for (const tab of ['Role', 'Tools & skills', 'Profile']) {
    await dialog.getByRole('tab', { name: tab, exact: true }).click();
    await settled(page);
    expect(await dialog.boundingBox()).toEqual(before);
    expect(await dialog.getByRole('heading').boundingBox()).toEqual(heading);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await settled(page);
  const phone = await dialog.boundingBox();
  await dialog.getByRole('tab', { name: 'Role', exact: true }).click();
  expect(await dialog.boundingBox()).toEqual(phone);
  await expect(dialog.getByRole('button', { name: 'Save changes', exact: true })).toBeInViewport();
});

test('account and attachment menus use the shared dark, borderless surface', async ({ page }) => {
  for (const trigger of ['Your account', 'Add attachment']) {
    await page.getByRole('button', { name: trigger, exact: true }).click();
    await settled(page);
    const surface = await page.getByRole('menu').evaluate((el) => {
      const s = getComputedStyle(el);
      return { border: s.borderTopWidth, background: s.backgroundColor, outline: s.outlineStyle };
    });
    expect(surface).toEqual({ border: '0px', background: 'rgb(34, 34, 37)', outline: 'none' });
    await page.keyboard.press('Escape');
    await settled(page);
  }
  const scrollbars = await page.locator('.review-transcript').evaluate((el) => ({
    width: getComputedStyle(el).scrollbarWidth,
    color: getComputedStyle(el).scrollbarColor,
  }));
  expect(scrollbars.width).toBe('thin');
  expect(scrollbars.color).toContain('59, 58, 67');
});

test('crews open independent chats; their menu owns crew settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Open Studio chat', exact: true }).click();
  await expect(page.getByLabel('Message', { exact: true })).toHaveAttribute(
    'placeholder',
    'Message Studio',
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Message', { exact: true }).fill('Crew-only message');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Thinking');
  await page.getByRole('button', { name: 'Open Arlo', exact: true }).click();
  await expect(page.getByText('Crew-only message', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Studio chat', exact: true }).click();
  await expect(page.getByText('Crew-only message', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Actions for Studio', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Crew settings', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Crew settings' })).toBeVisible();
});

test('sections can be created, collapsed, reordered and receive pebbles through menus or drag', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New section', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Projects');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await settled(page);
  await page.getByRole('button', { name: 'Actions for Rowan', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Move to section', exact: true }).hover();
  await page.getByRole('menuitemradio', { name: 'Projects', exact: true }).click();
  await settled(page);
  const section = page.getByRole('region', { name: 'Projects', exact: true });
  await expect(section.getByRole('button', { name: 'Open Rowan', exact: true })).toBeVisible();
  await section.getByRole('button', { name: 'Projects', exact: true }).click();
  await expect(section.getByRole('button', { name: 'Open Rowan', exact: true })).toHaveCount(0);
  await section.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Actions for Projects section', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Move up', exact: true }).click();
  await settled(page);
  expect(
    await page
      .locator('.review-list')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label'))),
  ).toEqual(['Personal', 'Projects', 'Crews']);
  await section
    .locator('.review-row')
    .dragTo(
      page.getByRole('region', { name: 'Personal', exact: true }).locator('.review-section-header'),
    );
  await settled(page);
  await expect(
    page
      .getByRole('region', { name: 'Personal', exact: true })
      .getByRole('button', { name: 'Open Rowan', exact: true }),
  ).toBeVisible();
});

test('pebbles move between crews and retain their identity and selected conversation', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New crew', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Research');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await settled(page);
  await page.getByRole('button', { name: 'Actions for Ember', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Move to crew', exact: true }).hover();
  await page.getByRole('menuitemradio', { name: 'Research', exact: true }).click();
  await settled(page);
  await expect(
    page.getByLabel('Research pebbles').getByRole('button', { name: 'Open Ember', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel('Studio pebbles').getByRole('button', { name: 'Open Ember', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Ember', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ember details', exact: true })).toBeVisible();
});

test('thinking and working use one quiet shimmering label, stable geometry, and a static reduced-motion equivalent', async ({
  page,
}) => {
  await page.getByLabel('Message', { exact: true }).fill('Show the activity states');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  const status = page.getByRole('status');
  await expect(status).toHaveText('Thinking');
  const before = await status.boundingBox(),
    initial = await status
      .locator('span')
      .evaluate((el) => getComputedStyle(el).backgroundPosition);
  await page.waitForTimeout(1000);
  const moved = await status
    .locator('span')
    .evaluate((el) => getComputedStyle(el).backgroundPosition);
  expect(moved).not.toBe(initial);
  expect(await status.boundingBox()).toEqual(before);
  await expect(status.locator('span')).toHaveCount(1);
  await expect(status).toHaveText('Working');
  expect(await status.boundingBox()).toEqual(before);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await status.locator('span').evaluate((el) => getComputedStyle(el).animationName)).toBe(
    'none',
  );
  await expect(page.getByText('This is the interaction preview.', { exact: false })).toBeVisible({
    timeout: 10000,
  });
  await expect(status).toBeEmpty();
});

test('equal face-relative pointer distances reach equal left and right gaze', async ({ page }) => {
  const row = page.locator('.review-row.pebble-row').first(),
    svg = row.locator('svg.avatar'),
    box = (await svg.boundingBox())!;
  async function center() {
    return svg.evaluate((node) => {
      if (!(node instanceof SVGSVGElement)) throw Error('Expected avatar SVG');
      const local = node.getCTM()!.inverse();
      return (
        [...node.querySelectorAll('rect')].reduce(
          (sum, eye) => sum + local.multiply(eye.getCTM()!).e,
          0,
        ) / 2
      );
    });
  }
  await page.mouse.move(box.x + 1, box.y + box.height / 2);
  await page.waitForTimeout(350);
  const left = await center();
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2);
  await page.waitForTimeout(350);
  const right = await center();
  expect(left).toBeLessThan(40);
  expect(right).toBeGreaterThan(60);
  expect(Math.abs(50 - left - (right - 50))).toBeLessThan(2);
});

test('phone details occupies the interface without a modal and returns focus to the title', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => (await page.locator('.review-details-slot').boundingBox())?.width)
    .toBeCloseTo(390, 0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.review-main')).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  await settled(page);
  await expect(page.getByRole('button', { name: 'Arlo details', exact: true })).toBeFocused();
  await expect(page.locator('.review-main')).not.toHaveAttribute('inert');
  await page.getByRole('button', { name: 'Arlo details', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Arlo', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Arlo details', exact: true })).toBeFocused();
});

test('crew drafts and chosen files remain with their originating conversation', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Open Studio chat', exact: true }).click();
  await page.getByLabel('Message', { exact: true }).fill('Crew draft');
  await page.getByLabel('Choose files', { exact: true }).setInputFiles({
    name: 'crew-notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Local preview file'),
  });
  await expect(page.getByText('crew-notes.txt', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open Arlo', exact: true }).click();
  await expect(page.getByLabel('Message', { exact: true })).toHaveValue('');
  await expect(page.getByText('crew-notes.txt', { exact: true })).toHaveCount(0);
  await page.getByLabel('Message', { exact: true }).fill('Arlo draft');
  await page.getByRole('button', { name: 'Open Studio chat', exact: true }).click();
  await expect(page.getByLabel('Message', { exact: true })).toHaveValue('Crew draft');
  await expect(page.getByText('crew-notes.txt', { exact: true })).toBeVisible();
});
