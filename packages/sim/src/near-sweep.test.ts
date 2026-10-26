import type { SimTuning } from '@kometa/shared';
import { describe, expect, it } from 'vitest';
import { classifyNearSweep, NearSweep } from './near-sweep';
import { DEFAULT_TUNING } from './tuning';

const T: SimTuning = {
  ...DEFAULT_TUNING.sim,
  player: { ...DEFAULT_TUNING.sim.player, lengthM: 2, widthM: 2, heightM: 1 },
};
const baseVehicle = T.vehicles[0];
if (!baseVehicle) throw new Error('missing test vehicle');
const V = { ...baseVehicle, lengthM: 4, widthM: 2, heightM: 1 };
const query = (x0: number, x1 = x0, y0 = 0, y1 = y0, z0 = -2, z1 = 6) =>
  classifyNearSweep({ x: x0, y: y0, z: 0 }, { x: x1, y: y1, z: 0 }, z0, z1, 0, V, T);

describe('exact swept near-miss geometry (G23)', () => {
  it.each([-1, 1])('uses inclusive surface gap0…0.6 on side%i', (sign) => {
    expect(query(sign * 2)).toBe(NearSweep.close);
    expect(query(sign * 2.6)).toBe(NearSweep.close);
    expect(query(sign * (2.6 + 1e-12))).toBe(NearSweep.none);
    expect(query(sign * (2 - 1e-12))).toBe(NearSweep.penetration);
  });

  it('clips longitudinal, vertical and lateral windows at the same time', () => {
    expect(query(3, 0, 0, 0, -2, 22)).toBe(NearSweep.close); // close only in an interior along-window
    expect(query(3, 2, 0, 0, -2, 26)).toBe(NearSweep.none); // corridor reached after longitudinal exit
    expect(query(2.6, 3.6, 2, 0, -2, 6)).toBe(NearSweep.none); // lateral close before vertical overlap
    expect(query(3.6, 2.6, 2, 0, -2, 6)).toBe(NearSweep.none); // only close at t1, after longitudinal exit
  });

  it('distinguishes closed corridor singleton from open longitudinal/vertical boundaries', () => {
    expect(query(3.6, 2.6, 0, 0, 0, 1)).toBe(NearSweep.close); // t1 is strictly inside body intervals
    expect(query(3.6, 2.6, 0, 0, 0, 5)).toBe(NearSweep.none); // t1 is the open longitudinal exit
    expect(query(3.6, 2.6, 0, 1, 0, 1)).toBe(NearSweep.none); // t1 is the open roof plane
    expect(query(2.6, 3.6, 0, 0, -1, 0)).toBe(NearSweep.none); // only close at open entry t0
  });

  it('requires strict body height overlap but permits low airborne side passes', () => {
    expect(query(2.3, 2.3, 0.5)).toBe(NearSweep.close);
    expect(query(2.3, 2.3, 1)).toBe(NearSweep.none);
    expect(query(2.3, 2.3, 1 + 1e-12)).toBe(NearSweep.none);
    expect(query(2.3, 2.3, -1)).toBe(NearSweep.none);
    expect(query(2.3, 2.3, -1 + 1e-12)).toBe(NearSweep.close);
  });

  it('rejects between-frame diagonal penetration even with separate endpoints', () => {
    expect(query(3, -3)).toBe(NearSweep.penetration);
    expect(query(-3, 3)).toBe(NearSweep.penetration);
    expect(query(3, 2, 0, 0, 0, 1)).toBe(NearSweep.close); // exact tangency is not penetration
  });

  it('handles zero slopes, reversed relative motion and width changes without special substeps', () => {
    expect(query(2.3, 2.3, 0, 0, 0, 0)).toBe(NearSweep.close);
    expect(query(2.3, 2.3, 0, 0, -1, -1)).toBe(NearSweep.none);
    expect(query(2.3, 2.3, 0, 0, 6, -2)).toBe(NearSweep.close);
    const wider = { ...V, widthM: 4 };
    expect(classifyNearSweep({ x: 3.6, y: 0, z: 0 }, { x: 3.6, y: 0, z: 0 }, -2, 6, 0, wider, T)).toBe(NearSweep.close);
    expect(query(3.6)).toBe(NearSweep.none);
  });
});
