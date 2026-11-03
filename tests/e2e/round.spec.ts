import { expect, test, type Page } from '@playwright/test';

const ORIGIN = 'http://localhost:4173';

/** An exchange date 30 days from now, so the draws never expire during the test. */
function exchangeDate(): string {
  return new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
}

function watchRequests(page: Page, seen: string[]): void {
  page.on('request', (request) => seen.push(request.url()));
}

test('a complete round makes no request outside the own origin', async ({ browser }) => {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const requests: string[] = [];
  context.on('request', (request) => requests.push(request.url()));
  const page = await context.newPage();

  await page.goto('./');
  await page.getByRole('link', { name: /Engerl-Bengerl klassisch/ }).click();
  await expect(page.getByRole('heading', { name: 'Wer spielt mit?' })).toBeVisible();
  await expect(page.getByLabel('Name der Runde')).toHaveValue(/^Engerl-Bengerl klassisch \d{4}$/);
  await page.getByLabel('Name der Runde').fill('Familie Huber');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\nBernd\n\nClara\nDavid\n\nEva');
  await expect(page.getByText('Gruppe Anna und Bernd')).toBeVisible();
  await page.getByLabel('Übergabetag').fill(exchangeDate());
  await page.getByLabel('Budget in Euro').fill('20');
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(page.getByRole('heading', { name: 'Regeln' })).toBeVisible();
  await page.getByLabel('Hinweis zu Clara').fill('keine Nüsse');
  await page.getByRole('button', { name: 'Ziehen' }).click();

  await expect(page.getByRole('heading', { name: 'Familie Huber' })).toBeVisible();
  await expect(page.getByText(/^Übergabe am /)).toBeVisible();
  await expect(page.getByText(/Eine von [\d.]+ möglichen Ziehungen/)).toBeVisible();
  await page.getByRole('button', { name: 'Verstanden' }).click();
  await page.getByRole('button', { name: 'Los an Anna senden' }).click();
  await expect(page.getByText('Link kopiert. Füge ihn jetzt im Einzelchat mit Anna ein.')).toBeVisible();
  const message = await page.evaluate(() => navigator.clipboard.readText());
  expect(message).toMatch(/^Dein Engerl-Bengerl-Los/);
  const link = message.split('\n').at(-1)!;
  expect(link).toMatch(/^http:\/\/localhost:4173\/SecretEngerl\/#1\.[\w-]{22}\.[\w-]{379}$/);

  const receiver = await context.newPage();
  await receiver.goto(link);
  await expect(receiver.getByRole('button', { name: 'Antippen zum Aufdecken' })).toBeVisible();
  expect(receiver.url()).toBe(`${ORIGIN}/SecretEngerl/`);
  await receiver.getByRole('button', { name: 'Antippen zum Aufdecken' }).click();
  await expect(receiver.locator('#los').getByText('Du bist das Engerl von')).toBeVisible();
  const bengerl = (await receiver.locator('#los .slip-name').textContent())!;
  expect(['Clara', 'David', 'Eva']).toContain(bengerl);

  // The round survives a reload in IndexedDB.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Deine Runden auf diesem Gerät' })).toBeVisible();
  await expect(page.getByText(/^Familie Huber, Übergabe am .+, 5 Personen$/)).toBeVisible();
  await expect(page.getByText('1 von 5 gesendet')).toBeVisible();
  await page.getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.locator('.sent-mark:visible')).toHaveCount(1);

  // Emergency view of one person, logged.
  await page.getByText('Während der Runde').click();
  await page.getByLabel('Wen beschenkt …?').selectOption('Anna');
  await page.getByLabel('Tippe „Ich spicke“').fill('ich spicke');
  await page.getByRole('button', { name: 'Ansehen' }).click();
  await expect(page.getByText(`Anna beschenkt ${bengerl}.`)).toBeVisible();
  await expect(page.getByText(/Zuordnung von Anna angesehen am/)).toBeVisible();

  // Drop-out: exactly one person gets a new link.
  await page.getByLabel('Wer sagt ab?').selectOption('Eva');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByText(/bekommt einen neuen Link/)).toBeVisible();

  const foreign = requests.filter((url) => !url.startsWith(ORIGIN) && !url.startsWith('blob:') && !url.startsWith('data:'));
  expect(foreign).toEqual([]);
  await context.close();
});

test('a broken, an empty and a tampered link show friendly messages', async ({ page }) => {
  const requests: string[] = [];
  watchRequests(page, requests);
  await page.goto('./#1.abc.def');
  await page.getByRole('button', { name: 'Antippen zum Aufdecken' }).click();
  await expect(page.getByRole('heading', { name: 'Dieses Los hat der Krampus geholt.' })).toBeVisible();
  await page.goto('about:blank');
  await page.goto('./#');
  await page.getByRole('button', { name: 'Antippen zum Aufdecken' }).click();
  await expect(page.getByRole('heading', { name: 'Hinterm # ist nix.' })).toBeVisible();
  // The skip link's anchor is not a draw.
  await page.goto('about:blank');
  await page.goto('./#main');
  await expect(page.getByRole('heading', { name: /Engerl-Bengerl auslosen/ })).toBeVisible();
});

test('the built pages have no inline scripts and start with the policy', async ({ page }) => {
  for (const path of ['./', 'faq/', 'sicherheit/', 'datenschutz/', 'so-funktionierts/', 'vorlagen/schrottwichteln/']) {
    await page.goto(path);
    expect(await page.locator('script:not([src])').count()).toBe(0);
    const first = await page.evaluate(() => document.head.firstElementChild?.getAttribute('http-equiv'));
    expect(first).toBe('Content-Security-Policy');
  }
});
