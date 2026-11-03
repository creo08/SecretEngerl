/**
 * The fair draw: every valid assignment is exactly equally likely.
 *
 * 1. Fixed must rules are set and removed from the problem.
 * 2. Feasibility over all matrix rules (Hopcroft-Karp); failure names a group (Hall).
 * 3. A bounded search proves impossibility early, so impossible rules are named at once.
 * 4. Standard draw: uniform over household-respecting assignments, rejected on any
 *    additional rule. With "one big chain": a uniform random circle (Fisher-Yates),
 *    rejected on any rule. Pairs are checked as soon as they are final; aborting
 *    then gives the same result as rejecting the finished draw.
 * 5. Budget of 1,000,000 attempts or 2 seconds; then no draw, never a biased one.
 */
import { randInt, type Rng } from '../random/rng.ts';
import { pairViolation } from './check.ts';
import { HouseholdSampler } from './households.ts';
import { checkFeasibility } from './matching.ts';
import { searchAssignments } from './search.ts';
import type { DrawResult, Problem, RuleRef } from './types.ts';

export interface DrawOptions {
  maxAttempts?: number;
  maxMillis?: number;
  /** Node limit of the impossibility search. */
  searchNodeLimit?: number;
  now?: () => number;
}

export const DEFAULT_MAX_ATTEMPTS = 1_000_000;
export const DEFAULT_MAX_MILLIS = 2000;

/** Counts which rule rejected attempts, to suggest which one to loosen. */
class Violations {
  private readonly counts = new Map<string, { rule: RuleRef; count: number }>();

  add(rule: RuleRef): void {
    const key = JSON.stringify(rule);
    const entry = this.counts.get(key);
    if (entry) entry.count++;
    else this.counts.set(key, { rule, count: 1 });
  }

  mostFrequent(fallback: RuleRef): RuleRef {
    let best: { rule: RuleRef; count: number } | undefined;
    for (const e of this.counts.values()) if (!best || e.count > best.count) best = e;
    return best?.rule ?? fallback;
  }
}

/** Draws an assignment for the problem; see the module comment. */
export function draw(p: Problem, rng: Rng, options: DrawOptions = {}): DrawResult {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const maxMillis = options.maxMillis ?? DEFAULT_MAX_MILLIS;
  const now = options.now ?? (() => performance.now());
  const start = now();

  const { n } = p;
  const pairRule: (RuleRef | null)[] = [];
  for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) pairRule.push(pairViolation(p, g, r));
  const allowed = Array.from({ length: n }, (_, g) => Array.from({ length: n }, (_, r) => pairRule[g * n + r] === null));

  const feasibility = checkFeasibility(allowed);
  if (!feasibility.ok) {
    return { ok: false, reason: 'tooFewReceivers', givers: feasibility.givers, receivers: feasibility.receivers.length };
  }
  const search = searchAssignments(p, { countAll: false, nodeLimit: options.searchNodeLimit ?? 200_000, allowed });
  if (search.status === 'none') return { ok: false, reason: 'impossible', chain: p.oneChain };

  const violations = new Violations();
  const outOfBudget = (attempts: number) => attempts >= maxAttempts || (attempts % 256 === 0 && now() - start > maxMillis);

  if (p.oneChain) {
    const order = [...Array(n).keys()];
    // Rejections caused by households or fixed must rules come from requiring one chain.
    const reason = (rule: RuleRef): RuleRef =>
      rule.kind === 'household' || (rule.kind === 'must' && p.mustFixedRule.includes(rule.index)) ? { kind: 'oneChain' } : rule;
    for (let attempts = 1; ; attempts++) {
      let rejected: RuleRef | null = null;
      for (let i = n - 1; i >= 0 && !rejected; i--) {
        const j = randInt(rng, i + 1);
        [order[i], order[j]] = [order[j]!, order[i]!];
        if (i < n - 1) rejected = pairRule[order[i]! * n + order[i + 1]!]!;
      }
      if (!rejected) rejected = pairRule[order[n - 1]! * n + order[0]!]!;
      if (!rejected && p.noMutual && n === 2) rejected = { kind: 'noMutual' };
      if (!rejected) {
        const assignment = new Array<number>(n);
        for (let i = 0; i < n; i++) assignment[order[i]!] = order[(i + 1) % n]!;
        return { ok: true, assignment, attempts };
      }
      violations.add(reason(rejected));
      if (outOfBudget(attempts)) return { ok: false, reason: 'tooStrict', rule: violations.mostFrequent({ kind: 'oneChain' }), attempts };
    }
  }

  const fixed = new Array<number>(n).fill(-1);
  const givers: number[] = [];
  const fixedReceivers = new Set(p.mustFixed.filter((r) => r !== -1));
  for (let g = 0; g < n; g++) {
    if (p.mustFixed[g] !== -1) fixed[g] = p.mustFixed[g]!;
    else givers.push(g);
  }
  const receivers = [...Array(n).keys()].filter((r) => !fixedReceivers.has(r));
  const sampler = new HouseholdSampler(p.household, givers, receivers);
  for (let attempts = 1; ; attempts++) {
    const assignment = fixed.slice();
    let rejected: RuleRef | null = null;
    const accept = (g: number, r: number): boolean => {
      rejected = pairRule[g * n + r]!;
      if (!rejected && p.noMutual && assignment[r] === g) rejected = { kind: 'noMutual' };
      assignment[g] = r;
      return rejected === null;
    };
    if (sampler.sample(rng, accept)) {
      // Fixed pairs were set before sampling; they can only clash with "no mutual pairs".
      if (!p.noMutual || assignment.every((r, g) => assignment[r] !== g)) return { ok: true, assignment, attempts };
      rejected = { kind: 'noMutual' };
    }
    violations.add(rejected!);
    if (outOfBudget(attempts)) return { ok: false, reason: 'tooStrict', rule: violations.mostFrequent({ kind: 'noMutual' }), attempts };
  }
}
