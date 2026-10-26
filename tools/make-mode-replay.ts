import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseReplay, SimEventKind } from '@kometa/shared';
import { createRecorder, createSimState, DEFAULT_TUNING, playReplay, SimStatus, step } from '@kometa/sim';

// Run only after independent outcome review; explain changes in DECISIONS → Sim changelog (ADR-024).
// pnpm exec tsx tools/make-mode-replay.ts writes only the fourth golden; the original three are untouched.
const T = DEFAULT_TUNING.sim;
const LIMITS = DEFAULT_TUNING.server.replay;
// This is a bounded fixture-generation budget, not a gameplay duration or a fabricated end condition.
const MAX_TICKS = 3600;
const route = parseReplay(readFileSync('docs/reviews/P2-04a1/meter-route/safe-landing.replay.json', 'utf8'), LIMITS);
// Reuse only the independently checked input route; its old outcome predates LIFTOFF integration.
assert.equal(route.seed, 1);
assert.equal(
  createHash('sha256').update(JSON.stringify(route.inputs)).digest('hex'),
  '198e556b93536a985c2cfdf874a55ca97aee9d7ee27fafc3ffc616e4c0710055',
  'The reviewed 50-transition input route must remain unchanged',
);

const state = createSimState(route.seed, T);
const recorder = createRecorder(route.seed, T);
const modeEvents: [tick: number, kind: number, a: number, b: number][] = [];
let held = 0;
let nextInput = 0;
let crashCause = 0;
for (let tick = 0; tick < MAX_TICKS && state.status === SimStatus.running; tick++) {
  const input = route.inputs[nextInput];
  if (input?.[0] === tick) {
    held = input[1];
    nextInput++;
  }
  recorder.record(held);
  step(state, held, T);
  for (let i = 0; i < state.events.count; i++) {
    const kind = state.events.kind[i] ?? 0;
    const a = state.events.a[i] ?? 0;
    const b = state.events.b[i] ?? 0;
    if (kind >= SimEventKind.modeStarted && kind <= SimEventKind.trafficPhasedOut)
      modeEvents.push([state.tick, kind, a, b]);
    if (kind === SimEventKind.crash) crashCause = a;
  }
}

// Refuse to write a partial route or a replay that does not exercise the complete requested cycle.
assert.equal(nextInput, route.inputs.length);
assert.equal(held, 0);
assert.equal(state.status, SimStatus.crashed, `No natural crash within ${MAX_TICKS} ticks`);
for (const kind of [SimEventKind.modeStarted, SimEventKind.smash, SimEventKind.modeEnded, SimEventKind.modeGraceEnded])
  assert.ok(
    modeEvents.some((event) => event[1] === kind),
    `Missing required mode event ${kind}`,
  );
assert.ok(crashCause > 0, 'The terminal tick must report a real crash cause');

const replay = recorder.finish(state);
assert.deepEqual(replay.inputs, route.inputs);
const text = `${JSON.stringify(replay)}\n`;
const validation = playReplay(parseReplay(text, LIMITS), T);
assert.equal(validation.valid, true, validation.reason ?? 'The generated mode replay must round-trip');
writeFileSync('tests/replays/liftoff.json', text);
console.log(
  JSON.stringify({
    file: 'tests/replays/liftoff.json',
    ticks: replay.ticks,
    inputChanges: replay.inputs.length,
    score: replay.claimedScore,
    distanceM: replay.claimedDistanceM,
    hash: replay.finalHash,
    crashCause,
    modeEvents,
  }),
);
