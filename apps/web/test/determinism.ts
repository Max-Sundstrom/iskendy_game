import { DEFAULT_TUNING } from '@kometa/sim';
import { runScripted } from '@kometa/sim/testing';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 7);
const ticks = Number(params.get('ticks') ?? 10000);
const { hash, runs } = runScripted(seed, ticks, DEFAULT_TUNING.sim);
document.body.dataset['hash'] = hash;
document.body.dataset['runs'] = String(runs);
