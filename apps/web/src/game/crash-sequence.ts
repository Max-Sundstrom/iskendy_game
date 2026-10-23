export type RunScreen = 'intro' | 'playing' | 'crashing' | 'results';
export type CrashFrame = Readonly<{ elapsedS: number; deltaS: number; reducedMotion: boolean }>;

export type CrashSequence<Result> = {
  readonly frame: CrashFrame;
  begin(): boolean;
  /** True only on the frame that completes the visible presentation interval. */
  advance(deltaS: number, hidden: boolean, reducedMotion: boolean): boolean;
  result(): Result | undefined;
  reset(): void;
};

/** Owns the one-shot result and visible crash clock; never steps or changes the simulation. */
export function createCrashSequence<Result>(durationS: number, record: () => Result): CrashSequence<Result> {
  const frame = { elapsedS: 0, deltaS: 0, reducedMotion: false };
  let phase: 'idle' | 'active' | 'done' = 'idle';
  let result: Result | undefined;
  return {
    frame,
    begin() {
      if (phase !== 'idle') return false;
      phase = 'active';
      result = record();
      return true;
    },
    advance(deltaS, hidden, reducedMotion) {
      frame.deltaS = 0;
      // Turning reduction on removes effects immediately; turning it off never replays this crash's impact.
      frame.reducedMotion ||= reducedMotion;
      if (phase !== 'active' || hidden) return false;
      frame.deltaS = Math.min(Math.max(0, deltaS), Math.max(0, durationS - frame.elapsedS));
      frame.elapsedS += frame.deltaS;
      if (frame.elapsedS + 1e-9 < durationS) return false;
      frame.elapsedS = durationS;
      phase = 'done';
      return true;
    },
    result: () => result,
    reset() {
      phase = 'idle';
      result = undefined;
      frame.elapsedS = 0;
      frame.deltaS = 0;
      frame.reducedMotion = false;
    },
  };
}
