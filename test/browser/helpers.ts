import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function pair(page: Page, waitForWorkspace = true) {
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
  if (waitForWorkspace) await expect(page.getByRole('navigation', { name: 'Bots' })).toBeAttached();
}

export async function connect(page: Page) {
  await pair(page);
  await page.getByRole('button', { name: 'Alpha Bot Chat' }).click();
  await expect(page.getByRole('heading', { name: 'Alpha', exact: true })).toBeVisible();
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
}
