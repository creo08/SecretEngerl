import { expect, test } from '@playwright/test';

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test('the stage reveal shows every pair, with a logged hurdle before the exchange day', async ({ page }) => {
  await page.goto('./?vorlage=engerl-bengerl');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\n\nBernd\n\nClara');
  await page.getByLabel('Übergabetag').fill(inDays(5));
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await expect(page.locator('#round h1')).toBeVisible();

  // Before the exchange day: "Ich spicke" and a log entry.
  await page.getByText('Auflösung starten', { exact: true }).first().click();
  await expect(page.getByText(/Der Übergabetag ist noch nicht da\./)).toBeVisible();
  await page.locator('details[open]').getByLabel('Tippe „Ich spicke“').fill('Ich spicke');
  await page.getByRole('button', { name: 'Auflösung starten' }).click();
  await expect(page.getByText('Paar 1 von 3')).toBeVisible();
  const givers = new Set<string>();
  for (let i = 0; i < 3; i++) {
    givers.add((await page.locator('.stage-name').first().textContent())!);
    await page.getByRole('button', { name: i < 2 ? 'Nächstes Paar' : 'Fertig' }).click();
  }
  expect(givers).toEqual(new Set(['Anna', 'Bernd', 'Clara']));
  await page.getByText('Während der Runde').click();
  await expect(page.getByText(/^Auflösung vor dem Übergabetag gestartet am /)).toBeVisible();

  // On the exchange day: no hurdle.
  await page.clock.setFixedTime(new Date(Date.now() + 6 * 86_400_000));
  await page.goto('./');
  await page.getByRole('button', { name: 'Öffnen' }).click();
  await page.getByText('Auflösung starten', { exact: true }).first().click();
  await expect(page.getByText(/Der Übergabetag ist noch nicht da\./)).toBeHidden();
  await page.getByRole('button', { name: 'Auflösung starten' }).click();
  await expect(page.getByText('Paar 1 von 3')).toBeVisible();
  await page.getByRole('button', { name: 'Beenden' }).click();
  await expect(page.locator('#round h1')).toBeVisible();
});
