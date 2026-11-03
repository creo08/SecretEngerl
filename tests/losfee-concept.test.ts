/** Figures from the concept for 10 people with three couples and four single people. */
import { describe, expect, it } from 'vitest';
import { compileRound, draw, searchAssignments } from '../src/losfee/index.ts';
import { createCryptoRng } from '../src/random/rng.ts';
import { CONCEPT_EXAMPLE, round } from './helpers/round.ts';
import { forEachPermutation, referenceChecker } from './helpers/reference.ts';
import { chiSquared, chiSquaredPValue } from './helpers/stats.ts';

describe('example of the concept, by enumerating all 3 628 800 permutations', () => {
  const householdsOnly = referenceChecker(round(CONCEPT_EXAMPLE, { noMutual: false }));
  let valid = 0;
  let noMutual = 0;
  let chains = 0;
  const annaGivesTo = new Array<number>(10).fill(0);
  forEachPermutation(10, (p) => {
    if (!householdsOnly(p)) return;
    valid++;
    if (p.some((r, g) => p[r] === g)) return;
    noMutual++;
    annaGivesTo[p[0]!]!++;
    let length = 1;
    for (let x = p[0]!; x !== 0; x = p[x]!) length++;
    if (length === 10) chains++;
  });

  it('has 672 240 valid draws with households only', () => expect(valid).toBe(672_240));
  it('has 392 160 with "no mutual pairs"', () => expect(noMutual).toBe(392_160));
  it('has 175 680 single big chains', () => expect(chains).toBe(175_680));

  it('documents that Anna draws couple members more often than single people', () => {
    const share = annaGivesTo.map((c) => Math.round((c / noMutual) * 1000) / 10);
    expect(share).toEqual([0, 0, 13.4, 13.4, 13.4, 13.4, 11.6, 11.6, 11.6, 11.6]);
  });

  it('counts the draws by search as the easter egg does', () => {
    const { problem } = compileRound(round(CONCEPT_EXAMPLE));
    expect(searchAssignments(problem, { countAll: true, nodeLimit: 1e8 })).toEqual({ status: 'found', count: 392_160 });
  });

  it("hits Anna's expected shares in 200 000 draws", { timeout: 120_000 }, () => {
    const { problem } = compileRound(round(CONCEPT_EXAMPLE));
    const rng = createCryptoRng();
    const observed = new Array<number>(10).fill(0);
    const samples = 200_000;
    for (let i = 0; i < samples; i++) {
      const result = draw(problem, rng);
      if (!result.ok) throw new Error(result.reason);
      observed[result.assignment[0]!]!++;
    }
    const cells = [2, 3, 4, 5, 6, 7, 8, 9];
    const expected = cells.map((r) => (annaGivesTo[r]! / noMutual) * samples);
    expect(observed[0]! + observed[1]!).toBe(0);
    const p = chiSquaredPValue(chiSquared(cells.map((r) => observed[r]!), expected), cells.length - 1);
    expect(p).toBeGreaterThan(0.001);
  });
});
