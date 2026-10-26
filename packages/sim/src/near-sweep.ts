import type { SimTuning } from '@kometa/shared';

export type MotionPoint = Readonly<{ x: number; y: number; z: number }>;
export const NearSweep = { none: 0, close: 1, penetration: 2 } as const;

type Interval = { lo: number; hi: number; loOpen: boolean; hiOpen: boolean };
// Reused by a synchronous query; no per-tick allocation and no persistent encounter history here.
const body: Interval = { lo: 0, hi: 1, loOpen: false, hiOpen: false };
const lateral: Interval = { lo: 0, hi: 1, loOpen: false, hiOpen: false };

/** Intersects a linear coordinate's bounds with normalized time, preserving open endpoints exactly. */
function clip(range: Interval, from: number, to: number, min: number, max: number, open: boolean): boolean {
  const slope = to - from;
  if (slope === 0) return open ? from > min && from < max : from >= min && from <= max;
  let lo = (min - from) / slope;
  let hi = (max - from) / slope;
  if (lo > hi) {
    const swap = lo;
    lo = hi;
    hi = swap;
  }
  if (lo > range.lo) {
    range.lo = lo;
    range.loOpen = open;
  } else if (lo === range.lo) range.loOpen ||= open;
  if (hi < range.hi) {
    range.hi = hi;
    range.hiOpen = open;
  } else if (hi === range.hi) range.hiOpen ||= open;
  return range.lo < range.hi || (range.lo === range.hi && !range.loOpen && !range.hiOpen);
}

function corridor(from: number, to: number, min: number, max: number, open: boolean): boolean {
  lateral.lo = body.lo;
  lateral.hi = body.hi;
  lateral.loOpen = body.loOpen;
  lateral.hiOpen = body.hiOpen;
  return clip(lateral, from, to, min, max, open);
}

/** Classifies simultaneous body overlap and side gap over the tick's exact linear swept segment. */
export function classifyNearSweep(
  start: MotionPoint,
  end: MotionPoint,
  relativeZ0: number,
  relativeZ1: number,
  vehicleX: number,
  vehicle: SimTuning['vehicles'][number],
  tuning: SimTuning,
): number {
  body.lo = 0;
  body.hi = 1;
  body.loOpen = false;
  body.hiOpen = false;
  const halfL = tuning.player.lengthM / 2;
  if (!clip(body, relativeZ0, relativeZ1, -halfL, vehicle.lengthM + halfL, true)) return NearSweep.none;
  if (!clip(body, start.y, end.y, -tuning.player.heightM, vehicle.heightM, true)) return NearSweep.none;
  const width = (tuning.player.widthM + vehicle.widthM) / 2;
  const x0 = start.x - vehicleX;
  const x1 = end.x - vehicleX;
  // A penetration anywhere disqualifies the whole encounter, even when physical endpoint tests miss it.
  if (corridor(x0, x1, -width, width, true)) return NearSweep.penetration;
  const limit = width + tuning.collision.nearMissLateralM;
  return corridor(x0, x1, width, limit, false) || corridor(x0, x1, -limit, -width, false)
    ? NearSweep.close
    : NearSweep.none;
}
