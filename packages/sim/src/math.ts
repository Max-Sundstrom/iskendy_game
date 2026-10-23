import { SAT_EXP, SAT_EXP_MAX, SAT_EXP_STEP } from './tables';

// Deterministic maths for the sim: only + − × ÷ and Math.floor/min/max/abs/sqrt (ARCHITECTURE §4.4).

/** 1 − e^(−u) from the checked-in table with linear interpolation; saturates at 1 beyond the table. */
export function saturatingExp(u: number): number {
  if (u <= 0) return 0;
  if (u >= SAT_EXP_MAX) return 1;
  const f = u / SAT_EXP_STEP;
  const i = Math.floor(f);
  const lo = SAT_EXP[i] ?? 1;
  const hi = SAT_EXP[i + 1] ?? 1;
  return lo + (hi - lo) * (f - i);
}

/** Cubic ease-out on [0, 1]; polynomial, so no table is needed. */
export function easeOutCubic(t: number): number {
  const k = 1 - clamp01(t);
  return 1 - k * k * k;
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
