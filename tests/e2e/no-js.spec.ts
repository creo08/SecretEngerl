import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

const pages: [string, string][] = [
  ['./', 'Engerl-Bengerl auslosen, ganz ohne Server.'],
  ['so-funktionierts/', "So funktioniert’s"],
  ['sicherheit/', 'Datenschutz und Bedrohungsmodell'],
  ['faq/', 'FAQ'],
  ['datenschutz/', 'Datenschutzhinweis'],
  ['vorlagen/engerl-bengerl/', 'Engerl-Bengerl klassisch'],
  ['vorlagen/schrottwichteln/', 'Schrottwichteln'],
  ['vorlagen/familien-wichteln/', 'Familien-Wichteln'],
  ['vorlagen/buero-wichteln/', 'Büro-Wichteln'],
];

test('the help pages are readable without JavaScript', async ({ page }) => {
  for (const [path, title] of pages) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  }
  await page.goto('datenschutz/');
  await expect(page.getByText('GitHub protokolliert beim Seitenaufruf IP-Adressen zu Sicherheitszwecken.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'creo08' })).toHaveAttribute('href', 'https://github.com/creo08');
});

test('without JavaScript the templates lead to their help pages', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: /Schrottwichteln/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Schrottwichteln' })).toBeVisible();
});

test('the start page says where data is stored', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Wo was gespeichert wird' })).toBeVisible();
  await expect(page.getByText('Auf einem Server', { exact: true })).toBeVisible();
});
