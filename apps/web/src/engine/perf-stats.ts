// Diagnostic storage is allocated once. Taking a report is explicit; recording a rendered frame allocates nothing.
const SAMPLE_CAPACITY = 65_536;
const RECENT_CAPACITY = 300;

export type RenderCounters = {
  render: { calls: number; triangles: number };
  memory: { geometries: number; textures: number };
};

export type PerfSnapshot = {
  schemaVersion: 1;
  frames: number;
  activeFrames: number;
  invalidFrames: number;
  storedSamples: number;
  overflowFrames: number;
  activeFrameMs: number;
  totalFrameMs: number;
  frameTimeMs: { p50: number; p95: number; max: number };
  maxDrawCalls: number;
  maxTriangles: number;
  maxGeometries: number;
  maxTextures: number;
};

/** Collects real rAF intervals and renderer counters; inactive screens never contribute timing samples. */
export function createPerfStats() {
  const times = new Float64Array(SAMPLE_CAPACITY);
  const recent = new Float64Array(RECENT_CAPACITY);
  const sortedRecent = new Float64Array(RECENT_CAPACITY);
  let frames = 0;
  let activeFrames = 0;
  let invalidFrames = 0;
  let activeFrameMs = 0;
  let totalFrameMs = 0;
  let maxFrameMs = 0;
  let maxDrawCalls = 0;
  let maxTriangles = 0;
  let maxGeometries = 0;
  let maxTextures = 0;
  const percentile = (sorted: Float64Array, count: number, q: number) =>
    sorted[Math.max(0, Math.ceil(count * q) - 1)] ?? 0;

  return {
    frame(ms: number, active: boolean, info: RenderCounters) {
      // The first rAF may share the boot timestamp; it has no meaningful interval to measure.
      if (ms === 0) return;
      if (
        !Number.isFinite(ms) ||
        ms < 0 ||
        !Number.isFinite(info.render.calls) ||
        !Number.isFinite(info.render.triangles) ||
        info.render.calls <= 0 ||
        info.render.triangles <= 0
      ) {
        invalidFrames++;
        return;
      }
      frames++;
      totalFrameMs += ms;
      maxDrawCalls = Math.max(maxDrawCalls, info.render.calls);
      maxTriangles = Math.max(maxTriangles, info.render.triangles);
      maxGeometries = Math.max(maxGeometries, info.memory.geometries);
      maxTextures = Math.max(maxTextures, info.memory.textures);
      if (!active) return;
      if (activeFrames < times.length) times[activeFrames] = ms;
      recent[activeFrames % recent.length] = ms;
      activeFrames++;
      activeFrameMs += ms;
      maxFrameMs = Math.max(maxFrameMs, ms);
    },
    reset() {
      frames = activeFrames = invalidFrames = activeFrameMs = totalFrameMs = maxFrameMs = 0;
      maxDrawCalls = maxTriangles = maxGeometries = maxTextures = 0;
    },
    /** Small rolling readout; its scratch storage is reused rather than copying the full report each frame. */
    label(): string {
      const n = Math.min(activeFrames, recent.length);
      sortedRecent.fill(Infinity);
      for (let i = 0; i < n; i++) sortedRecent[i] = recent[i] ?? 0;
      sortedRecent.sort();
      const at = (q: number) => (n > 0 ? percentile(sortedRecent, n, q) : 0);
      return `p50 ${at(0.5).toFixed(1)} ms · p95 ${at(0.95).toFixed(1)} ms · ${maxDrawCalls} draws · ${(maxTriangles / 1000).toFixed(0)}k tris`;
    },
    snapshot(): PerfSnapshot {
      const n = Math.min(activeFrames, times.length);
      const sorted = times.slice(0, n).sort();
      return {
        schemaVersion: 1,
        frames,
        activeFrames,
        invalidFrames,
        storedSamples: n,
        overflowFrames: Math.max(0, activeFrames - times.length),
        activeFrameMs,
        totalFrameMs,
        frameTimeMs: { p50: percentile(sorted, n, 0.5), p95: percentile(sorted, n, 0.95), max: maxFrameMs },
        maxDrawCalls,
        maxTriangles,
        maxGeometries,
        maxTextures,
      };
    },
  };
}
