import { parseReplay } from '@kometa/shared';
import { Action, DEFAULT_TUNING, playReplay, SimStatus } from '@kometa/sim';
import { describe, expect, it, vi } from 'vitest';
import { createControls } from '../input/controls';
import { advance, createSession } from './session';

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
