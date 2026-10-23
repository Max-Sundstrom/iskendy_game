import { SimEventKind } from '@kometa/shared';
import { emit } from './events';
import { SimStatus, type SimState } from './state';

// Ending a run, shared by collisions and landings so neither imports the other.

export const CrashCause = { rear: 1, secondScrape: 2, landing: 3 } as const;

export function crash(state: SimState, cause: number): void {
  // Stop future trick work but retain the exact terminal pose and completed counts for crash presentation.
  const p = state.player;
  p.flipping = false;
  p.flipQueued = false;
  p.rolling = false;
  p.rollQueuedDir = 0;
  state.status = SimStatus.crashed;
  emit(state.events, SimEventKind.crash, cause);
}
