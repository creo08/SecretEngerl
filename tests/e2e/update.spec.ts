import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

test('after "Neu laden" in one tab, other open tabs offer a reload too', async ({ browser }) => {
  const context = await browser.newContext();
  const a = await context.newPage();
  await a.goto('./');
  await a.evaluate(() => navigator.serviceWorker.ready);
  await a.reload();
  await a.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const b = await context.newPage();
  await b.goto('./');
  await b.waitForFunction(() => navigator.serviceWorker.controller !== null);

  // Publish a "new version" of the service worker.
  const path = 'dist/sw.js';
  const original = await readFile(path, 'utf8');
  await writeFile(path, `${original}\n// a new version for this test\n`);
  try {
    await a.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
    await a.getByRole('button', { name: 'Neu laden' }).click();
    await a.waitForFunction(() => document.readyState === 'complete');
    // Tab b still runs the old code; it must offer a reload that really reloads.
    await expect(b.getByRole('button', { name: 'Neu laden' })).toBeVisible();
    await Promise.all([b.waitForEvent('load'), b.getByRole('button', { name: 'Neu laden' }).click()]);
    await expect(b.getByRole('button', { name: 'Neu laden' })).toBeHidden();
  } finally {
    await writeFile(path, original);
    await context.close();
  }
});
