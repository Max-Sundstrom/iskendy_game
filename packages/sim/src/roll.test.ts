import { SimEventKind, type SimTuning } from '@kometa/shared';
import { describe, expect, it } from 'vitest';
import { readEvents } from './events';
import { stateHash } from './hash';
import { Action } from './input';
import { advanceLaneChange, requestLaneChange } from './lateral';
import { laneCenterX } from './lanes';
import { crash, CrashCause } from './outcome';
import { createRecorder, playReplay } from './replay';
import { advanceRoll, requestRoll } from './roll';
import { createSimState, SimStatus, type PlayerState } from './state';
import { step } from './step';
import { DEFAULT_TUNING } from './tuning';

const T = DEFAULT_TUNING.sim;
const dt = 1 / T.tickRateHz;
const sky = () => {
  const s = createSimState(7, T);
  s.director.nextRowM = Infinity;
  s.player.airborne = true;
  s.player.y = T.fly.maxAltitudeM;
  return s;
};

describe('committed barrel roll (G20)', () => {
  it.each([-1, 1])('finishes direction %i on tick 27, never tick 26 or 28', (direction) => {
    const s = sky();
    step(s, direction < 0 ? Action.left : Action.right, T);
    expect(readEvents(s.events)).toContainEqual({ kind: 'rollStart', index: 1, direction });
    for (let tick = 2; tick <= 26; tick++) step(s, 0, T);
    expect(s.player.rolling).toBe(true);
    expect(s.player.rollTurns).toBeCloseTo((direction * 26) / 27, 12);
    step(s, 0, T);
    expect(s.player.rollTurns).toBe(direction);
    expect(s.player.rollTargetTurns).toBe(direction);
    expect(s.player.rolling).toBe(false);
    expect(s.player.rollsDone).toBe(1);
    expect(readEvents(s.events)).toContainEqual({ kind: 'rollDone', count: 1, direction });
    step(s, 0, T);
    expect(readEvents(s.events).some((e) => e.kind === 'rollDone')).toBe(false);
  });

  it('keeps the first pending direction and counts opposite rolls despite zero net rotation', () => {
    const s = sky();
    requestLaneChange(s, T, 1);
    advanceLaneChange(s, T, T.lanes.changeDurationS);
    requestLaneChange(s, T, -1);
    expect(s.player.rollQueuedDir).toBe(-1);
    advanceLaneChange(s, T, T.lanes.changeDurationS);
    requestLaneChange(s, T, 1); // third actual lane start still moves, but cannot replace the pending roll
    expect(s.player.laneTo).toBe(3);
    expect(s.player.rollQueuedDir).toBe(-1);
    expect(s.player.rollTargetTurns).toBe(1);
    s.events.count = 0;
    for (let i = 0; i < 27; i++) advanceRoll(s, T, dt);
    expect(s.player.rollTurns).toBe(1); // queued roll has not advanced on the completion tick
    expect(s.player.rollTargetTurns).toBe(0);
    expect(s.player.rollQueuedDir).toBe(0);
    expect(readEvents(s.events)).toEqual([
      { kind: 'rollDone', count: 1, direction: 1 },
      { kind: 'rollStart', index: 2, direction: -1 },
    ]);
    s.events.count = 0;
    for (let i = 0; i < 27; i++) advanceRoll(s, T, dt);
    expect(s.player.rollTurns).toBe(0);
    expect(s.player.rollsDone).toBe(2);
    expect(readEvents(s.events)).toEqual([{ kind: 'rollDone', count: 2, direction: -1 }]);
  });

  it('disabling the queue ignores further roll requests without cancelling lane motion', () => {
    const tuning: SimTuning = { ...T, tricks: { ...T.tricks, barrelRollQueuedInputs: 0 } };
    const s = sky();
    requestLaneChange(s, tuning, -1);
    advanceLaneChange(s, tuning, T.lanes.changeDurationS);
    requestLaneChange(s, tuning, 1);
    expect(s.player.changing).toBe(true);
    expect(s.player.rollQueuedDir).toBe(0);
    for (let i = 0; i < 27; i++) advanceRoll(s, tuning, dt);
    expect(s.player.rollTurns).toBe(-1);
    expect(s.player.rolling).toBe(false);
    expect(s.player.rollsDone).toBe(1);
  });

  it('merely queued lateral input waits for an actual airborne lane start', () => {
    const s = createSimState(7, T);
    requestLaneChange(s, T, 1); // ground lane change
    s.player.airborne = true;
    requestLaneChange(s, T, -1);
    expect(s.player.rolling).toBe(false);
    advanceLaneChange(s, T, T.lanes.changeDurationS);
    expect(s.player.rolling).toBe(true);
    expect(s.player.rollTargetTurns).toBe(-1);
    expect(readEvents(s.events).filter((e) => e.kind === 'rollStart')).toEqual([
      { kind: 'rollStart', index: 1, direction: -1 },
    ]);
  });

  it('same-direction chaining retains two full signed turns and two completed rolls', () => {
    const s = sky();
    requestLaneChange(s, T, 1);
    advanceLaneChange(s, T, T.lanes.changeDurationS);
    requestLaneChange(s, T, 1);
    for (let i = 0; i < 54; i++) advanceRoll(s, T, dt);
    expect(s.player.rollTurns).toBe(2);
    expect(s.player.rollsDone).toBe(2);
    expect(s.player.rolling).toBe(false);
  });

  it('queued lane changes that begin after landing or hit the edge cannot request a roll', () => {
    const landed = sky();
    requestLaneChange(landed, T, 1);
    requestLaneChange(landed, T, -1);
    landed.player.airborne = false; // touchdown occurred before this pending movement could start
    advanceLaneChange(landed, T, T.lanes.changeDurationS);
    expect(landed.player.rollQueuedDir).toBe(0);
    const edge = sky();
    edge.player.lane = 3;
    edge.player.x = laneCenterX(3, T);
    requestLaneChange(edge, T, 1);
    requestLaneChange(edge, T, 1);
    advanceLaneChange(edge, T, T.lanes.changeDurationS);
    expect(edge.player.rollQueuedDir).toBe(0);
    expect(readEvents(edge.events).filter((e) => e.kind === 'rollStart')).toHaveLength(1);
    expect(readEvents(edge.events)).toContainEqual({ kind: 'laneBump', direction: 1 });
  });

  it('ground, simultaneous ground jump+lane, both directions and an edge bump never start rolls', () => {
    for (const held of [Action.right, Action.jump | Action.right]) {
      const s = createSimState(7, T);
      step(s, held, T);
      expect(s.player.rolling).toBe(false);
    }
    const both = sky();
    step(both, Action.left | Action.right, T);
    expect(both.player.rolling).toBe(false);
    const edge = sky();
    edge.player.lane = 0;
    edge.player.x = laneCenterX(0, T);
    step(edge, Action.left, T);
    expect(edge.player.rolling).toBe(false);
    expect(readEvents(edge.events)).toContainEqual({ kind: 'laneBump', direction: -1 });
  });

  it('scrape auto-return creates no extra roll or pending request', () => {
    const s = sky();
    s.player.y = 0.7;
    s.player.vy = 4;
    s.traffic.active[0] = 1;
    s.traffic.type[0] = T.vehicles.findIndex((v) => v.id === 'van');
    s.traffic.lane[0] = 3;
    s.traffic.z[0] = -2;
    s.traffic.speed[0] = T.speed.minMps;
    const seen = [];
    for (let i = 0; i < 8; i++) {
      step(s, i === 0 ? Action.right : 0, T);
      seen.push(...readEvents(s.events));
      if (seen.some((e) => e.kind === 'scrape')) break;
    }
    expect(seen.some((e) => e.kind === 'scrape')).toBe(true);
    expect(seen.filter((e) => e.kind === 'rollStart')).toHaveLength(1);
    expect(s.player.laneTo).toBe(2);
    expect(s.player.rollTargetTurns).toBe(1);
    expect(s.player.rollQueuedDir).toBe(0);
  });

  it('held lane input starts once; release and re-press can queue the next roll', () => {
    const s = sky();
    const seen = [];
    for (let i = 0; i < 12; i++) {
      step(s, Action.right, T);
      seen.push(...readEvents(s.events));
    }
    expect(seen.filter((e) => e.kind === 'rollStart')).toHaveLength(1);
    expect(s.player.rollQueuedDir).toBe(0);
    step(s, 0, T);
    step(s, Action.left, T);
    expect(s.player.rollQueuedDir).toBe(-1);
  });
});

describe('barrel state lifecycle and replay', () => {
  it.each(['rollTurns', 'rollTargetTurns', 'rolling', 'rollQueuedDir', 'rollsDone'] as const)(
    'hashes %s independently',
    (key) => {
      const s = sky();
      const before = stateHash(s);
      const change: Pick<PlayerState, typeof key> = {
        rollTurns: 0.25,
        rollTargetTurns: -1,
        rolling: true,
        rollQueuedDir: -1,
        rollsDone: 2,
      };
      Object.assign(s.player, { [key]: change[key] });
      expect(stateHash(s)).not.toBe(before);
    },
  );

  it('a collision cancels active/queued tricks without erasing the terminal pose; retry is fresh', () => {
    const s = sky();
    Object.assign(s.player, {
      flipTurns: 1.4,
      flipsDone: 1,
      flipping: true,
      flipQueued: true,
      rollTurns: -1.2,
      rollTargetTurns: -2,
      rollsDone: 1,
      rolling: true,
      rollQueuedDir: 1,
    });
    crash(s, CrashCause.rear);
    expect(s.player).toMatchObject({
      flipTurns: 1.4,
      flipsDone: 1,
      flipping: false,
      flipQueued: false,
      rollTurns: -1.2,
      rollTargetTurns: -2,
      rollsDone: 1,
      rolling: false,
      rollQueuedDir: 0,
    });
    const frozen = stateHash(s);
    step(s, Action.jump | Action.left, T);
    expect(stateHash(s)).toBe(frozen);
    const retry = createSimState(s.seed, T);
    expect(retry.player).toMatchObject({
      rollTurns: 0,
      rollTargetTurns: 0,
      rolling: false,
      rollQueuedDir: 0,
      rollsDone: 0,
    });
  });

  it('records real jump/lane inputs and replays a full roll to the same hash', () => {
    const s = createSimState(7, T);
    const rec = createRecorder(7, T);
    const seen = [];
    for (let i = 0; i < 55 && s.status === SimStatus.running; i++) {
      const held = i === 0 ? Action.jump : i === 3 ? Action.right : 0;
      rec.record(held);
      step(s, held, T);
      seen.push(...readEvents(s.events));
    }
    expect(seen).toContainEqual({ kind: 'rollDone', count: 1, direction: 1 });
    expect(seen).toContainEqual({ kind: 'landingGraded', grade: 'perfect', flips: 0 });
    expect(playReplay(JSON.parse(JSON.stringify(rec.finish(s))), T).valid).toBe(true);
  });

  it('event numbers append without changing existing wire kinds', () => {
    expect(SimEventKind.landingGraded).toBe(19);
    expect(SimEventKind.rollStart).toBe(20);
    expect(SimEventKind.rollDone).toBe(21);
    const s = sky();
    requestRoll(s, T, -1);
    expect(s.events.a[0]).toBe(1);
    expect(s.events.b[0]).toBe(-1);
  });
});
