import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test('a backup restores a round on another device, and asks before replacing', async ({ browser }) => {
  const first = await browser.newContext();
  const page = await first.newPage();
  await page.goto('./?vorlage=engerl-bengerl');
  await page.getByLabel('Name der Runde').fill('Team Nord');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\n\nBernd\n\nClara');
  await page.getByLabel('Übergabetag').fill(inDays(30));
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await page.getByText('Sicherung speichern', { exact: true }).first().click();
  await expect(page.getByText(/Ohne Passwort steht die Runde mit allen Links in der Datei\./)).toBeVisible();
  await page.locator('details[open]').getByLabel('Passwort (optional)').fill('Lärche');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sicherung speichern' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^runde-\d{4}-\d{2}\.wichtel$/);
  const path = await file.path();
  expect(await readFile(path, 'utf8')).not.toContain('Anna');

  // A second device (a fresh browser profile) opens the backup.
  const second = await browser.newContext();
  const other = await second.newPage();
  await other.goto('./');
  await other.getByText('Datei öffnen', { exact: true }).click();
  await other.getByLabel('Datei', { exact: true }).setInputFiles(path);
  await other.locator('#files').getByRole('button', { name: 'Öffnen' }).click();
  await expect(other.getByText('Die Datei ist mit einem Passwort geschützt.')).toBeVisible();
  await other.getByLabel('Passwort', { exact: true }).fill('Lärche');
  await other.locator('#files').getByRole('button', { name: 'Öffnen' }).click();
  await expect(other.getByRole('heading', { name: 'Team Nord' })).toBeVisible();
  await expect(other.getByText('Die Runde ist wiederhergestellt.')).toBeVisible();
  await expect(other.getByRole('button', { name: 'Los an Anna senden' })).toBeVisible();

  // Opening it again on the same device asks first.
  await other.goto('./');
  await other.getByText('Datei öffnen', { exact: true }).click();
  await other.getByLabel('Datei', { exact: true }).setInputFiles(path);
  await other.locator('#files').getByRole('button', { name: 'Öffnen' }).click();
  await expect(other.getByText('Die Datei ist mit einem Passwort geschützt.')).toBeVisible();
  await other.getByLabel('Passwort', { exact: true }).fill('Lärche');
  await other.locator('#files').getByRole('button', { name: 'Öffnen' }).click();
  await expect(other.getByText(/Diese Runde liegt schon auf diesem Gerät\. Hier: Ziehung Nr\. 1\. In der Datei: Ziehung Nr\. 1\./)).toBeVisible();
  await other.getByRole('button', { name: 'Abbrechen' }).click();
  await first.close();
  await second.close();
});
