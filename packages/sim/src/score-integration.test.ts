import { ScoreReason, type SimTuning } from '@kometa/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { readEvents } from './events';
import { stateHash } from './hash';
import { Action } from './input';
import { createRecorder, playReplay } from './replay';
import { createSimState, SimStatus, type SimState } from './state';
import { step } from './step';
import { DEFAULT_TUNING } from './tuning';

const T = DEFAULT_TUNING.sim;
const emptyRoad = () => {
  const s = createSimState(28, T);
  s.director.nextRowM = Infinity;
  return s;
};
const place = (s: SimState, slot: number, id: string, z: number) => {
  s.traffic.active[slot] = 1;
  s.traffic.type[slot] = T.vehicles.findIndex((v) => v.id === id);
  s.traffic.lane[slot] = s.player.lane;
  s.traffic.z[slot] = z;
  s.traffic.speed[slot] = 0;
};

describe('scoring through real simulation steps', () => {
  it('real jump/slam inputs bank112.5 then survive through a validated natural crash replay', () => {
    const s = createSimState(28, T);
    const recorder = createRecorder(28, T);
    let slams = 0;
    const banks: number[] = [];
    while (s.status === SimStatus.running && s.tick < 1000) {
      const held = s.tick === 3 || s.tick === 16 ? Action.jump : s.tick === 6 || s.tick === 19 ? Action.slam : 0;
      recorder.record(held);
      step(s, held, T);
      for (const event of readEvents(s.events)) {
        if (event.kind === 'land' && event.slam) slams++;
        if (event.kind === 'streakSettled') banks.push(event.banked);
      }
    }
    expect(slams).toBe(2);
    expect(banks).toEqual([112.5]);
    expect(s.tick).toBe(258);
    expect(s.score.total).toBeCloseTo(s.player.distanceM + 112.5, 10);
    expect(s.score.pot).toBe(0);
    const replay = recorder.finish(s);
    expect(replay.claimedScore).toBe(Math.floor(s.score.total));
    const result = playReplay(replay, T);
    expect(result.valid).toBe(true);
    expect(result.state.score).toEqual(s.score);
    expect(createSimState(29, T).score).toEqual({
      total: 0,
      pot: 0,
      streakN: 0,
      streakTicksLeft: 0,
      meter: 0,
      boostTicks: 0,
      roofDistanceM: 0,
    });
  });

  it.each(['flip', 'roll'] as const)('actual %s completion and safe touchdown feed a pending series', (trick) => {
    const s = emptyRoad();
    for (let tick = 0; tick < 60; tick++) {
      step(s, tick === 0 ? Action.jump : tick === 5 ? (trick === 'flip' ? Action.jump : Action.right) : 0, T);
    }
    expect(s.player.airborne).toBe(false);
    expect(s.score.pot).toBe(trick === 'flip' ? 510 : 270);
    expect(s.score.streakN).toBe(2);
    expect(s.score.total).toBe(s.player.distanceM);
  });

  it('fatal road SLAM cannot bank its late award or a previous pot', () => {
    const s = emptyRoad();
    Object.assign(s.player, { y: 0.1, vy: -10, airborne: true, slamming: true, flipsDone: 1, flipTurns: 0.5 });
    Object.assign(s.score, { total: 25.75, pot: 100, streakN: 1, streakTicksLeft: 1 });
    step(s, 0, T);
    expect(s.status).toBe(SimStatus.crashed);
    expect(readEvents(s.events)).toContainEqual({ kind: 'land', slam: true });
    expect(readEvents(s.events)).toContainEqual({ kind: 'crash', cause: 'landing' });
    expect(readEvents(s.events)).toContainEqual({ kind: 'streakSettled', banked: 0, lost: 162.5 });
    expect(s.score.total).toBe(25.75 + s.player.distanceM);
    expect(s.score.streakN).toBe(0);
  });

  it('G10 platform slam and roof HOP use actual collision events exactly once', () => {
    for (const id of ['bus', 'sedan']) {
      const s = emptyRoad();
      place(s, 0, id, -1);
      const top = T.vehicles[s.traffic.type[0] ?? 0]?.heightM ?? 0;
      Object.assign(s.player, { y: top + 0.1, vy: T.slam.vyMps, airborne: true, slamming: true });
      step(s, 0, T);
      expect(s.status).toBe(SimStatus.running);
      expect(s.score.pot).toBe(id === 'bus' ? 50 : 212.5);
      expect(s.score.streakN).toBe(id === 'bus' ? 1 : 2);
      expect(s.score.roofDistanceM).toBe(0);
    }
  });

  it('keeps63 real CLEAR source events before a later-slot crash and loses their entire pot', () => {
    const s = emptyRoad();
    for (let i = 0; i < 63; i++) {
      place(s, i, 'sedan', -10);
      s.traffic.over[i] = s.player.touchSeq + 1;
    }
    place(s, 63, 'sedan', T.player.lengthM / 2 + 0.1);
    step(s, 0, T);
    const events = readEvents(s.events);
    expect(s.status).toBe(SimStatus.crashed);
    expect(events.slice(0, 63)).toEqual(
      Array.from({ length: 63 }, () => ({ kind: 'clear', vehicleType: 0, semi: false })),
    );
    expect(events[63]).toEqual({ kind: 'crash', cause: 'rear' });
    expect(events.filter((e) => e.kind === 'scoreAddedToPot')).toHaveLength(1);
    expect(events.at(-1)?.kind).toBe('streakSettled');
    expect(s.score.pot).toBe(0);
    expect(s.score.total).toBe(s.player.distanceM);
  });

  it.each(['world', 'relative'] as const)(
    'origin shifts preserve %s roof travel from actual moved positions',
    (basis) => {
      const tuning: SimTuning = { ...T, scoring: { ...T.scoring, roofRideDistanceBasis: basis } };
      const s = emptyRoad();
      s.player.z = T.world.originShiftM - 0.2;
      s.player.distanceM = s.player.z;
      place(s, 0, 'semi', s.player.z - 1);
      s.traffic.speed[0] = 10;
      s.player.rideSlot = 0;
      s.player.y = T.vehicles[s.traffic.type[0] ?? 0]?.heightM ?? 0;
      s.score.roofDistanceM = 9.5;
      const before = s.player.distanceM;
      step(s, 0, tuning);
      const travel = s.player.distanceM - before - (basis === 'relative' ? 10 / 60 : 0);
      expect(s.player.z).toBeLessThan(2);
      expect(s.score.roofDistanceM).toBeCloseTo(9.5 + travel - 10, 10);
      expect(readEvents(s.events)).toContainEqual({
        kind: 'scoreAddedDirect',
        reason: ScoreReason.roofRide,
        points: 20,
      });
    },
  );

  it('relative roof distance uses traffic follow-slowdown movement from this tick', () => {
    const tuning: SimTuning = { ...T, scoring: { ...T.scoring, roofRideDistanceBasis: 'relative' } };
    const s = emptyRoad();
    place(s, 0, 'semi', -3);
    const length = T.vehicles[s.traffic.type[0] ?? 0]?.lengthM ?? 0;
    place(s, 1, 'sedan', -3 + length + 3);
    s.traffic.speed[0] = 30;
    s.traffic.speed[1] = 5;
    s.player.rideSlot = 0;
    s.player.y = T.vehicles[s.traffic.type[0] ?? 0]?.heightM ?? 0;
    step(s, 0, tuning);
    expect(s.traffic.speed[0]).toBe(5);
    expect(s.score.roofDistanceM).toBeCloseTo(s.player.speedMps / 60 - 5 / 60, 12);
    expect(s.score.roofDistanceM).not.toBeCloseTo(s.player.speedMps / 60 - 30 / 60, 6);
  });

  it('hashes all seven scoring fields independently', () => {
    const s = emptyRoad();
    const original = stateHash(s);
    for (const field of [
      'total',
      'pot',
      'streakN',
      'streakTicksLeft',
      'meter',
      'boostTicks',
      'roofDistanceM',
    ] as const) {
      s.score[field] = 1;
      expect(stateHash(s)).not.toBe(original);
      s.score[field] = 0;
    }
  });

  it('interleaved fresh sessions cannot leak credit scratch, score stays finite and banked total never decreases', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 63 }), { minLength: 20, maxLength: 500 }), (inputs) => {
        const a = createSimState(28, T);
        const b = createSimState(28, T);
        const noise = createSimState(123, T);
        let previousTotal = 0;
        for (const held of inputs) {
          step(a, held, T);
          step(noise, held ^ Action.jump, T);
          step(b, held, T);
          expect(stateHash(a)).toBe(stateHash(b));
          expect(a.score).toEqual(b.score);
          expect(readEvents(a.events)).toEqual(readEvents(b.events));
          expect(Object.values(a.score).every(Number.isFinite)).toBe(true);
          expect(a.score.total).toBeGreaterThanOrEqual(previousTotal);
          expect(a.score.meter).toBeGreaterThanOrEqual(0);
          expect(a.score.meter).toBeLessThanOrEqual(T.meter.capacity);
          previousTotal = a.score.total;
        }
      }),
      { numRuns: 40 },
    );
  });
});
