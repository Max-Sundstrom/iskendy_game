import { CrashCause, createSimState, DEFAULT_TUNING, SimStatus, step } from '@kometa/sim';
import type { SimTuning } from '@kometa/shared';
import { chaos, novice, type Bot } from './policies';

// Runs a bot for many seeds and collects the numbers the balance dashboard needs (TEST_STRATEGY §3).

export type RunStats = {
  distanceM: number;
  timeS: number;
  cause: 'rear' | 'secondScrape' | 'timeout';
  airUsedL: number;
};

export type BotReport = {
  bot: string;
  runs: number;
  medianM: number;
  p10M: number;
  p90M: number;
  maxM: number;
  causes: Record<RunStats['cause'], number>;
  /** Histogram of distance in 250 m buckets: [bucketStartM, count]. */
  histogram: [number, number][];
  anomalies: string[];
};

const MAX_TICKS = 60 * 60 * 10; // a 10-minute cap so a bot that never crashes still ends

export function playOne(bot: Bot, seed: number, tuning: SimTuning): RunStats {
  const s = createSimState(seed, tuning);
  let airUsed = 0;
  let prevAir = s.player.airLiters;
  for (let t = 0; t < MAX_TICKS && s.status === SimStatus.running; t++) {
    step(s, bot.decide(s), tuning);
    if (s.player.airLiters < prevAir) airUsed += prevAir - s.player.airLiters;
    prevAir = s.player.airLiters;
    const p = s.player;
    if (![p.x, p.y, p.z, p.speedMps, p.airLiters].every(Number.isFinite))
      throw new Error(`non-finite state at seed ${seed} tick ${t}`);
  }
  const lastCause = s.events.count > 0 ? s.events.a[s.events.count - 1] : 0;
  const cause =
    s.status !== SimStatus.crashed ? 'timeout' : lastCause === CrashCause.secondScrape ? 'secondScrape' : 'rear';
  return { distanceM: s.player.distanceM, timeS: s.tick / tuning.tickRateHz, cause, airUsedL: airUsed };
}

const quantile = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;

export function runBot(
  make: (seed: number) => Bot,
  runs: number,
  firstSeed: number,
  tuning: SimTuning = DEFAULT_TUNING.sim,
): BotReport {
  const stats: RunStats[] = [];
  const anomalies: string[] = [];
  let name = '';
  for (let i = 0; i < runs; i++) {
    const bot = make(firstSeed + i);
    name = bot.name;
    try {
      stats.push(playOne(bot, firstSeed + i, tuning));
    } catch (error) {
      anomalies.push(String(error));
    }
  }
  const d = stats.map((r) => r.distanceM).sort((a, b) => a - b);
  const buckets = new Map<number, number>();
  for (const x of d) buckets.set(Math.floor(x / 250) * 250, (buckets.get(Math.floor(x / 250) * 250) ?? 0) + 1);
  const causes = { rear: 0, secondScrape: 0, timeout: 0 };
  for (const r of stats) causes[r.cause]++;
  return {
    bot: name,
    runs: stats.length,
    medianM: quantile(d, 0.5),
    p10M: quantile(d, 0.1),
    p90M: quantile(d, 0.9),
    maxM: d.at(-1) ?? 0,
    causes,
    histogram: [...buckets.entries()].sort((a, b) => a[0] - b[0]),
    anomalies,
  };
}

export const BOTS = {
  novice: (seed: number) => novice(seed, DEFAULT_TUNING.sim),
  chaos: (seed: number) => chaos(seed),
};
