/**
 * Randomness. In production the only source is crypto.getRandomValues; tests
 * pass their own generator. All integers are drawn without modulo bias.
 */

/** A source of uniformly random 32-bit words. */
export interface Rng {
  nextUint32(): number;
}

/** Generator backed by crypto.getRandomValues, buffered to keep calls cheap. */
export function createCryptoRng(): Rng {
  const buffer = new Uint32Array(1024);
  let pos = buffer.length;
  return {
    nextUint32() {
      if (pos === buffer.length) {
        crypto.getRandomValues(buffer);
        pos = 0;
      }
      return buffer[pos++]!;
    },
  };
}

const TWO_32 = 2 ** 32;

/** Uniform integer in [0, n) for 1 <= n <= 2^32, rejecting values above the last full multiple. */
export function randInt(rng: Rng, n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > TWO_32) throw new RangeError(`randInt: bad range ${n}`);
  const limit = Math.floor(TWO_32 / n) * n;
  let x: number;
  do x = rng.nextUint32(); while (x >= limit);
  return x % n;
}

/** Uniform BigInt in [0, n) for n >= 1, assembled from as many 32-bit words as needed. */
export function randBigInt(rng: Rng, n: bigint): bigint {
  if (n < 1n) throw new RangeError('randBigInt: bad range');
  if (n <= BigInt(TWO_32)) return BigInt(randInt(rng, Number(n)));
  let words = 0;
  while (1n << BigInt(32 * words) < n) words++;
  const space = 1n << BigInt(32 * words);
  const limit = (space / n) * n;
  let x: bigint;
  do {
    x = 0n;
    for (let i = 0; i < words; i++) x = (x << 32n) | BigInt(rng.nextUint32());
  } while (x >= limit);
  return x % n;
}

/** Shuffles in place with Fisher-Yates. */
export function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
