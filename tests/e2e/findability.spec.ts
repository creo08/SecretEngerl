import { expect, test } from '@playwright/test';

const SITE = 'https://creo08.github.io/SecretEngerl/';
const local = (url: string) => url.replace(SITE, './');

test('the sitemap lists reachable pages, each with its canonical URL', async ({ page, request }) => {
  const xml = await (await request.get('sitemap.xml')).text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  expect(urls).toContain(`${SITE}wichteln/`);
  expect(urls.some((u) => u.includes('/neu') || u.includes('/vorlagen/'))).toBe(false);
  for (const url of urls) {
    await page.goto(local(url));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', url);
  }
});

test('form pages carry HowTo data and the start page WebApplication data', async ({ page }) => {
  await page.goto('schrottwichteln/');
  const howTo = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(howTo['@type']).toBe('HowTo');
  expect(howTo.step).toHaveLength(4);
  await page.goto('./');
  const app = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(app).toMatchObject({ '@type': 'WebApplication', url: SITE });
});

test('llms.txt explains the app and the pre-fill link', async ({ request }) => {
  const text = await (await request.get('llms.txt')).text();
  expect(text).toMatch(/^# SecretEngerl/);
  expect(text).toContain(`${SITE}neu#v=1&f=engerl-bengerl&n=Anna,Bernd;Clara,David;Eva&b=20&d=2026-12-20`);
  expect(text).toContain("reach that assistant's provider");
  expect(text).not.toContain('{{app}}');
});

test('old template addresses forward to the form pages without script', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('vorlagen/schrottwichteln/');
  await expect(page.getByRole('heading', { level: 1, name: 'Schrottwichteln online auslosen' })).toBeVisible();
  expect(page.url()).toMatch(/\/SecretEngerl\/schrottwichteln\/$/);
  await context.close();
});

test('a pre-fill link shows a confirmation and fills the wizard, drawing nothing', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('neu#v=1&f=engerl-bengerl&n=Anna,Bernd;Clara,David;Eva&b=25&d=2099-12-20');
  await expect(page.getByRole('heading', { name: 'Neue Runde aus einem Link' })).toBeVisible();
  expect(page.url()).not.toContain('#');
  await expect(page.getByText('Gruppe Anna und Bernd')).toBeVisible();
  await expect(page.getByText('25 €')).toBeVisible();
  await page.getByRole('button', { name: 'Übernehmen und weiter' }).click();
  await expect(page.getByRole('heading', { name: 'Wer spielt mit?' })).toBeVisible();
  await expect(page.getByLabel('Namen, einer pro Zeile')).toHaveValue('Anna\nBernd\n\nClara\nDavid\n\nEva');
  await expect(page.getByLabel('Übergabetag')).toHaveValue('2099-12-20');
  await expect(page.getByLabel('Budget in Euro')).toHaveValue('25');
  expect(page.url()).toMatch(/\/SecretEngerl\/$/);
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.getByRole('link', { name: /Büro-Wichteln/ }).click();
  await expect(page.getByRole('heading', { name: 'Wer spielt mit?' })).toBeVisible();
  expect(requests.filter((u) => !u.startsWith('http://localhost:4173'))).toEqual([]);
});

test('a broken pre-fill link explains why', async ({ page }) => {
  await page.goto('neu#v=1&f=pyramid&n=Anna');
  await expect(page.getByText('Mit diesem Link lässt sich keine Runde vorbereiten.')).toBeVisible();
  await expect(page.getByText('Diese Vorlage gibt es nicht.')).toBeVisible();
});
