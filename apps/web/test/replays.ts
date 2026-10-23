import { DEFAULT_TUNING, playReplay } from '@kometa/sim';
import { parseReplay } from '@kometa/shared';
import busy from '../../../tests/replays/busy-inputs.json';
import early from '../../../tests/replays/early-crash.json';
import long from '../../../tests/replays/long-run.json';

const results = Object.entries({ 'busy-inputs': busy, 'early-crash': early, 'long-run': long }).map(([name, raw]) => {
  const r = playReplay(parseReplay(JSON.stringify(raw), DEFAULT_TUNING.server.replay), DEFAULT_TUNING.sim);
  return { name, hash: r.hash, valid: r.valid };
});
document.body.dataset['results'] = JSON.stringify(results);
