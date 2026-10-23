// Seeded PRNG for the sim (ARCHITECTURE §4.4): sfc32 seeded through splitmix32. Integer-only (Math.imul, >>>),
// so every JS engine produces the same stream. Separate streams per consumer keep systems independent.

/** sfc32 state; four unsigned 32-bit words, mutated in place. */
export type RngState = { a: number; b: number; c: number; d: number };

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

/** Creates a stream from a run seed and a stream id (e.g. 1 = director, 2 = pickups). */
export function createRng(seed: number, stream: number): RngState {
  const next = splitmix32((seed >>> 0) ^ Math.imul(stream + 1, 0x632be5ab));
  const rng = { a: next(), b: next(), c: next(), d: next() };
  for (let i = 0; i < 12; i++) nextU32(rng); // warm-up, as the sfc32 authors recommend
  return rng;
}

/** Next unsigned 32-bit integer. */
export function nextU32(r: RngState): number {
  const t = (((r.a + r.b) >>> 0) + r.d) >>> 0;
  r.d = (r.d + 1) >>> 0;
  r.a = (r.b ^ (r.b >>> 9)) >>> 0;
  r.b = (r.c + (r.c << 3)) >>> 0;
  r.c = ((r.c << 21) | (r.c >>> 11)) >>> 0;
  r.c = (r.c + t) >>> 0;
  return t;
}

/** Uniform float in [0, 1). */
export function nextFloat(r: RngState): number {
  return nextU32(r) / 4294967296;
}

/** Uniform integer in [0, n) for 1 ≤ n ≤ 2^32 (modulo bias is negligible for the small n the sim uses). */
export function nextInt(r: RngState, n: number): number {
  return Math.floor(nextFloat(r) * n);
}
