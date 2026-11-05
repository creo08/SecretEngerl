import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('Zufallswichteln draws at the party, keeps groups apart and stores nothing', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: /Zufallswichteln/ }).click();
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\nBernd\n\nClara\nDavid');
  await expect(page.getByText('Gruppe Anna und Bernd')).toBeVisible();
  await page.getByRole('button', { name: 'Jetzt auslosen' }).click();

  const pairs: [string, string][] = [];
  for (let i = 1; i <= 4; i++) {
    await expect(page.getByText(`Paar ${i} von 4`)).toBeVisible();
    const [giver, receiver] = await page.locator('.stage-name').allTextContents();
    pairs.push([giver!, receiver!]);
    await page.getByRole('button', { name: i < 4 ? 'Nächstes Paar' : 'Alle Paare zeigen' }).click();
  }
  // Nobody gets their own gift or one from their own group.
  const group = (n: string) => (['Anna', 'Bernd'].includes(n) ? 1 : 2);
  expect(pairs.every(([g, r]) => group(g) !== group(r))).toBe(true);
  expect(new Set(pairs.map(([, r]) => r)).size).toBe(4);
  await expect(page.locator('#game li')).toHaveCount(4);
  await page.getByRole('button', { name: 'Fertig' }).click();
  // Nothing was stored: no round and no running game on the start page, also after a reload.
  await page.reload();
  await expect(page.locator('#rounds')).toBeHidden();
  await expect(page.locator('#game-running')).toBeHidden();
});

test('an impossible Zufallswichteln explains why', async ({ page }) => {
  await page.goto('./?spiel=zufallswichteln');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\nBernd\nClara\n\nDavid');
  await page.getByRole('button', { name: 'Jetzt auslosen' }).click();
  await expect(page.getByRole('alert')).toContainText('dürfen zusammen nur');
});
