/**
 * Drop-out repair: the Engerl of the person who left takes over that person's
 * Bengerl, so exactly one link changes.
 */
import type { Problem, RuleRef } from './types.ts';
import { pairViolation } from './check.ts';

export type DropoutRepair =
  /** The Engerl and the person who left gave to each other: the Engerl would draw themselves. Only a new draw helps. */
  | { kind: 'selfDraw'; engerl: number }
  /**
   * `engerl` gets a new link for `receiver`. `assignment` covers the remaining
   * people under their old indices (the person who left maps to -1).
   * `broken` lists the rules the new pair breaks; if not empty, the app warns.
   */
  | { kind: 'repaired'; engerl: number; receiver: number; assignment: number[]; broken: RuleRef[] };

/**
 * Repairs `assignment` after person `left` drops out. People who left earlier
 * are marked -1 in `assignment`; their rules no longer apply.
 */
export function repairDropout(p: Problem, assignment: readonly number[], left: number): DropoutRepair {
  const engerl = assignment.indexOf(left);
  if (engerl === -1 || assignment[left] === -1) throw new Error(`person ${left} is not in the round`);
  const receiver = assignment[left]!;
  if (engerl === receiver) return { kind: 'selfDraw', engerl };

  const broken: RuleRef[] = [];
  // Rules of everyone who left no longer apply.
  const remaining: Problem = { ...p, mustFixed: p.mustFixed.map((r, g) => (g === left || assignment[g] === -1 ? -1 : r)) };
  const pair = pairViolation(remaining, engerl, receiver);
  // A fixed must rule "engerl gives to left" can no longer hold; pairViolation reports it as must.
  if (pair) broken.push(pair);
  if (p.noMutual && assignment[receiver] === engerl) broken.push({ kind: 'noMutual' });

  const next = assignment.slice();
  next[engerl] = receiver;
  next[left] = -1;
  return { kind: 'repaired', engerl, receiver, assignment: next, broken };
}
