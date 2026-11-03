import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('an Advent-Engerl draw names the weekly themes and adds one event per Advent Sunday', async ({ browser }) => {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const year = new Date().getFullYear() + 1;
  await page.goto('./?vorlage=advent-engerl');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\n\nBernd\n\nClara');
  await page.getByLabel('Übergabetag').fill(`${year}-12-22`);
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByLabel('Woche 1').fill('etwas Süßes');
  await page.getByLabel('Woche 3').fill('selbstgemacht');
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await page.getByRole('button', { name: 'Verstanden' }).click();
  await page.getByRole('button', { name: 'Los an Anna senden' }).click();
  await expect(page.getByText(/Link kopiert/)).toBeVisible();
  const link = (await page.evaluate(() => navigator.clipboard.readText())).split('\n').at(-1)!;

  const receiver = await context.newPage();
  await receiver.goto(link);
  await receiver.getByRole('button', { name: 'Antippen zum Aufdecken' }).click();
  await expect(receiver.getByText('etwas Süßes')).toBeVisible();
  await expect(receiver.getByText('selbstgemacht')).toBeVisible();
  await expect(receiver.getByText(/Jede Adventwoche heimlich eine kleine Freude\./)).toBeVisible();
  const download = receiver.waitForEvent('download');
  await receiver.getByRole('button', { name: 'In den Kalender' }).click();
  const ics = await readFile(await (await download).path(), 'utf8');
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(5);
  expect(ics).toContain('SUMMARY:Advent-Engerl\\, Woche 1: etwas Süßes');
  expect(ics).not.toMatch(/Bernd|Clara|Anna/);
  await context.close();
});
