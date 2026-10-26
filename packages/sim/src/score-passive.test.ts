import { ScoreReason, SimEventKind, type SimTuning } from '@kometa/shared';
import { describe, expect, it } from 'vitest';
import { emit, readEvents } from './events';
import { Action } from './input';
import { scoreTick } from './score';
import { createSimState, type SimState } from './state';
import { step } from './step';
import { DEFAULT_TUNING } from './tuning';

const T = DEFAULT_TUNING.sim;
const fresh = () => createSimState(28, T);
const tick = (s: SimState, tuning: SimTuning = T, distanceM = 0, platformTravelM = 0) => {
  s.events.count = 0;
  scoreTick(s, tuning, s.player.rideSlot, distanceM, platformTravelM);
};
const platform = (s: SimState) => {
  s.player.rideSlot = 0;
  s.traffic.active[0] = 1;
  s.traffic.type[0] = T.vehicles.findIndex((v) => v.top === 'platform');
};

describe('passive score intervals', () => {
  it('BOOST pulses at15/30 actual ticks and never starts a series', () => {
    const s = fresh();
    s.player.boosting = true;
    for (let i = 0; i < 14; i++) tick(s);
    expect(s.score.total).toBe(0);
    expect(s.score.boostTicks).toBe(14);
    tick(s);
    expect(s.score.total).toBe(10);
    expect(s.score.boostTicks).toBe(0);
    expect(readEvents(s.events)).toEqual([{ kind: 'scoreAddedDirect', reason: ScoreReason.boost, points: 10 }]);
    for (let i = 0; i < 15; i++) tick(s);
    expect(s.score.total).toBe(20);
    expect(s.score.meter).toBe(2);
    expect(s.score.streakN).toBe(0);
  });

  it('discards incomplete boost intervals on stop and uses ceil for non-integral durations', () => {
    const s = fresh();
    s.player.boosting = true;
    for (let i = 0; i < 14; i++) tick(s);
    s.player.boosting = false;
    tick(s);
    expect(s.score.boostTicks).toBe(0);
    s.player.boosting = true;
    tick(s);
    expect(s.score.total).toBe(0);
    expect(s.score.boostTicks).toBe(1);
    const altered = { ...T, scoring: { ...T.scoring, boostIntervalS: 0.251 } };
    for (let i = 0; i < 14; i++) tick(s, altered);
    expect(s.score.total).toBe(0);
    tick(s, altered);
    expect(s.score.total).toBe(10);
  });

  it('follows actual AIR exhaustion, not a held boost input', () => {
    const s = fresh();
    s.player.airLiters = T.air.boostCostLps / T.tickRateHz / 2;
    s.score.boostTicks = 14;
    step(s, Action.boost, T);
    expect(s.player.boosting).toBe(false);
    expect(s.score.boostTicks).toBe(0);
    expect(s.score.total).toBe(s.player.distanceM);
    expect(readEvents(s.events).some((e) => e.kind === 'scoreAddedDirect')).toBe(false);
  });

  it.each(['total', 'activePot'] as const)(
    'BOOST target %s uses the current multiplier without extending expiry',
    (target) => {
      const s = fresh();
      Object.assign(s.score, { pot: 100, streakN: 2, streakTicksLeft: 1, boostTicks: 14 });
      s.player.boosting = true;
      tick(s, { ...T, scoring: { ...T.scoring, boostTarget: target } });
      expect(s.score.total).toBe(target === 'total' ? 110 : 112.5);
      expect(s.score.streakN).toBe(0);
      expect(s.score.pot).toBe(0);
      const noStreak = fresh();
      noStreak.player.boosting = true;
      noStreak.score.boostTicks = 14;
      tick(noStreak, { ...T, scoring: { ...T.scoring, boostTarget: target } });
      expect(noStreak.score.total).toBe(10);
      expect(noStreak.score.streakN).toBe(0);
    },
  );

  it('direct boost survives a simultaneous crash, active-pot boost is lost', () => {
    for (const target of ['total', 'activePot'] as const) {
      const s = fresh();
      Object.assign(s.score, { total: 5, pot: 100, streakN: 2, streakTicksLeft: 1, boostTicks: 14 });
      s.player.boosting = true;
      emit(s.events, SimEventKind.crash, 1);
      scoreTick(s, { ...T, scoring: { ...T.scoring, boostTarget: target } }, -1, 0, 0);
      expect(s.score.total).toBe(target === 'total' ? 15 : 5);
      expect(s.score.pot).toBe(0);
      expect(s.score.streakN).toBe(0);
    }
  });

  it('pulses roofs at10m, retaining fractional remainder and batching multiple intervals', () => {
    const s = fresh();
    platform(s);
    tick(s, T, 9.75);
    expect(s.score.total).toBe(0);
    tick(s, T, 0.25);
    expect(s.score.total).toBe(20);
    expect(s.score.roofDistanceM).toBe(0);
    tick(s, T, 25.5);
    expect(s.score.total).toBe(60);
    expect(s.score.roofDistanceM).toBe(5.5);
    expect(s.score.meter).toBe(15);
    expect(s.score.streakN).toBe(0);
    expect(readEvents(s.events)).toEqual([{ kind: 'scoreAddedDirect', reason: ScoreReason.roofRide, points: 40 }]);
  });

  it.each(['total', 'activePot'] as const)(
    'ROOF target %s refreshes existing N at expiry but never creates a series',
    (target) => {
      const s = fresh();
      platform(s);
      Object.assign(s.score, { pot: 100, streakN: 2, streakTicksLeft: 1 });
      tick(s, { ...T, scoring: { ...T.scoring, roofRideTarget: target } }, 10);
      expect(s.score.total).toBe(target === 'total' ? 20 : 0);
      expect(s.score.pot).toBe(target === 'total' ? 100 : 125);
      expect(s.score.streakN).toBe(2);
      expect(s.score.streakTicksLeft).toBe(150);
      s.score.streakTicksLeft = 1;
      tick(s, T, 9);
      expect(s.score.streakN).toBe(0);
      expect(s.score.total).toBe(target === 'total' ? 120 : 125);
      tick(s, T, 1);
      expect(s.score.streakN).toBe(0);
      expect(s.score.total).toBe(target === 'total' ? 140 : 145);
    },
  );

  it('accepts accumulated 100×0.1 m at the interval, but not missing1e-10m or zero travel', () => {
    const s = fresh();
    platform(s);
    for (let i = 0; i < 100; i++) tick(s, T, 0.1);
    expect(s.score.total).toBe(20);
    expect(s.score.roofDistanceM).toBe(0);
    const short = fresh();
    platform(short);
    tick(short, T, 10 - 1e-10);
    expect(short.score.total).toBe(0);
    tick(short, T, 0);
    expect(short.score.total).toBe(0);
    const zero = fresh();
    platform(zero);
    tick(zero, T, 0);
    expect(zero.score.total).toBe(0);
  });

  it('distinguishes world from relative platform distance and never accumulates backward travel', () => {
    const relative: SimTuning = { ...T, scoring: { ...T.scoring, roofRideDistanceBasis: 'relative' } };
    const world = fresh();
    const rel = fresh();
    platform(world);
    platform(rel);
    tick(world, T, 10, 9);
    tick(rel, relative, 10, 9);
    expect(world.score.total).toBe(20);
    expect(rel.score.total).toBe(0);
    expect(rel.score.roofDistanceM).toBe(1);
    tick(rel, relative, 1, 5);
    expect(rel.score.roofDistanceM).toBe(1);
    tick(rel, relative, 10, 1);
    expect(rel.score.total).toBe(20);
  });

  it.each(['exit', 'change', 'inactive', 'notPlatform', 'sameSlotReturn'] as const)(
    'resets roof remainder on %s',
    (boundary) => {
      const s = fresh();
      platform(s);
      s.score.roofDistanceM = 9;
      if (boundary === 'exit') s.player.rideSlot = -1;
      if (boundary === 'change') s.player.rideSlot = 1;
      if (boundary === 'inactive') s.traffic.active[0] = 0;
      if (boundary === 'notPlatform') s.traffic.type[0] = T.vehicles.findIndex((v) => v.top === 'hop');
      if (boundary === 'sameSlotReturn') {
        emit(s.events, SimEventKind.rideEnd, 3);
        emit(s.events, SimEventKind.rideStart, 0);
      }
      scoreTick(s, T, 0, 10, 0);
      expect(s.score.roofDistanceM).toBe(0);
      expect(s.score.total).toBe(0);
    },
  );

  it('awards physics then boost then roof, preserving current multiplier and final loss priority', () => {
    const s = fresh();
    platform(s);
    Object.assign(s.score, { pot: 100, streakN: 1, streakTicksLeft: 1, boostTicks: 14 });
    s.player.boosting = true;
    emit(s.events, SimEventKind.hop, 1, 0);
    const tuning: SimTuning = { ...T, scoring: { ...T.scoring, boostTarget: 'activePot' } };
    scoreTick(s, tuning, 0, 10, 0);
    expect(s.score.pot).toBe(100 + 187.5 + 12.5 + 25);
    expect(s.score.streakN).toBe(2);
    expect(s.score.meter).toBe(46);
  });
});
