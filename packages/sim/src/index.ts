import { SCHEMA_VERSION } from '@kometa/shared';

/** Bumped on any change to sim outcomes; replays carry it (invariant 10). */
export const SIM_VERSION = 1;

/** Schema version the sim's replays and snapshots are written with. */
export const SIM_SCHEMA_VERSION = SCHEMA_VERSION;
