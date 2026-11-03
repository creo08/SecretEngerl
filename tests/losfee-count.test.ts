import { describe, expect, it } from 'vitest';
import { countHouseholdAssignments, HouseholdSampler } from '../src/losfee/households.ts';
import { forEachPermutation } from './helpers/reference.ts';
import { seededRng } from './helpers/seeded-rng.ts';
import { randInt } from '../src/random/rng.ts';

/** Household id per person for the given household sizes. */
function households(sizes: number[]): number[] {
  return sizes.flatMap((s, h) => new Array(s).fill(h));
}

function bruteForce(household: number[]): number {
  let count = 0;
  forEachPermutation(household.length, (p) => {
    if (p.every((r, g) => household[g] !== household[r])) count++;
  });
  return count;
}

describe('household count', () => {
  it('gives 672 240 for the example of the concept', () => {
    expect(countHouseholdAssignments(households([2, 2, 2, 1, 1, 1, 1]))).toBe(672_240n);
  });

  it('matches brute force for random households up to 10 people', () => {
    const rng = seededRng(7);
    for (let n = 1; n <= 10; n++) {
      for (let trial = 0; trial < (n < 10 ? 6 : 2); trial++) {
        const sizes: number[] = [];
        for (let left = n; left > 0; ) {
          const s = 1 + randInt(rng, Math.min(left, 4));
          sizes.push(s);
          left -= s;
        }
        const h = households(sizes);
        expect(countHouseholdAssignments(h), `sizes ${sizes}`).toBe(BigInt(bruteForce(h)));
      }
    }
  });

  it('counts rectangles that are not square, as left after fixed must rules', () => {
    // Households [A,B,C], [D,E], [F]; A gives to D fixed, so givers B..F and receivers A,B,C,E,F remain.
    const h = households([3, 2, 1]);
    const givers = [1, 2, 3, 4, 5];
    const receivers = [0, 1, 2, 4, 5];
    let expected = 0;
    forEachPermutation(5, (p) => {
      if (givers.every((g, i) => h[g] !== h[receivers[p[i]!]!])) expected++;
    });
    expect(new HouseholdSampler(h, givers, receivers).total()).toBe(BigInt(expected));
  });
});
