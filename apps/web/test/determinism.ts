import { createSimState, DEFAULT_TUNING, stateHash, step } from '@kometa/sim';
import { scriptedInputs } from '@kometa/sim/testing';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 7);
const ticks = Number(params.get('ticks') ?? 10000);
const state = createSimState(seed, DEFAULT_TUNING.sim);
for (const held of scriptedInputs(seed, ticks)) step(state, held, DEFAULT_TUNING.sim);
document.body.dataset['hash'] = stateHash(state);
document.body.dataset['tick'] = String(state.tick);
