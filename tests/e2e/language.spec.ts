import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test('an English browser moves to /en/ once; a choice in the footer sticks', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-GB' });
  const page = await context.newPage();
  await page.goto('./');
  await expect(page).toHaveURL(/\/SecretEngerl\/en\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Draw Engerl-Bengerl, without any server.');
  await expect(page.getByText('Translated by AI.')).toBeVisible();
  await expect(page.getByText('Junk gift swap')).toBeVisible();

  await page.getByRole('link', { name: 'Deutsch' }).click();
  await expect(page).toHaveURL(/\/SecretEngerl\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Engerl-Bengerl auslosen, ganz ohne Server.');
  await expect(page.getByText('Junk gift swap')).toBeHidden();
  await page.goto('./');
  await expect(page).toHaveURL(/\/SecretEngerl\/$/);
  await context.close();
});

test('an English round shows the budget without currency; a German browser opens the draw in German', async ({ browser }) => {
  const organizer = await browser.newContext({ locale: 'en-GB', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await organizer.newPage();
  await page.goto('./en/');
  // Before the script has wired the cards, a tap opens the form page instead, as without script.
  await expect(page.locator('a[data-template][data-wired]')).toHaveCount(6);
  await page.getByRole('link', { name: /Engerl-Bengerl classic/ }).click();
  await expect(page.getByRole('heading', { name: 'Who plays?' })).toBeVisible();
  await page.getByLabel('Names, one per line').fill('Anna\n\nBernd');
  await page.getByLabel('Exchange date').fill(inDays(30));
  await page.getByLabel('Budget').fill('20');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('No mutual pairs').uncheck();
  await page.getByRole('button', { name: 'Draw' }).click();
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('button', { name: 'Send draw to Anna' }).click();
  await expect(page.getByText('Link copied. Paste it now in your one-to-one chat with Anna.')).toBeVisible();
  const message = await page.evaluate(() => navigator.clipboard.readText());
  expect(message).toContain('Your Engerl-Bengerl draw');
  const link = message.split('\n').at(-1)!;
  expect(link).toMatch(/\/SecretEngerl\/#1\./);

  const receiver = await browser.newContext({ locale: 'de-AT' });
  const draw = await receiver.newPage();
  await draw.goto(link);
  await draw.getByRole('button', { name: 'Antippen zum Aufdecken' }).click();
  await expect(draw.locator('#los .slip-label')).toHaveText('Du bist das Engerl von');
  await expect(draw.locator('#los dd').first()).toHaveText('20');
  await organizer.close();
  await receiver.close();
});

test('a German draw opens in English in an English browser, relabelled in place', async ({ browser }) => {
  const organizer = await browser.newContext({ locale: 'de-AT', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await organizer.newPage();
  await page.goto('./?vorlage=engerl-bengerl');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\n\nBernd');
  await page.getByLabel('Übergabetag').fill(inDays(30));
  await page.getByLabel('Budget in Euro').fill('20');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByLabel('Keine Gegenseitigkeit').uncheck();
  await page.getByRole('button', { name: 'Ziehen' }).click();
  await page.getByRole('button', { name: 'Verstanden' }).click();
  await page.getByRole('button', { name: 'Los an Anna senden' }).click();
  await expect(page.getByText(/Link kopiert/)).toBeVisible();
  const link = (await page.evaluate(() => navigator.clipboard.readText())).split('\n').at(-1)!;

  const receiver = await browser.newContext({ locale: 'en-GB' });
  const draw = await receiver.newPage();
  await draw.goto(link);
  await expect(draw).toHaveURL(/\/SecretEngerl\/$/);
  await expect(draw.locator('html')).toHaveAttribute('lang', 'en');
  await expect(draw.getByRole('link', { name: 'How it works' }).first()).toHaveAttribute('href', /\/en\/how-it-works\/$/);
  await draw.getByRole('button', { name: 'Tap to reveal' }).click();
  await expect(draw.locator('#los .slip-label')).toHaveText('You are the Engerl of');
  await expect(draw.locator('#los dd').first()).toHaveText('20 €');
  await organizer.close();
  await receiver.close();
});

test('English help and form pages lead to the English app', async ({ page }) => {
  await page.goto('./en/white-elephant/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('link', { name: 'Start this game' }).click();
  await expect(page).toHaveURL(/\/SecretEngerl\/en\/$/);
  await expect(page.getByRole('heading', { name: 'Räuberwichteln', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Names, one per line')).toBeVisible();
});

test('the built English pages carry no German page texts', () => {
  const german = ['Zum Inhalt', 'So funktioniert', 'Datenschutzhinweis', 'Quellcode auf GitHub', 'Womit fangen wir an', 'Wo was gespeichert wird', 'Spiele am Tisch'];
  const dir = 'dist/en';
  const pages = readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.name === 'index.html').map((e) => join(e.parentPath, e.name));
  expect(pages.length).toBeGreaterThan(10);
  for (const file of pages) {
    const html = readFileSync(file, 'utf8');
    expect(german.filter((word) => html.includes(word)), file).toEqual([]);
  }
});
