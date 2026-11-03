import { expect, test } from '@playwright/test';

test('in a postal round the Engerl sees the address, and only in their own draw', async ({ browser }) => {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  await page.goto('./?vorlage=post-wichteln');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\n\nBernd');
  await page.getByLabel('Übergabetag').fill(new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByLabel('Adresse von Anna').fill('Anna Beispiel\nRingstraße 2\n1010 Wien');
  await page.getByLabel('Adresse von Bernd').fill('Bernd Beispiel\nHauptplatz 1\n8010 Graz');
  // Two people without "no mutual pairs": Anna gives to Bernd and Bernd to Anna.
  await page.getByLabel('Keine Gegenseitigkeit').uncheck();
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await page.getByRole('button', { name: 'Verstanden' }).click();
  await page.getByRole('button', { name: 'Los an Anna senden' }).click();
  await expect(page.getByText(/Link kopiert/)).toBeVisible();
  const link = (await page.evaluate(() => navigator.clipboard.readText())).split('\n').at(-1)!;

  const receiver = await context.newPage();
  await receiver.goto(link);
  await receiver.getByRole('button', { name: 'Antippen zum Aufdecken' }).click();
  await expect(receiver.locator('#los .slip-name')).toHaveText('Bernd');
  await expect(receiver.getByText('Adresse für das Paket')).toBeVisible();
  await expect(receiver.getByText(/Hauptplatz 1/)).toBeVisible();
  await expect(receiver.getByText(/Ringstraße 2/)).toHaveCount(0);
  await context.close();
});
