import type { Replay } from '@kometa/shared';

// Keeps the last runs' replays on the device (ARCHITECTURE §4.7: "the client keeps the last 20 runs for debugging").
// Best effort: storage can be missing or full (scenario P10), and a lost replay never affects play.

const KEY = 'kometa.replays.v1';
const KEEP = 20;

export function storeReplay(replay: Replay, store: Storage | undefined = safeStore()): void {
  try {
    const raw = store?.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    const runs = Array.isArray(list) ? list.slice(-(KEEP - 1)) : [];
    runs.push(replay);
    store?.setItem(KEY, JSON.stringify(runs));
  } catch {
    // ignore: quota, private mode or blocked storage
  }
}

function safeStore(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
