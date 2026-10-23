import defaultTuning from '@kometa/content/tuning.default.json';
import { describe, expect, it } from 'vitest';
import { parseTuning, TuningError } from './parse';

const clone = (): Record<string, unknown> => structuredClone(defaultTuning) as Record<string, unknown>;

function problemsOf(raw: unknown): readonly string[] {
  try {
    parseTuning(raw);
  } catch (error) {
    if (error instanceof TuningError) return error.problems;
    throw error;
  }
  throw new Error('expected parseTuning to throw');
}

function set(target: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.');
  let node = target;
  for (const key of keys.slice(0, -1)) node = node[key] as Record<string, unknown>;
  node[keys.at(-1) as string] = value;
  return target;
}

describe('parseTuning', () => {
  it('accepts the shipped tuning', () => {
    expect(parseTuning(defaultTuning).sim.air.capacityL).toBe(600);
  });

  it('names the exact path of a bad number', () => {
    // -5 is also below minMps, so the cross-field rule fires too; both point into sim.speed.
    const problems = problemsOf(set(clone(), 'sim.speed.maxMps', -5));
    expect(problems).toEqual([
      expect.stringMatching(/^sim\.speed\.maxMps: Too small/),
      'sim.speed.minMps: minMps must not exceed maxMps',
    ]);
  });

  it('rejects a misspelt key with its name', () => {
    const raw = set(clone(), 'sim.jump.apexHeightMeters', 4);
    expect(problemsOf(raw)).toEqual(['sim.jump: Unrecognized key: "apexHeightMeters"']);
  });

  it('reports a missing key', () => {
    const raw = clone();
    delete (raw['sim'] as { air: Record<string, unknown> }).air['canisterL'];
    expect(problemsOf(raw)).toEqual([expect.stringMatching(/^sim\.air\.canisterL: /)]);
  });

  it('lists every problem, not just the first', () => {
    const raw = set(set(clone(), 'sim.lanes.count', 2), 'presentation.hud.buttonSizePx', 30);
    const problems = problemsOf(raw);
    expect(problems.some((p) => p.startsWith('sim.lanes.count: '))).toBe(true);
    expect(problems.some((p) => p.startsWith('presentation.hud.buttonSizePx: '))).toBe(true);
  });

  it('enforces cross-field rules', () => {
    expect(problemsOf(set(clone(), 'sim.air.startL', 700))).toEqual([
      'sim.air.startL: startL must not exceed capacityL',
    ]);
    expect(problemsOf(set(clone(), 'sim.landing.stuntMaxDeg', 10))).toEqual([
      'sim.landing.stuntMaxDeg: grades must be ordered: perfectMaxDeg < stuntMaxDeg < sloppyMaxDeg',
    ]);
    expect(problemsOf(set(clone(), 'sim.director.maxBlockedGroundLanes', 5))).toEqual([
      'sim.director.maxBlockedGroundLanes: maxBlockedGroundLanes must leave at least one lane free',
    ]);
  });

  it('formats array indices', () => {
    const raw = clone();
    const world = (raw['presentation'] as { world: { biomes: { id: string }[] } }).world;
    (world.biomes[1] as { id: string }).id = 'Ring Road';
    expect(problemsOf(raw)).toEqual([expect.stringMatching(/^presentation\.world\.biomes\[1\]\.id: /)]);
  });

  it('keeps crash presentation durations and cloud opacity bounded by their contract', () => {
    expect(problemsOf(set(clone(), 'presentation.crash.settleDurationS', 1))).toEqual([
      'presentation.crash.settleDurationS: settleDurationS must fit in the crash presentation',
    ]);
    expect(problemsOf(set(clone(), 'presentation.crash.cloudAlpha', 1.1))).toEqual([
      expect.stringMatching(/^presentation\.crash\.cloudAlpha: /),
    ]);
    expect(problemsOf(set(clone(), 'presentation.crash.settleDurationS', 0))).toEqual([
      expect.stringMatching(/^presentation\.crash\.settleDurationS: /),
    ]);
  });

  it('rejects non-object input', () => {
    expect(problemsOf(null)).toEqual([expect.stringMatching(/^\(root\): /)]);
  });
});
