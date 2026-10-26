import { SimTuningSchema, type SimTuning } from '@kometa/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  advanceModeClock,
  createModeClock,
  ModeClockTransition as Transition,
  resetModeClock,
  startLiftoffClock,
  type ModeClock,
} from './mode-clock';
import { DEFAULT_TUNING } from './tuning';

const T = DEFAULT_TUNING.sim;
const tuningFor = (durationS: number, graceS: number): SimTuning =>
  SimTuningSchema.parse({ ...T, modes: { ...T.modes, liftoff: { durationS }, graceS } });
const assertInvariants = (clock: ModeClock) => {
  expect(Number.isSafeInteger(clock.activeTicksLeft)).toBe(true);
  expect(Number.isSafeInteger(clock.graceTicksLeft)).toBe(true);
  expect(clock.activeTicksLeft).toBeGreaterThanOrEqual(0);
  expect(clock.graceTicksLeft).toBeGreaterThanOrEqual(0);
  expect(clock.activeTicksLeft === 0 || clock.graceTicksLeft === 0).toBe(true);
};

// P2-04a1 / GDD §10: timing foundation for G9, not collision/overlap or automatic-trigger behavior.
describe('internal LIFTOFF clock boundaries', () => {
  it('keeps all 300 active and 60 grace ticks and emits each boundary once', () => {
    expect(Transition).toEqual({ none: 0, activeEnded: 1, graceEnded: 2 });
    const clock = createModeClock();
    expect(startLiftoffClock(clock, T)).toBe(true);
    expect(clock).toEqual({ activeTicksLeft: 300, graceTicksLeft: 0 });
    for (let tick = 1; tick < 300; tick++) {
      expect(advanceModeClock(clock, T)).toBe(Transition.none);
      expect(clock).toEqual({ activeTicksLeft: 300 - tick, graceTicksLeft: 0 });
    }
    expect(advanceModeClock(clock, T)).toBe(Transition.activeEnded);
    expect(clock).toEqual({ activeTicksLeft: 0, graceTicksLeft: 60 });
    for (let tick = 1; tick < 60; tick++) {
      expect(advanceModeClock(clock, T)).toBe(Transition.none);
      expect(clock).toEqual({ activeTicksLeft: 0, graceTicksLeft: 60 - tick });
    }
    expect(advanceModeClock(clock, T)).toBe(Transition.graceEnded);
    for (let tick = 0; tick < 1000; tick++) expect(advanceModeClock(clock, T)).toBe(Transition.none);
    expect(clock).toEqual(createModeClock());
  });

  it('does not consume a one-tick grace interval on the last active tick', () => {
    const tuning = tuningFor(0.001, 0.001);
    const clock = createModeClock();
    startLiftoffClock(clock, tuning);
    expect(clock).toEqual({ activeTicksLeft: 1, graceTicksLeft: 0 });
    expect(advanceModeClock(clock, tuning)).toBe(Transition.activeEnded);
    expect(clock).toEqual({ activeTicksLeft: 0, graceTicksLeft: 1 });
    expect(advanceModeClock(clock, tuning)).toBe(Transition.graceEnded);
    expect(clock).toEqual(createModeClock());
    expect(advanceModeClock(clock, tuning)).toBe(Transition.none);
  });

  it('ends directly in idle with zero grace, without inventing a grace-ended transition', () => {
    const tuning = tuningFor(1 / 60, 0);
    const clock = createModeClock();
    startLiftoffClock(clock, tuning);
    expect(advanceModeClock(clock, tuning)).toBe(Transition.activeEnded);
    expect(clock).toEqual(createModeClock());
    expect(advanceModeClock(clock, tuning)).toBe(Transition.none);
    expect(startLiftoffClock(clock, tuning)).toBe(true);
    expect(clock.activeTicksLeft).toBe(1);
  });

  it('rounds fractional intervals up, without losing their final partial tick', () => {
    const tuning = tuningFor(0.017, 0.025);
    const clock = createModeClock();
    startLiftoffClock(clock, tuning);
    expect(clock.activeTicksLeft).toBe(2);
    expect(advanceModeClock(clock, tuning)).toBe(Transition.none);
    expect(advanceModeClock(clock, tuning)).toBe(Transition.activeEnded);
    expect(clock.graceTicksLeft).toBe(2);
    expect(advanceModeClock(clock, tuning)).toBe(Transition.none);
    expect(advanceModeClock(clock, tuning)).toBe(Transition.graceEnded);
  });

  it('rejects starts throughout active/grace without extending either interval', () => {
    const tuning = tuningFor(0.017, 0.025);
    const clock = createModeClock();
    startLiftoffClock(clock, tuning);
    for (let tick = 0; tick < 4; tick++) {
      const before = { ...clock };
      for (let attempt = 0; attempt < 5; attempt++) expect(startLiftoffClock(clock, T)).toBe(false);
      expect(clock).toEqual(before);
      advanceModeClock(clock, tuning);
    }
    expect(startLiftoffClock(clock, T)).toBe(true);
    expect(clock.activeTicksLeft).toBe(300);
  });

  it('resets an active or grace clock in place and recreates independent idle clocks', () => {
    const tuning = tuningFor(1 / 60, 1);
    for (const phase of ['active', 'grace'] as const) {
      const clock = createModeClock();
      const original = clock;
      startLiftoffClock(clock, tuning);
      if (phase === 'grace') advanceModeClock(clock, tuning);
      resetModeClock(clock);
      expect(clock).toBe(original);
      expect(clock).toEqual(createModeClock());
      expect(advanceModeClock(clock, tuning)).toBe(Transition.none);
      const other = createModeClock();
      expect(other).not.toBe(clock);
      startLiftoffClock(clock, T);
      expect(other).toEqual({ activeTicksLeft: 0, graceTicksLeft: 0 });
      expect(clock.activeTicksLeft).toBe(300);
    }
  });

  it('has no meter/automatic-trigger policy and never mutates supplied tuning', () => {
    const tuning = SimTuningSchema.parse({ ...T, meter: { capacity: 7, autoTrigger: false } });
    const before = structuredClone(tuning);
    const clock = createModeClock();
    expect(startLiftoffClock(clock, tuning)).toBe(true);
    for (let tick = 0; tick < 361; tick++) advanceModeClock(clock, tuning);
    expect(tuning).toEqual(before);
  });

  it.each([Number.MAX_VALUE, Number.MAX_SAFE_INTEGER])(
    'rejects schema-valid unrepresentable tick products atomically (%s seconds)',
    (seconds) => {
      const clock = createModeClock();
      const hugeActive = tuningFor(seconds, 0);
      expect(() => startLiftoffClock(clock, hugeActive)).toThrow(RangeError);
      expect(clock).toEqual(createModeClock());
      const hugeGrace = tuningFor(1 / 60, seconds);
      startLiftoffClock(clock, hugeGrace);
      expect(startLiftoffClock(clock, hugeActive)).toBe(false); // a rejected start does not read its duration
      expect(() => advanceModeClock(clock, hugeGrace)).toThrow(RangeError);
      expect(clock).toEqual({ activeTicksLeft: 1, graceTicksLeft: 0 });
      resetModeClock(clock);
      expect(startLiftoffClock(clock, T)).toBe(true);
    },
  );

  it('counts down large safe intervals exactly instead of imposing an arbitrary duration cap', () => {
    const tuning = tuningFor(2 ** 45, 0);
    const clock = createModeClock();
    startLiftoffClock(clock, tuning);
    const before = clock.activeTicksLeft;
    expect(advanceModeClock(clock, tuning)).toBe(Transition.none);
    expect(clock.activeTicksLeft).toBe(before - 1);
    expect(clock.activeTicksLeft).toBeLessThan(before);
    assertInvariants(clock);
  });
});

describe('reference timeline and independent clocks', () => {
  it('matches absolute phase endpoints for varied validated durations and preserves all interval ticks', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1024 }), fc.integer({ min: 0, max: 1024 }), (active, grace) => {
        // Binary-fraction seconds have exact products here. The oracle uses integer quotient/remainder,
        // not the implementation's floating ceil conversion or decrementing state machine.
        const tuning = tuningFor(active / 1024, grace / 1024);
        const activeTicks = Math.floor((active * 60 + 1023) / 1024);
        const graceTicks = Math.floor((grace * 60 + 1023) / 1024);
        const clock = createModeClock();
        startLiftoffClock(clock, tuning);
        let spentActive = 0;
        let spentGrace = 0;
        const transitions = [];
        for (let elapsed = 1; elapsed <= activeTicks + graceTicks + 3; elapsed++) {
          if (clock.activeTicksLeft > 0) spentActive++;
          if (clock.graceTicksLeft > 0) spentGrace++;
          const transition = advanceModeClock(clock, tuning);
          if (transition !== Transition.none) transitions.push({ elapsed, transition });
          expect(clock.activeTicksLeft).toBe(Math.max(0, activeTicks - elapsed));
          expect(clock.graceTicksLeft).toBe(
            elapsed < activeTicks ? 0 : Math.max(0, activeTicks + graceTicks - elapsed),
          );
          assertInvariants(clock);
        }
        expect(spentActive).toBe(activeTicks);
        expect(spentGrace).toBe(graceTicks);
        const expected: { elapsed: number; transition: Transition }[] = [
          { elapsed: activeTicks, transition: Transition.activeEnded },
        ];
        if (graceTicks > 0) expected.push({ elapsed: activeTicks + graceTicks, transition: Transition.graceEnded });
        expect(transitions).toEqual(expected);
      }),
      { seed: 24041, numRuns: 150 },
    );
  });

  it('keeps paused/interleaved clocks isolated across repeated starts, boundaries and resets', () => {
    const tunings = [tuningFor(2 / 60, 3 / 60), tuningFor(4 / 60, 0)];
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 1 }), fc.constantFrom('start', 'advance', 'pause', 'reset')), {
          minLength: 100,
          maxLength: 200,
        }),
        (actions) => {
          const clocks = [createModeClock(), createModeClock()];
          const models = [
            { tick: 0, activeEnd: 0, graceEnd: 0, activeTicks: 2, graceTicks: 3 },
            { tick: 0, activeEnd: 0, graceEnd: 0, activeTicks: 4, graceTicks: 0 },
          ];
          for (const [index, action] of actions) {
            const clock = clocks[index];
            const model = models[index];
            const tuning = tunings[index];
            if (!clock || !model || !tuning) throw new Error('reference fixture index missing');
            if (action === 'start') {
              const idle = model.tick >= model.graceEnd;
              expect(startLiftoffClock(clock, tuning)).toBe(idle);
              if (idle) {
                model.activeEnd = model.tick + model.activeTicks;
                model.graceEnd = model.activeEnd + model.graceTicks;
              }
            } else if (action === 'advance') {
              model.tick++;
              const expected =
                model.tick === model.activeEnd
                  ? Transition.activeEnded
                  : model.graceTicks > 0 && model.tick === model.graceEnd
                    ? Transition.graceEnded
                    : Transition.none;
              expect(advanceModeClock(clock, tuning)).toBe(expected);
            } else if (action === 'reset') {
              resetModeClock(clock);
              model.activeEnd = model.graceEnd = model.tick;
            }
            // Pause performs no call and advances no reference time, so resume cannot catch up wall time.
            for (const [i, state] of clocks.entries()) {
              const reference = models[i];
              if (!reference) throw new Error('reference fixture missing');
              expect(state.activeTicksLeft).toBe(Math.max(0, reference.activeEnd - reference.tick));
              expect(state.graceTicksLeft).toBe(
                reference.tick < reference.activeEnd ? 0 : Math.max(0, reference.graceEnd - reference.tick),
              );
              assertInvariants(state);
            }
          }
        },
      ),
      { seed: 24042, numRuns: 100 },
    );
  });
});
