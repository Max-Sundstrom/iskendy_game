import type { SimTuning } from '@kometa/shared';

/** Lateral centre of a lane in metres; lane 0 is the leftmost, +x is the driver's right. */
export function laneCenterX(lane: number, tuning: SimTuning): number {
  return (lane - (tuning.lanes.count - 1) / 2) * tuning.lanes.widthM;
}
