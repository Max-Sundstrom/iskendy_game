import { parseReplay } from '@kometa/shared';
import { DEFAULT_TUNING, playReplay, SimStatus } from '@kometa/sim';
import { describe, expect, it } from 'vitest';
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
});
