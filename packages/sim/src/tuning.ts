import defaultTuningJson from '@kometa/content/tuning.default.json';
import { parseTuning, tuningHash, type Tuning } from '@kometa/shared';

/** The shipped tuning, validated once at module load so a bad edit fails every test and build. */
export const DEFAULT_TUNING: Tuning = parseTuning(defaultTuningJson);

/** Hash of the shipped sim tuning; recorded in replays. */
export const DEFAULT_TUNING_HASH: string = tuningHash(DEFAULT_TUNING.sim);
