import { parseReplay } from '@kometa/shared';
import { Action, DEFAULT_TUNING, playReplay, SimStatus } from '@kometa/sim';
import { describe, expect, it, vi } from 'vitest';
import { createControls } from '../input/controls';
import { advance, createSession, lerp } from './session';

describe('session recording', () => {
  it('records a replay that reproduces the run, frames and all', () => {
    const s = createSession(28);
    let frame = 0;
    while (s.state.status === SimStatus.running && frame < 2000) {
      // Uneven frames (0–3 steps) and changing input, like a real device.
      advance(s, frame % 4, frame % 50 < 5 ? 2 : 0);
      frame++;
    }
    const replay = s.recorder.finish(s.state);
    const r = playReplay(parseReplay(JSON.stringify(replay), DEFAULT_TUNING.server.replay), DEFAULT_TUNING.sim);
    expect(r.valid).toBe(true);
  });

  it('keeps quick presses through zero-step frames and records each catch-up tick separately', () => {
    const session = createSession(5);
    const controls = createControls();
    controls.hold(Action.jump, true);
    controls.hold(Action.jump, false);
    advance(session, 0, controls.sample);
    expect(session.state.tick).toBe(0);
    advance(session, 1, controls.sample);
    expect(session.state.player.airborne).toBe(true);
    controls.hold(Action.jump, true);
    controls.hold(Action.jump, false);
    advance(session, 0, controls.sample);
    advance(session, 3, controls.sample);
    expect(session.state.player.flipping).toBe(true);
    expect(session.state.player.flipTurns).toBeGreaterThan(0);

    const replay = session.recorder.finish(session.state);
    expect(replay.inputs).toEqual([
      [0, Action.jump],
      [1, 0],
      [2, Action.jump],
      [3, 0],
    ]);
    const result = playReplay(parseReplay(JSON.stringify(replay), DEFAULT_TUNING.server.replay), DEFAULT_TUNING.sim);
    expect(result.valid).toBe(true);
    expect(result.state.player.flipping).toBe(true);
    expect(result.state.player.flipTurns).toBe(session.state.player.flipTurns);
  });

  it('does not sample unused ticks after a crash interrupts a catch-up frame', () => {
    const session = createSession(28);
    const sample = vi.fn(() => 0);
    advance(session, 1000, sample);
    expect(session.state.status).toBe(SimStatus.crashed);
    expect(session.state.tick).toBeLessThan(1000);
    expect(sample).toHaveBeenCalledTimes(session.state.tick);
  });
});

describe('trick snapshots', () => {
  it.each([-1, 1])('retains signed roll interpolation and replay direction %i', (direction) => {
    const s = createSession(5);
    advance(s, 1, Action.jump);
    advance(s, 1, direction < 0 ? Action.left : Action.right);
    expect(s.prev.roll).toBe(0);
    expect(s.state.player.rollTurns).toBeCloseTo(direction / 27);
    advance(s, 1, 0);
    expect(s.prev.roll).toBeCloseTo(direction / 27);
    expect(lerp(s.prev.roll, s.state.player.rollTurns, 0.5)).toBeCloseTo((direction * 1.5) / 27);
    const replay = s.recorder.finish(s.state);
    expect(playReplay(replay, s.tuning).valid).toBe(true);
  });

  it('does not wrap a completed positive roll when its queued negative roll begins', () => {
    const s = createSession(5);
    advance(s, 1, Action.jump);
    advance(s, 1, Action.right);
    advance(s, 11, 0);
    advance(s, 1, Action.left);
    advance(s, 14, 0);
    expect(s.state.player.rollsDone).toBe(1);
    expect(s.state.player.rollTurns).toBe(1);
    expect(s.prev.roll).toBeCloseTo(26 / 27);
    advance(s, 1, 0);
    expect(s.prev.roll).toBe(1);
    expect(s.state.player.rollTurns).toBeCloseTo(26 / 27);
    expect(lerp(s.prev.roll, s.state.player.rollTurns, 0.5)).toBeCloseTo(26.5 / 27);
  });

  it.each(['road', 'buffered', 'sedan', 'bus'])('does not interpolate across a safe %s touchdown', (surface) => {
    const s = createSession(5);
    const p = s.state.player;
    p.airborne = true;
    p.vy = -2;
    p.flipTurns = 0.04;
    p.rollTurns = -0.04;
    p.flipsDone = p.rollsDone = 1;
    p.y = 0.01;
    if (surface === 'buffered') p.jumpBufferS = 0.1;
    if (surface === 'sedan' || surface === 'bus') {
      const type = s.tuning.vehicles.findIndex((v) => v.id === surface);
      const vehicle = s.tuning.vehicles[type];
      if (!vehicle) throw new Error('missing test vehicle');
      s.state.traffic.active[0] = 1;
      s.state.traffic.type[0] = type;
      s.state.traffic.lane[0] = p.lane;
      s.state.traffic.z[0] = -2;
      s.state.traffic.speed[0] = vehicle.minMps;
      p.y += vehicle.heightM;
    }
    advance(s, 1, 0);
    expect(s.state.status).toBe(SimStatus.running);
    expect(p.touchSeq).toBe(1);
    expect(p.airborne).toBe(surface === 'sedan' || surface === 'buffered');
    expect([s.prev.flip, s.prev.roll, p.flipTurns, p.rollTurns]).toEqual([0, 0, 0, 0]);
    if (surface === 'sedan') expect(s.frameEvents).toContainEqual({ kind: 'hop', chain: 1, slam: false });
    if (surface === 'bus') expect(p.rideSlot).toBe(0);
  });

  it('interpolates new airborne work after a touchdown earlier in the same catch-up frame', () => {
    const s = createSession(5);
    Object.assign(s.state.player, {
      airborne: true,
      y: 0.01,
      vy: -2,
      flipTurns: 1,
      flipsDone: 1,
      rollTurns: -1,
      rollsDone: 1,
      jumpBufferS: 0.1,
    });
    let calls = 0;
    advance(s, 2, () => (calls++ === 0 ? 0 : Action.right));
    expect(s.state.player.touchSeq).toBe(1);
    expect(s.state.player.airborne).toBe(true);
    expect(s.prev.roll).toBe(0);
    expect(s.state.player.rollTurns).toBeCloseTo(1 / 27);
    expect(lerp(s.prev.roll, s.state.player.rollTurns, 0.5)).toBeCloseTo(0.5 / 27);
  });

  it('keeps both terminal crash angles and starts Retry with a fresh zero snapshot', () => {
    const s = createSession(5);
    Object.assign(s.state.player, {
      airborne: true,
      y: 0.01,
      vy: -2,
      flipTurns: 0.2,
      flipping: true,
      rollTurns: -0.25,
      rollTargetTurns: -1,
      rolling: true,
    });
    advance(s, 1, 0);
    expect(s.state.status).toBe(SimStatus.crashed);
    expect(s.prev.flip).toBe(0.2);
    expect(s.prev.roll).toBe(-0.25);
    expect(s.state.player.flipTurns).toBeGreaterThan(s.prev.flip);
    expect(s.state.player.rollTurns).toBeLessThan(s.prev.roll);
    const retry = createSession(6);
    expect([retry.prev.flip, retry.prev.roll, retry.state.player.flipTurns, retry.state.player.rollTurns]).toEqual([
      0, 0, 0, 0,
    ]);
  });
});
