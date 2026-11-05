import { describe, expect, it } from 'vitest';
import { canSteal, finalSwap, isRaeuberState, parseLabel, startRaeuber, steal, unwrap, wrappedCount, type RaeuberState } from '../src/games/raeuber.ts';
import { randInt } from '../src/random/rng.ts';
import { seededRng } from './helpers/seeded-rng.ts';

const setup = (players: string[], extra: Partial<{ random: boolean; lockAfter: number; finalSwap: boolean }> = {}) =>
  startRaeuber({ players, random: false, lockAfter: 3, finalSwap: false, ...extra }, seededRng(1), 0);

describe('Räuberwichteln', () => {
  it('plays a short game: steal, the robbed player goes next and may not steal back', () => {
    let s = setup(['Anna', 'Bernd', 'Clara']);
    s = unwrap(s, 'Socken'); // Anna unwraps 1
    expect(s.current).toBe(1);
    s = steal(s, 1); // Bernd steals 1 from Anna
    expect(s.current).toBe(0);
    expect(s.blocked).toBe(1);
    expect(steal(s, 1)).toBe(s); // Anna may not take it back
    s = unwrap(s, ''); // Anna unwraps 2, Clara's turn
    expect(s.current).toBe(2);
    expect(s.blocked).toBeNull();
    s = unwrap(s, 'Tasse');
    expect(s.phase).toBe('done');
    expect(s.gifts.map((g) => [g.number, g.holder])).toEqual([[1, 1], [2, 0], [3, 2]]);
  });

  it('locks a gift after the set number of steals', () => {
    let s = setup(['Anna', 'Bernd', 'Clara', 'David'], { lockAfter: 1 });
    s = unwrap(s, '');
    s = steal(s, 1);
    expect(s.gifts[0]!.steals).toBe(1);
    expect(canSteal(s, s.gifts[0]!)).toBe(false);
  });

  it('offers the first player one last swap if chosen', () => {
    let s = setup(['Anna', 'Bernd'], { finalSwap: true });
    s = unwrap(unwrap(s, 'A'), 'B');
    expect(s.phase).toBe('finalSwap');
    expect(s.current).toBe(0);
    const swapped = finalSwap(s, 2);
    expect(swapped.phase).toBe('done');
    expect(swapped.gifts.map((g) => g.holder)).toEqual([1, 0]);
    expect(finalSwap(s, null).gifts).toEqual(s.gifts);
  });

  it('always ends with exactly one gift per person, whatever is played', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = seededRng(seed);
      const n = 2 + randInt(rng, 12);
      let s: RaeuberState = startRaeuber({ players: Array.from({ length: n }, (_, i) => `P${i}`), random: true, lockAfter: 1 + randInt(rng, 3), finalSwap: randInt(rng, 2) === 1 }, rng, 0);
      for (let step = 0; s.phase === 'play' && step < 10_000; step++) {
        const options = s.gifts.filter((g) => canSteal(s, g));
        const before = s;
        s = options.length && randInt(rng, 2) ? steal(s, options[randInt(rng, options.length)]!.number) : unwrap(s, '');
        expect(s).not.toBe(before);
        expect(isRaeuberState(s)).toBe(true);
      }
      if (s.phase === 'finalSwap') s = finalSwap(s, null);
      expect(s.phase).toBe('done');
      expect(wrappedCount(s)).toBe(0);
      expect(new Set(s.gifts.map((g) => g.holder)).size).toBe(n);
      expect(s.gifts.every((g) => g.steals <= s.lockAfter)).toBe(true);
    }
  });

  it('shuffles the turn order only when asked', () => {
    const names = ['Anna', 'Bernd', 'Clara', 'David', 'Eva'];
    expect(setup(names).players).toEqual(names);
    const orders = new Set(Array.from({ length: 50 }, (_, i) => startRaeuber({ players: names, random: true, lockAfter: 3, finalSwap: false }, seededRng(i), 0).players.join()));
    expect(orders.size).toBeGreaterThan(10);
  });

  it('checks stored games and gift words like any other input', () => {
    const s = unwrap(setup(['Anna', 'Bernd']), 'Socken');
    expect(isRaeuberState(JSON.parse(JSON.stringify(s)))).toBe(true);
    expect(isRaeuberState({ ...s, players: ['Anna'] })).toBe(false);
    expect(isRaeuberState({ ...s, gifts: [{ ...s.gifts[0]!, holder: 7 }] })).toBe(false);
    expect(isRaeuberState({ ...s, lockAfter: 0 })).toBe(false);
    expect(isRaeuberState(null)).toBe(false);
    expect(parseLabel(' Socken‮ ')).toBe('Socken');
    expect(parseLabel('x'.repeat(31))).toBeNull();
  });
});
