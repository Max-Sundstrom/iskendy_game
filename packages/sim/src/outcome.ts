import { SimEventKind } from '@kometa/shared';
import { emit } from './events';
import { SimStatus, type SimState } from './state';

// Ending a run, shared by collisions and landings so neither imports the other.

export const CrashCause = { rear: 1, secondScrape: 2, landing: 3 } as const;

export function crash(state: SimState, cause: number): void {
  state.status = SimStatus.crashed;
  emit(state.events, SimEventKind.crash, cause);
}
