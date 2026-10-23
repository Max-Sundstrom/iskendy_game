import type { RngState } from './rng';
import type { SimState } from './state';

// State hash (ARCHITECTURE §4.4): FNV-1a 32 over quantised fields. Identical in every engine because it only uses
// integer operations on values that the sim computed with + − × ÷.

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const TWO_32 = 4294967296;

function mixWord(h: number, word: number): number {
  let x = h;
  for (let shift = 0; shift < 32; shift += 8) {
    x ^= (word >>> shift) & 0xff;
    x = Math.imul(x, FNV_PRIME) >>> 0;
  }
  return x;
}

/** Mixes a number quantised to 1e-4 units, as two 32-bit halves so large distances don't wrap. */
function mixNumber(h: number, value: number): number {
  const q = Math.round(value * 10000);
  const hi = Math.floor(q / TWO_32);
  const lo = q - hi * TWO_32;
  return mixWord(mixWord(h, hi >>> 0), lo >>> 0);
}

function mixRng(h: number, r: RngState): number {
  return mixWord(mixWord(mixWord(mixWord(h, r.a), r.b), r.c), r.d);
}

/** 8-hex-digit hash of everything that defines the run's future. */
export function stateHash(s: SimState): string {
  const p = s.player;
  let h = FNV_OFFSET;
  h = mixWord(h, s.tick);
  h = mixWord(h, s.seed);
  h = mixWord(h, s.status);
  h = mixWord(h, s.prevHeld);
  h = mixWord(h, p.lane);
  h = mixWord(h, p.laneFrom);
  h = mixWord(h, p.laneTo);
  h = mixWord(h, p.changing ? 1 : 0);
  h = mixWord(h, p.queuedDir & 0xff);
  h = mixNumber(h, p.laneT);
  h = mixNumber(h, p.x);
  h = mixNumber(h, p.z);
  h = mixNumber(h, p.distanceM);
  h = mixNumber(h, p.speedMps);
  h = mixWord(h, (p.airborne ? 1 : 0) | (p.flying ? 2 : 0) | (p.slamming ? 4 : 0) | (p.boosting ? 8 : 0));
  h = mixNumber(h, p.y);
  h = mixNumber(h, p.vy);
  h = mixNumber(h, p.jumpHeldS);
  h = mixNumber(h, p.jumpBufferS);
  h = mixNumber(h, p.airLiters);
  h = mixNumber(h, p.laneStartX);
  h = mixNumber(h, p.penaltyS);
  h = mixNumber(h, p.scrapeTimerS);
  h = mixNumber(h, s.director.nextRowM);
  const t = s.traffic;
  for (let i = 0; i < t.active.length; i++) {
    if (t.active[i] === 0) continue;
    h = mixWord(h, i | ((t.type[i] ?? 0) << 8) | ((t.lane[i] ?? 0) << 16));
    h = mixNumber(h, t.z[i] ?? 0);
    h = mixNumber(h, t.speed[i] ?? 0);
  }
  h = mixRng(h, s.rng.director);
  h = mixRng(h, s.rng.pickups);
  return h.toString(16).padStart(8, '0');
}
