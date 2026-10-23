import { Action, createRng, nextFloat, nextInt, TRAFFIC_CAPACITY, type RngState, type SimState } from '@kometa/sim';
import type { SimTuning } from '@kometa/shared';

// Synthetic players (TEST_STRATEGY §3): they read the sim state like eyes and press actions like thumbs, through the
// same Action interface as people, so they also exercise replays. Their randomness is their own stream, never the sim's.

export type Bot = { name: string; decide(s: SimState): number };

/** Distance to the nearest vehicle rear ahead in a lane (Infinity if open), seen from the player's front bumper. */
export function gapAhead(s: SimState, tuning: SimTuning, lane: number): number {
  let best = Infinity;
  const front = s.player.z + tuning.player.lengthM / 2;
  for (let i = 0; i < TRAFFIC_CAPACITY; i++) {
    if (s.traffic.active[i] === 0 || s.traffic.lane[i] !== lane) continue;
    const v = tuning.vehicles[s.traffic.type[i] ?? 0];
    const rear = s.traffic.z[i] ?? 0;
    if (rear + (v?.lengthM ?? 0) < front - tuning.player.lengthM) continue; // already passed
    best = Math.min(best, rear - front);
  }
  return best;
}

/**
 * Novice: reacts after `reactionS`, stays on the ground (lane changes only, no jumps), and presses the wrong
 * direction `errorRate` of the time.
 */
export function novice(seed: number, tuning: SimTuning, reactionS = 0.35, errorRate = 0.1): Bot {
  const rng: RngState = createRng(seed, 1001);
  const delay = Math.round(reactionS * tuning.tickRateHz);
  const queue: number[] = [];
  let lastPress = 0;
  return {
    name: 'novice',
    decide(s) {
      // Decide on what is seen now; the press lands `delay` ticks later.
      let intent = 0;
      const p = s.player;
      const lookahead = p.speedMps * 1.1; // about a second of road
      if (!p.changing && gapAhead(s, tuning, p.lane) < lookahead) {
        const left = p.lane > 0 ? gapAhead(s, tuning, p.lane - 1) : -1;
        const right = p.lane < tuning.lanes.count - 1 ? gapAhead(s, tuning, p.lane + 1) : -1;
        intent = left >= right ? Action.left : Action.right;
        if (nextFloat(rng) < errorRate) intent = intent === Action.left ? Action.right : Action.left;
      }
      queue.push(intent);
      const due = queue.length > delay ? (queue.shift() ?? 0) : 0;
      // Release for a tick between presses so each one is a fresh press.
      const out = due !== 0 && lastPress === 0 ? due : 0;
      lastPress = out;
      return out;
    },
  };
}

/** Chaos: random masks held for random 1–40 ticks; finds crashes, NaNs and stuck states. */
export function chaos(seed: number): Bot {
  const rng = createRng(seed, 1002);
  let held = 0;
  let left = 0;
  return {
    name: 'chaos',
    decide() {
      if (left-- <= 0) {
        held = nextInt(rng, 64);
        left = 1 + nextInt(rng, 40);
      }
      return held;
    },
  };
}
