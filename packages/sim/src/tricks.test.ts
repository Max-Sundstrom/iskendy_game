import { SimEventKind } from '@kometa/shared';
import { describe, expect, it } from 'vitest';
import { CrashCause } from './outcome';
import { Action } from './input';
import { createSimState, SimStatus, type SimState } from './state';
import { step } from './step';
import { gradeLanding, LandingGrade, uprightErrorDeg } from './tricks';
import { DEFAULT_TUNING } from './tuning';

const T = DEFAULT_TUNING.sim;
const ticks = (s: number) => Math.round(s * T.tickRateHz);

function emptyRoad(): SimState {
  const s = createSimState(1, T);
  s.director.nextRowM = Infinity;
  return s;
}

/** Plays a scripted list of [tick, held mask] changes and collects events until landing or `max` ticks. */
function play(s: SimState, script: [number, number][], max = 300) {
  const seen: { kind: number; a: number; b: number }[] = [];
  let held = 0;
  for (let k = 0; k < max; k++) {
    for (const [at, mask] of script) if (at === k) held = mask;
    step(s, held, T);
    for (let i = 0; i < s.events.count; i++)
      seen.push({ kind: s.events.kind[i] ?? 0, a: s.events.a[i] ?? 0, b: s.events.b[i] ?? 0 });
    if (k > 2 && !s.player.airborne && s.player.rideSlot < 0) break;
    if (s.status !== SimStatus.running) break;
  }
  return seen;
}

describe('front flips (GDD §5.6)', () => {
  it('a second Jump press in the air flips once and lands PERFECT', () => {
    const s = emptyRoad();
    // Tap jump, release, tap again early in the jump.
    const seen = play(s, [
      [0, Action.jump],
      [2, 0],
      [ticks(0.08), Action.jump],
      [ticks(0.08) + 2, 0],
    ]);
    expect(seen.filter((e) => e.kind === SimEventKind.flipStart)).toHaveLength(1);
    expect(seen.find((e) => e.kind === SimEventKind.flipDone)?.a).toBe(1);
    const grade = seen.find((e) => e.kind === SimEventKind.landingGraded);
    expect(grade?.a).toBe(LandingGrade.perfect);
    expect(grade?.b).toBe(1);
    expect(s.status).toBe(SimStatus.running);
    expect(s.player.flipTurns).toBe(0);
  });

  it('a flip started too late lands upside down and crashes', () => {
    const s = emptyRoad();
    const seen = play(s, [
      [0, Action.jump],
      [2, 0],
      [ticks(0.42), Action.jump],
      [ticks(0.42) + 2, 0],
    ]);
    expect(s.status).toBe(SimStatus.crashed);
    expect(seen.find((e) => e.kind === SimEventKind.crash)?.a).toBe(CrashCause.landing);
  });

  it('G3 still holds: a press in the last 100 ms before touchdown is a buffered jump, not a flip', () => {
    const s = emptyRoad();
    // The plain jump lasts ~0.81 s; press ~70 ms before landing.
    const at = ticks(0.74);
    const seen = play(s, [
      [0, Action.jump],
      [2, 0],
      [at, Action.jump],
      [at + 2, 0],
    ]);
    expect(seen.some((e) => e.kind === SimEventKind.flipStart)).toBe(false);
    expect(seen.filter((e) => e.kind === SimEventKind.jump)).toHaveLength(2); // jumped again on touchdown
  });

  it('queues a second flip while the thrusters keep the car up', () => {
    const s = emptyRoad();
    // High in the air (as after a roof hop): press (flip 1) and hold to glide, re-press (flip 2 queued), glide, let go.
    s.player.airborne = true;
    s.player.y = T.fly.maxAltitudeM;
    s.player.vy = 0;
    const seen = play(
      s,
      [
        [0, Action.jump],
        [ticks(0.25), 0],
        [ticks(0.25) + 2, Action.jump],
        [ticks(1.6), 0],
      ],
      900,
    );
    expect(seen.filter((e) => e.kind === SimEventKind.flipDone).length).toBeGreaterThanOrEqual(2);
    expect(s.status).toBe(SimStatus.running);
  });
});

describe('landing grades (GDD §5.7, scenario G6)', () => {
  const gradeAt = (deg: number) => {
    const s = emptyRoad();
    s.player.flipsDone = 1;
    s.player.flipTurns = 1 + deg / 360;
    const ok = gradeLanding(s, T);
    return { ok, grade: s.events.count ? s.events.a[s.events.count - 1] : undefined, s };
  };
  it('uses inclusive bounds at 12°, 35° and 75°', () => {
    expect(uprightErrorDeg(1 - 35 / 360)).toBeCloseTo(35, 9);
    expect(gradeAt(12).grade).toBe(LandingGrade.perfect);
    expect(gradeAt(12.01).grade).toBe(LandingGrade.stunt);
    expect(gradeAt(35).grade).toBe(LandingGrade.stunt);
    expect(gradeAt(35.01).grade).toBe(LandingGrade.sloppy);
    expect(gradeAt(75).grade).toBe(LandingGrade.sloppy);
    expect(gradeAt(75.01).ok).toBe(false);
  });
  it('a sloppy landing slows the car for 0.8 s', () => {
    const { s } = gradeAt(50);
    expect(s.player.penaltyS).toBe(T.speed.sloppyPenaltyDurationS);
    expect(s.player.penaltyFactor).toBe(T.speed.sloppyPenalty);
  });
  it('a plain jump is not graded', () => {
    const s = emptyRoad();
    expect(gradeLanding(s, T)).toBe(true);
    expect(s.events.count).toBe(0);
  });
});
