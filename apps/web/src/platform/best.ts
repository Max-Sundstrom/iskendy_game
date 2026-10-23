// Local personal best (ADR-019: no server in v1). Versioned record (invariant 10); storage may be unavailable or
// ephemeral in a partitioned iframe (scenario P11), so every access is guarded and failures fall back to "no best".

const KEY = 'kometa.best.v1';

export type BestRecord = { schemaVersion: 1; score: number; distanceM: number };

export function readBest(store: Storage | undefined = safeLocalStorage()): BestRecord | undefined {
  try {
    const raw = store?.getItem(KEY);
    if (!raw || raw.length > 256) return undefined;
    const v = JSON.parse(raw) as Partial<BestRecord>;
    if (v.schemaVersion !== 1 || typeof v.score !== 'number' || typeof v.distanceM !== 'number') return undefined;
    if (!Number.isFinite(v.score) || v.score < 0) return undefined;
    return { schemaVersion: 1, score: v.score, distanceM: v.distanceM };
  } catch {
    return undefined;
  }
}

/** Saves the run if it beats the stored best; returns true for a new best. */
export function submitBest(score: number, distanceM: number, store: Storage | undefined = safeLocalStorage()): boolean {
  const best = readBest(store);
  if (best && best.score >= score) return false;
  try {
    store?.setItem(KEY, JSON.stringify({ schemaVersion: 1, score, distanceM } satisfies BestRecord));
  } catch {
    // quota or blocked storage: the run still counts as a best on screen
  }
  return true;
}

function safeLocalStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
