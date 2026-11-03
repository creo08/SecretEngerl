import type { Rng } from '../../src/random/rng.ts';

/** Deterministic generator (sfc32) for tests that need a fixed sequence. */
export function seededRng(seed: number): Rng {
  let a = 0x9e3779b9 ^ seed;
  let b = 0x243f6a88;
  let c = 0xb7e15162;
  let d = seed | 0;
  const next = () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 12; i++) next();
  return { nextUint32: next };
}
