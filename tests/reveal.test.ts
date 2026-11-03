import { describe, expect, it } from 'vitest';
import { revealOrder } from '../src/losfee/reveal.ts';
import { seededRng } from './helpers/seeded-rng.ts';

describe('stage reveal order', () => {
  it('follows each circle and shows every pair once', () => {
    // Two circles: A → B → C → A and D → E → D.
    const assignment = new Map([['A', 'B'], ['B', 'C'], ['C', 'A'], ['D', 'E'], ['E', 'D']]);
    for (let seed = 1; seed <= 20; seed++) {
      const order = revealOrder(assignment, seededRng(seed));
      expect(order).toHaveLength(5);
      expect(new Set(order.map(([g]) => g)).size).toBe(5);
      for (const [g, r] of order) expect(assignment.get(g)).toBe(r);
      // Within a circle, the next giver is the last receiver.
      for (let i = 1; i < order.length; i++) {
        const sameCircle = ['A', 'B', 'C'].includes(order[i]![0]) === ['A', 'B', 'C'].includes(order[i - 1]![0]);
        if (sameCircle) expect(order[i]![0]).toBe(order[i - 1]![1]);
      }
    }
  });
});
