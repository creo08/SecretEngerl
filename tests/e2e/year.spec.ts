import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function drawRound(page: Page, names: string, date = inDays(30)): Promise<void> {
  await page.goto('./?vorlage=familien-wichteln');
  await page.getByLabel('Namen, einer pro Zeile').fill(names);
  await page.getByLabel('Übergabetag').fill(date);
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByLabel('Hinweis zu Clara').fill('keine Nüsse');
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await expect(page.locator('#round h1')).toBeVisible();
}

async function saveYearFile(page: Page, password = ''): Promise<string> {
  await page.getByText('Fürs nächste Jahr merken', { exact: true }).click();
  await expect(page.getByText('Ohne Passwort kann jede Person mit der Datei die Zuordnung und die Hinweise lesen.')).toBeVisible();
  if (password) await page.getByLabel('Passwort (optional)').fill(password);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Datei speichern' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^engerl-\d{4}\.wichtel$/);
  return file.path();
}

async function openYearFile(page: Page, path: string): Promise<void> {
  await page.goto('./');
  await page.getByText('Datei öffnen', { exact: true }).click();
  await page.getByLabel('Datei', { exact: true }).setInputFiles(path);
  await page.locator('#files').getByRole('button', { name: 'Öffnen' }).click();
}

test('a yearly file starts next year without last year\'s pairings, with renamed people matched', async ({ page }) => {
  await drawRound(page, 'Anna\nBernd\n\nClara\n\nDavid\n\nEva');
  const path = await saveYearFile(page);
  const content = JSON.parse(await readFile(path, 'utf8'));
  expect(content).toMatchObject({ format: 'secretengerl-year', version: 1, hints: { Clara: 'keine Nüsse' } });
  expect(content.pairings).toHaveLength(5);

  await openYearFile(page, path);
  await expect(page.getByLabel('Namen, einer pro Zeile')).toHaveValue('Anna\nBernd\n\nClara\n\nDavid\n\nEva');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\nBernd\n\nKlara\n\nDavid\n\nEva');
  await page.getByLabel('Übergabetag').fill(inDays(40));
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('Wer ist wer?')).toBeVisible();
  await page.getByLabel(/^Clara aus \d{4} heißt jetzt$/).selectOption('Klara');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText(/^5 Paarungen aus \d{4} werden ausgeschlossen\.$/)).toBeVisible();
  // The pairings stay hidden until "Ich spicke".
  await expect(page.getByText(/^\p{L}+ hat \p{L}+ beschenkt$/u)).toHaveCount(0);
  await page.getByText('Paarungen ansehen', { exact: true }).click();
  await page.getByLabel('Tippe „Ich spicke“').fill('Ich spicke');
  await page.getByRole('button', { name: 'Ansehen' }).click();
  await expect(page.getByText(/^\p{L}+ hat \p{L}+ beschenkt$/u)).toHaveCount(5);
  // Clara's hint follows her new name.
  await expect(page.getByLabel('Hinweis zu Klara')).toHaveValue('keine Nüsse');
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await expect(page.locator('#round h1')).toBeVisible();
});

test('an encrypted yearly file asks for its password', async ({ page }) => {
  await drawRound(page, 'Anna\n\nBernd\n\nClara');
  const path = await saveYearFile(page, 'Zirbe');
  expect(await readFile(path, 'utf8')).not.toContain('Anna');
  await openYearFile(page, path);
  await expect(page.getByText('Die Datei ist mit einem Passwort geschützt.')).toBeVisible();
  await page.getByLabel('Passwort', { exact: true }).fill('Fichte');
  await page.locator('#files').getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByText('Das Passwort stimmt nicht.')).toBeVisible();
  await page.getByLabel('Passwort', { exact: true }).fill('Zirbe');
  await page.locator('#files').getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByLabel('Namen, einer pro Zeile')).toHaveValue('Anna\n\nBernd\n\nClara');
});

test('an ended round stays on the device as last year\'s round', async ({ page }) => {
  await drawRound(page, 'Anna\n\nBernd\n\nClara', inDays(1));
  // Ten days later the round deletes itself within a week: the app reminds the organizer.
  await page.clock.setFixedTime(new Date(Date.now() + 10 * 86_400_000));
  await page.goto('./');
  await page.getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByText(/Diese Runde löscht sich am .+\. Speichere sie vorher fürs nächste Jahr\./)).toBeVisible();
  await page.clock.setFixedTime(new Date(Date.now() + 20 * 86_400_000));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Vom letzten Jahr' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Deine Runden auf diesem Gerät' })).toBeHidden();
  await page.getByRole('button', { name: 'Runde daraus starten' }).click();
  await expect(page.getByLabel('Namen, einer pro Zeile')).toHaveValue('Anna\n\nBernd\n\nClara');
});
