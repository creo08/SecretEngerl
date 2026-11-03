import { expect, test } from '@playwright/test';

test('a hint of someone removed in step 1 does not block the draw', async ({ page }) => {
  await page.goto('./?vorlage=familien-wichteln');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\n\nBernd\n\nClara\n\nDavid');
  await page.getByLabel('Übergabetag').fill(new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByLabel('Hinweis zu David').fill('Bücher');
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\n\nBernd\n\nClara');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await expect(page.getByRole('heading', { name: /Runde für den/ })).toBeVisible();
});
