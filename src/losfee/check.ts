/** Rule checks shared by feasibility, search, draw and drop-out repair. */
import type { Problem, RuleRef } from './types.ts';

/**
 * The rule a single pair giver → receiver breaks among the rules that look at
 * one pair only (household, exclusions, last year, must rules), or null.
 */
export function pairViolation(p: Problem, giver: number, receiver: number): RuleRef | null {
  if (p.household[giver] === p.household[receiver]) return { kind: 'household' };
  const fixed = p.mustFixed[giver]!;
  if (fixed !== -1 && fixed !== receiver) return { kind: 'must', index: p.mustFixedRule[giver]! };
  const fixedGiver = p.mustFixed.indexOf(receiver);
  if (fixedGiver !== -1 && fixedGiver !== giver) return { kind: 'must', index: p.mustFixedRule[fixedGiver]! };
  const banned = p.banned.get(giver * p.n + receiver);
  if (banned) return banned;
  const choice = p.mustChoice[giver];
  if (choice && !choice.receivers.has(receiver)) return choice.rule;
  return null;
}

/** "Who may give to whom" over every rule that fits a matrix. */
export function allowedMatrix(p: Problem): boolean[][] {
  return Array.from({ length: p.n }, (_, g) => Array.from({ length: p.n }, (_, r) => pairViolation(p, g, r) === null));
}

/** Length of the cycle through `start` in a complete assignment. */
export function cycleLength(assignment: readonly number[], start: number): number {
  let length = 1;
  for (let x = assignment[start]!; x !== start; x = assignment[x]!) length++;
  return length;
}

/** The first rule a complete assignment breaks, or null if it is valid. */
export function findViolation(p: Problem, assignment: readonly number[]): RuleRef | null {
  for (let g = 0; g < p.n; g++) {
    const v = pairViolation(p, g, assignment[g]!);
    if (v) return v;
  }
  if (p.noMutual) {
    for (let g = 0; g < p.n; g++) if (assignment[assignment[g]!] === g) return { kind: 'noMutual' };
  }
  if (p.oneChain && cycleLength(assignment, 0) !== p.n) return { kind: 'oneChain' };
  return null;
}
