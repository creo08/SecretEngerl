import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('Räuberwichteln runs on one phone: steal, lock, reload, undo and the end', async ({ page }) => {
  await page.goto('./');
  // Before the script has wired the cards, a tap opens the form page instead, as without script.
  await expect(page.locator('a[data-game][data-wired]')).toHaveCount(3);
  await page.getByRole('link', { name: /Räuberwichteln/ }).click();
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\nBernd\nClara');
  await page.getByLabel('Wie eingetippt').check();
  await page.getByLabel('Gesperrt nach so vielen Klauen').fill('1');
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  await expect(page.getByRole('heading', { name: 'Anna ist dran' })).toBeFocused();
  await expect(page.getByText('Noch 3 Geschenke verpackt')).toBeVisible();
  await page.getByLabel('Was ist drin? (freiwillig)').fill('Socken');
  // A double tap unwraps one gift, not a second one for the next person.
  await expect(page.locator('.settling')).toHaveCount(0);
  const box = (await page.getByRole('button', { name: 'Neues Geschenk auspacken' }).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByText('Noch 2 Geschenke verpackt')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Bernd ist dran' })).toBeVisible();
  await page.getByRole('button', { name: 'Klauen' }).click();
  await expect(page.getByRole('heading', { name: 'Anna ist dran' })).toBeVisible();
  await expect(page.getByText('Anna wurde beklaut. Geschenk 1 darf nicht sofort zurück.')).toBeVisible();
  await expect(page.getByText('bei Bernd, gesperrt')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Klauen' })).toHaveCount(0);

  // A reload does not end the game.
  await page.reload();
  await page.getByRole('button', { name: 'Weiterspielen' }).click();
  await expect(page.getByRole('heading', { name: 'Anna ist dran' })).toBeVisible();
  await page.getByRole('button', { name: 'Neues Geschenk auspacken' }).click();
  await expect(page.getByRole('heading', { name: 'Clara ist dran' })).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('heading', { name: 'Anna ist dran' })).toBeVisible();
  await page.getByRole('button', { name: 'Neues Geschenk auspacken' }).click();
  await page.getByRole('button', { name: 'Klauen' }).click();
  await expect(page.getByRole('heading', { name: 'Anna ist dran' })).toBeVisible();
  await page.getByRole('button', { name: 'Neues Geschenk auspacken' }).click();

  await expect(page.getByRole('heading', { name: 'Alle Geschenke sind ausgepackt' })).toBeVisible();
  await expect(page.locator('#game li')).toHaveText(['AnnaGeschenk 3', 'BerndGeschenk 1: Socken', 'ClaraGeschenk 2']);
  await page.getByRole('button', { name: 'Spiel beenden' }).click();
  await expect(page.getByText('Das Spiel ist beendet und gelöscht.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Weiterspielen' })).toHaveCount(0);
});

test('the game card and ?spiel= open the game, and the form page works without script', async ({ browser, page }) => {
  await page.goto('./?spiel=raeuberwichteln');
  await expect(page.getByRole('heading', { name: 'Räuberwichteln', level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/SecretEngerl\/$/);

  const context = await browser.newContext({ javaScriptEnabled: false });
  const noJs = await context.newPage();
  await noJs.goto('./');
  await noJs.getByRole('link', { name: /Räuberwichteln/ }).click();
  await expect(noJs.getByRole('heading', { level: 1, name: 'Räuberwichteln mit dem Handy spielen' })).toBeVisible();
  await expect(noJs.getByRole('link', { name: 'Mit diesem Spiel starten' })).toHaveClass(/btn--ink/);
  await context.close();
});
