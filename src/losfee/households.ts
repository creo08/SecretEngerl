/**
 * Exactly uniform draw over all assignments that respect the households.
 *
 * The forbidden cells of the households form rectangles (rows: the household's
 * remaining givers, columns: its remaining receivers) that share no row and no
 * column. The number of complete assignments is Σ (−1)^k · r_k · (m−k)!, where r
 * is the product of the rectangles' rook polynomials, r_k = C(a,k)·C(b,k)·k!
 * for an a×b rectangle. Givers are drawn one after another, weighted by the
 * number of completions; receivers whose household has the same remaining
 * rectangle leave the same shape and form one class. All counts are BigInts.
 */
import { randBigInt, randInt, type Rng } from '../random/rng.ts';

const factorials: bigint[] = [1n];
function factorial(k: number): bigint {
  for (let i = factorials.length; i <= k; i++) factorials.push(factorials[i - 1]! * BigInt(i));
  return factorials[k]!;
}

function binomial(n: number, k: number): bigint {
  return factorial(n) / (factorial(k) * factorial(n - k));
}

const rookCache = new Map<number, bigint[]>();
/** Rook polynomial of an a×b rectangle: coefficient k is C(a,k)·C(b,k)·k!. */
export function rookPolynomial(a: number, b: number): bigint[] {
  const key = a * 1024 + b;
  let poly = rookCache.get(key);
  if (!poly) {
    poly = [];
    for (let k = 0; k <= Math.min(a, b); k++) poly.push(binomial(a, k) * binomial(b, k) * factorial(k));
    rookCache.set(key, poly);
  }
  return poly;
}

function multiply(p: readonly bigint[], q: readonly bigint[]): bigint[] {
  const out = new Array<bigint>(p.length + q.length - 1).fill(0n);
  for (let i = 0; i < p.length; i++) {
    const pi = p[i]!;
    for (let j = 0; j < q.length; j++) out[i + j]! += pi * q[j]!;
  }
  return out;
}

/**
 * Number of assignments of m givers to m receivers that avoid the given
 * rectangles, each written as [rows, columns].
 */
export function countAvoiding(m: number, rectangles: readonly (readonly [number, number])[]): bigint {
  let poly: bigint[] = [1n];
  for (const [a, b] of rectangles) if (a > 0 && b > 0) poly = multiply(poly, rookPolynomial(a, b));
  let total = 0n;
  for (let k = 0; k < poly.length && k <= m; k++) {
    const term = poly[k]! * factorial(m - k);
    total += k % 2 === 0 ? term : -term;
  }
  return total;
}

/** Counts assignments where nobody gives within their own household (all people give and receive). */
export function countHouseholdAssignments(household: readonly number[]): bigint {
  const sizes = new Map<number, number>();
  for (const h of household) sizes.set(h, (sizes.get(h) ?? 0) + 1);
  return countAvoiding(household.length, [...sizes.values()].map((s) => [s, s] as const));
}

/**
 * Draws uniformly among household-respecting assignments of `givers` to
 * `receivers` (equal length). `accept(giver, receiver)` sees every pair right
 * after it is drawn; returning false aborts the attempt early, which gives the
 * same result as rejecting the finished assignment. Returns the receiver per
 * giver as a map, null if aborted, or throws if no assignment exists.
 */
export class HouseholdSampler {
  private readonly cache = new Map<string, bigint>();

  private readonly household: readonly number[];
  private readonly givers: readonly number[];
  private readonly receivers: readonly number[];

  constructor(household: readonly number[], givers: readonly number[], receivers: readonly number[]) {
    this.household = household;
    this.givers = givers;
    this.receivers = receivers;
  }

  private count(m: number, rows: readonly number[], cols: readonly number[]): bigint {
    const codes: number[] = [];
    for (let h = 0; h < rows.length; h++) if (rows[h]! > 0 && cols[h]! > 0) codes.push(rows[h]! * 1024 + cols[h]!);
    codes.sort((x, y) => x - y);
    const key = `${m}|${codes.join(',')}`;
    let value = this.cache.get(key);
    if (value === undefined) {
      value = countAvoiding(m, codes.map((c) => [Math.floor(c / 1024), c % 1024] as const));
      this.cache.set(key, value);
    }
    return value;
  }

  /** Number of household-respecting assignments of the givers to the receivers. */
  total(): bigint {
    const { rows, cols } = this.initialShape();
    return this.count(this.givers.length, rows, cols);
  }

  private initialShape() {
    const size = Math.max(-1, ...this.household) + 1;
    const rows = new Array<number>(size).fill(0);
    const cols = new Array<number>(size).fill(0);
    for (const g of this.givers) rows[this.household[g]!]!++;
    for (const r of this.receivers) cols[this.household[r]!]!++;
    return { rows, cols };
  }

  /** Draws one assignment; see the class comment. */
  sample(rng: Rng, accept: (giver: number, receiver: number) => boolean): Map<number, number> | null {
    const { rows, cols } = this.initialShape();
    const open: number[][] = rows.map(() => []);
    for (const r of this.receivers) open[this.household[r]!]!.push(r);
    const result = new Map<number, number>();
    let m = this.givers.length;
    let total = this.count(m, rows, cols);
    if (total === 0n) throw new Error('no household-respecting assignment exists');

    for (const g of this.givers) {
      const hg = this.household[g]!;
      rows[hg]!--;
      // Group the other households with open receivers by their remaining rectangle.
      const classes = new Map<number, number[]>();
      for (let h = 0; h < cols.length; h++) {
        if (h === hg || cols[h] === 0) continue;
        const code = rows[h]! * 1024 + cols[h]!;
        const members = classes.get(code);
        if (members) members.push(h);
        else classes.set(code, [h]);
      }
      let u = randBigInt(rng, total);
      let chosen: number[] | undefined;
      let chosenCount = 0n;
      for (const households of classes.values()) {
        const h0 = households[0]!;
        cols[h0]!--;
        const completions = this.count(m - 1, rows, cols);
        cols[h0]!++;
        const weight = completions * BigInt(households.length * cols[h0]!);
        if (u < weight) {
          chosen = households;
          chosenCount = completions;
          break;
        }
        u -= weight;
      }
      if (!chosen) throw new Error('household weights do not add up');
      // Uniform receiver among all open receivers of the chosen class.
      let pick = randInt(rng, chosen.length * cols[chosen[0]!]!);
      const h = chosen[Math.floor(pick / cols[chosen[0]!]!)]!;
      pick %= cols[h]!;
      const list = open[h]!;
      const receiver = list[pick]!;
      list[pick] = list[list.length - 1]!;
      list.pop();
      cols[h]!--;
      m--;
      total = chosenCount;
      result.set(g, receiver);
      if (!accept(g, receiver)) return null;
    }
    return result;
  }
}
