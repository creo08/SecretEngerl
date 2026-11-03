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

test('after setting a PIN the emergency view asks for it', async ({ page }) => {
  await page.goto('./?vorlage=engerl-bengerl');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\n\nBernd\n\nClara');
  await page.getByLabel('Übergabetag').fill(new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await page.getByText('Während der Runde').click();
  await page.locator('summary', { hasText: 'PIN festlegen' }).click();
  await page.getByLabel('Neue PIN').fill('4711');
  await page.getByRole('button', { name: 'PIN festlegen' }).click();
  await expect(page.getByText('PIN gespeichert.')).toBeVisible();
  await page.getByText('Während der Runde').click();
  await page.getByLabel('Tippe „Ich spicke“').fill('Ich spicke');
  await page.getByLabel('PIN', { exact: true }).fill('0000');
  await page.getByRole('button', { name: 'Ansehen' }).click();
  await expect(page.getByText('Die PIN stimmt nicht.')).toBeVisible();
  await page.getByLabel('PIN', { exact: true }).fill('4711');
  await page.getByRole('button', { name: 'Ansehen' }).click();
  await expect(page.getByText(/^Anna beschenkt (Bernd|Clara)\.$/)).toBeVisible();
});
