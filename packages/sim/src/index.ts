import { SCHEMA_VERSION } from '@kometa/shared';

import { SIM_VERSION } from './version';

export { SIM_VERSION };

/** Schema version the sim's replays and snapshots are written with. */
export const SIM_SCHEMA_VERSION = SCHEMA_VERSION;

export { createEventBuffer, readEvents, type EventBuffer } from './events';
export { stateHash } from './hash';
export { Action, ACTION_MASK, pressed } from './input';
export { easeOutCubic, saturatingExp } from './math';
export { createRng, nextFloat, nextInt, nextU32, type RngState } from './rng';
export { createSimState, laneCenterX, SimStatus, type PlayerState, type SimState } from './state';
export { speedAtDistance, step } from './step';
export { DEFAULT_TUNING, DEFAULT_TUNING_HASH } from './tuning';
export { CrashCause } from './collisions';
export { difficulty, type DirectorState } from './director';
export { TRAFFIC_CAPACITY, type Traffic } from './traffic';
export { FlyStop, jumpPhysics } from './vertical';
export { createRecorder, playReplay, type Recorder, type ReplayResult } from './replay';
