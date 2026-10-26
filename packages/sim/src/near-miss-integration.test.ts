import { ScoreReason, type SimTuning } from '@kometa/shared';
import { describe, expect, it } from 'vitest';
import { readEvents } from './events';
import { Action } from './input';
import { NearPass } from './near-miss';
import { createSimState, SimStatus, type SimState } from './state';
import { step } from './step';
import { DEFAULT_TUNING } from './tuning';

const T = DEFAULT_TUNING.sim;
function vehicleAt(type: number) {
  const vehicle = T.vehicles[type];
  if (!vehicle) throw new Error(`missing test vehicle ${type}`);
  return vehicle;
}
const V = vehicleAt(0);
const halfL = T.player.lengthM / 2;
const width = (T.player.widthM + V.widthM) / 2;
const exit = V.lengthM + halfL;
const fresh = () => {
  const s = createSimState(1, T);
  s.director.nextRowM = Infinity;
  return s;
};
function place(s: SimState, slot: number, lane = 2, rear = 0, type = 0) {
  s.traffic.active[slot] = 1;
  s.traffic.type[slot] = type;
  s.traffic.lane[slot] = lane;
  s.traffic.z[slot] = rear;
  s.traffic.speed[slot] = 0;
}
const nearEvents = (s: SimState) => readEvents(s.events).filter((e) => e.kind === 'nearMiss');

describe('near-miss producer integration (G23)', () => {
  it('a whole pass in one step has actual event/score, and disabled policy preserves physical state', () => {
    const tuning: SimTuning = { ...T, speed: { ...T.speed, minMps: 1200, maxMps: 1200 } };
    const enabled = fresh();
    const disabled = fresh();
    for (const s of [enabled, disabled]) {
      place(s, 0);
      s.player.x = width + 0.3;
      s.player.z = -halfL - 1;
    }
    step(enabled, 0, tuning);
    step(disabled, 0, { ...tuning, scoring: { ...tuning.scoring, nearMissEnabled: false } });
    expect(enabled.player).toEqual(disabled.player);
    expect(enabled.status).toBe(disabled.status);
    expect(nearEvents(enabled)).toEqual([{ kind: 'nearMiss', vehicleType: 0, slot: 0 }]);
    expect(nearEvents(disabled)).toEqual([]);
    expect(enabled.score.pot).toBe(50);
    expect(enabled.score.meter).toBe(10);
    expect(disabled.score.pot).toBe(0);
    expect(enabled.score.total).toBe(disabled.score.total);
  });

  it('default centre-lane driving does not satisfy the configured surface gap', () => {
    const s = fresh();
    place(s, 0, 3, 3);
    for (let t = 0; t < 30; t++) {
      step(s, 0, T);
      expect(nearEvents(s)).toEqual([]);
    }
    expect(s.score.pot).toBe(0);
  });

  it('CLEAR invalidates the exact completed candidate; it cannot double-score as NEAR MISS', () => {
    const s = fresh();
    place(s, 0, 2, -exit + 0.2);
    s.traffic.nearMiss[0] = NearPass.qualified;
    s.traffic.over[0] = 1;
    s.player.y = V.heightM + 3;
    step(s, 0, T);
    expect(readEvents(s.events)).toContainEqual({ kind: 'clear', vehicleType: 0, semi: false });
    expect(nearEvents(s)).toEqual([]);
    expect(s.score.pot).toBe(300);
  });

  it.each(['sedan', 'bus'])('a %s roof contact yields only its existing HOP/ride score', (id) => {
    const s = fresh();
    const type = T.vehicles.findIndex((v) => v.id === id);
    const vehicle = vehicleAt(type);
    place(s, 0, 2, -1, type);
    s.traffic.nearMiss[0] = NearPass.qualified;
    Object.assign(s.player, { y: vehicle.heightM + 0.05, vy: -5, airborne: true });
    step(s, 0, T);
    expect(nearEvents(s)).toEqual([]);
    expect(readEvents(s.events).some((e) => e.kind === (id === 'sedan' ? 'hop' : 'rideStart'))).toBe(true);
    expect(s.score.pot).toBe(id === 'sedan' ? 150 : 0);
    expect(s.traffic.nearMiss[0]).toBe(NearPass.disqualified);
  });

  it('jumping from a platform excludes the starting ride slot after current ride is cleared', () => {
    const s = fresh();
    const type = T.vehicles.findIndex((v) => v.id === 'bus');
    place(s, 0, 2, -1, type);
    s.traffic.nearMiss[0] = NearPass.qualified;
    Object.assign(s.player, { y: vehicleAt(type).heightM, rideSlot: 0 });
    step(s, Action.jump, T);
    expect(s.player.rideSlot).toBe(-1);
    expect(s.traffic.nearMiss[0]).toBe(NearPass.disqualified);
    expect(nearEvents(s)).toEqual([]);
  });

  it('road touchdown does not invalidate an unrelated low-air side pass', () => {
    const s = fresh();
    place(s, 0, 2, -exit + 0.2);
    s.traffic.nearMiss[0] = NearPass.qualified;
    Object.assign(s.player, { x: width + 0.3, y: 0.001, vy: -1, airborne: true });
    step(s, 0, T);
    expect(readEvents(s.events)).toContainEqual({ kind: 'land', slam: false });
    expect(nearEvents(s)).toHaveLength(1);
  });

  it('late other-slot crash suppresses near misses already completed earlier that tick', () => {
    const s = fresh();
    place(s, 0, 2, -exit + 0.2);
    place(s, 1, 3, halfL + 0.1);
    s.traffic.nearMiss[0] = NearPass.qualified;
    s.player.x = width + 0.3;
    step(s, 0, T);
    expect(s.status).toBe(SimStatus.crashed);
    expect(nearEvents(s)).toEqual([]);
    expect(s.score.pot).toBe(0);
    expect(s.score.meter).toBe(0);
  });

  it('unrelated-slot scrape retains the completed near event, then loses its entire pot', () => {
    const s = fresh();
    place(s, 0, 1, -exit + 0.2);
    place(s, 1, 3, -1);
    s.traffic.nearMiss[0] = NearPass.qualified;
    Object.assign(s.player, { x: 1.3, laneStartX: 1.3, changing: true, laneTo: 3, laneT: 0 });
    step(s, 0, T);
    const events = readEvents(s.events);
    expect(events).toContainEqual({ kind: 'scrape' });
    expect(nearEvents(s)).toEqual([{ kind: 'nearMiss', vehicleType: 0, slot: 0 }]);
    expect(events.findIndex((e) => e.kind === 'scrape')).toBeLessThan(events.findIndex((e) => e.kind === 'nearMiss'));
    expect(events.at(-1)).toEqual({ kind: 'streakSettled', banked: 0, lost: 50 });
    expect(s.score.pot).toBe(0);
    expect(s.score.meter).toBe(10);
  });

  it('finalizes multiple slots in ascending order with multiplier, cap and milestone', () => {
    const s = fresh();
    s.player.x = width + 0.3;
    for (const i of [3, 1, 2]) {
      place(s, i, 2, -exit + 0.2);
      s.traffic.nearMiss[i] = NearPass.qualified;
    }
    Object.assign(s.score, { streakN: 28, streakTicksLeft: 1, pot: 100 });
    step(s, 0, T);
    expect(nearEvents(s).map((e) => e.slot)).toEqual([1, 2, 3]);
    expect(s.score.pot).toBe(1300); // all three events are at the ×8 cap
    expect(s.score.streakN).toBe(31);
    expect(s.score.streakTicksLeft).toBe(150);
    expect(readEvents(s.events)).toContainEqual({ kind: 'streakMilestone', count: 30 });
    expect(readEvents(s.events)).toContainEqual({
      kind: 'scoreAddedToPot',
      reason: ScoreReason.nearMiss,
      points: 1200,
    });
  });

  it('origin shifts preserve a pending pass without absolute-z history', () => {
    const s = fresh();
    s.player.z = T.world.originShiftM - 0.2;
    s.player.distanceM = s.player.z;
    s.player.x = width + 0.3;
    place(s, 0, 2, s.player.z - 1);
    s.traffic.nearMiss[0] = NearPass.qualified;
    step(s, 0, T);
    expect(readEvents(s.events).some((e) => e.kind === 'originShift')).toBe(true);
    expect(nearEvents(s)).toEqual([]);
    let count = 0;
    for (let i = 0; i < 20; i++) {
      step(s, 0, T);
      count += nearEvents(s).length;
    }
    expect(count).toBe(1);
    expect(s.traffic.nearMiss[0]).toBe(NearPass.awarded);
  });

  it('excludes current cones and barriers (top:none) from motor near misses', () => {
    for (let type = 0; type < T.vehicles.length; type++) {
      const vehicle = vehicleAt(type);
      if (vehicle.top !== 'none') continue;
      const s = fresh();
      place(s, 0, 0, -vehicle.lengthM - halfL + 0.2, type);
      s.traffic.nearMiss[0] = NearPass.qualified;
      step(s, 0, T);
      expect(nearEvents(s)).toEqual([]);
    }
  });
});
