import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { countdownDigit, createIntro, INTRO_S, RETRY_START_S, type IntroPose } from './intro';

const pose = (): IntroPose => ({ position: new Vector3(), quaternion: new Quaternion(), speed: 0, phase: 'approach' });
const roof = (p: IntroPose) => new Vector3(0, 1, 0).applyQuaternion(p.quaternion);
const nose = (p: IntroPose) => new Vector3(0, 0, -1).applyQuaternion(p.quaternion);

describe('launch intro (C ramp)', () => {
  it('counts 3, 2, 1 in equal thirds and ends at INTRO_S', () => {
    expect(countdownDigit(0)).toBe(3);
    expect(countdownDigit(INTRO_S / 3 - 0.01)).toBe(3);
    expect(countdownDigit(INTRO_S / 3 + 0.01)).toBe(2);
    expect(countdownDigit((2 * INTRO_S) / 3 + 0.01)).toBe(1);
    expect(countdownDigit(INTRO_S)).toBe(0);
    expect(INTRO_S - RETRY_START_S).toBeCloseTo(1.5);
  });

  it('touches down at the start line, upright and facing the run', () => {
    const p = createIntro(35).pose(INTRO_S, pose());
    expect(p.position.length()).toBeLessThan(0.05);
    expect(roof(p).y).toBeGreaterThan(0.999);
    expect(nose(p).z).toBeLessThan(-0.999);
  });

  it('climbs the inside of the C: upside down on the top arm, roof toward the centre on the wall', () => {
    const intro = createIntro(35);
    const p = pose();
    let sawInverted = false;
    let sawWall = false;
    for (let t = 0; t < INTRO_S; t += 1 / 60) {
      intro.pose(t, p);
      if (p.phase !== 'ramp') continue;
      if (roof(p).y < -0.99) sawInverted = true;
      if (Math.abs(nose(p).y) > 0.99) sawWall = true;
    }
    expect(sawInverted).toBe(true);
    expect(sawWall).toBe(true);
  });

  it('moves continuously: no jump in position or orientation between frames', () => {
    const intro = createIntro(35);
    const a = pose();
    const b = pose();
    intro.pose(0, a);
    for (let t = 1 / 60; t <= INTRO_S; t += 1 / 60) {
      intro.pose(t, b);
      expect(b.position.distanceTo(a.position)).toBeLessThan(40 / 60 + 0.05); // ≤ ~40 m/s
      expect(b.quaternion.angleTo(a.quaternion)).toBeLessThan(0.2); // ≤ ~11° per frame
      a.position.copy(b.position);
      a.quaternion.copy(b.quaternion);
    }
  });
});
