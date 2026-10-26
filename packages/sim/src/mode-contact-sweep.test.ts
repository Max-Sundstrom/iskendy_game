import type { SimTuning } from '@kometa/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { hasClosedModeContact, hasClosedModeOverlap } from './mode-contact-sweep';
import { DEFAULT_TUNING } from './tuning';

const T: SimTuning = {
  ...DEFAULT_TUNING.sim,
  player: { ...DEFAULT_TUNING.sim.player, lengthM: 2, widthM: 2, heightM: 1 },
};
const baseVehicle = T.vehicles[0];
if (!baseVehicle) throw new Error('missing test vehicle');
const V = { ...baseVehicle, lengthM: 4, widthM: 2, heightM: 1 };
const contact = (x0: number, x1 = x0, y0 = 0, y1 = y0, z0 = 0, z1 = z0) =>
  hasClosedModeContact({ x: x0, y: y0, z: 0 }, { x: x1, y: y1, z: 0 }, z0, z1, 0, V, T);
const overlap = (x: number, y = 0, z = 0) => hasClosedModeOverlap({ x, y, z: 0 }, z, 0, V, T);

describe('closed protected-contact geometry (P2-04a2)', () => {
  it.each([
    { axis: 'left', x: -2, y: 0, z: 0, dx: -1e-12, dy: 0, dz: 0 },
    { axis: 'right', x: 2, y: 0, z: 0, dx: 1e-12, dy: 0, dz: 0 },
    { axis: 'bottom', x: 0, y: -1, z: 0, dx: 0, dy: -1e-12, dz: 0 },
    { axis: 'roof', x: 0, y: 1, z: 0, dx: 0, dy: 1e-12, dz: 0 },
    { axis: 'rear', x: 0, y: 0, z: -1, dx: 0, dy: 0, dz: -1e-12 },
    { axis: 'front', x: 0, y: 0, z: 5, dx: 0, dy: 0, dz: 1e-12 },
  ])('includes the exact $axis face and excludes an immediately separated body', ({ x, y, z, dx, dy, dz }) => {
    expect(overlap(x, y, z)).toBe(true);
    expect(contact(x, x, y, y, z, z)).toBe(true);
    expect(overlap(x + dx, y + dy, z + dz)).toBe(false);
    expect(contact(x + dx, x + dx, y + dy, y + dy, z + dz, z + dz)).toBe(false);
  });

  it('distinguishes a swept crossing from a final overlap, in both relative directions', () => {
    expect(contact(0, 0, 0, 0, -2, 6)).toBe(true);
    expect(overlap(0, 0, 6)).toBe(false);
    expect(contact(0, 0, 0, 0, 6, -2)).toBe(true);
    expect(overlap(0, 0, -2)).toBe(false);
    expect(contact(-3, 3, 0, 0, -2, 6)).toBe(true);
  });

  it('requires all three axis intervals to meet at one time', () => {
    expect(contact(3, 0, 0, 0, -2, 26)).toBe(false); // x enters after z has already exited
    expect(contact(0, 0, 2, 0, -2, 26)).toBe(false); // y enters after z has already exited
    expect(contact(-4, 4, 3, -1, 4, 12)).toBe(false); // each axis crosses, but no simultaneous intersection
    expect(contact(3, 0, 0, 0, -2, 6)).toBe(true);
  });

  it('keeps closed singleton contacts at either endpoint and in the interior', () => {
    expect(contact(3, 2, 2, 1, 0, 5)).toBe(true); // all three faces meet at t=1
    expect(contact(2, 3, 1, 2, 5, 6)).toBe(true); // all three faces meet only at t=0
    expect(contact(3, 1, 0, 2, 0, 1)).toBe(true); // x entry and y exit meet exactly at t=1/2
    expect(contact(3, 1, 0, 2 + 1e-12, 0, 1)).toBe(false);
  });

  it('does not turn a flight wholly above the common x/z interval into contact', () => {
    expect(contact(0, 0, 1 + 1e-12, 1 + 1e-12, -2, 6)).toBe(false);
    expect(contact(0, 0, 0, 4, -10, 0)).toBe(false); // already above roof before longitudinal entry
    expect(contact(0, 0, 4, 0, 0, 10)).toBe(false); // only descends below roof after longitudinal exit
    expect(contact(0, 0, 1, 1, -2, 6)).toBe(true);
  });

  it('uses relative Z for moving traffic and remains independent of the world origin', () => {
    const start = Object.freeze({ x: 1024, y: 0, z: 2001 });
    const end = Object.freeze({ x: 1024, y: 0, z: 2001 });
    expect(hasClosedModeContact(start, end, 6, -2, 1024, V, T)).toBe(true);
    expect(hasClosedModeOverlap(end, -2, 1024, V, T)).toBe(false);
    expect(hasClosedModeContact({ ...start, z: 1 }, { ...end, z: 1 }, 6, -2, 1024, V, T)).toBe(true);
    expect(start).toEqual({ x: 1024, y: 0, z: 2001 });
    expect(end).toEqual(start);
  });

  it('uses actual player/vehicle dimensions and cannot retain a prior query interval', () => {
    const wider = { ...V, widthM: 4, heightM: 3, lengthM: 8 };
    expect(hasClosedModeOverlap({ x: 3, y: 3, z: 0 }, 9, 0, wider, T)).toBe(true);
    expect(hasClosedModeOverlap({ x: 3, y: 3, z: 0 }, 9, 0, V, T)).toBe(false);
    expect(contact(20)).toBe(false);
    expect(contact(0)).toBe(true);
    expect(contact(3, 2, 2, 1, 0, 5)).toBe(true);
    expect(contact(0, 0, 4, 0, 0, 10)).toBe(false);
    expect(contact(0)).toBe(true);
  });

  // Exact binary64-rational witnesses from independent QA (closed-sweep-failures-compact.json).
  // Ten empty intervals were rounded into contacts; the marshrutka interval has positive width 1/37999121855938557.
  it.each([
    { id: 'sedan', x0: 0, x1: -3.75, y0: 2.825, y1: 0.17500000000000004, z: 2.25, hit: false },
    { id: 'semi', x0: -4.5, x1: 0, y0: 1.425, y1: 6.575, z: 8.25, hit: false },
    { id: 'semi', x0: 0, x1: -4.5, y0: 6.575, y1: 1.425, z: 8.25, hit: false },
    { id: 'semi', x0: -4.5, x1: 2.25, y0: 1.425, y1: 9.15, z: 8.25, hit: false },
    { id: 'semi', x0: 2.25, x1: -4.5, y0: 9.15, y1: 1.425, z: 8.25, hit: false },
    { id: 'cones', x0: 0, x1: -2.95, y0: 2.075, y1: -0.07499999999999996, z: 0.5, hit: false },
    { id: 'marshrutka', x0: -4.05, x1: 2.025, y0: 0.7250000000000001, y1: 6.35, z: 2.9999999999999996, hit: true },
    { id: 'sweeper', x0: -4.45, x1: 0, y0: 0.925, y1: 5.075, z: 3.4999999999999996, hit: false },
    { id: 'sweeper', x0: 0, x1: -4.45, y0: 5.075, y1: 0.925, z: 3.4999999999999996, hit: false },
    { id: 'sweeper', x0: -4.45, x1: 2.225, y0: 0.925, y1: 7.15, z: 3.4999999999999996, hit: false },
    { id: 'sweeper', x0: 2.225, x1: -4.45, y0: 7.15, y1: 0.925, z: 3.4999999999999996, hit: false },
  ])('retains exact default-dimension interval $id ($x0,$y0) → ($x1,$y1)', ({ id, x0, x1, y0, y1, z, hit }) => {
    const tuning = DEFAULT_TUNING.sim;
    const vehicle = tuning.vehicles.find((v) => v.id === id);
    if (!vehicle) throw new Error('missing QA regression vehicle');
    const from = { x: x0, y: y0, z: 100 };
    const to = { x: x1, y: y1, z: 102 };
    expect(hasClosedModeContact(from, to, z, z, 0, vehicle, tuning)).toBe(hit);
    expect(hasClosedModeContact(to, from, z, z, 0, vehicle, tuning)).toBe(hit);
    expect(hasClosedModeOverlap(to, z, 0, vehicle, tuning)).toBe(false);
  });

  it('compares finite extreme and subnormal crossings without overflowing or retaining scratch', () => {
    const max = Number.MAX_VALUE;
    expect(contact(-max, max, max, -max)).toBe(true); // common t=1/2, even though both deltas overflow double
    expect(contact(-max, max, max, 0)).toBe(false); // y enters near 1, after x leaves near 1/2
    const min = Number.MIN_VALUE;
    const tiny = { ...T, player: { lengthM: 2 * min, widthM: 2 * min, heightM: min } };
    const vehicle = { ...V, lengthM: 4 * min, widthM: 2 * min, heightM: min };
    const from = { x: 3 * min, y: 0, z: 0 };
    expect(hasClosedModeContact(from, { x: min, y: 2 * min, z: 0 }, 0, min, 0, vehicle, tiny)).toBe(true);
    expect(hasClosedModeContact(from, { x: min, y: 3 * min, z: 0 }, 0, min, 0, vehicle, tiny)).toBe(false);
    expect(contact(-max, max, max, -max)).toBe(true);
    expect(contact(-0, 0)).toBe(true);
  });

  it('rejects nonfinite derived geometry before returning a partial result, without mutating inputs', () => {
    const max = Number.MAX_VALUE;
    for (const fixture of [
      { point: { x: max, y: 0, z: 0 }, x: -max, z: 0, vehicle: V, tuning: T },
      { point: { x: 20, y: NaN, z: 0 }, x: 0, z: 0, vehicle: V, tuning: T },
      { point: { x: 20, y: 0, z: 0 }, x: 0, z: Infinity, vehicle: V, tuning: T },
      {
        point: { x: 20, y: 0, z: 0 },
        x: 0,
        z: 0,
        vehicle: { ...V, widthM: max },
        tuning: { ...T, player: { ...T.player, widthM: max } },
      },
      {
        point: { x: 20, y: 0, z: 0 },
        x: 0,
        z: 0,
        vehicle: { ...V, lengthM: max },
        tuning: { ...T, player: { ...T.player, lengthM: max } },
      },
    ]) {
      const { x, z, vehicle, tuning } = fixture;
      const point = Object.freeze(fixture.point);
      const before = { ...point };
      expect(() => hasClosedModeContact(point, point, z, z, x, vehicle, tuning)).toThrow(RangeError);
      expect(() => hasClosedModeOverlap(point, z, x, vehicle, tuning)).toThrow(RangeError);
      expect(point).toEqual(before);
    }
    expect(contact(0)).toBe(true);
  });

  it('matches an exact rational boundary-witness oracle without sampling time', () => {
    // A closed box/segment intersection contains either an endpoint or a crossing of a box plane.
    // BigInt evaluates those rational witnesses exactly, independently of slab clipping and floating division.
    const oracle = (from: number[], to: number[], lows: number[], highs: number[]) => {
      const candidates: [bigint, bigint][] = [
        [0n, 1n],
        [1n, 1n],
      ];
      for (let axis = 0; axis < 3; axis++) {
        const a = from[axis];
        const b = to[axis];
        const lo = lows[axis];
        const hi = highs[axis];
        if (a === undefined || b === undefined || lo === undefined || hi === undefined) throw new Error('axis missing');
        if (a === b) continue;
        for (const bound of [lo, hi]) {
          let numerator = BigInt(bound - a);
          let denominator = BigInt(b - a);
          if (denominator < 0n) {
            numerator = -numerator;
            denominator = -denominator;
          }
          if (numerator >= 0n && numerator <= denominator) candidates.push([numerator, denominator]);
        }
      }
      return candidates.some(([numerator, denominator]) =>
        from.every((a, axis) => {
          const b = to[axis];
          const lo = lows[axis];
          const hi = highs[axis];
          if (b === undefined || lo === undefined || hi === undefined) throw new Error('axis missing');
          const position = BigInt(a) * denominator + BigInt(b - a) * numerator;
          return position >= BigInt(lo) * denominator && position <= BigInt(hi) * denominator;
        }),
      );
    };
    const point = fc.tuple(
      fc.integer({ min: -10, max: 10 }),
      fc.integer({ min: -10, max: 10 }),
      fc.integer({ min: -10, max: 10 }),
    );
    fc.assert(
      fc.property(point, point, ([x0, y0, z0], [x1, y1, z1]) => {
        const expected = oracle([x0, y0, z0], [x1, y1, z1], [-2, -1, -1], [2, 1, 5]);
        expect(contact(x0, x1, y0, y1, z0, z1)).toBe(expected);
        expect(contact(x1, x0, y1, y0, z1, z0)).toBe(expected);
        expect(contact(x1, x1, y1, y1, z1, z1)).toBe(overlap(x1, y1, z1));
      }),
      { seed: 240421, numRuns: 1000 },
    );
  });
});
