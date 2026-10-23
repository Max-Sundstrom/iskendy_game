import { describe, expect, it } from 'vitest';
import { createVapour, type Burst } from './vapour';

const burst: Burst = {
  x: 0,
  y: 1,
  z: 0,
  vx: 0,
  vy: -10,
  vz: 20,
  spread: 0,
  lifeS: 0.5,
  sizeM: 0.2,
  growM: 1,
  alpha: 0.5,
};

describe('vapour pool', () => {
  it('moves, stops at the road and fades particles out by the end of their life', () => {
    const v = createVapour();
    v.emit(burst, 10);
    v.update(0.05, 500);
    const pos = v.points.geometry.getAttribute('position');
    const alpha = v.points.geometry.getAttribute('aAlpha');
    expect(pos.getZ(0)).toBeGreaterThan(0);
    for (let k = 0; k < 40; k++) v.update(0.05, 500);
    for (let i = 0; i < 10; i++) {
      expect(pos.getY(i)).toBeGreaterThanOrEqual(0.05 - 1e-6); // gas never goes through the road
      expect(alpha.getX(i)).toBe(0);
    }
  });

  it('shift moves every particle for the floating origin', () => {
    const v = createVapour();
    v.emit(burst, 3);
    const pos = v.points.geometry.getAttribute('position');
    const before = pos.getZ(1);
    v.shift(2000);
    expect(pos.getZ(1)).toBeCloseTo(before + 2000);
  });
});
