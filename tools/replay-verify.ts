import { readFileSync } from 'node:fs';
import { DEFAULT_TUNING, playReplay } from '@kometa/sim';
import { parseReplay } from '@kometa/shared';

// `pnpm replay:verify <file>` (AGENTS §5): re-simulates a recorded run and prints its state hash and score.
const file = process.argv[2];
if (!file) {
  console.error('usage: pnpm replay:verify <replay.json>');
  process.exit(2);
}
const replay = parseReplay(readFileSync(file, 'utf8'), DEFAULT_TUNING.server.replay);
const r = playReplay(replay, DEFAULT_TUNING.sim);
console.log(
  `${file}: hash ${r.hash} · score ${r.score} · ${r.distanceM.toFixed(1)} m · ${replay.ticks} ticks · ${r.valid ? 'OK' : `MISMATCH (${r.reason})`}`,
);
process.exit(r.valid ? 0 : 1);
