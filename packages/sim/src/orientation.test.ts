import type { SimTuning } from '@kometa/shared';
import { describe, expect, it } from 'vitest';
import { readEvents } from './events';
import { cosHalfTurn } from './math';
import { createSimState, SimStatus } from './state';
import { step } from './step';
import { COS_HALF_TURN_ERROR } from './tables';
import { gradeLanding, LandingGrade, withinLandingAngle } from './tricks';
import { DEFAULT_TUNING } from './tuning';

const T = DEFAULT_TUNING.sim;
const modes = ['uprightForward', 'upVector'] as const;
type Mode = (typeof modes)[number];
const tuningFor = (mode: Mode): SimTuning => ({ ...T, landing: { ...T.landing, orientationMode: mode } });

/** Independent reference: build Qx(pitch)*Qz(roll), then rotate up or measure shortest quaternion distance. */
function oracleDeg(pitch: number, roll: number, mode: Mode): number {
  const p = (pitch * Math.PI) / 360;
  const r = (roll * Math.PI) / 360;
  const w = Math.cos(p) * Math.cos(r);
  const x = Math.sin(p) * Math.cos(r);
  const z = Math.cos(p) * Math.sin(r);
  const cosine = mode === 'uprightForward' ? Math.abs(w) : 1 - 2 * (x * x + z * z);
  return (Math.acos(Math.max(-1, Math.min(1, cosine))) * (mode === 'uprightForward' ? 360 : 180)) / Math.PI;
}

function gradeAt(pitch: number, roll: number, mode: Mode = 'uprightForward') {
  const s = createSimState(1, T);
  s.player.flipTurns = pitch / 360;
  s.player.rollTurns = roll / 360;
  s.player.flipsDone = 1;
  s.player.rollsDone = 1;
  const ok = gradeLanding(s, tuningFor(mode));
  return { s, ok, grade: readEvents(s.events).find((e) => e.kind === 'landingGraded')?.grade };
}

describe('combined orientation grading (G6/G21)', () => {
  it.each(modes)('%s preserves pure-axis signed inclusive boundaries and ±1° neighbours', (mode) => {
    for (const axis of ['pitch', 'roll'])
      for (const sign of [-1, 1]) {
        for (const [bound, exact, above] of [
          [12, 'perfect', 'stunt'],
          [35, 'stunt', 'sloppy'],
          [75, 'sloppy', undefined],
        ] as const) {
          for (const offset of [-1, 0, 1]) {
            const angle = sign * (bound + offset);
            const result = gradeAt(axis === 'pitch' ? angle : 0, axis === 'roll' ? angle : 0, mode);
            expect(result.grade).toBe(offset <= 0 ? exact : above);
            expect(result.ok).toBe(bound !== 75 || offset <= 0);
          }
        }
      }
  });

  it('signed mixed rotations cannot cancel each other; the flag explicitly changes heading treatment', () => {
    expect(gradeAt(25, -25).grade).toBe('sloppy');
    expect(gradeAt(25, -25, 'upVector').grade).toBe('stunt');
    expect(gradeAt(8.5, 8.5).grade).toBe('stunt');
    expect(gradeAt(8.5, 8.5, 'upVector').grade).toBe('perfect');
    expect(gradeAt(180, 180).ok).toBe(false);
    expect(gradeAt(180, 180, 'upVector').grade).toBe('perfect');
    for (const mode of modes) {
      expect(gradeAt(180, 0, mode).ok).toBe(false);
      expect(gradeAt(0, -180, mode).ok).toBe(false);
      expect(gradeAt(360, -360, mode).grade).toBe('perfect');
    }
  });

  it.each(modes)(
    '%s agrees with a quaternion oracle across signed rotations away from the bounded LUT uncertainty',
    (mode) => {
      // 0.001° exceeds the worst-case comparison band at the smallest 12° threshold (<0.0007°).
      for (let pitch = -360; pitch <= 360; pitch += 7)
        for (let roll = -360; roll <= 360; roll += 11) {
          const expected = oracleDeg(pitch, roll, mode);
          for (const bound of [12, 35, 75]) {
            if (Math.abs(expected - bound) <= 0.001) continue;
            expect(withinLandingAngle(pitch / 360, roll / 360, bound, mode)).toBe(expected < bound);
          }
        }
    },
  );

  it.each(modes)('%s accepts exact mixed boundaries but not a 0.01° excess', (mode) => {
    for (const bound of [12, 35, 75]) {
      // Equal-axis solution derived independently from quaternion distance / rotated-up dot product.
      const angleFor = (error: number) =>
        mode === 'uprightForward'
          ? (360 / Math.PI) * Math.acos(Math.sqrt(Math.cos((error * Math.PI) / 360)))
          : (180 / Math.PI) * Math.acos(Math.sqrt(Math.cos((error * Math.PI) / 180)));
      for (const sign of [-1, 1]) {
        const exact = angleFor(bound);
        expect(oracleDeg(exact, sign * exact, mode)).toBeCloseTo(bound, 9);
        expect(withinLandingAngle(exact / 360, (sign * exact) / 360, bound, mode)).toBe(true);
        const above = angleFor(bound + 0.01);
        expect(withinLandingAngle(above / 360, (sign * above) / 360, bound, mode)).toBe(false);
      }
    }
  });

  it('folds lookup coordinates only: grading stays periodic without erasing stored signed turns', () => {
    for (const mode of modes)
      for (const p of [-3, 0, 4])
        for (const r of [-4, 0, 3]) {
          expect(gradeAt(25 + 360 * p, -25 + 360 * r, mode).grade).toBe(gradeAt(25, -25, mode).grade);
        }
    const { s } = gradeAt(180 + 360, -180 - 720);
    expect(s.player.flipTurns).toBe(1.5);
    expect(s.player.rollTurns).toBe(-2.5);
  });

  it('preserves flips in landingGraded.b and resets all safe touchdown trick state', () => {
    const s = createSimState(1, T);
    Object.assign(s.player, {
      flipTurns: 2,
      flipsDone: 2,
      flipping: true,
      flipQueued: true,
      rollTurns: -1,
      rollTargetTurns: -2,
      rollsDone: 3,
      rolling: true,
      rollQueuedDir: 1,
    });
    expect(gradeLanding(s, T)).toBe(true);
    expect(s.events.a[0]).toBe(LandingGrade.perfect);
    expect(s.events.b[0]).toBe(2);
    expect(s.player).toMatchObject({
      flipTurns: 0,
      flipsDone: 0,
      flipping: false,
      flipQueued: false,
      rollTurns: 0,
      rollTargetTurns: 0,
      rollsDone: 0,
      rolling: false,
      rollQueuedDir: 0,
    });
  });
});

describe('touchdown integration and terminal pose (G11/G22)', () => {
  it.each(['road', 'sedan', 'bus'])('grades both axes on %s with safe reset or unsafe frozen angles', (surface) => {
    for (const unsafe of [false, true]) {
      const s = createSimState(1, T);
      s.director.nextRowM = Infinity;
      const type = T.vehicles.findIndex((v) => v.id === surface);
      const height = T.vehicles[type]?.heightM ?? 0;
      if (type >= 0) {
        s.traffic.active[0] = 1;
        s.traffic.type[0] = type;
        s.traffic.lane[0] = s.player.lane;
        s.traffic.z[0] = -1;
        s.traffic.speed[0] = T.speed.minMps;
      }
      Object.assign(s.player, {
        airborne: true,
        y: height + 0.001,
        vy: -2,
        flipTurns: unsafe ? 0.3 : 0,
        flipsDone: 1,
        rollTurns: unsafe ? -0.2 : -1,
        rollsDone: 1,
      });
      step(s, 0, T);
      expect(s.status).toBe(unsafe ? SimStatus.crashed : SimStatus.running);
      const seen = readEvents(s.events);
      if (unsafe) {
        expect(seen).toContainEqual({ kind: 'crash', cause: 'landing' });
        expect(seen.some((e) => e.kind === 'hop' || e.kind === 'rideStart')).toBe(false);
        expect(s.player.flipTurns).toBe(0.3);
        expect(s.player.rollTurns).toBe(-0.2);
      } else {
        expect(seen).toContainEqual({ kind: 'landingGraded', grade: 'perfect', flips: 1 });
        expect(s.player.rollTurns).toBe(0);
        expect(s.player.flipTurns).toBe(0);
        if (surface === 'sedan') expect(seen).toContainEqual({ kind: 'hop', chain: 1, slam: false });
        if (surface === 'bus') expect(s.player.rideSlot).toBe(0);
      }
    }
  });

  it('landing crash stores the exact same-tick advanced pitch/roll, not the preceding pose', () => {
    const s = createSimState(1, T);
    s.director.nextRowM = Infinity;
    Object.assign(s.player, {
      airborne: true,
      y: 0.001,
      vy: -1,
      flipTurns: 0.3,
      flipping: true,
      flipQueued: true,
      rollTurns: -0.2,
      rollTargetTurns: -1,
      rolling: true,
      rollQueuedDir: 1,
    });
    step(s, 0, T);
    expect(s.status).toBe(SimStatus.crashed);
    expect(s.player.flipTurns).toBe(0.3 + 1 / T.tickRateHz / T.tricks.frontFlipDurationS);
    expect(s.player.rollTurns).toBe(-0.2 - 1 / T.tickRateHz / T.tricks.barrelRollDurationS);
    expect(s.player).toMatchObject({ flipping: false, flipQueued: false, rolling: false, rollQueuedDir: 0 });
  });

  it('emits simultaneous completions in flip→roll order before touchdown grading', () => {
    const s = createSimState(1, T);
    s.director.nextRowM = Infinity;
    Object.assign(s.player, {
      airborne: true,
      y: 0.001,
      vy: -1,
      flipTurns: 0.999,
      flipping: true,
      rollTurns: -0.999,
      rollTargetTurns: -1,
      rolling: true,
    });
    step(s, 0, T);
    expect(readEvents(s.events).map((e) => e.kind)).toEqual(['flipDone', 'rollDone', 'land', 'landingGraded']);
  });
});

describe('deterministic half-angle cosine interpolation', () => {
  it('bounds interpolation error by h²/8, including negative and repeated turns', () => {
    for (let i = -10000; i <= 10000; i++) {
      const turns = i * 0.0006137;
      const reference = Math.abs(Math.cos(Math.PI * turns));
      expect(Math.abs(cosHalfTurn(turns) - reference)).toBeLessThanOrEqual(COS_HALF_TURN_ERROR + 4e-15);
    }
    expect(cosHalfTurn(0)).toBe(1);
    expect(cosHalfTurn(-3)).toBe(1);
    expect(cosHalfTurn(0.5)).toBe(0);
  });
});
