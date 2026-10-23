import { describe, expect, it } from 'vitest';
import { createPerfStats } from './perf-stats';

const info = { render: { calls: 100, triangles: 100_000 }, memory: { geometries: 12, textures: 2 } };

describe('rendered performance samples', () => {
  it('keeps inactive intervals out of frame percentiles but still enforces their geometry', () => {
    const stats = createPerfStats();
    for (let ms = 1; ms <= 100; ms++) stats.frame(ms, true, info);
    stats.frame(5000, false, { ...info, render: { calls: 151, triangles: 300_001 } });
    const result = stats.snapshot();
    expect(result.frames).toBe(101);
    expect(result.activeFrames).toBe(100);
    expect(result.frameTimeMs).toEqual({ p50: 50, p95: 95, max: 100 });
    expect(result.activeFrameMs).toBe(5050);
    expect(result.totalFrameMs).toBe(10050);
    expect(result.maxDrawCalls).toBe(151);
    expect(result.maxTriangles).toBe(300_001);
  });

  it('rejects invalid geometry/times, ignores the boot zero interval and resets all diagnostic state', () => {
    const stats = createPerfStats();
    stats.frame(0, true, info);
    stats.frame(NaN, true, info);
    stats.frame(16, true, { ...info, render: { calls: 0, triangles: 0 } });
    expect(stats.snapshot().invalidFrames).toBe(2);
    expect(stats.snapshot().activeFrames).toBe(0);
    stats.frame(16, true, info);
    stats.reset();
    expect(stats.snapshot()).toMatchObject({
      frames: 0,
      activeFrames: 0,
      invalidFrames: 0,
      maxDrawCalls: 0,
      maxTriangles: 0,
    });
    expect(stats.snapshot().frameTimeMs).toEqual({ p50: 0, p95: 0, max: 0 });
    stats.frame(20, true, info);
    expect(stats.snapshot().frameTimeMs).toEqual({ p50: 20, p95: 20, max: 20 });
  });

  it('reports storage overflow instead of silently reporting only a tail or a partial run', () => {
    const stats = createPerfStats();
    for (let i = 0; i < 65_537; i++) stats.frame(16, true, info);
    expect(stats.snapshot()).toMatchObject({ activeFrames: 65_537, storedSamples: 65_536, overflowFrames: 1 });
  });
});
