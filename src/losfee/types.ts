/**
 * Data structures of the matching engine. People are indices 0..n-1;
 * an assignment maps each giver (Engerl) to their receiver (Bengerl).
 */

/** Which rule of the configuration a check refers to. `index` points into the rule list of that kind. */
export type RuleRef =
  | { kind: 'household' }
  | { kind: 'exclusion'; index: number }
  | { kind: 'lastYear'; index: number }
  | { kind: 'must'; index: number }
  | { kind: 'noMutual' }
  | { kind: 'oneChain' };

/** The matching problem, already translated from names to indices. */
export interface Problem {
  n: number;
  /** Household id per person; a single person has a household of their own. */
  household: number[];
  /** Forbidden directed pairs `giver * n + receiver` from exclusions and last year, with their rule. */
  banned: Map<number, RuleRef>;
  /** Fixed receiver per giver from a must rule with one choice, or -1. */
  mustFixed: number[];
  /** Allowed receivers per giver from a must rule with several choices, or null. */
  mustChoice: ({ receivers: Set<number>; rule: RuleRef } | null)[];
  /** Rule index of each fixed must rule, per giver (or -1). */
  mustFixedRule: number[];
  noMutual: boolean;
  oneChain: boolean;
}

/** Outcome of a draw. */
export type DrawResult =
  | { ok: true; assignment: number[]; attempts: number }
  /** Hall's condition fails: these givers together may give to only `receivers` people. */
  | { ok: false; reason: 'tooFewReceivers'; givers: number[]; receivers: number }
  /** A complete search proved there is no valid draw (or, with oneChain, no big chain). */
  | { ok: false; reason: 'impossible'; chain: boolean }
  /** The attempt budget ran out; `rule` is the additional rule violated most often. */
  | { ok: false; reason: 'tooStrict'; rule: RuleRef; attempts: number };
