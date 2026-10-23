import { readFileSync, statSync } from 'node:fs';
import { z } from 'zod';

export const PERF_BUDGETS = { maxDrawCalls: 150, maxTriangles: 300_000, geometryRegressionRatio: 1.1 } as const;
const nonnegative = z.number().finite().nonnegative();
const count = nonnegative.int();

export const perfSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  frames: count,
  activeFrames: count,
  invalidFrames: count,
  storedSamples: count,
  overflowFrames: count,
  activeFrameMs: nonnegative,
  totalFrameMs: nonnegative,
  frameTimeMs: z.object({ p50: nonnegative, p95: nonnegative, max: nonnegative }),
  maxDrawCalls: nonnegative,
  maxTriangles: nonnegative,
  maxGeometries: count,
  maxTextures: count,
});
export type PerfMeasurement = z.infer<typeof perfSnapshotSchema>;

export const perfConfigurationSchema = z.object({
  scriptVersion: z.literal(1),
  seed: z.number().int().min(1).max(0xffff_ffff),
  durationS: z.number().min(1).max(600),
  viewport: z.enum(['desktop', 'mobile']),
  quality: z.enum(['low', 'high']),
});
export type PerfConfiguration = z.infer<typeof perfConfigurationSchema>;

const baselineSchema = z.object({
  schemaVersion: z.literal(1),
  configuration: perfConfigurationSchema,
  measurement: perfSnapshotSchema,
  passed: z.literal(true),
});
export type PerfBaseline = z.infer<typeof baselineSchema>;

/** Bounds the untrusted report before parsing; a failed/incomplete run cannot become a valid baseline. */
export function readPerfBaseline(path: string): PerfBaseline {
  if (statSync(path).size > 1024 * 1024) throw new Error('Performance baseline exceeds 1 MiB');
  const baseline = baselineSchema.parse(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  const errors = checkPerfReport(baseline.measurement, baseline.configuration);
  if (errors.length > 0) throw new Error(`Invalid performance baseline: ${errors.join('; ')}`);
  return baseline;
}

/** Gates actual rendered geometry and measurement coverage, never headless frame-time milliseconds. */
export function checkPerfReport(
  measurement: PerfMeasurement,
  configuration: PerfConfiguration,
  baseline?: PerfBaseline,
): string[] {
  const errors: string[] = [];
  if (
    measurement.activeFrames > measurement.frames ||
    measurement.storedSamples + measurement.overflowFrames !== measurement.activeFrames ||
    measurement.activeFrameMs > measurement.totalFrameMs ||
    measurement.frameTimeMs.p50 > measurement.frameTimeMs.p95 ||
    measurement.frameTimeMs.p95 > measurement.frameTimeMs.max
  )
    errors.push('Inconsistent performance sample counters');
  if (measurement.activeFrames === 0 || measurement.storedSamples === 0) errors.push('No active gameplay samples');
  const minimumSamples = Math.min(30, Math.max(2, Math.ceil(configuration.durationS)));
  if (measurement.activeFrames < minimumSamples)
    errors.push(`Fewer than ${minimumSamples} active frames were measured`);
  if (measurement.activeFrames < measurement.frames / 2)
    errors.push('Less than half of rendered frames were active play');
  if (measurement.activeFrameMs < (configuration.durationS * 1000) / 2)
    errors.push('Active-play frame intervals cover less than half of the requested wall duration');
  if (measurement.maxDrawCalls <= 0 || measurement.maxTriangles <= 0) errors.push('No rendered geometry observed');
  if (measurement.invalidFrames > 0) errors.push(`${measurement.invalidFrames} invalid render samples`);
  if (measurement.overflowFrames > 0) errors.push('Frame sample storage overflowed; shorten the measurement');
  if (measurement.maxDrawCalls > PERF_BUDGETS.maxDrawCalls)
    errors.push(`Draw calls ${measurement.maxDrawCalls} exceed ${PERF_BUDGETS.maxDrawCalls}`);
  if (measurement.maxTriangles > PERF_BUDGETS.maxTriangles)
    errors.push(`Triangles ${measurement.maxTriangles} exceed ${PERF_BUDGETS.maxTriangles}`);
  if (baseline) {
    const keys = ['scriptVersion', 'seed', 'durationS', 'viewport', 'quality'] as const;
    if (keys.some((key) => configuration[key] !== baseline.configuration[key])) {
      errors.push('Baseline configuration differs; compare the same scenario, duration, viewport and quality');
    } else {
      for (const key of ['maxDrawCalls', 'maxTriangles'] as const) {
        if (measurement[key] > baseline.measurement[key] * PERF_BUDGETS.geometryRegressionRatio)
          errors.push(`${key} regressed by more than 10% versus baseline`);
      }
    }
  }
  return errors;
}
