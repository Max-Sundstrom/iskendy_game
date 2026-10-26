import { describe, expect, it, vi } from 'vitest';
import { createCrashSequence } from './crash-sequence';

// J14 / P1: the run is recorded at impact; only visible presentation time delays the results screen.
describe('crash presentation sequence', () => {
  it('records once at impact even if the retained crash is observed on repeated frames', () => {
    const result = { score: 123, distanceM: 45, tick: 67 };
    const record = vi.fn(() => result);
    const crash = createCrashSequence(0.75, record);

    expect(crash.result()).toBeUndefined();
    expect(crash.advance(1, false, false)).toBe(false);
    expect(record).not.toHaveBeenCalled();
    expect(crash.begin()).toBe(true);
    expect(record).toHaveBeenCalledExactlyOnceWith();
    expect(crash.result()).toBe(result);

    for (let i = 0; i < 3; i++) {
      expect(crash.begin()).toBe(false);
      expect(crash.advance(0.25, false, false)).toBe(i === 2);
      expect(crash.result()).toBe(result);
    }
    expect(crash.begin()).toBe(false);
    expect(crash.advance(10, false, false)).toBe(false);
    expect(crash.frame.elapsedS).toBe(0.75);
    expect(crash.frame.deltaS).toBe(0);
    expect(record).toHaveBeenCalledExactlyOnceWith();
  });

  it('finishes at the visible deadline and clamps a frame that crosses it', () => {
    const crash = createCrashSequence(0.75, () => 'saved');
    crash.begin();
    expect(crash.advance(0.7, false, false)).toBe(false);
    expect(crash.frame.elapsedS).toBe(0.7);
    expect(crash.advance(0.1, false, false)).toBe(true);
    expect(crash.frame.elapsedS).toBe(0.75);
    expect(crash.frame.deltaS).toBeCloseTo(0.05, 10);
    expect(crash.advance(0, false, false)).toBe(false);
    expect(crash.frame.deltaS).toBe(0);
  });

  it('keeps effects and the results deadline paused while hidden, then resumes without catching up', () => {
    const crash = createCrashSequence(0.75, () => 'saved');
    crash.begin();
    crash.advance(0.25, false, false);
    expect(crash.frame.deltaS).toBe(0.25);

    for (const hiddenDeltaS of [0, 0.5, 300]) {
      expect(crash.advance(hiddenDeltaS, true, false)).toBe(false);
      expect(crash.frame.elapsedS).toBe(0.25);
      expect(crash.frame.deltaS).toBe(0);
      expect(crash.result()).toBe('saved');
    }
    expect(crash.advance(-1, false, false)).toBe(false);
    expect(crash.frame.elapsedS).toBe(0.25);
    expect(crash.frame.deltaS).toBe(0);
    expect(crash.advance(0.25, false, false)).toBe(false);
    expect(crash.advance(0.25, false, false)).toBe(true);
  });

  it('removes motion immediately and does not restart the impact when the preference is turned off', () => {
    const crash = createCrashSequence(0.75, () => 'saved');
    crash.begin();
    crash.advance(0.1, false, false);
    expect(crash.frame.reducedMotion).toBe(false);
    crash.advance(10, true, true);
    expect(crash.frame).toEqual({ elapsedS: 0.1, deltaS: 0, reducedMotion: true });
    crash.advance(0.1, false, false);
    expect(crash.frame.reducedMotion).toBe(true);
  });

  it('starts fresh after each of two retries, allowing exactly one result for each new run', () => {
    let recordedRuns = 0;
    const record = vi.fn(() => ({ run: ++recordedRuns }));
    const crash = createCrashSequence(0.75, record);

    for (let run = 1; run <= 3; run++) {
      expect(crash.result()).toBeUndefined();
      expect(crash.frame).toEqual({ elapsedS: 0, deltaS: 0, reducedMotion: false });
      expect(crash.begin()).toBe(true);
      expect(crash.begin()).toBe(false);
      expect(crash.result()).toEqual({ run });
      expect(crash.advance(0.75, false, true)).toBe(true);
      expect(crash.advance(0.75, false, false)).toBe(false);
      expect(record).toHaveBeenCalledTimes(run);
      if (run < 3) crash.reset();
    }
  });
});
