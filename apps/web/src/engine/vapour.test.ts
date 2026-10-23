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

  it('clears visible particles immediately on retry and cannot resurrect them on later updates', () => {
    const v = createVapour();
    v.emit(burst, 10);
    v.update(0.05, 500);
    const alpha = v.points.geometry.getAttribute('aAlpha');
    const size = v.points.geometry.getAttribute('aSize');
    expect(alpha.getX(0)).toBeGreaterThan(0);

    v.reset();
    for (let i = 0; i < alpha.count; i++) {
      expect(alpha.getX(i)).toBe(0);
      expect(size.getX(i)).toBe(0);
    }
    v.update(0.1, 500);
    v.update(0.05, 500);
    for (let i = 0; i < alpha.count; i++) expect(alpha.getX(i)).toBe(0);
  });

  it('reuses the fixed pool and restarts emission from a clean ring across two retries', () => {
    const v = createVapour();
    const geometry = v.points.geometry;
    const pos = geometry.getAttribute('position');
    const alpha = geometry.getAttribute('aAlpha');
    const size = geometry.getAttribute('aSize');
    const capacity = pos.count;

    for (let run = 0; run < 3; run++) {
      v.emit({ ...burst, x: 10 + run, vx: 0 }, 1);
      v.update(0.05, 500);
      expect(alpha.getX(0)).toBeGreaterThan(0);
      expect(pos.getX(0)).toBe(10 + run);
      for (let i = 1; i < capacity; i++) expect(alpha.getX(i)).toBe(0);

      // More emissions than capacity must overwrite the ring, never allocate another geometry or grow it.
      v.emit(burst, capacity + 7);
      v.update(0.05, 500);
      expect(v.points.geometry).toBe(geometry);
      expect(geometry.getAttribute('position')).toBe(pos);
      expect(geometry.getAttribute('aAlpha')).toBe(alpha);
      expect(geometry.getAttribute('aSize')).toBe(size);
      expect(pos.count).toBe(capacity);
      if (run < 2) v.reset();
    }
  });
});
