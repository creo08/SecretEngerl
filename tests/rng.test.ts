import { describe, expect, it } from 'vitest';
import { createCryptoRng, randBigInt, randInt, type Rng } from '../src/random/rng.ts';
import { chiSquared, chiSquaredPValue } from './helpers/stats.ts';

/** Replays a fixed list of words. */
function replay(words: number[]): Rng {
  let i = 0;
  return { nextUint32: () => words[i++]! };
}

describe('random numbers', () => {
  it('rejects values above the last full multiple instead of using a biased modulo', () => {
    // n = 3: limit = 4294967295 - (2^32 mod 3) ... the top value 2^32-1 must be rejected.
    expect(randInt(replay([0xffffffff, 4]), 3)).toBe(1);
  });

  it('draws BigInts beyond 2^32 with rejection', () => {
    const n = (1n << 40n) + 1n;
    // Two words give 64 bits; the first draw is above the limit and rejected.
    const r = randBigInt(replay([0xffffffff, 0xffffffff, 0, 7]), n);
    expect(r).toBe(7n);
    expect(randBigInt(createCryptoRng(), 3n * 10n ** 64n) < 3n * 10n ** 64n).toBe(true);
  });

  it('is uniform for small ranges', () => {
    const rng = createCryptoRng();
    const counts = new Array(7).fill(0);
    for (let i = 0; i < 70_000; i++) counts[randInt(rng, 7)]++;
    expect(chiSquaredPValue(chiSquared(counts, new Array(7).fill(10_000)), 6)).toBeGreaterThan(0.001);
  });

  it('computes chi-squared p-values', () => {
    expect(chiSquaredPValue(3.841, 1)).toBeCloseTo(0.05, 3);
    expect(chiSquaredPValue(124.342, 100)).toBeCloseTo(0.05, 3);
  });
});
