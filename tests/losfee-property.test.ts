/**
 * 1 000 random configurations up to 8 people: every draw keeps every rule, and
 * the engine says "solvable" exactly when brute force finds a valid draw.
 */
import { describe, expect, it } from 'vitest';
import type { RoundConfig } from '../src/config/types.ts';
import { compileRound, draw } from '../src/losfee/index.ts';
import { randInt, type Rng } from '../src/random/rng.ts';
import { round } from './helpers/round.ts';
import { forEachPermutation, referenceChecker } from './helpers/reference.ts';
import { seededRng } from './helpers/seeded-rng.ts';

function randomConfig(rng: Rng): RoundConfig {
  const n = 2 + randInt(rng, 7);
  const names = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
  const households: string[][] = [];
  for (let i = 0; i < n; ) {
    const size = Math.min(1 + randInt(rng, 3), n - i);
    households.push(names.slice(i, i + size));
    i += size;
  }
  const pick = () => names[randInt(rng, n)]!;
  const exclusions = Array.from({ length: randInt(rng, n) }, () => ({ from: pick(), to: pick(), bothWays: randInt(rng, 2) === 0 }));
  const lastYear = Array.from({ length: randInt(rng, 3) }, () => ({ giver: pick(), receiver: pick() }));
  const givers = new Set<string>();
  const must = Array.from({ length: randInt(rng, 3) }, () => ({ giver: pick(), choices: [...new Set([pick(), ...(randInt(rng, 2) ? [pick()] : [])])] }))
    .filter((m) => !givers.has(m.giver) && givers.add(m.giver));
  return round(households, { exclusions, lastYear, must, noMutual: randInt(rng, 3) > 0, oneChain: randInt(rng, 4) === 0 });
}

describe('property: random configurations up to 8 people', () => {
  it('draws only valid assignments and agrees with brute force on solvability', { timeout: 120_000 }, () => {
    const rng = seededRng(2026);
    let solvable = 0;
    for (let i = 0; i < 1000; i++) {
      const config = randomConfig(rng);
      const valid = referenceChecker(config);
      let exists = false;
      forEachPermutation(config.participants.households.flat().length, (p) => {
        exists ||= valid(p);
      });
      const result = draw(compileRound(config).problem, rng);
      const context = JSON.stringify({ i, households: config.participants.households, rules: config.rules, structure: config.structure, result });
      expect(result.ok, context).toBe(exists);
      if (result.ok) {
        solvable++;
        expect(valid(result.assignment), context).toBe(true);
      } else {
        expect(['tooFewReceivers', 'impossible'], context).toContain(result.reason);
      }
    }
    // Both outcomes must be well represented for the test to mean something.
    expect(solvable).toBeGreaterThan(200);
    expect(solvable).toBeLessThan(900);
  });
});
