/** 200 random rounds of 50 people draw in under 200 ms on average and under 2 s each. */
import { describe, expect, it } from 'vitest';
import { compileRound, draw } from '../src/losfee/index.ts';
import { createCryptoRng } from '../src/random/rng.ts';
import { randomRound } from './helpers/random-round.ts';
import { seededRng } from './helpers/seeded-rng.ts';

describe('performance', () => {
  it('draws 200 rounds of 50 people quickly', { timeout: 120_000 }, () => {
    const generator = seededRng(50);
    const rng = createCryptoRng();
    const times: number[] = [];
    for (let i = 0; i < 200; i++) {
      const config = randomRound(generator, {
        people: 50,
        maxHousehold: 6,
        maxExclusionsPerPerson: 3,
        lastYear: true,
        noMutual: true,
        oneChain: i % 4 === 0,
      });
      const { problem } = compileRound(config);
      const start = performance.now();
      const result = draw(problem, rng);
      times.push(performance.now() - start);
      expect(result.ok, `round ${i}: ${JSON.stringify(result)}`).toBe(true);
    }
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    expect(mean).toBeLessThan(200);
    expect(Math.max(...times)).toBeLessThan(2000);
  });
});
