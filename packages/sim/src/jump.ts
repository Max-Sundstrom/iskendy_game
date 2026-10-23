import type { SimTuning } from '@kometa/shared';

// Jump constants shared by vertical motion, roofs and collisions (kept apart so those modules don't import each
// other).

/** Launch speed and rising gravity from apex height and time to apex: v0 = 2h/t, g = 2h/t². */
export function jumpPhysics(tuning: SimTuning): { v0: number; gUp: number; gDown: number } {
  const { apexHeightM: h, timeToApexS: t, fallGravityMultiplier: k } = tuning.jump;
  const gUp = (2 * h) / (t * t);
  return { v0: (2 * h) / t, gUp, gDown: gUp * k };
}

export const FlyStop = { released: 1, airEmpty: 2, slam: 3, landed: 4 } as const;
