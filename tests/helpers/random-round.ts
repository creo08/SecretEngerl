import type { RoundConfig } from '../../src/config/types.ts';
import { randInt, type Rng } from '../../src/random/rng.ts';
import { compileRound, draw } from '../../src/losfee/index.ts';

export interface RandomRoundOptions {
  people: number;
  maxHousehold: number;
  maxExclusionsPerPerson: number;
  lastYear: boolean;
  noMutual: boolean;
  oneChain: boolean;
}

/** A random round configuration like the ones in the acceptance criteria. */
export function randomRound(rng: Rng, o: RandomRoundOptions): RoundConfig {
  const names = Array.from({ length: o.people }, (_, i) => `P${i}`);
  const households: string[][] = [];
  for (let i = 0; i < names.length; ) {
    const size = Math.min(1 + randInt(rng, o.maxHousehold), names.length - i);
    households.push(names.slice(i, i + size));
    i += size;
  }
  const exclusions: RoundConfig['rules']['exclusions'] = [];
  for (const from of names) {
    const k = randInt(rng, o.maxExclusionsPerPerson + 1);
    for (let j = 0; j < k; j++) {
      const to = names[randInt(rng, names.length)]!;
      if (to !== from) exclusions.push({ from, to, bothWays: randInt(rng, 4) === 0 });
    }
  }
  const config: RoundConfig = {
    version: 1,
    template: 'familien-wichteln',
    family: 'drawn',
    occasion: { exchangeDate: '2026-12-20' },
    participants: { households },
    structure: { noMutual: o.noMutual, oneChain: o.oneChain, giftsPerPerson: 1 },
    rules: { exclusions, must: [], lastYear: [] },
    gifts: { budget: null, kind: 'bought', theme: '', hints: {} },
    exchange: 'in-person',
    communication: 'none',
    reveal: 'in-person',
    context: 'family',
    organizerPlays: true,
    place: '',
    addresses: {},
  };
  if (o.lastYear) {
    const previous = structuredClone(config);
    previous.rules.exclusions = [];
    previous.structure.oneChain = false;
    const { names: n, problem } = compileRound(previous);
    const result = draw(problem, rng);
    if (result.ok) config.rules.lastYear = result.assignment.map((r, g) => ({ giver: n[g]!, receiver: n[r]! }));
  }
  return config;
}
