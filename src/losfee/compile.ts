/** Translates a validated round configuration into a matching problem over indices. */
import type { RoundConfig } from '../config/types.ts';
import { nameKey } from '../input/validate.ts';
import type { Problem } from './types.ts';

/** A problem plus the names its indices stand for. */
export interface CompiledRound {
  names: string[];
  problem: Problem;
}

/**
 * Builds the problem from a configuration that passed validateConfig.
 * People are numbered in the order of the households.
 */
export function compileRound(config: RoundConfig): CompiledRound {
  const names = config.participants.households.flat();
  const n = names.length;
  const index = new Map(names.map((name, i) => [nameKey(name), i]));
  const at = (name: string) => index.get(nameKey(name))!;
  const household: number[] = [];
  config.participants.households.forEach((members, h) => members.forEach(() => household.push(h)));

  const banned: Problem['banned'] = new Map();
  config.rules.exclusions.forEach((e, i) => {
    const from = at(e.from);
    const to = at(e.to);
    banned.set(from * n + to, { kind: 'exclusion', index: i });
    if (e.bothWays) banned.set(to * n + from, { kind: 'exclusion', index: i });
  });
  config.rules.lastYear.forEach((p, i) => {
    const key = at(p.giver) * n + at(p.receiver);
    if (!banned.has(key)) banned.set(key, { kind: 'lastYear', index: i });
  });

  const mustFixed = new Array<number>(n).fill(-1);
  const mustFixedRule = new Array<number>(n).fill(-1);
  const mustChoice: Problem['mustChoice'] = new Array(n).fill(null);
  config.rules.must.forEach((m, i) => {
    const giver = at(m.giver);
    const receivers = new Set(m.choices.map(at));
    if (receivers.size === 1) {
      mustFixed[giver] = [...receivers][0]!;
      mustFixedRule[giver] = i;
    } else {
      mustChoice[giver] = { receivers, rule: { kind: 'must', index: i } };
    }
  });

  return {
    names,
    problem: {
      n,
      household,
      banned,
      mustFixed,
      mustFixedRule,
      mustChoice,
      noMutual: config.structure.noMutual,
      oneChain: config.structure.oneChain,
    },
  };
}
