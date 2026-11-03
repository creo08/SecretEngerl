import { describe, expect, it } from 'vitest';
import { withoutPerson } from '../src/config/edit.ts';
import { readFragment } from '../src/link/link.ts';
import { compileRound } from '../src/losfee/index.ts';
import { isStoredRound } from '../src/store/db.ts';
import { checkPin, isPeekPhrase, setPin, viewAssignment } from '../src/store/emergency.ts';
import { DrawTooLongError, markSent, planDropout, purgeExpired, readAssignment, saveDraw } from '../src/store/rounds.ts';
import { freeHintBytes } from '../src/link/payload.ts';
import { memoryStore } from './helpers/memory-store.ts';
import { round as makeConfig } from './helpers/round.ts';

const BASE = 'https://creo08.github.io/SecretEngerl/';
const people = (s: string) => s.split('').map((c) => [c]);

async function stored(households: string[][], assignment: number[], options: Parameters<typeof makeConfig>[1] = {}) {
  const store = memoryStore();
  const config = makeConfig(households, options);
  const { names } = compileRound(config);
  const round = await saveDraw(store, { config, names, assignment, base: BASE });
  return { store, round, names };
}

describe('stored round', () => {
  it('keeps one link per giver and no plain-text assignment', async () => {
    const { store, round } = await stored(people('ABCD'), [1, 2, 3, 0]);
    expect(round.drawNumber).toBe(1);
    expect(round.expiresAt).toBe(1799020799);
    expect(round.links.map((l) => l.name)).toEqual(['A', 'B', 'C', 'D']);
    const json = JSON.stringify(store.rounds.get(round.id));
    expect(json).not.toMatch(/"r":/);
    expect([...(await readAssignment(round))]).toEqual([['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A']]);
    expect(isStoredRound(store.rounds.get(round.id), BASE)).toBe(true);
    const foreign = structuredClone(store.rounds.get(round.id)!);
    foreign.links[0]!.link = foreign.links[0]!.link.replace(BASE, 'https://evil.example/');
    expect(isStoredRound(foreign, BASE)).toBe(false);
  });

  it('counts up the draw number on a new draw and keeps the log', async () => {
    const { store, round, names } = await stored(people('ABCD'), [1, 2, 3, 0]);
    await viewAssignment(store, round.id, 'A', 1);
    const again = await saveDraw(store, { config: round.config, names, assignment: [2, 3, 0, 1], base: BASE, previousId: round.id });
    expect(again.id).toBe(round.id);
    expect(again.drawNumber).toBe(2);
    expect(again.views).toEqual([{ name: 'A', at: 1 }]);
    const first = await readFragment(again.links[0]!.link.slice(again.links[0]!.link.indexOf('#')), 0);
    expect(first).toMatchObject({ status: 'ok', payload: { n: 2, r: 'C' } });
  });

  it('never lets one change wipe another, such as a logged view', async () => {
    const { store, round } = await stored(people('ABC'), [1, 2, 0]);
    await viewAssignment(store, round.id, 'A', 5);
    await markSent(store, round.id, 'B');
    await setPin(store, round.id, '1', 1000);
    const latest = (await store.get(round.id))!;
    expect(latest.views).toEqual([{ name: 'A', at: 5 }]);
    expect(latest.links[1]!.sent).toBe(true);
    expect(latest.pin).not.toBeNull();
  });

  it('refuses a drop-out repair when the round changed in between', async () => {
    const { store, round, names } = await stored(people('ABCDE'), [1, 2, 3, 4, 0]);
    const plan = await planDropout(store, round.id, 'B', BASE);
    await saveDraw(store, { config: round.config, names, assignment: [2, 3, 4, 0, 1], base: BASE, previousId: round.id });
    if (plan.kind === 'repair') await expect(plan.apply()).rejects.toThrow(/changed/);
  });

  it('refuses a new draw that no longer fits, and stores nothing', async () => {
    const { store, round, names } = await stored(people('ABC'), [1, 2, 0]);
    const config = structuredClone(round.config);
    config.gifts.hints = { B: 'x'.repeat(freeHintBytes(config, 'B', 1)) };
    // Fits for draw 1 to 9, but draw 10 has one more digit.
    const stored9 = { ...(await store.get(round.id))!, drawNumber: 9, config };
    await store.put(stored9);
    await expect(saveDraw(store, { config, names, assignment: [2, 0, 1], base: BASE, previousId: round.id })).rejects.toBeInstanceOf(DrawTooLongError);
    expect((await store.get(round.id))!.drawNumber).toBe(9);
  });

  it('marks a link as sent', async () => {
    const { store, round } = await stored(people('ABC'), [1, 2, 0]);
    const next = await markSent(store, round.id, 'B');
    expect(next.links.map((l) => l.sent)).toEqual([false, true, false]);
  });

  it('deletes rounds after their end', async () => {
    const { store, round } = await stored(people('ABC'), [1, 2, 0]);
    await purgeExpired(store, round.expiresAt * 1000);
    expect(store.rounds.size).toBe(1);
    await purgeExpired(store, round.expiresAt * 1000 + 1);
    expect(store.rounds.size).toBe(0);
  });

  it('rejects records that are not rounds', () => {
    expect(isStoredRound({ id: 'x' }, BASE)).toBe(false);
    expect(isStoredRound(null, BASE)).toBe(false);
  });
});

describe('drop-out on a stored round', () => {
  it('changes exactly one link and names only the Engerl', async () => {
    const { store, round } = await stored(people('ABCDE'), [1, 2, 3, 4, 0]);
    const plan = await planDropout(store, round.id, 'B', BASE);
    expect(plan).toMatchObject({ kind: 'repair', engerl: 'A', rulesBroken: false });
    if (plan.kind !== 'repair') return;
    expect(JSON.stringify(plan)).not.toContain('"C"');
    const next = await plan.apply();
    expect(next.links.map((l) => l.name)).toEqual(['A', 'C', 'D', 'E']);
    const changed = next.links.filter((l, i) => l.link !== round.links.filter((x) => x.name !== 'B')[i]!.link);
    expect(changed.map((l) => l.name)).toEqual(['A']);
    expect((await readAssignment(next)).get('A')).toBe('C');
    expect(next.config.participants.households.flat()).toEqual(['A', 'C', 'D', 'E']);
  });

  it('warns when the repair breaks a rule, and offers only a new draw for a self-draw', async () => {
    const three = await stored(people('ABCDE'), [1, 2, 0, 4, 3], { noMutual: false });
    expect(await planDropout(three.store, three.round.id, 'D', BASE)).toEqual({ kind: 'selfDraw', engerl: 'E' });
    const mutual = await stored(people('ABCDE'), [1, 2, 0, 4, 3], { noMutual: true });
    expect(await planDropout(mutual.store, mutual.round.id, 'B', BASE)).toMatchObject({ kind: 'repair', engerl: 'A', rulesBroken: true });
  });

  it('removes the person from households, rules and hints', () => {
    const config = makeConfig([['A', 'B'], ['C'], ['D']], {
      exclusions: [{ from: 'A', to: 'C', bothWays: true }],
      must: [{ giver: 'D', choices: ['A', 'C'] }, { giver: 'C', choices: ['A'] }],
      lastYear: [{ giver: 'B', receiver: 'A' }],
    });
    config.gifts.hints = { A: 'keine Nüsse', C: 'Bücher' };
    const next = withoutPerson(config, 'a');
    expect(next.participants.households).toEqual([['B'], ['C'], ['D']]);
    expect(next.rules).toEqual({ exclusions: [], must: [{ giver: 'D', choices: ['C'] }], lastYear: [] });
    expect(next.gifts.hints).toEqual({ C: 'Bücher' });
  });
});

describe('emergency view', () => {
  it('needs the phrase "Ich spicke"', () => {
    expect(isPeekPhrase('  ich SPICKE ')).toBe(true);
    expect(isPeekPhrase('ich schau')).toBe(false);
  });

  it('logs every view before showing one person', async () => {
    const { store, round } = await stored(people('ABC'), [1, 2, 0]);
    const { round: next, receiver } = await viewAssignment(store, round.id, 'B', 1234);
    expect(receiver).toBe('C');
    expect((await store.get(round.id))!.views).toEqual([{ name: 'B', at: 1234 }]);
    expect(next.views).toHaveLength(1);
    await expect(viewAssignment(store, round.id, 'Zoe', 1)).rejects.toThrow();
    expect((await store.get(round.id))!.views).toHaveLength(1);
  });

  it('checks an optional PIN', async () => {
    const { store, round } = await stored(people('ABC'), [1, 2, 0]);
    expect(await checkPin(round, 'anything')).toBe(true);
    const withPin = await setPin(store, round.id, '4711', 1000);
    expect(await checkPin(withPin, '4711')).toBe(true);
    expect(await checkPin(withPin, '4712')).toBe(false);
    expect(JSON.stringify(withPin.pin)).not.toContain('4711');
  });
});
