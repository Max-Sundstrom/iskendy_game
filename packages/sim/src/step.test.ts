import { SimEventKind } from '@kometa/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { stateHash } from './hash';
import { Action } from './input';
import { createSimState, laneCenterX, type SimState } from './state';
import { speedAtDistance, step } from './step';
import { DEFAULT_TUNING } from './tuning';

const T = DEFAULT_TUNING.sim;
const fresh = (seed = 1) => createSimState(seed, T);
const kinds = (s: SimState) => Array.from(s.events.kind.slice(0, s.events.count));

/** Holds `mask` for one tick, then releases for one tick. */
function tap(s: SimState, mask: number): void {
  step(s, mask, T);
}

describe('lanes', () => {
  it('starts in the centre lane at its centre', () => {
    const s = fresh();
    expect(s.player.lane).toBe(2);
    expect(s.player.x).toBe(0);
    expect(laneCenterX(0, T)).toBeCloseTo(-7.2, 10);
    expect(laneCenterX(4, T)).toBeCloseTo(7.2, 10);
  });

  it('changes lane in changeDurationS (0.16 s → completes on the 10th tick) with ease-out', () => {
    const s = fresh();
    tap(s, Action.right);
    expect(kinds(s)).toEqual([SimEventKind.laneChangeStarted]);
    const xs = [s.player.x];
    for (let i = 0; i < 8; i++) {
      step(s, 0, T);
      xs.push(s.player.x);
    }
    expect(s.player.changing).toBe(true);
    step(s, 0, T); // 10th tick since the press
    expect(s.player.changing).toBe(false);
    expect(s.player.lane).toBe(3);
    expect(s.player.x).toBe(laneCenterX(3, T));
    // monotonic, and front-loaded (ease-out): more than half the way after a third of the time
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1] ?? Infinity);
    expect(xs[2]).toBeGreaterThan(T.lanes.widthM / 2);
  });

  it('G1: ignores a lane input at the edge lane and reports a bump', () => {
    const s = fresh();
    for (let n = 0; n < 2; n++) {
      tap(s, Action.left);
      for (let i = 0; i < 12; i++) step(s, 0, T);
    }
    expect(s.player.lane).toBe(0);
    tap(s, Action.left);
    expect(kinds(s)).toEqual([SimEventKind.laneBump]);
    expect(s.player.changing).toBe(false);
  });

  it('G2: queues a second input during a change once and drops the third', () => {
    const s = fresh();
    tap(s, Action.right);
    step(s, 0, T);
    tap(s, Action.right);
    expect(kinds(s)).toEqual([SimEventKind.laneChangeQueued]);
    step(s, 0, T);
    tap(s, Action.right); // third input inside the same change: dropped
    expect(kinds(s)).toEqual([]);
    for (let i = 0; i < 30; i++) step(s, 0, T);
    expect(s.player.lane).toBe(4);
  });

  it('cancels left and right pressed on the same tick', () => {
    const s = fresh();
    tap(s, Action.left | Action.right);
    expect(s.player.changing).toBe(false);
    expect(kinds(s)).toEqual([]);
  });

  it('only acts on presses, not on held keys', () => {
    const s = fresh();
    for (let i = 0; i < 60; i++) step(s, Action.right, T);
    expect(s.player.lane).toBe(3);
  });
});

describe('forward motion', () => {
  it('follows vMin + (vMax − vMin)(1 − e^(−d/dScale)) within 0.01 %', () => {
    for (const d of [0, 500, 2000, 4000, 12000, 40000]) {
      const expected = T.speed.minMps + (T.speed.maxMps - T.speed.minMps) * (1 - Math.exp(-d / T.speed.distanceScaleM));
      expect(Math.abs(speedAtDistance(d, T) - expected) / expected).toBeLessThan(1e-4);
    }
  });

  it('shifts the origin every originShiftM without losing distance (invariant 7)', () => {
    const s = fresh();
    let shifts = 0;
    let ticks = 0;
    while (s.player.distanceM < 4500) {
      step(s, 0, T);
      ticks++;
      if (kinds(s).includes(SimEventKind.originShift)) shifts++;
    }
    expect(shifts).toBe(2);
    expect(s.player.z).toBeCloseTo(s.player.distanceM - 2 * T.world.originShiftM, 6);
    expect(s.tick).toBe(ticks);
  });
});

describe('properties', () => {
  const inputs = fc.array(fc.integer({ min: 0, max: 63 }), { minLength: 1, maxLength: 1500 });

  it('keeps the player on the road with finite, bounded state for any input stream', () => {
    fc.assert(
      fc.property(inputs, fc.integer({ min: 0, max: 2 ** 31 }), (stream, seed) => {
        const s = fresh(seed);
        for (const held of stream) {
          step(s, held, T);
          const p = s.player;
          if (!(p.lane >= 0 && p.lane < T.lanes.count)) return false;
          if (!(p.x >= laneCenterX(0, T) - 1e-9 && p.x <= laneCenterX(T.lanes.count - 1, T) + 1e-9)) return false;
          if (!(p.speedMps >= T.speed.minMps && p.speedMps <= T.speed.maxMps * T.speed.boostMultiplier)) return false;
          if (!(p.z >= 0 && p.z < T.world.originShiftM)) return false;
          if (![p.x, p.z, p.distanceM, p.speedMps, p.laneT].every(Number.isFinite)) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it('is deterministic: the same seed and inputs give the same hash', () => {
    fc.assert(
      fc.property(inputs, fc.integer({ min: 0, max: 2 ** 31 }), (stream, seed) => {
        const a = fresh(seed);
        const b = fresh(seed);
        for (const held of stream) {
          step(a, held, T);
          step(b, held, T);
        }
        return stateHash(a) === stateHash(b);
      }),
      { numRuns: 100 },
    );
  });
});
