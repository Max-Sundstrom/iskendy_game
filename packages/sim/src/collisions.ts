import { SimEventKind, type SimTuning } from '@kometa/shared';
import { emit } from './events';
import { laneCenterX, SimStatus, type SimState } from './state';
import { crash, CrashCause } from './outcome';
import { hop, startRide } from './roofs';
import { TRAFFIC_CAPACITY, vehicleCenterX, vehicleHalfWidth } from './traffic';

// Player vs traffic (GDD §5.8–5.9, ARCHITECTURE §4.5). Boxes in lane space; the forward test is swept, using the
// positions at the start and end of the step, so nothing tunnels at 95 m/s (≈ 1.6 m per step).

export { CrashCause };

/** Where the player was at the start of this step, captured before anything moved. */
export type StepStart = { x: number; y: number; z: number };

function scrape(state: SimState, tuning: SimTuning, start: StepStart): void {
  const p = state.player;
  if (p.scrapeTimerS > 0) {
    crash(state, CrashCause.secondScrape); // second scrape within the window (GDD §5.9)
    return;
  }
  // Back to where the step started, then ease home to the lane we came from.
  p.x = start.x;
  p.laneTo = p.lane;
  p.laneStartX = p.x;
  p.laneT = 0;
  p.changing = p.x !== laneCenterX(p.lane, tuning);
  p.queuedDir = 0;
  p.penaltyS = tuning.speed.scrapePenaltyDurationS;
  p.penaltyFactor = tuning.speed.scrapePenalty;
  p.scrapeTimerS = tuning.collision.secondScrapeWindowS;
  p.airLiters = Math.max(0, p.airLiters - tuning.collision.scrapeAirLossL);
  emit(state.events, SimEventKind.scrape);
}

/** Resolves contacts for this step; must run after the player and traffic have moved. */
export function resolveCollisions(state: SimState, tuning: SimTuning, start: StepStart, dt: number): void {
  const p = state.player;
  const t = state.traffic;
  const half = tuning.player.widthM / 2;
  const halfL = tuning.player.lengthM / 2;
  const tol = tuning.roofs.landingToleranceM;

  const seq = p.touchSeq + 1;
  for (let i = 0; i < TRAFFIC_CAPACITY && state.status === SimStatus.running; i++) {
    if (t.active[i] === 0 || i === p.rideSlot) continue;
    const v = tuning.vehicles[t.type[i] ?? 0];
    if (!v) continue;
    const rear1 = t.z[i] ?? 0;
    const rear0 = rear1 - (t.speed[i] ?? 0) * dt;
    const front1 = rear1 + v.lengthM;

    // Forward: signed gap from the player's front bumper to the vehicle's rear, before and after the step.
    const gap0 = rear0 - (start.z + halfL);
    const gap1 = rear1 - (p.z + halfL);
    const zOverlap1 = gap1 <= 0 && p.z - halfL < front1;
    const crossedRear = gap0 > 0 && gap1 <= 0;
    const cx = vehicleCenterX(t, tuning, i);
    const vHalf = vehicleHalfWidth(t, tuning, i);
    const lat0 = Math.abs(start.x - cx) < half + vHalf;
    const lat1 = Math.abs(p.x - cx) < half + vHalf;
    const top = v.heightM;

    // CLEAR / SEMI CLEARED (GDD §9): over the whole vehicle, rear to front, in the air and touching nothing.
    if (v.top !== 'none') {
      if (crossedRear && lat1 && p.airborne && p.y >= top) t.over[i] = seq;
      if (t.over[i] !== 0) {
        if (t.over[i] !== seq || !lat1) t.over[i] = 0;
        else if (p.z - halfL >= front1) {
          t.over[i] = 0;
          emit(state.events, SimEventKind.clear, t.type[i] ?? 0, v.top === 'platform' ? 1 : 0);
        }
      }
    }

    if (!zOverlap1 && !crossedRear) continue;
    if (!lat0 && !lat1) continue;
    if (p.y >= top) continue; // clear above
    if (start.y >= top - tol && p.vy <= 0 && v.top !== 'none') {
      // Came down onto the top: platforms are ridden, everything else bounces (G10, G11).
      if (v.top === 'platform') startRide(state, tuning, i, top);
      else hop(state, tuning, top);
      continue;
    }
    if (crossedRear) {
      crash(state, CrashCause.rear); // hit the back of the vehicle
    } else if (!lat0 && lat1) {
      scrape(state, tuning, start); // side contact while changing lanes
    } else {
      crash(state, CrashCause.rear); // already overlapping: treat as a hit, never pass through
    }
  }
}
