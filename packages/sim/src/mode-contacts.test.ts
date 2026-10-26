import { ModeKind, ScoreReason, SimEventKind, SimTuningSchema } from '@kometa/shared';
import { describe, expect, it } from 'vitest';
import { resolveCollisions } from './collisions';
import { runDirector } from './director';
import { createEventBuffer, emit, readEvents } from './events';
import { Action } from './input';
import { resolveModeContacts } from './mode-contacts';
import { arm, emptyRoad, obstacle, T } from './mode-test-helpers';
import { finishNearMisses, NearPass, prepareNearMisses } from './near-miss';
import { scoreTick } from './score';
import { SimStatus } from './state';
import { step } from './step';
import { TRAFFIC_CAPACITY } from './traffic';

describe('protected real contacts and support destruction', () => {
  it.each(['sedan', 'bus', 'cones', 'barrier'])('smashes an actual %s contact once with no roof award', (id) => {
    const s = emptyRoad();
    arm(s, 5);
    const type = obstacle(s, 0, id);
    step(s, 0, T);
    expect(s.status).toBe(SimStatus.running);
    expect(s.traffic.active[0]).toBe(0);
    expect(readEvents(s.events)).toContainEqual({ kind: 'smash', vehicleType: type, chain: 1 });
    expect(s.score.pot).toBe(T.score.smashBase);
    expect(s.score.meter).toBe(0);
    expect(readEvents(s.events).some((e) => ['hop', 'land', 'clear', 'nearMiss', 'rideStart'].includes(e.kind))).toBe(
      false,
    );
    step(s, 0, T);
    expect(s.mode.smashChain).toBe(1);
    expect(readEvents(s.events).some((e) => e.kind === 'smash')).toBe(false);
  });

  it.each([false, true])('destroys the old platform and preserves an already launched jump=%s', (jump) => {
    const s = emptyRoad();
    arm(s, 3);
    const type = obstacle(s, 0, 'bus', -2);
    s.player.rideSlot = 0;
    s.player.y = T.vehicles[type]?.heightM ?? 0;
    s.score.roofDistanceM = T.scoring.roofRideIntervalM - 0.01;
    step(s, jump ? Action.jump : 0, T);
    expect(s.traffic.active[0]).toBe(0);
    expect(s.player.rideSlot).toBe(-1);
    expect(s.player.airborne).toBe(true);
    expect(s.player.coyoteS).toBe(0);
    if (jump) expect(s.player.vy).toBeGreaterThan(0);
    else expect(s.player.vy).toBe(0);
    const events = readEvents(s.events);
    expect(events).toContainEqual({ kind: 'rideEnd', reason: jump ? 'jumped' : 'gone' });
    expect(events).toContainEqual({ kind: 'smash', vehicleType: type, chain: 1 });
    expect(
      events.some((e) => ['hop', 'land', 'rideStart', 'clear', 'nearMiss', 'landingGraded'].includes(e.kind)),
    ).toBe(false);
    expect(s.score.roofDistanceM).toBe(0);
    expect(s.score.pot).toBe(T.score.smashBase);
  });

  it('grace detaches old support and crosses another roof without HOP, SLAM or new support', () => {
    const s = emptyRoad();
    arm(s, 0, 3);
    const type = obstacle(s, 0, 'bus', -2);
    s.player.rideSlot = 0;
    s.player.y = T.vehicles[type]?.heightM ?? 0;
    step(s, 0, T);
    expect(s.traffic.active[0]).toBe(1);
    expect(s.player.rideSlot).toBe(-1);
    expect(s.player.coyoteS).toBe(0);
    expect(s.score.streakN).toBe(0);
    s.player.y += 0.01;
    s.player.vy = -20;
    s.player.slamming = true;
    step(s, 0, T);
    expect(s.player.y).toBeLessThan(T.vehicles[type]?.heightM ?? 0);
    expect(s.traffic.active[0]).toBe(1);
    expect(s.player.rideSlot).toBe(-1);
    expect(s.score.streakN).toBe(0);
    expect(readEvents(s.events)).toEqual([]);
  });

  it('invalidates a same-tick exact-face NEAR completion before its producer can award', () => {
    for (const active of [true, false]) {
      const s = emptyRoad();
      arm(s, active ? 2 : 0, active ? 0 : 2);
      const type = obstacle(s, 0);
      const v = T.vehicles[type];
      if (!v) throw new Error('fixture vehicle missing');
      const start = { x: (T.player.widthM + v.widthM) / 2, y: 0, z: -T.player.lengthM / 2 - 1 };
      Object.assign(s.player, { x: start.x, y: 0, z: v.lengthM + T.player.lengthM / 2 + 1 });
      s.traffic.over[0] = s.player.touchSeq + 1;
      prepareNearMisses(s, T, start, -1, 0);
      expect(s.traffic.nearMiss[0]).toBe(NearPass.qualified);
      resolveCollisions(s, T, start, 0);
      finishNearMisses(s, T);
      expect(readEvents(s.events).some((e) => e.kind === 'nearMiss' || e.kind === 'clear')).toBe(false);
      expect(s.traffic.over[0]).toBe(0);
      expect(s.traffic.active[0]).toBe(active ? 0 : 1);
    }
  });

  it('retains an unrelated contact-free CLEAR in producer order alongside SMASH', () => {
    const s = emptyRoad();
    arm(s, 2);
    const semi = obstacle(s, 0, 'semi');
    const sedan = obstacle(s, 1);
    const v = T.vehicles[sedan];
    if (!v) throw new Error('fixture vehicle missing');
    const start = { x: 0, y: v.heightM + 0.1, z: -T.player.lengthM / 2 - 1 };
    Object.assign(s.player, { ...start, z: v.lengthM + T.player.lengthM / 2 + 1, airborne: true });
    resolveModeContacts(s, T, start, 0);
    expect(readEvents(s.events)).toEqual([
      { kind: 'smash', vehicleType: semi, chain: 1 },
      { kind: 'clear', vehicleType: sedan, semi: false },
    ]);
    scoreTick(s, T, -1, 0, 0);
    expect(s.score.pot).toBe(T.score.smashBase + T.score.clear * 1.25);
    expect(s.score.meter).toBe(T.meterGain.clear);
  });
});

describe('finite endpoint cleanup and slot lifetime', () => {
  it.each(['left', 'right', 'roof', 'bottom', 'rear', 'front'])(
    'retires exact %s face on final grace without reward',
    (face) => {
      const s = emptyRoad();
      arm(s, 0, 1);
      const type = obstacle(s, 0);
      const v = T.vehicles[type];
      if (!v) throw new Error('fixture vehicle missing');
      const halfW = (T.player.widthM + v.widthM) / 2;
      s.player.x = face === 'left' ? -halfW : face === 'right' ? halfW : 0;
      s.player.y = face === 'roof' ? v.heightM : face === 'bottom' ? -T.player.heightM : 0;
      s.player.z = face === 'rear' ? -T.player.lengthM / 2 : face === 'front' ? v.lengthM + T.player.lengthM / 2 : 0;
      s.traffic.over[0] = s.player.touchSeq + 1;
      s.traffic.nearMiss[0] = NearPass.qualified;
      resolveModeContacts(s, T, { ...s.player }, 0);
      expect(readEvents(s.events)).toEqual([{ kind: 'trafficPhasedOut', vehicleType: type }]);
      expect(s.traffic.active[0]).toBe(0);
      expect(s.traffic.over[0]).toBe(0);
      expect(s.traffic.nearMiss[0]).toBe(0);
      scoreTick(s, T, -1, 0, 0);
      expect(s.score.pot).toBe(0);
      expect(s.score.meter).toBe(0);
    },
  );

  it('leaves crossed-and-exited traffic alive, but no longer grants it contact rewards', () => {
    const s = emptyRoad();
    arm(s, 0, 1);
    const type = obstacle(s, 0);
    const v = T.vehicles[type];
    if (!v) throw new Error('fixture vehicle missing');
    const start = { x: 0, y: 0, z: -T.player.lengthM / 2 - 1 };
    s.player.z = v.lengthM + T.player.lengthM / 2 + 1;
    resolveModeContacts(s, T, start, 0);
    expect(s.traffic.active[0]).toBe(1);
    expect(readEvents(s.events)).toEqual([]);
  });

  it('uses traffic motion for a crossing whose two endpoint boxes are separated', () => {
    for (const active of [true, false]) {
      const s = emptyRoad();
      arm(s, active ? 2 : 0, active ? 0 : 1);
      const type = obstacle(s, 0, 'sedan', 10);
      s.traffic.speed[0] = 20; // rear was -10 at start, +10 at end of this isolated one-second sweep
      resolveModeContacts(s, T, { ...s.player }, 1);
      expect(s.traffic.active[0]).toBe(active ? 0 : 1);
      expect(readEvents(s.events)).toEqual(active ? [{ kind: 'smash', vehicleType: type, chain: 1 }] : []);
    }
  });

  it('gives last-active SMASH priority with zero grace, then leaves the next tick ordinary', () => {
    const tuning = SimTuningSchema.parse({ ...T, modes: { ...T.modes, graceS: 0 } });
    const s = emptyRoad(tuning);
    arm(s, 1);
    obstacle(s, 0);
    step(s, 0, tuning);
    expect(s.mode.kind).toBe(ModeKind.none);
    expect(s.mode.smashChain).toBe(1);
    expect(readEvents(s.events).some((e) => e.kind === 'trafficPhasedOut' || e.kind === 'modeGraceEnded')).toBe(false);
    obstacle(s, 0, 'sedan', s.player.z);
    s.score.meter = T.meter.capacity;
    step(s, 0, tuning);
    expect(s.status).toBe(SimStatus.crashed);
    expect(s.mode.kind).toBe(ModeKind.none);
  });

  it('cleans up before origin shift and gives a reused slot no lasting immunity', () => {
    const s = emptyRoad();
    arm(s, 0, 1);
    s.player.z = s.player.distanceM = T.world.originShiftM - 0.1;
    const type = obstacle(s, 0, 'sedan', s.player.z);
    step(s, 0, T);
    const events = readEvents(s.events);
    expect(events).toContainEqual({ kind: 'trafficPhasedOut', vehicleType: type });
    expect(events.at(-1)).toEqual({ kind: 'originShift', dz: -T.world.originShiftM });
    expect(s.player.z).toBeLessThan(2);
    expect(s.mode.kind).toBe(ModeKind.none);
    obstacle(s, 0, 'sedan', s.player.z);
    step(s, 0, T);
    expect(s.status).toBe(SimStatus.crashed);
  });

  it('initializes all tracking before reuse and retains destruction payload independently of the slot', () => {
    const s = emptyRoad();
    arm(s, 2);
    const type = obstacle(s, 0, 'bus');
    s.traffic.over[0] = 17;
    s.traffic.nearMiss[0] = NearPass.qualified;
    resolveModeContacts(s, T, { ...s.player }, 0);
    s.director.nextRowM = T.director.firstRowM;
    runDirector(s, T);
    expect(s.traffic.active[0]).toBe(1);
    expect(s.traffic.over[0]).toBe(0);
    expect(s.traffic.nearMiss[0]).toBe(0);
    s.traffic.type[0] = type === 0 ? 1 : 0;
    expect(readEvents(s.events)).toEqual([{ kind: 'smash', vehicleType: type, chain: 1 }]);
  });

  it('keeps every SMASH/chain milestone and score credit for all 64 slots at fireworksEvery=1', () => {
    const tuning = SimTuningSchema.parse({ ...T, streak: { ...T.streak, fireworksEvery: 1 } });
    const s = emptyRoad(tuning);
    arm(s, 3);
    for (let i = 0; i < TRAFFIC_CAPACITY; i++) obstacle(s, i);
    step(s, 0, tuning);
    const events = readEvents(s.events);
    expect(events.filter((e) => e.kind === 'smash')).toHaveLength(64);
    expect(events.filter((e) => e.kind === 'streakMilestone')).toHaveLength(64);
    expect(events.filter((e) => e.kind === 'scoreAddedToPot')).toEqual([
      { kind: 'scoreAddedToPot', reason: ScoreReason.smash, points: s.score.pot },
    ]);
    expect(s.events.count).toBe(129);
    expect(s.events.kind.length).toBe(1024);
    expect(s.mode.smashChain).toBe(64);
    expect(s.score.streakN).toBe(64);
    expect(s.score.meter).toBe(0);
    const buffer = createEventBuffer();
    for (let i = 0; i < buffer.kind.length; i++) emit(buffer, SimEventKind.smash, 0, i + 1);
    expect(() => emit(buffer, SimEventKind.smash)).toThrow(RangeError);
    expect(buffer.count).toBe(1024);
  });
});
