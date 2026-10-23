import { SimEventKind } from '@kometa/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Action } from './input';
import { createSimState, type SimState } from './state';
import { step } from './step';
import { DEFAULT_TUNING } from './tuning';
import { jumpPhysics } from './vertical';

const T = DEFAULT_TUNING.sim;
/** Empty road: these tests are about vertical motion and AIR, not traffic. */
const fresh = () => {
  const s = createSimState(1, T);
  s.director.nextRowM = Infinity;
  return s;
};
const has = (s: SimState, kind: number) => Array.from(s.events.kind.slice(0, s.events.count)).includes(kind);
const within1pct = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(0.01);

/** Steps until landing (or a limit); returns the peak height and the tick it happened on. */
function flight(s: SimState, held: (tick: number) => number, limit = 600) {
  let peak = 0;
  let peakTick = 0;
  for (let t = 1; t <= limit; t++) {
    step(s, held(t), T);
    if (s.player.y > peak) {
      peak = s.player.y;
      peakTick = t;
    }
    if (has(s, SimEventKind.land)) return { peak, peakTick, landTick: t };
  }
  return { peak, peakTick, landTick: -1 };
}

describe('jump (GDD §5.3)', () => {
  it('peaks at apexHeightM after timeToApexS, within 1 %', () => {
    const s = fresh();
    const { peak, peakTick } = flight(s, (t) => (t === 1 ? Action.jump : 0));
    within1pct(peak, T.jump.apexHeightM);
    // Launch and the first integration both happen on tick 1, so tick n is n/60 s after launch.
    within1pct(peakTick / T.tickRateHz, T.jump.timeToApexS);
  });

  it('falls faster than it rises (fallGravityMultiplier)', () => {
    const s = fresh();
    const { landTick } = flight(s, (t) => (t === 1 ? Action.jump : 0));
    const expected = T.jump.timeToApexS * (1 + 1 / Math.sqrt(T.jump.fallGravityMultiplier));
    expect(Math.abs(landTick / T.tickRateHz - expected)).toBeLessThan(1.5 / T.tickRateHz);
  });

  it('derives launch speed and gravity consistently, clearing a van (2.4 m)', () => {
    // A semi (4.0 m) is under the apex only for an instant, so it still needs fly or hops (GDD §5.3).
    expect(T.jump.apexHeightM).toBeGreaterThan(2.4);
    const { v0, gUp } = jumpPhysics(T);
    expect((v0 * v0) / (2 * gUp)).toBeCloseTo(T.jump.apexHeightM, 10);
  });

  it('G3: a press up to bufferS before touchdown jumps on landing; an earlier one does not', () => {
    for (const [earlyTicks, expectJump] of [
      [6, true],
      [12, false],
    ] as const) {
      const s = fresh();
      const land = flight(fresh(), (t) => (t === 1 ? Action.jump : 0)).landTick;
      const pressTick = land - earlyTicks;
      let rejumped = false;
      for (let t = 1; t <= land; t++) {
        step(s, t === 1 || t === pressTick ? Action.jump : 0, T);
        if (t === land) rejumped = s.player.airborne;
      }
      expect(rejumped).toBe(expectJump);
    }
  });
});

describe('fly (GDD §5.4) and AIR (GDD §6)', () => {
  it('starts after holdThresholdS of holding, eases to the glide speed and drains airCostLps', () => {
    const s = fresh();
    let flyTick = -1;
    for (let t = 1; t <= 200; t++) {
      step(s, Action.jump, T);
      if (has(s, SimEventKind.flyStart)) flyTick = t;
    }
    expect(flyTick).toBe(1 + Math.ceil(T.fly.holdThresholdS * T.tickRateHz));
    within1pct(s.player.vy, T.fly.glideVyMps); // converged after ~12 time constants
    expect(s.player.airborne).toBe(true);
    const before = s.player.airLiters;
    for (let t = 0; t < 90; t++) step(s, Action.jump, T);
    within1pct(before - s.player.airLiters, T.fly.airCostLps * 1.5);
  });

  it('never climbs above maxAltitudeM', () => {
    const s = fresh();
    for (let t = 0; t < 600; t++) {
      step(s, Action.jump, T);
      expect(s.player.y).toBeLessThanOrEqual(T.fly.maxAltitudeM);
    }
  });

  it('boost drains boostCostLps and multiplies speed; fly + boost stack', () => {
    const s = fresh();
    for (let t = 0; t < 60; t++) step(s, Action.boost, T);
    within1pct(T.air.startL - s.player.airLiters, T.air.boostCostLps);
    expect(s.player.boosting).toBe(true);
    const base = s.player.speedMps / T.speed.boostMultiplier;
    step(s, 0, T);
    expect(s.player.speedMps).toBeLessThan(base * 1.001); // the base itself grows ~0.03 % per tick

    const f = fresh();
    for (let t = 0; t < 40; t++) step(f, Action.jump, T); // airborne and flying
    const air0 = f.player.airLiters;
    for (let t = 0; t < 60; t++) step(f, Action.jump | Action.boost, T);
    within1pct(air0 - f.player.airLiters, T.fly.airCostLps + T.air.boostCostLps);
  });

  it('regenerates regenLps on the ground when not boosting, capped at capacity', () => {
    const s = fresh();
    s.player.airLiters = 100;
    for (let t = 0; t < 120; t++) step(s, 0, T);
    within1pct(s.player.airLiters - 100, T.air.regenLps * 2);
    for (let t = 0; t < 60 * 30; t++) step(s, 0, T);
    expect(s.player.airLiters).toBe(T.air.capacityL);
  });

  it('G5: running dry mid-flight stops the thrusters once and the car falls without NaN', () => {
    const s = fresh();
    for (let t = 0; t < 30; t++) step(s, Action.jump, T);
    expect(s.player.flying).toBe(true);
    s.player.airLiters = 3;
    let empties = 0;
    let landed = false;
    for (let t = 0; t < 300 && !landed; t++) {
      step(s, Action.jump | Action.boost, T);
      if (has(s, SimEventKind.airEmpty)) empties++;
      landed = has(s, SimEventKind.land);
      expect(Number.isFinite(s.player.y)).toBe(true);
    }
    expect(empties).toBe(1);
    expect(landed).toBe(true);
    expect(s.player.airLiters).toBe(0);
  });
});

describe('slam (GDD §5.5)', () => {
  it('drops at slam.vyMps, cancels flight and reports a slam landing', () => {
    const s = fresh();
    for (let t = 0; t < 30; t++) step(s, Action.jump, T);
    step(s, Action.jump | Action.slam, T);
    expect(s.player.vy).toBe(T.slam.vyMps);
    expect(s.player.flying).toBe(false);
    let slamLanding = false;
    for (let t = 0; t < 60; t++) {
      step(s, Action.jump, T);
      if (has(s, SimEventKind.land)) slamLanding = s.events.a[s.events.count - 1] === 1 || slamLanding;
    }
    expect(slamLanding).toBe(true);
  });

  it('does nothing on the ground', () => {
    const s = fresh();
    step(s, Action.slam, T);
    expect(s.player.vy).toBe(0);
    expect(has(s, SimEventKind.slam)).toBe(false);
  });
});

describe('vertical properties', () => {
  it('keeps height in [0, maxAltitudeM] and AIR in [0, capacity] for any input stream', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 63 }), { maxLength: 1500 }), (stream) => {
        const s = fresh();
        for (const held of stream) {
          step(s, held, T);
          const p = s.player;
          if (!(p.y >= 0 && p.y <= T.fly.maxAltitudeM)) return false;
          if (!(p.airLiters >= 0 && p.airLiters <= T.air.capacityL)) return false;
          if (![p.y, p.vy, p.airLiters].every(Number.isFinite)) return false;
          if (!p.airborne && (p.y !== 0 || p.flying)) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });
});
