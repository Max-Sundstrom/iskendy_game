import { BufferAttribute, ShaderMaterial } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVapour, type Burst, type Vapour } from './vapour';

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

const snapshot = (v: Vapour) =>
  Object.fromEntries(
    Object.entries(v.points.geometry.attributes).map(([name, attribute]) => [name, Array.from(attribute.array)]),
  );

const attribute = (v: Vapour, name: string) => {
  const result = v.points.geometry.getAttribute(name);
  if (!(result instanceof BufferAttribute)) throw new Error(`expected a pooled BufferAttribute: ${name}`);
  return result;
};

afterEach(() => vi.restoreAllMocks());

describe('vapour pool', () => {
  it.each([0, -0.01])('freezes every rendered attribute and resumes identically after delta %s', (dt) => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.51);
    const v = createVapour();
    const reference = createVapour();
    const impact = { ...burst, vy: 0, lifeS: 0.45, sizeM: 0.25, growM: 0.8, alpha: 0.35 };
    for (const pool of [v, reference]) {
      pool.emit(impact, 16);
      // This age cannot be represented exactly in the particle Float32 buffer.
      for (let frame = 0; frame < 8; frame++) pool.update(0.016, 400);
    }
    const before = snapshot(v);
    random.mockClear();
    for (let frame = 0; frame < 3; frame++) v.update(dt, 800);
    expect.soft(random).not.toHaveBeenCalled();
    expect(snapshot(v)).toEqual(before);
    const material = v.points.material;
    if (!(material instanceof ShaderMaterial)) throw new Error('expected the vapour shader');
    expect(material.uniforms['uScale']?.value).toBe(800); // Resize must still affect point projection while paused.

    v.update(0.021, 800);
    reference.update(0.021, 800);
    expect(snapshot(v)).toEqual(snapshot(reference)); // Also protects private age/velocity across the pause.
  });

  it('does not bounce or sample randomness for a fresh below-road particle until time advances', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.51);
    const v = createVapour();
    v.emit({ ...burst, y: 0.01 }, 1);
    const before = snapshot(v);
    random.mockClear();
    v.update(0, 600);
    expect.soft(random).not.toHaveBeenCalled();
    expect(snapshot(v)).toEqual(before);
    v.update(0.016, 600);
    expect(random).toHaveBeenCalledTimes(1);
    expect(attribute(v, 'position').getY(0)).toBeCloseTo(0.05);
    expect(attribute(v, 'aAlpha').getX(0)).toBeGreaterThan(0);
  });

  it('publishes emission and origin shifts without relying on a positive-time update', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const v = createVapour();
    const position = attribute(v, 'position');
    const alpha = attribute(v, 'aAlpha');
    const size = attribute(v, 'aSize');
    v.emit(burst, position.count);
    v.update(0.016, 400);
    expect(alpha.getX(0)).toBeGreaterThan(0);
    const versions = [position.version, size.version, alpha.version];

    // Reusing a still-visible slot must publish its age-zero state, even on a paused render.
    v.emit({ ...burst, x: 12, sizeM: 0.3 }, 1);
    expect(position.getX(0)).toBe(12);
    expect.soft(alpha.getX(0)).toBe(0);
    expect.soft(size.getX(0)).toBe(Math.fround(0.3));
    expect.soft([position.version, size.version, alpha.version]).toEqual(versions.map((version) => version + 1));
    const born = snapshot(v);
    v.update(0, 600);
    expect(snapshot(v)).toEqual(born);

    const z = position.getZ(0);
    const version = position.version;
    v.shift(2000);
    expect(position.getZ(0)).toBeCloseTo(z + 2000);
    expect(position.version).toBe(version + 1);
    const shifted = snapshot(v);
    v.update(0, 600);
    expect(snapshot(v)).toEqual(shifted);
    v.reset();
    const reset = snapshot(v);
    v.update(0, 600);
    expect(snapshot(v)).toEqual(reset);
  });

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
