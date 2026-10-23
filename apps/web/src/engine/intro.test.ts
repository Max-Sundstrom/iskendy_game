import { describe, expect, it } from 'vitest';
import { countdownDigit, createIntro, INTRO_S, RETRY_START_S, type IntroPose } from './intro';

describe('launch intro', () => {
  it('counts 3, 2, 1 in equal thirds and ends at INTRO_S', () => {
    expect(countdownDigit(0)).toBe(3);
    expect(countdownDigit(INTRO_S / 3 - 0.01)).toBe(3);
    expect(countdownDigit(INTRO_S / 3 + 0.01)).toBe(2);
    expect(countdownDigit((2 * INTRO_S) / 3 + 0.01)).toBe(1);
    expect(countdownDigit(INTRO_S)).toBe(0);
  });

  it('a retry starts inside the last second and a half', () => {
    expect(INTRO_S - RETRY_START_S).toBeCloseTo(1.5);
    expect(countdownDigit(RETRY_START_S)).toBeGreaterThan(0);
  });

  it('meets the road at the start line, level, at the run start speed', () => {
    const pose: IntroPose = { x: 0, y: 0, z: 0, pitch: 0, speed: 0 };
    createIntro(35).pose(INTRO_S, pose);
    expect(pose.z).toBeCloseTo(0, 3);
    expect(pose.y).toBeCloseTo(0, 3);
    expect(Math.abs(pose.pitch)).toBeLessThan(0.02);
    expect(pose.speed).toBeCloseTo(35, 3);
  });

  it('only ever moves toward the start and downhill', () => {
    const intro = createIntro(35);
    const pose: IntroPose = { x: 0, y: 0, z: 0, pitch: 0, speed: 0 };
    let lastZ = Infinity;
    let lastY = Infinity;
    for (let t = 0; t <= INTRO_S; t += 0.05) {
      intro.pose(t, pose);
      expect(pose.z).toBeLessThanOrEqual(lastZ + 1e-9);
      expect(pose.y).toBeLessThanOrEqual(lastY + 1e-9);
      expect(pose.speed).toBeGreaterThanOrEqual(0);
      lastZ = pose.z;
      lastY = pose.y;
    }
  });
});
