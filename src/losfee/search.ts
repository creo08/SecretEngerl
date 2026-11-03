/**
 * Bounded depth-first search over assignments with every rule. It decides
 * whether any valid draw exists, and counts all valid draws for small rounds.
 * Its results never feed the fair draw, so they cannot bias it.
 */
import { allowedMatrix } from './check.ts';
import type { Problem } from './types.ts';

export interface SearchResult {
  /** `none` is a proof; `unknown` means the node limit was hit first. */
  status: 'found' | 'none' | 'unknown';
  /** Number of valid assignments seen; exact when status is not `unknown` and counting. */
  count: number;
}

/**
 * Searches valid assignments. With `countAll` it enumerates all of them,
 * otherwise it stops at the first. `nodeLimit` caps the number of steps.
 */
export function searchAssignments(p: Problem, options: { countAll: boolean; nodeLimit: number }): SearchResult {
  const { n } = p;
  const allowed = allowedMatrix(p);
  const order = [...Array(n).keys()].sort((a, b) => allowed[a]!.filter(Boolean).length - allowed[b]!.filter(Boolean).length);
  const candidates = order.map((g) => allowed[g]!.flatMap((ok, r) => (ok ? [r] : [])));
  const to = new Array<number>(n).fill(-1);
  const taken = new Array<boolean>(n).fill(false);
  let nodes = 0;
  let count = 0;
  let limited = false;

  // Length of the cycle that g → r would close, or 0 if it closes none.
  const closes = (g: number, r: number): number => {
    let x = r;
    let length = 1;
    while (x !== g && to[x] !== -1) {
      x = to[x]!;
      length++;
    }
    return x === g ? length : 0;
  };

  const step = (depth: number): boolean => {
    if (depth === n) {
      count++;
      return !options.countAll;
    }
    const g = order[depth]!;
    for (const r of candidates[depth]!) {
      if (taken[r]) continue;
      if (++nodes > options.nodeLimit) {
        limited = true;
        return true;
      }
      const cycle = closes(g, r);
      if (cycle === 2 && p.noMutual) continue;
      if (cycle > 0 && p.oneChain && cycle !== n) continue;
      to[g] = r;
      taken[r] = true;
      const stop = step(depth + 1);
      to[g] = -1;
      taken[r] = false;
      if (stop) return true;
    }
    return false;
  };

  step(0);
  if (limited) return { status: 'unknown', count };
  return { status: count > 0 ? 'found' : 'none', count };
}
