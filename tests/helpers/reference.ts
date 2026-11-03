/**
 * Reference implementation for tests: decides validity straight from the
 * configuration's names, independent of the engine's compiled problem.
 */
import type { RoundConfig } from '../../src/config/types.ts';

/** Calls `visit` for every permutation of 0..n-1 (Heap's algorithm). The array is reused. */
export function forEachPermutation(n: number, visit: (p: number[]) => void): void {
  const p = [...Array(n).keys()];
  const c = new Array<number>(n).fill(0);
  visit(p);
  for (let i = 0; i < n; ) {
    if (c[i]! < i) {
      const k = i % 2 === 0 ? 0 : c[i]!;
      [p[k], p[i]] = [p[i]!, p[k]!];
      visit(p);
      c[i]!++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
}

/** Returns a validity check over assignments (giver index → receiver index, households order). */
export function referenceChecker(config: RoundConfig): (assignment: readonly number[]) => boolean {
  const names = config.participants.households.flat();
  const at = (name: string) => names.indexOf(name);
  const home = names.map((name) => config.participants.households.findIndex((h) => h.includes(name)));
  const banned = new Set<string>();
  for (const e of config.rules.exclusions) {
    banned.add(`${at(e.from)}>${at(e.to)}`);
    if (e.bothWays) banned.add(`${at(e.to)}>${at(e.from)}`);
  }
  for (const p of config.rules.lastYear) banned.add(`${at(p.giver)}>${at(p.receiver)}`);
  const must = config.rules.must.map((m) => ({ giver: at(m.giver), choices: m.choices.map(at) }));
  const n = names.length;
  return (a) => {
    for (let g = 0; g < n; g++) {
      if (home[g] === home[a[g]!]) return false;
      if (banned.has(`${g}>${a[g]}`)) return false;
      if (config.structure.noMutual && a[a[g]!] === g) return false;
    }
    for (const m of must) if (!m.choices.includes(a[m.giver]!)) return false;
    if (config.structure.oneChain) {
      let length = 1;
      for (let x = a[0]!; x !== 0; x = a[x]!) length++;
      if (length !== n) return false;
    }
    return true;
  };
}

/** All valid assignments of a small round, as comma-joined keys. */
export function validAssignments(config: RoundConfig): string[] {
  const valid = referenceChecker(config);
  const out: string[] = [];
  forEachPermutation(config.participants.households.flat().length, (p) => {
    if (valid(p)) out.push(p.join(','));
  });
  return out;
}
