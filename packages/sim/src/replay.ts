import { tuningHash, type Replay, type SimTuning } from '@kometa/shared';
import { stateHash } from './hash';
import { SIM_VERSION } from './version';
import { createSimState, SimStatus, type SimState } from './state';
import { step } from './step';

// Input-log replays (ADR-002): seed + tuning hash + held masks on change reproduce a run exactly.

export type Recorder = {
  /** Call once per step with the mask that step received. */
  record(held: number): void;
  finish(state: SimState): Replay;
};

export function createRecorder(seed: number, tuning: SimTuning): Recorder {
  const inputs: [number, number][] = [];
  let tick = 0;
  let last = 0;
  return {
    record(held) {
      if (held !== last) {
        inputs.push([tick, held]);
        last = held;
      }
      tick++;
    },
    finish(state) {
      return {
        schemaVersion: 1,
        simVersion: SIM_VERSION,
        seed: seed >>> 0,
        tuningHash: tuningHash(tuning),
        mode: 'endless',
        ticks: state.tick,
        inputs: inputs.filter(([t]) => t < state.tick),
        claimedScore: Math.floor(state.score.total),
        claimedDistanceM: state.player.distanceM,
        finalHash: stateHash(state),
      };
    },
  };
}

export type ReplayResult = {
  state: SimState;
  hash: string;
  score: number;
  distanceM: number;
  valid: boolean;
  reason?: string;
};

/** Re-simulates a replay. `valid` means the final hash and the claimed score and distance all match. */
export function playReplay(replay: Replay, tuning: SimTuning): ReplayResult {
  const state = createSimState(replay.seed, tuning);
  const fail = (reason: string): ReplayResult => ({
    state,
    hash: stateHash(state),
    score: 0,
    distanceM: 0,
    valid: false,
    reason,
  });
  if (replay.simVersion !== SIM_VERSION) return fail(`simVersion ${replay.simVersion} ≠ ${SIM_VERSION}`);
  if (replay.tuningHash !== tuningHash(tuning)) return fail('tuningHash does not match this build');
  let next = 0;
  let held = 0;
  for (let t = 0; t < replay.ticks && state.status === SimStatus.running; t++) {
    const entry = replay.inputs[next];
    if (entry && entry[0] === t) {
      held = entry[1];
      next++;
    }
    step(state, held, tuning);
  }
  const hash = stateHash(state);
  const score = Math.floor(state.score.total);
  const distanceM = state.player.distanceM;
  const valid =
    hash === replay.finalHash &&
    score === replay.claimedScore &&
    distanceM === replay.claimedDistanceM &&
    state.tick === replay.ticks;
  return { state, hash, score, distanceM, valid, ...(valid ? {} : { reason: 'final state differs from the claim' }) };
}
