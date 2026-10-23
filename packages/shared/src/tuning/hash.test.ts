import defaultTuning from '@kometa/content/tuning.default.json';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canonicalJson, tuningHash, utf8Bytes } from './hash';
import { parseTuning } from './parse';
import type { SimTuning } from './schema';

const sim = (): SimTuning => parseTuning(structuredClone(defaultTuning)).sim;

/** Same data, keys inserted in reverse order at every level. */
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .reverse()
        .map((k) => [k, reverseKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** Paths to every numeric leaf of an object. */
function numericLeaves(value: unknown, prefix: string[] = []): string[][] {
  if (typeof value === 'number') return [prefix];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => numericLeaves(v, [...prefix, k]));
}

describe('tuningHash', () => {
  it('is pinned for the shipped tuning (golden: change only with a SIM_VERSION note in DECISIONS)', () => {
    expect(tuningHash(sim())).toBe(GOLDEN_DEFAULT_HASH);
  });

  it('ignores key order', () => {
    expect(tuningHash(reverseKeys(sim()) as SimTuning)).toBe(tuningHash(sim()));
  });

  it('ignores presentation and server numbers', () => {
    const raw = structuredClone(defaultTuning);
    raw.presentation.camera.distanceM = 99;
    raw.server.replay.maxTicks = 1;
    expect(tuningHash(parseTuning(raw).sim)).toBe(tuningHash(sim()));
  });

  it('changes when any sim number changes', () => {
    const leaves = numericLeaves(sim());
    expect(leaves.length).toBeGreaterThan(100);
    const base = tuningHash(sim());
    fc.assert(
      fc.property(fc.constantFrom(...leaves), (path) => {
        const changed = structuredClone(sim()) as unknown as Record<string, unknown>;
        let node = changed;
        for (const key of path.slice(0, -1)) node = node[key] as Record<string, unknown>;
        const last = path.at(-1) as string;
        node[last] = (node[last] as number) + 0.5;
        return tuningHash(changed as unknown as SimTuning) !== base;
      }),
      { numRuns: leaves.length * 2 },
    );
  });
});

describe('canonicalJson', () => {
  it('sorts keys at every level and keeps array order', () => {
    expect(canonicalJson({ b: [3, { y: 1, x: 2 }], a: true })).toBe('{"a":true,"b":[3,{"x":2,"y":1}]}');
  });

  it('refuses non-finite numbers and non-JSON values', () => {
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(/non-finite/);
    expect(() => canonicalJson({ a: undefined })).toThrow(/undefined is not JSON/);
    expect(() => canonicalJson([1n])).toThrow(/bigint is not JSON/);
  });
});

describe('utf8Bytes', () => {
  it('matches the platform UTF-8 encoder for any valid string', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (text) => {
        expect(utf8Bytes(text)).toEqual([...Buffer.from(text, 'utf8')]);
      }),
    );
  });
});

// Cross-checked with an independent Python FNV-1a 64 over the same canonical JSON (P0-03 handoff note).
const GOLDEN_DEFAULT_HASH = '788ecccb429e4cdc';
