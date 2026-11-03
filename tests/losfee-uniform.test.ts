/**
 * Exact uniformity: for small rounds, all valid draws are counted by brute force,
 * the engine draws at least 50 times as often with real randomness, and a
 * chi-squared test at the 0.001 level must not reject equal probabilities.
 */
import { describe, expect, it } from 'vitest';
import type { RoundConfig } from '../src/config/types.ts';
import { compileRound, draw } from '../src/losfee/index.ts';
import { createCryptoRng } from '../src/random/rng.ts';
import { round } from './helpers/round.ts';
import { validAssignments } from './helpers/reference.ts';
import { chiSquared, chiSquaredPValue } from './helpers/stats.ts';

const single = (s: string) => s.split('').map((c) => [c]);

const cases: [string, RoundConfig][] = [
  ['4 people, must rule, no mutual pairs', round(single('ABCD'), { must: [{ giver: 'A', choices: ['B'] }] })],
  ['5 people, one couple, no mutual pairs', round([['A', 'B'], ...single('CDE')])],
  ['6 people, two couples, exclusions, mutual allowed', round([['A', 'B'], ['C', 'D'], ...single('EF')], {
    noMutual: false,
    exclusions: [{ from: 'A', to: 'C', bothWays: false }, { from: 'E', to: 'F', bothWays: true }],
  })],
  ['7 people, household of three, last year, must with choice', round([['A', 'B', 'C'], ...single('DEFG')], {
    lastYear: [{ giver: 'D', receiver: 'E' }],
    must: [{ giver: 'A', choices: ['D', 'E', 'F'] }],
  })],
  ['6 people, one big chain, exclusion', round([['A', 'B'], ...single('CDEF')], {
    oneChain: true,
    exclusions: [{ from: 'C', to: 'D', bothWays: false }],
  })],
  ['7 people, one big chain, two couples, fixed must rule', round([['A', 'B'], ['C', 'D'], ...single('EFG')], {
    oneChain: true,
    must: [{ giver: 'E', choices: ['A'] }],
  })],
];

describe('uniform draw', () => {
  for (const [name, config] of cases) {
    it(name, { timeout: 60_000 }, () => {
      const solutions = validAssignments(config);
      expect(solutions.length).toBeGreaterThan(1);
      const index = new Map(solutions.map((s, i) => [s, i]));
      const counts = new Array<number>(solutions.length).fill(0);
      const { problem } = compileRound(config);
      const rng = createCryptoRng();
      const samples = Math.max(50 * solutions.length, 5000);
      for (let i = 0; i < samples; i++) {
        const result = draw(problem, rng);
        if (!result.ok) throw new Error(`draw failed: ${result.reason}`);
        const at = index.get(result.assignment.join(','));
        if (at === undefined) throw new Error(`invalid draw ${result.assignment}`);
        counts[at]!++;
      }
      const expected = new Array<number>(solutions.length).fill(samples / solutions.length);
      const p = chiSquaredPValue(chiSquared(counts, expected), solutions.length - 1);
      expect(p, `${solutions.length} solutions, p = ${p}`).toBeGreaterThan(0.001);
    });
  }
});
