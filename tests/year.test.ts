import { describe, expect, it } from 'vitest';
import { openFile, sealFile } from '../src/files/envelope.ts';
import { validateYear, yearFileName, yearFromRound } from '../src/files/year.ts';
import { compileRound } from '../src/losfee/index.ts';
import { purgeExpired, saveDraw } from '../src/store/rounds.ts';
import { memoryStore } from './helpers/memory-store.ts';
import { round as makeConfig } from './helpers/round.ts';

const BASE = 'https://creo08.github.io/SecretEngerl/';

async function storedRound() {
  const store = memoryStore();
  const config = makeConfig([['Anna', 'Bernd'], ['Clara'], ['David']]);
  config.gifts.hints = { Clara: 'keine Nüsse' };
  const { names } = compileRound(config);
  const round = await saveDraw(store, { config, names, assignment: [2, 3, 1, 0], base: BASE, title: 'Familie Huber' });
  return { store, round };
}

describe("last year's round", () => {
  it('keeps names, groups, pairings, budget and hints', async () => {
    const { round } = await storedRound();
    const year = await yearFromRound(round);
    expect(year).toEqual({
      year: 2026,
      template: 'engerl-bengerl',
      title: 'Familie Huber',
      households: [['Anna', 'Bernd'], ['Clara'], ['David']],
      pairings: [
        { giver: 'Anna', receiver: 'Clara' },
        { giver: 'Bernd', receiver: 'David' },
        { giver: 'Clara', receiver: 'Bernd' },
        { giver: 'David', receiver: 'Anna' },
      ],
      budget: 20,
      hints: { Clara: 'keine Nüsse' },
    });
    expect(yearFileName(year.year)).toBe('engerl-2026.wichtel');
  });

  it('survives a round trip through an encrypted yearly file', async () => {
    const year = await yearFromRound((await storedRound()).round);
    const text = await sealFile('secretengerl-year', { ...year }, 'pw', 100_000);
    const opened = await openFile(text, 'pw');
    expect(opened.status).toBe('ok');
    if (opened.status === 'ok') expect(validateYear(opened.content)).toEqual({ ok: true, value: year });
  });

  it('rejects pairings with unknown names and other broken data', () => {
    const base = { year: 2026, template: 'engerl-bengerl', households: [['Anna'], ['Bernd']], pairings: [], budget: null, hints: {} };
    expect(validateYear(base).ok).toBe(true);
    expect(validateYear({ ...base, pairings: [{ giver: 'Anna', receiver: 'Zoe' }] }).ok).toBe(false);
    expect(validateYear({ ...base, template: 'pyramid' }).ok).toBe(false);
    expect(validateYear({ ...base, year: 1 }).ok).toBe(false);
    expect(validateYear({ ...base, budget: '1e9' }).ok).toBe(false);
    expect(validateYear(null).ok).toBe(false);
  });

  it('is remembered when the round deletes itself', async () => {
    const { store, round } = await storedRound();
    const kept: unknown[] = [];
    await purgeExpired(store, round.expiresAt * 1000 + 1, async (r) => void kept.push(await yearFromRound(r)));
    expect(store.rounds.size).toBe(0);
    expect(kept).toHaveLength(1);
  });

  it('still deletes an expired round if remembering fails', async () => {
    const { store, round } = await storedRound();
    await purgeExpired(store, round.expiresAt * 1000 + 1, async () => Promise.reject(new Error('full')));
    expect(store.rounds.size).toBe(0);
  });
});
