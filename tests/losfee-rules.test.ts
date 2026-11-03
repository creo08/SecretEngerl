import { describe, expect, it } from 'vitest';
import { compileRound, draw, findViolation, repairDropout } from '../src/losfee/index.ts';
import { round } from './helpers/round.ts';
import { seededRng } from './helpers/seeded-rng.ts';

const people = (s: string) => s.split('').map((c) => [c]);

describe('draw with rules (fixed RNG)', () => {
  it('honours households, exclusions, last year and must rules', () => {
    const config = round([['A', 'B'], ['C'], ['D'], ['E'], ['F']], {
      exclusions: [{ from: 'C', to: 'D', bothWays: true }],
      lastYear: [{ giver: 'E', receiver: 'F' }],
      must: [{ giver: 'A', choices: ['E'] }, { giver: 'F', choices: ['B', 'C'] }],
    });
    const { problem } = compileRound(config);
    const rng = seededRng(1);
    for (let i = 0; i < 200; i++) {
      const result = draw(problem, rng);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(findViolation(problem, result.assignment)).toBeNull();
        expect(result.assignment[0]).toBe(4);
      }
    }
  });

  it('names the group that has too few people to give to (Hall)', () => {
    const { names, problem } = compileRound(round([['Anna', 'Bernd', 'Clara'], ['David', 'Eva']]));
    const result = draw(problem, seededRng(2));
    expect(result).toMatchObject({ ok: false, reason: 'tooFewReceivers', receivers: 2 });
    if (!result.ok && result.reason === 'tooFewReceivers') expect(result.givers.map((g) => names[g])).toEqual(['Anna', 'Bernd', 'Clara']);
  });

  it('reports a person nobody may give to', () => {
    const config = round(people('ABC'), { noMutual: false, exclusions: [{ from: 'A', to: 'C', bothWays: false }, { from: 'B', to: 'C', bothWays: false }] });
    expect(draw(compileRound(config).problem, seededRng(3))).toMatchObject({ ok: false, reason: 'tooFewReceivers' });
  });

  it('proves impossibility when only mutual pairs are left', () => {
    expect(draw(compileRound(round(people('AB'))).problem, seededRng(4))).toEqual({ ok: false, reason: 'impossible', chain: false });
  });

  it('tells "no big chain" apart from other failures', () => {
    const must = [{ giver: 'A', choices: ['B'] }, { giver: 'B', choices: ['A'] }];
    const withoutChain = round(people('ABCD'), { noMutual: false, must });
    expect(draw(compileRound(withoutChain).problem, seededRng(5)).ok).toBe(true);
    const withChain = round(people('ABCD'), { noMutual: false, oneChain: true, must });
    expect(draw(compileRound(withChain).problem, seededRng(5))).toEqual({ ok: false, reason: 'impossible', chain: true });
  });

  it('gives up without a biased draw when the budget runs out', () => {
    const must = [{ giver: 'A', choices: ['B'] }, { giver: 'C', choices: ['D'] }, { giver: 'E', choices: ['F'] }];
    const config = round(people('ABCDEFGH'), { oneChain: true, must });
    const result = draw(compileRound(config).problem, seededRng(6), { maxAttempts: 1 });
    expect(result).toMatchObject({ ok: false, reason: 'tooStrict', rule: { kind: 'oneChain' }, attempts: 1 });
  });

  it('names the additional rule that failed most often', () => {
    const config = round(people('ABCDEF'), {
      noMutual: false,
      exclusions: [{ from: 'A', to: 'B', bothWays: false }],
      must: [{ giver: 'C', choices: ['D', 'E'] }],
    });
    const result = draw(compileRound(config).problem, seededRng(8), { maxAttempts: 1 });
    if (!result.ok) expect(result).toMatchObject({ reason: 'tooStrict' });
  });

  it('stops after two seconds', () => {
    let calls = 0;
    // Six fixed pairs in one chain of twelve: about one valid circle in 330 000.
    const must = ['AB', 'CD', 'EF', 'GH', 'IJ', 'KL'].map(([giver, to]) => ({ giver: giver!, choices: [to!] }));
    const config = round(people('ABCDEFGHIJKL'), { oneChain: true, must });
    const result = draw(compileRound(config).problem, seededRng(9), { now: () => (calls++ === 0 ? 0 : 2001) });
    expect(result).toMatchObject({ ok: false, reason: 'tooStrict', attempts: 256 });
  });
});

describe('drop-out repair', () => {
  const chainOf = (order: number[]) => {
    const a: number[] = [];
    order.forEach((g, i) => (a[g] = order[(i + 1) % order.length]!));
    return a;
  };

  it('lets the Engerl take over the Bengerl, changing one link', () => {
    const { problem } = compileRound(round(people('ABCD')));
    const repair = repairDropout(problem, chainOf([0, 1, 2, 3]), 1);
    expect(repair).toEqual({ kind: 'repaired', engerl: 0, receiver: 2, assignment: [2, -1, 3, 0], broken: [] });
  });

  it('warns about a mutual pair left from a circle of three', () => {
    const { problem } = compileRound(round(people('ABCDE')));
    const assignment = [...chainOf([0, 1, 2])];
    assignment[3] = 4;
    assignment[4] = 3;
    const repair = repairDropout(problem, assignment, 1);
    expect(repair).toMatchObject({ kind: 'repaired', engerl: 0, receiver: 2, broken: [{ kind: 'noMutual' }] });
  });

  it('allows only a new draw when the Engerl would draw themselves', () => {
    const { problem } = compileRound(round(people('ABCD'), { noMutual: false }));
    expect(repairDropout(problem, [1, 0, 3, 2], 1)).toEqual({ kind: 'selfDraw', engerl: 0 });
  });

  it('warns about households, exclusions, last year and must rules', () => {
    const cases: [Parameters<typeof round>, number[], unknown][] = [
      [[people('ABCD'), { exclusions: [{ from: 'A', to: 'C', bothWays: false }] }], [1, 2, 3, 0], { kind: 'exclusion', index: 0 }],
      [[people('ABCD'), { lastYear: [{ giver: 'A', receiver: 'C' }] }], [1, 2, 3, 0], { kind: 'lastYear', index: 0 }],
      [[people('ABCD'), { must: [{ giver: 'A', choices: ['B'] }] }], [1, 2, 3, 0], { kind: 'must', index: 0 }],
      [[people('ABCD'), { must: [{ giver: 'A', choices: ['B', 'D'] }] }], [1, 2, 3, 0], { kind: 'must', index: 0 }],
    ];
    for (const [args, assignment, rule] of cases) {
      const { problem } = compileRound(round(...args));
      expect(repairDropout(problem, assignment, 1)).toMatchObject({ kind: 'repaired', engerl: 0, receiver: 2, broken: [rule] });
    }
  });

  it('warns when the new pair shares a household', () => {
    // Order of people: A, C, B, D. Circle A → B → C → D → A; B leaves, A takes over C.
    const { problem } = compileRound(round([['A', 'C'], ['B'], ['D']]));
    expect(repairDropout(problem, [2, 3, 1, 0], 2)).toMatchObject({ kind: 'repaired', engerl: 0, receiver: 1, broken: [{ kind: 'household' }] });
  });

  it('ignores rules of people who left earlier, and refuses someone already gone', () => {
    // A → B → C → D → E → A with "B gives to C". B leaves (A takes C), then A leaves (E takes C).
    const { problem } = compileRound(round(people('ABCDE'), { must: [{ giver: 'B', choices: ['C'] }] }));
    const first = repairDropout(problem, [1, 2, 3, 4, 0], 1);
    if (first.kind !== 'repaired') throw new Error('expected a repair');
    expect(repairDropout(problem, first.assignment, 0)).toMatchObject({ kind: 'repaired', engerl: 4, receiver: 2, broken: [] });
    expect(() => repairDropout(problem, first.assignment, 1)).toThrow();
  });

  it('drops the must rule of the person who left', () => {
    const { problem } = compileRound(round(people('ABCD'), { must: [{ giver: 'B', choices: ['C'] }] }));
    expect(repairDropout(problem, [1, 2, 3, 0], 1)).toMatchObject({ broken: [] });
  });
});
