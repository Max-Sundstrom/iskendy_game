import { parseReplay, ScoreReason } from '@kometa/shared';
import { describe, expect, it } from 'vitest';
import { readEvents } from './events';
import { Action } from './input';
import { createRecorder, playReplay } from './replay';
import { createSimState, SimStatus } from './state';
import { step } from './step';
import { DEFAULT_TUNING } from './tuning';

const T = DEFAULT_TUNING.sim;

describe('G23 actual-input close pass and Retry', () => {
  it('one late lane input completes a pass, banks50 after150 ticks and reproduces the natural crash', () => {
    const s = createSimState(1, T);
    const disabled = createSimState(1, T);
    const off = { ...T, scoring: { ...T.scoring, nearMissEnabled: false } };
    const recorder = createRecorder(1, T);
    const nearTicks: number[] = [];
    const credits: number[] = [];
    const settlements: { tick: number; banked: number; lost: number }[] = [];
    while (s.status === SimStatus.running && s.tick < 600) {
      const held = s.tick === 350 ? Action.right : 0;
      recorder.record(held);
      step(s, held, T);
      step(disabled, held, off);
      expect(s.player).toEqual(disabled.player);
      expect(s.status).toBe(disabled.status);
      for (const event of readEvents(s.events)) {
        if (event.kind === 'nearMiss') {
          nearTicks.push(s.tick);
          expect(event).toEqual({ kind: 'nearMiss', vehicleType: 3, slot: 0 });
          expect(s.score).toMatchObject({ pot: 50, meter: 10, streakN: 1, streakTicksLeft: 150 });
        }
        if (event.kind === 'scoreAddedToPot') {
          expect(event.reason).toBe(ScoreReason.nearMiss);
          credits.push(event.points);
        }
        if (event.kind === 'streakSettled') settlements.push({ tick: s.tick, banked: event.banked, lost: event.lost });
      }
      if (s.tick === 501) expect(s.score).toMatchObject({ pot: 50, streakTicksLeft: 1 });
      expect(readEvents(disabled.events).some((event) => event.kind === 'nearMiss')).toBe(false);
    }
    expect(nearTicks).toEqual([352]);
    expect(credits).toEqual([50]);
    expect(settlements).toEqual([{ tick: 502, banked: 50, lost: 0 }]);
    expect(s.tick).toBe(509);
    expect(readEvents(s.events)).toContainEqual({ kind: 'crash', cause: 'rear' });
    expect(readEvents(disabled.events)).toContainEqual({ kind: 'crash', cause: 'rear' });
    expect(s.score.total).toBeCloseTo(s.player.distanceM + 50, 10);
    expect(disabled.score.total).toBe(disabled.player.distanceM);
    const replay = recorder.finish(s);
    expect(replay.inputs).toEqual([
      [350, Action.right],
      [351, 0],
    ]);
    const result = playReplay(parseReplay(JSON.stringify(replay), { maxTicks: 600, maxDecompressedBytes: 4096 }), T);
    expect(result.valid).toBe(true);
    expect(result.state.score).toEqual(s.score);

    const retry = createSimState(2, T);
    expect(Array.from(retry.traffic.nearMiss)).toEqual(Array(64).fill(0));
    while (retry.status === SimStatus.running && retry.tick < 1500) {
      step(retry, 0, T);
      expect(readEvents(retry.events).some((event) => event.kind === 'nearMiss')).toBe(false);
    }
    expect(retry.status).toBe(SimStatus.crashed);
    expect(retry.score.total).toBe(retry.player.distanceM);
    expect(retry.score).toMatchObject({ pot: 0, meter: 0, streakN: 0, streakTicksLeft: 0 });
  });
});
