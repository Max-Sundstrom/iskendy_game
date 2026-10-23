import { writeFileSync } from 'node:fs';
import {
  Action,
  createRecorder,
  createSimState,
  DEFAULT_TUNING,
  SimStatus,
  step,
  TRAFFIC_CAPACITY,
  type SimState,
} from '@kometa/sim';
import { scriptedInputs } from '@kometa/sim/testing';

// Records the golden replays in tests/replays (ROADMAP P1-06). Re-run only when sim outcomes change on purpose and
// log the reason in DECISIONS → Sim changelog (ADR-024):  pnpm exec tsx tools/make-golden-replays.ts

const T = DEFAULT_TUNING.sim;
/** Nearest vehicle rear ahead in a lane, in metres (Infinity when the lane is open within the horizon). */
function gapAhead(s: SimState, lane: number): number {
  let best = Infinity;
  for (let i = 0; i < TRAFFIC_CAPACITY; i++) {
    if (s.traffic.active[i] === 0 || s.traffic.lane[i] !== lane) continue;
    const gap = (s.traffic.z[i] ?? 0) - s.player.z;
    if (gap > -2 && gap < best) best = gap;
  }
  return best;
}

/** A tiny dodging policy (the seed of P1-08's bots): change to an open neighbour lane, else jump. */
function dodger(s: SimState, tick: number): number {
  const p = s.player;
  if (p.changing || p.airborne || tick % 2 === 1) return 0; // release between presses so each is a new press
  if (gapAhead(s, p.lane) > 40) return 0;
  const left = p.lane > 0 ? gapAhead(s, p.lane - 1) : -1;
  const right = p.lane < T.lanes.count - 1 ? gapAhead(s, p.lane + 1) : -1;
  if (Math.max(left, right) > 45) return left >= right ? Action.left : Action.right;
  return Action.jump;
}

const GOLDENS: { name: string; seed: number; maxTicks: number }[] = [
  { name: 'early-crash', seed: 28, maxTicks: 60 * 60 },
  { name: 'busy-inputs', seed: 7, maxTicks: 60 * 60 },
  { name: 'long-run', seed: 1234, maxTicks: 60 * 90 },
];

for (const g of GOLDENS) {
  const state = createSimState(g.seed, T);
  const rec = createRecorder(g.seed, T);
  const inputs = scriptedInputs(g.seed * 31 + 5, g.maxTicks);
  for (let t = 0; t < g.maxTicks && state.status === SimStatus.running; t++) {
    const held = g.name === 'early-crash' ? 0 : g.name === 'long-run' ? dodger(state, t) : (inputs[t] ?? 0);
    rec.record(held);
    step(state, held, T);
  }
  const replay = rec.finish(state);
  writeFileSync(`tests/replays/${g.name}.json`, `${JSON.stringify(replay)}\n`);
  console.log(
    `${g.name}: ${replay.ticks} ticks, ${replay.inputs.length} input changes, score ${replay.claimedScore}, hash ${replay.finalHash}`,
  );
}
