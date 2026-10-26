import { readdirSync, readFileSync } from 'node:fs';
import { parseReplay, ReplayError, SimEventKind, type Replay } from '@kometa/shared';
import {
  createRecorder,
  createSimState,
  DEFAULT_TUNING,
  playReplay,
  SIM_VERSION,
  SimStatus,
  stateHash,
  step,
} from '@kometa/sim';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

// P1-06: golden replays reproduce exactly; tampering is detected (the tamper suite of SECURITY T1–T2 and T10).

const T = DEFAULT_TUNING.sim;
const LIMITS = DEFAULT_TUNING.server.replay;
const goldens = readdirSync('tests/replays').filter((f) => f.endsWith('.json'));
const load = (f: string) => parseReplay(readFileSync(`tests/replays/${f}`, 'utf8'), LIMITS);

function record(seed: number, inputs: number[]): Replay {
  const s = createSimState(seed, T);
  const rec = createRecorder(seed, T);
  for (const held of inputs) {
    if (s.status !== SimStatus.running) break;
    rec.record(held);
    step(s, held, T);
  }
  return rec.finish(s);
}

describe('golden replays', () => {
  it('has the four goldens, including a complete LIFTOFF run', () => {
    expect(goldens.sort()).toEqual(['busy-inputs.json', 'early-crash.json', 'liftoff.json', 'long-run.json']);
  });

  for (const f of goldens) {
    it(`${f} reproduces its final hash, score and distance`, () => {
      const r = playReplay(load(f), T);
      expect(r.reason).toBeUndefined();
      expect(r.valid).toBe(true);
    });
  }

  it('replays a complete LIFTOFF episode through its independently reviewed natural crash', () => {
    const replay = load('liftoff.json');
    const original = parseReplay(
      readFileSync('docs/reviews/P2-04a1/meter-route/safe-landing.replay.json', 'utf8'),
      LIMITS,
    );
    expect(replay.inputs).toHaveLength(50);
    expect(replay.inputs).toEqual(original.inputs);
    expect(replay).toMatchObject({
      seed: 1,
      ticks: 928,
      claimedScore: 18828,
      claimedDistanceM: 638.4743759294411,
      finalHash: '66e41f15',
    });

    const state = createSimState(replay.seed, T);
    const recorder = createRecorder(replay.seed, T);
    const events: [tick: number, kind: number, a: number, b: number][] = [];
    let held = 0;
    let nextInput = 0;
    for (let tick = 0; tick < replay.ticks && state.status === SimStatus.running; tick++) {
      const input = replay.inputs[nextInput];
      if (input?.[0] === tick) {
        held = input[1];
        nextInput++;
      }
      recorder.record(held);
      step(state, held, T);
      for (let i = 0; i < state.events.count; i++) {
        const kind = state.events.kind[i] ?? 0;
        if (kind === SimEventKind.crash || (kind >= SimEventKind.modeStarted && kind <= SimEventKind.trafficPhasedOut))
          events.push([state.tick, kind, state.events.a[i] ?? 0, state.events.b[i] ?? 0]);
      }
    }

    // P2-04a2: separately checked physical contact and 928-tick ledger, not generator-derived assertions.
    expect(events).toEqual([
      [525, 27, 1, 300],
      [688, 30, 0, 1],
      [825, 28, 1, 60],
      [885, 29, 0, 0],
      [928, 13, 1, 0],
    ]);
    expect(state.status).toBe(SimStatus.crashed);
    expect(state.tick).toBe(928);
    expect(stateHash(state)).toBe(replay.finalHash);
    expect(Math.floor(state.score.total)).toBe(replay.claimedScore);
    expect(state.player.distanceM).toBe(replay.claimedDistanceM);
    expect(state.player.airLiters).toBe(270.5);
    expect(recorder.finish(state)).toEqual(replay);
  });
});

describe('record → JSON → parse → play', () => {
  it('round-trips any input stream', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 ** 31 }),
        fc.array(fc.integer({ min: 0, max: 63 }), { maxLength: 900 }),
        (seed, inputs) => {
          const replay = record(seed, inputs);
          return playReplay(parseReplay(JSON.stringify(replay), LIMITS), T).valid;
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe('tamper suite', () => {
  const base = () => load('long-run.json');

  it('rejects an edited score or distance', () => {
    expect(playReplay({ ...base(), claimedScore: base().claimedScore + 1000 }, T).valid).toBe(false);
    expect(playReplay({ ...base(), claimedDistanceM: base().claimedDistanceM + 1 }, T).valid).toBe(false);
  });

  it('rejects edited inputs', () => {
    const r = base();
    const inputs = r.inputs.map(([t, m], i) => [t, i === 3 ? m ^ 0b11 : m] as [number, number]);
    expect(playReplay({ ...r, inputs }, T).valid).toBe(false);
  });

  it('rejects another sim version or tuning', () => {
    expect(playReplay({ ...base(), simVersion: SIM_VERSION + 1 }, T).reason).toMatch(/simVersion/);
    expect(playReplay({ ...base(), tuningHash: '0'.repeat(16) }, T).reason).toMatch(/tuningHash/);
  });

  it('refuses oversized, prototype-polluting or malformed payloads before simulating (T10)', () => {
    const text = JSON.stringify(base());
    expect(() => parseReplay(text + ' '.repeat(LIMITS.maxDecompressedBytes), LIMITS)).toThrow(ReplayError);
    expect(() => parseReplay(text.replace('{', '{"__proto__":{"x":1},'), LIMITS)).toThrow(/forbidden key/);
    expect(() => parseReplay('{"schemaVersion":1', LIMITS)).toThrow(/not valid JSON/);
    expect(() => parseReplay(JSON.stringify({ ...base(), ticks: LIMITS.maxTicks + 1 }), LIMITS)).toThrow(ReplayError);
    expect(() =>
      parseReplay(
        JSON.stringify({
          ...base(),
          inputs: [
            [5, 1],
            [5, 0],
          ],
        }),
        LIMITS,
      ),
    ).toThrow(/strictly increasing/);
    expect(() => parseReplay(JSON.stringify({ ...base(), extra: true }), LIMITS)).toThrow(ReplayError);
  });
});
