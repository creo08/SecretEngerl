import { expect, test } from '@playwright/test';

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test('a running round can be edited and drawn again without typing all names', async ({ browser }) => {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  await page.goto('./?vorlage=familien-wichteln');
  await page.getByLabel('Name der Runde').fill('Familie Huber');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\nBernd\n\nClara\n\nDavid');
  await page.getByLabel('Übergabetag').fill(inDays(30));
  await page.getByLabel('Budget in Euro').fill('20');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByLabel('Hinweis zu Clara').fill('keine Nüsse');
  await page.getByLabel('Hinweis zu David').fill('mag Tee');
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await page.getByRole('button', { name: 'Verstanden' }).click();
  await expect(page.locator('#round').getByText('Ziehung Nr. 1', { exact: true })).toBeVisible();

  await page.getByText('Während der Runde').click();
  await page.getByRole('button', { name: 'Runde bearbeiten' }).click();
  // Everything is filled in: rename David, add Eva, raise the budget.
  await expect(page.getByLabel('Name der Runde')).toHaveValue('Familie Huber');
  await expect(page.getByLabel('Namen, einer pro Zeile')).toHaveValue('Anna\nBernd\n\nClara\n\nDavid');
  await expect(page.getByLabel('Budget in Euro')).toHaveValue('20');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\nBernd\n\nClara\n\nDavide\n\nEva');
  await page.getByLabel('Budget in Euro').fill('25');
  await page.getByRole('button', { name: 'Weiter' }).click();
  // The hint stays with the unchanged name; the renamed person starts empty.
  await expect(page.getByLabel('Hinweis zu Clara')).toHaveValue('keine Nüsse');
  await expect(page.getByLabel('Hinweis zu Davide')).toHaveValue('');
  await page.getByRole('button', { name: 'Ziehen' }).click();

  await expect(page.getByRole('heading', { name: 'Familie Huber' })).toBeVisible();
  await expect(page.locator('#round').getByText('Ziehung Nr. 2', { exact: true })).toBeVisible();
  await expect(page.getByText('Geändert und neu gezogen. Sag der Gruppe, dass nur Ziehung Nr. 2 gilt, und schick allen ihr neues Los.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Los an .+ senden$/ })).toHaveCount(5);

  // Still one round on the device, not a second one.
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await expect(page.locator('#rounds li')).toHaveCount(1);

  // The new draw carries the new budget.
  await page.getByRole('button', { name: 'Öffnen' }).click();
  await page.getByRole('button', { name: 'Los an Clara senden' }).click();
  await expect(page.getByText(/Link kopiert/)).toBeVisible();
  const link = (await page.evaluate(() => navigator.clipboard.readText())).split('\n').at(-1)!;
  const draw = await context.newPage();
  await draw.goto(link);
  await draw.getByRole('button', { name: 'Antippen zum Aufdecken' }).click();
  await expect(draw.locator('#los').getByText('25 €', { exact: true })).toBeVisible();
  await expect(draw.locator('#los').getByText('Ziehung Nr. 2', { exact: true })).toBeVisible();
  await context.close();
});

test('"Zurück" while editing returns to the round', async ({ page }) => {
  await page.goto('./?vorlage=engerl-bengerl');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\n\nBernd\n\nClara');
  await page.getByLabel('Übergabetag').fill(inDays(30));
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await page.getByText('Während der Runde').click();
  await page.getByRole('button', { name: 'Runde bearbeiten' }).click();
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page.locator('#round').getByText('Ziehung Nr. 1', { exact: true })).toBeVisible();
});

test('editing keeps last year\'s pairings hidden behind "Ich spicke"', async ({ page }) => {
  await page.goto('./?vorlage=familien-wichteln');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\n\nBernd\n\nClara');
  await page.getByLabel('Übergabetag').fill(inDays(30));
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByLabel('Anna hat beschenkt').selectOption('Bernd');
  await page.getByLabel('Keine Gegenseitigkeit').uncheck();
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await page.getByText('Während der Runde').click();
  await page.getByRole('button', { name: 'Runde bearbeiten' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByLabel('Anna hat beschenkt')).toHaveValue('');
  await expect(page.getByText(/^1 Paarung aus \d{4} wird ausgeschlossen\.$/)).toBeVisible();
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await expect(page.locator('#round').getByText('Ziehung Nr. 2', { exact: true })).toBeVisible();
});
