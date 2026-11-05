import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('Würfelwichteln rolls, shows the rule, turns around, pauses and ends when the time is up', async ({ page }) => {
  await page.clock.install();
  await page.goto('./?spiel=wuerfelwichteln');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\nBernd\nClara');
  await page.getByLabel('Wie eingetippt').check();
  await page.getByLabel('Spielzeit in Minuten').fill('2');
  await page.getByText('Würfelregeln', { exact: true }).click();
  await page.getByLabel('Bei einer 6').fill('Nimm eins aus der Mitte');
  await page.getByLabel('Trinkregel').check();
  await page.getByLabel('Was dann gilt').fill('Ein Schluck Punsch');
  await page.getByRole('button', { name: 'Spiel starten' }).click();

  await expect(page.getByRole('heading', { name: 'Anna ist dran' })).toBeFocused();
  await expect(page.getByRole('timer')).toHaveText('2:00 übrig');
  await page.getByRole('button', { name: 'Würfeln' }).click();
  const face = Number(await page.locator('.die-face').textContent());
  expect(face).toBeGreaterThanOrEqual(1);
  expect(face).toBeLessThanOrEqual(6);
  const rule = face === 6 ? 'Nimm eins aus der Mitte' : (await page.locator('.die-rule').textContent())!;
  await expect(page.locator('.die-rule')).toHaveText(rule);
  await expect(page.getByText('Ein Schluck Punsch', { exact: true })).toHaveCount(face === 1 ? 1 : 0);
  await page.getByRole('button', { name: 'Weiter zu Bernd' }).click();

  await expect(page.getByRole('heading', { name: 'Bernd ist dran' })).toBeVisible();
  await page.getByRole('button', { name: 'Richtung umkehren' }).click();
  await expect(page.getByText('Es geht gegen den Uhrzeigersinn weiter.')).toBeVisible();
  await page.getByRole('button', { name: 'Würfeln' }).click();
  await expect(page.getByRole('button', { name: 'Weiter zu Anna' })).toBeVisible();

  // Pause keeps the time; after a reload the game goes on.
  await page.clock.runFor(30_000);
  await page.getByRole('button', { name: 'Pause' }).click();
  // The clock also runs on in real time while the test clicks, so allow a few seconds.
  await expect(page.getByRole('timer')).toHaveText(/^Pause, 1:[23]\d übrig$/);
  const paused = await page.getByRole('timer').textContent();
  await page.clock.runFor(60_000);
  await page.reload();
  await page.getByRole('button', { name: 'Weiterspielen' }).click();
  await expect(page.getByRole('timer')).toHaveText(paused!);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.clock.runFor(91_000);
  await expect(page.getByRole('heading', { name: 'Die Zeit ist um' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Würfeln' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Spiel beenden' }).click();
  await expect(page.getByText('Das Spiel ist beendet und gelöscht.')).toBeVisible();
});

test('the screen stays on while the timer runs, also after coming back to the tab', async ({ page }) => {
  // A stand-in wake lock that counts requests and can be released like the browser does when a tab is hidden.
  await page.addInitScript(() => {
    const w = window as unknown as { locks: EventTarget[] };
    w.locks = [];
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: async () => {
          const lock = new EventTarget() as EventTarget & { release: () => Promise<void> };
          lock.release = async () => void lock.dispatchEvent(new Event('release'));
          w.locks.push(lock);
          return lock;
        },
      },
    });
  });
  await page.goto('./?spiel=wuerfelwichteln');
  await page.getByLabel('Namen, einer pro Zeile').fill('Anna\nBernd');
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { locks: unknown[] }).locks.length)).toBe(1);
  // The browser drops the lock; on return to the tab the game asks again.
  await page.evaluate(() => {
    const w = window as unknown as { locks: (EventTarget & { release: () => Promise<void> })[] };
    void w.locks[0]!.release();
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { locks: unknown[] }).locks.length)).toBe(2);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('timer')).toHaveText(/^Pause/);
});
