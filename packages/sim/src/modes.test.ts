import { ModeKind, SimTuningSchema } from '@kometa/shared';
import { describe, expect, it } from 'vitest';
import { readEvents } from './events';
import { stateHash } from './hash';
import { Action } from './input';
import { arm, dt, emptyRoad, obstacle, T } from './mode-test-helpers';
import { SimStatus } from './state';
import { speedAtDistance, step } from './step';

describe('LIFTOFF phase-at-start timing and trigger ordering', () => {
  it('starts after an ordinary trigger tick and protects exactly 300 active plus 60 grace ticks', () => {
    const s = emptyRoad();
    s.score.meter = T.meter.capacity;
    step(s, 0, T);
    expect(s.player.speedMps).toBe(T.speed.minMps);
    expect(s.mode).toEqual({ kind: ModeKind.liftoff, activeTicksLeft: 300, graceTicksLeft: 0, smashChain: 0 });
    expect(readEvents(s.events)).toContainEqual({ kind: 'modeStarted', mode: 'liftoff', activeTicks: 300 });
    expect(s.score.meter).toBe(0);
    for (let tick = 1; tick <= 300; tick++) {
      const baseSpeed = speedAtDistance(s.player.distanceM, T);
      step(s, 0, T);
      expect(s.player.speedMps).toBe(baseSpeed * T.speed.liftoffMultiplier);
      expect(s.mode.activeTicksLeft).toBe(300 - tick);
      expect(s.mode.graceTicksLeft).toBe(tick === 300 ? 60 : 0);
      expect(readEvents(s.events).filter((e) => e.kind === 'modeEnded')).toHaveLength(tick === 300 ? 1 : 0);
    }
    for (let tick = 1; tick <= 60; tick++) {
      const baseSpeed = speedAtDistance(s.player.distanceM, T);
      step(s, 0, T);
      expect(s.player.speedMps).toBe(baseSpeed);
      expect(s.mode.graceTicksLeft).toBe(60 - tick);
      expect(readEvents(s.events).filter((e) => e.kind === 'modeGraceEnded')).toHaveLength(tick === 60 ? 1 : 0);
    }
    expect(s.mode.kind).toBe(ModeKind.none);
    step(s, 0, T);
    expect(readEvents(s.events).some((e) => e.kind === 'modeEnded' || e.kind === 'modeGraceEnded')).toBe(false);
  });

  it('keeps full meter through active/grace and requires one ordinary physics tick before restart', () => {
    const s = emptyRoad();
    arm(s, 1);
    s.mode.smashChain = 7;
    s.score.meter = T.meter.capacity;
    const tuning = SimTuningSchema.parse({ ...T, modes: { ...T.modes, graceS: dt } });
    step(s, 0, tuning);
    expect(s.mode.graceTicksLeft).toBe(1);
    expect(s.score.meter).toBe(T.meter.capacity);
    step(s, 0, tuning);
    expect(s.mode.kind).toBe(ModeKind.none);
    expect(s.score.meter).toBe(T.meter.capacity);
    const ordinarySpeed = speedAtDistance(s.player.distanceM, tuning);
    step(s, 0, tuning);
    expect(s.player.speedMps).toBe(ordinarySpeed);
    expect(s.mode.activeTicksLeft).toBe(300);
    expect(s.mode.smashChain).toBe(0);
    expect(s.score.meter).toBe(0);
  });

  it('honors autoTrigger=false and last-tick meter gains, but cannot rescue a same-tick crash', () => {
    const disabled = { ...T, meter: { ...T.meter, autoTrigger: false } };
    const off = emptyRoad(disabled);
    off.score.meter = T.meter.capacity;
    step(off, 0, disabled);
    expect(off.mode.kind).toBe(ModeKind.none);
    expect(off.score.meter).toBe(T.meter.capacity);

    const gain = emptyRoad();
    gain.score.meter = T.meter.capacity - T.meterGain.boostPerQuarterSecond;
    gain.score.boostTicks = Math.ceil(T.scoring.boostIntervalS * T.tickRateHz) - 1;
    step(gain, Action.boost, T);
    expect(gain.mode.activeTicksLeft).toBe(300);
    expect(gain.player.airLiters).toBe(T.air.startL - T.air.boostCostLps * dt);

    const crash = emptyRoad();
    crash.score.meter = T.meter.capacity;
    obstacle(crash, 0);
    step(crash, 0, T);
    expect(crash.status).toBe(SimStatus.crashed);
    expect(crash.mode.kind).toBe(ModeKind.none);
    expect(crash.score.meter).toBe(T.meter.capacity);
    expect(readEvents(crash.events).some((e) => e.kind === 'modeStarted')).toBe(false);
  });

  it('uses ceil for custom intervals and zero grace has no synthetic graceEnded event', () => {
    const tuning = SimTuningSchema.parse({ ...T, modes: { ...T.modes, liftoff: { durationS: 0.017 }, graceS: 0 } });
    const s = emptyRoad(tuning);
    s.score.meter = T.meter.capacity;
    step(s, 0, tuning);
    expect(s.mode.activeTicksLeft).toBe(2);
    step(s, 0, tuning);
    expect(s.mode.activeTicksLeft).toBe(1);
    step(s, 0, tuning);
    expect(s.mode.kind).toBe(ModeKind.none);
    expect(readEvents(s.events).filter((e) => e.kind === 'modeEnded')).toEqual([
      { kind: 'modeEnded', mode: 'liftoff', graceTicks: 0 },
    ]);
    expect(readEvents(s.events).some((e) => e.kind === 'modeGraceEnded')).toBe(false);
  });

  it('keeps full one-tick active and grace intervals after their creation', () => {
    const tuning = SimTuningSchema.parse({ ...T, modes: { ...T.modes, liftoff: { durationS: dt }, graceS: dt } });
    const s = emptyRoad(tuning);
    s.score.meter = T.meter.capacity;
    step(s, 0, tuning);
    expect([s.mode.activeTicksLeft, s.mode.graceTicksLeft]).toEqual([1, 0]);
    step(s, 0, tuning);
    expect([s.mode.activeTicksLeft, s.mode.graceTicksLeft]).toEqual([0, 1]);
    expect(readEvents(s.events)).toEqual([{ kind: 'modeEnded', mode: 'liftoff', graceTicks: 1 }]);
    step(s, 0, tuning);
    expect([s.mode.activeTicksLeft, s.mode.graceTicksLeft]).toEqual([0, 0]);
    expect(readEvents(s.events)).toEqual([{ kind: 'modeGraceEnded' }]);
  });

  it('does not advance a paused clock and creates a clean independent Retry run', () => {
    const a = emptyRoad();
    const b = emptyRoad();
    arm(a, 8);
    arm(b, 9);
    const before = stateHash(a);
    for (let i = 0; i < 5; i++) step(b, 0, T);
    expect(stateHash(a)).toBe(before);
    step(a, 0, T);
    expect(a.mode.activeTicksLeft).toBe(7);
    const retry = emptyRoad();
    expect(retry.mode).toEqual({ kind: ModeKind.none, activeTicksLeft: 0, graceTicksLeft: 0, smashChain: 0 });
    expect(retry.mode).not.toBe(a.mode);
  });
});

describe('protected AIR, speed and real road touchdowns', () => {
  it.each([0, 123])('preserves %i L under flight and BOOST, stacking mode speed with penalties', (air) => {
    const s = emptyRoad();
    arm(s, 3);
    s.player.airLiters = air;
    s.player.airborne = true;
    s.player.y = 10;
    s.player.jumpHeldS = T.fly.holdThresholdS;
    s.prevHeld = Action.jump;
    s.player.penaltyS = 1;
    s.player.penaltyFactor = T.speed.scrapePenalty;
    step(s, Action.jump | Action.boost, T);
    expect(s.player.flying).toBe(true);
    expect(s.player.boosting).toBe(true);
    expect(s.player.airLiters).toBe(air);
    expect(s.player.speedMps).toBe(
      T.speed.minMps * T.speed.boostMultiplier * (1 - T.speed.scrapePenalty) * T.speed.liftoffMultiplier,
    );
    expect(s.player.penaltyS).toBe(1 - dt);
    expect(s.prevHeld).toBe(Action.jump | Action.boost);
  });

  it('does not regenerate active AIR on the ground and resumes ordinary regeneration in grace', () => {
    const s = emptyRoad();
    arm(s, 1);
    s.player.airLiters = 100;
    step(s, 0, T);
    expect(s.player.airLiters).toBe(100);
    step(s, 0, T);
    expect(s.player.airLiters).toBe(100 + T.air.regenLps * dt);
  });

  it('held flight/BOOST at zero AIR stops on the first grace physics tick without resetting orientation', () => {
    const s = emptyRoad();
    arm(s, 1);
    s.player.airLiters = 0;
    s.player.airborne = s.player.flying = true;
    s.player.y = T.fly.maxAltitudeM;
    s.player.flipTurns = 0.3;
    s.player.flipping = true;
    s.prevHeld = Action.jump;
    step(s, Action.jump | Action.boost, T);
    expect(s.player.flying).toBe(true);
    const before = s.player.flipTurns;
    step(s, Action.jump | Action.boost, T);
    expect(s.player.airLiters).toBe(0);
    expect(s.player.flying).toBe(false);
    expect(s.player.boosting).toBe(false);
    expect(s.player.y).toBeLessThan(T.fly.maxAltitudeM);
    expect(s.player.flipTurns).toBeGreaterThan(before);
    expect(readEvents(s.events)).toContainEqual({ kind: 'flyStop', reason: 'airEmpty' });
  });

  it('resumes both ordinary flight and BOOST costs on the first grace tick with stored AIR', () => {
    const s = emptyRoad();
    arm(s, 1);
    Object.assign(s.player, { airLiters: 100, airborne: true, flying: true, y: 10 });
    s.prevHeld = Action.jump | Action.boost;
    step(s, Action.jump | Action.boost, T);
    expect(s.player.airLiters).toBe(100);
    step(s, Action.jump | Action.boost, T);
    expect(s.player.airLiters).toBe(100 - (T.fly.airCostLps + T.air.boostCostLps) * dt);
    expect(s.player.flying && s.player.boosting).toBe(true);
  });

  it.each([0, Action.slam])('still honors release/SLAM input %i while active without changing AIR', (input) => {
    const s = emptyRoad();
    arm(s, 2);
    Object.assign(s.player, { airLiters: 123, airborne: true, flying: true, y: 10 });
    s.prevHeld = Action.jump;
    step(s, input, T);
    expect(s.player.flying).toBe(false);
    expect(s.player.slamming).toBe(input === Action.slam);
    expect(s.player.airLiters).toBe(123);
    expect(readEvents(s.events)).toContainEqual({ kind: 'flyStop', reason: 'released' });
    if (input === Action.slam) expect(readEvents(s.events)).toContainEqual({ kind: 'slam' });
  });

  it.each(['active', 'grace'] as const)('grades a real %s road touchdown STUNT even without a trick', (phase) => {
    const s = emptyRoad();
    arm(s, phase === 'active' ? 2 : 0, phase === 'grace' ? 2 : 0);
    step(s, 0, T);
    expect(readEvents(s.events).some((e) => e.kind === 'landingGraded')).toBe(false);
    s.player.airborne = true;
    s.player.y = 0.001;
    s.player.vy = -10;
    step(s, 0, T);
    expect(readEvents(s.events)).toContainEqual({ kind: 'land', slam: false });
    expect(readEvents(s.events)).toContainEqual({ kind: 'landingGraded', grade: 'stunt', flips: 0 });
    expect(s.score.pot).toBe(T.score.stuntLanding);
    expect(s.status).toBe(SimStatus.running);
  });

  it('aligns a protected unsafe touchdown but gives no landing protection after grace', () => {
    for (const protectedLanding of [true, false]) {
      const s = emptyRoad();
      arm(s, 0, 1);
      s.player.airborne = true;
      s.player.y = protectedLanding ? 0.001 : 10;
      s.player.vy = -1;
      s.player.flipTurns = 0.5;
      s.player.flipsDone = 1;
      step(s, 0, T);
      if (protectedLanding) {
        expect(s.status).toBe(SimStatus.running);
        expect(s.player.flipTurns).toBe(0);
        expect(readEvents(s.events)).toContainEqual({ kind: 'landingGraded', grade: 'stunt', flips: 1 });
      } else {
        expect(s.mode.kind).toBe(ModeKind.none);
        expect(s.player.flipTurns).toBe(0.5);
        s.player.y = 0.001;
        step(s, 0, T);
        expect(s.status).toBe(SimStatus.crashed);
        expect(readEvents(s.events)).toContainEqual({ kind: 'crash', cause: 'landing' });
      }
    }
  });
});
