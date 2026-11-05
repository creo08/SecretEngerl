import { describe, expect, it } from 'vitest';
import { checkTime, isWuerfelState, nextPlayer, parseRule, passTurn, reverse, roll, startWuerfel, timeLeft, toggleTimer } from '../src/games/wuerfel.ts';
import { createCryptoRng } from '../src/random/rng.ts';
import { chiSquared, chiSquaredPValue } from './helpers/stats.ts';
import { seededRng } from './helpers/seeded-rng.ts';

const rules = ['Tausch mit irgendwem', 'Alle geben weiter', 'Tausch links', 'Tausch rechts', 'Zwei tauschen', 'Aus der Mitte nehmen'];
const start = (players = ['Anna', 'Bernd', 'Clara']) => startWuerfel({ players, random: false, rules, drink: null, minutes: 15, sound: true }, seededRng(1), 1000);

describe('Würfelwichteln', () => {
  it('rolls once per turn and passes on in the chosen direction', () => {
    let s = start();
    expect(passTurn(s)).toBe(s); // no passing before a roll
    s = roll(s, seededRng(2));
    expect(s.rolled).toBeGreaterThanOrEqual(1);
    expect(roll(s, seededRng(3))).toBe(s); // one roll per turn
    s = passTurn(s);
    expect([s.current, s.rolled]).toEqual([1, null]);
    s = reverse(s);
    expect(nextPlayer(s)).toBe(0);
    s = passTurn(roll(s, seededRng(4)));
    s = passTurn(roll(s, seededRng(5)));
    expect(s.current).toBe(2); // 1 → 0 → 2 counterclockwise
  });

  it('rolls every face equally often', () => {
    const rng = createCryptoRng();
    const counts = [0, 0, 0, 0, 0, 0];
    const s = start();
    for (let i = 0; i < 60_000; i++) counts[roll(s, rng).rolled! - 1]!++;
    expect(chiSquaredPValue(chiSquared(counts, counts.map(() => 10_000)), 5)).toBeGreaterThan(0.001);
  });

  it('runs, pauses and ends the timer', () => {
    let s = start();
    expect(timeLeft(s, 1000 + 60_000)).toBe(14 * 60_000);
    s = toggleTimer(s, 1000 + 60_000); // pause with 14 minutes left
    expect(timeLeft(s, 1000 + 10 * 60_000)).toBe(14 * 60_000);
    s = toggleTimer(s, 2_000_000); // resume
    expect(checkTime(s, 2_000_000 + 14 * 60_000 - 1).over).toBe(false);
    s = checkTime(s, 2_000_000 + 14 * 60_000);
    expect(s.over).toBe(true);
    expect(roll(s, seededRng(1))).toBe(s);
  });

  it('checks stored games and rule lines like any other input', () => {
    const s = roll(start(), seededRng(9));
    expect(isWuerfelState(JSON.parse(JSON.stringify(s)))).toBe(true);
    expect(isWuerfelState({ ...s, rules: rules.slice(0, 5) })).toBe(false);
    expect(isWuerfelState({ ...s, rolled: 7 })).toBe(false);
    expect(isWuerfelState({ ...s, current: 3 })).toBe(false);
    expect(isWuerfelState({ ...s, drink: { face: 1, text: '' } })).toBe(false);
    expect(isWuerfelState({ ...s, drink: { face: 1, text: 'Ein Schluck' } })).toBe(true);
    expect(isWuerfelState({ ...s, leftMs: -1 })).toBe(false);
    expect(parseRule('  Tausch‮ ')).toBe('Tausch');
    expect(parseRule('')).toBeNull();
    expect(parseRule('x'.repeat(81))).toBeNull();
  });
});
