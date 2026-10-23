import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkPerfReport, readPerfBaseline, type PerfConfiguration, type PerfMeasurement } from './perf-report';

const configuration: PerfConfiguration = {
  scriptVersion: 1,
  seed: 5,
  durationS: 90,
  viewport: 'desktop',
  quality: 'low',
};
const measurement: PerfMeasurement = {
  schemaVersion: 1,
  frames: 600,
  activeFrames: 590,
  storedSamples: 590,
  invalidFrames: 0,
  overflowFrames: 0,
  totalFrameMs: 90_000,
  activeFrameMs: 85_000,
  frameTimeMs: { p50: 150, p95: 600, max: 1200 },
  maxDrawCalls: 150,
  maxTriangles: 300_000,
  maxGeometries: 100,
  maxTextures: 4,
};

describe('performance smoke gates', () => {
  it('accepts exact geometry limits and reports slow cloud timing without using it as a gate', () => {
    expect(checkPerfReport(measurement, configuration)).toEqual([]);
    expect(checkPerfReport({ ...measurement, maxDrawCalls: 151 }, configuration)).toContain(
      'Draw calls 151 exceed 150',
    );
    expect(checkPerfReport({ ...measurement, maxTriangles: 300_001 }, configuration)).toContain(
      'Triangles 300001 exceed 300000',
    );
  });

  it('fails empty, inactive, invalid and truncated samples', () => {
    expect(checkPerfReport({ ...measurement, activeFrames: 0, storedSamples: 0 }, configuration)).toContain(
      'No active gameplay samples',
    );
    expect(checkPerfReport({ ...measurement, activeFrameMs: 44_999 }, configuration).length).toBeGreaterThan(0);
    expect(checkPerfReport({ ...measurement, activeFrames: 299 }, configuration).length).toBeGreaterThan(0);
    expect(checkPerfReport({ ...measurement, invalidFrames: 1 }, configuration)).toContain('1 invalid render samples');
    expect(checkPerfReport({ ...measurement, overflowFrames: 1 }, configuration).length).toBeGreaterThan(0);
  });

  it('compares only matching geometry profiles with a strict greater-than-10-percent limit', () => {
    const baseline = {
      schemaVersion: 1 as const,
      configuration,
      measurement: { ...measurement, maxDrawCalls: 100 },
      passed: true as const,
    };
    expect(checkPerfReport({ ...measurement, maxDrawCalls: 110 }, configuration, baseline)).toEqual([]);
    expect(checkPerfReport({ ...measurement, maxDrawCalls: 111 }, configuration, baseline)).toContain(
      'maxDrawCalls regressed by more than 10% versus baseline',
    );
    expect(checkPerfReport(measurement, { ...configuration, quality: 'high' }, baseline).join(' ')).toContain(
      'Baseline configuration differs',
    );
  });

  it('rejects failed, malformed and oversized baseline files before they can relax a gate', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kometa-perf-'));
    const file = join(dir, 'baseline.json');
    try {
      writeFileSync(file, JSON.stringify({ schemaVersion: 1, configuration, measurement, passed: false }));
      expect(() => readPerfBaseline(file)).toThrow();
      writeFileSync(file, JSON.stringify({ schemaVersion: 1, configuration, measurement, passed: true }));
      expect(readPerfBaseline(file).measurement).toEqual(measurement);
      writeFileSync(
        file,
        JSON.stringify({
          schemaVersion: 1,
          configuration,
          measurement: { ...measurement, activeFrames: 0, storedSamples: 0, invalidFrames: 1, maxDrawCalls: 999999 },
          passed: true,
        }),
      );
      expect(() => readPerfBaseline(file)).toThrow('Invalid performance baseline');
      writeFileSync(
        file,
        JSON.stringify({
          schemaVersion: 1,
          configuration,
          measurement: { ...measurement, activeFrames: measurement.frames + 1 },
          passed: true,
        }),
      );
      expect(() => readPerfBaseline(file)).toThrow('Inconsistent performance sample counters');
      writeFileSync(file, '{');
      expect(() => readPerfBaseline(file)).toThrow();
      writeFileSync(file, ' '.repeat(1024 * 1024 + 1));
      expect(() => readPerfBaseline(file)).toThrow('exceeds 1 MiB');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
