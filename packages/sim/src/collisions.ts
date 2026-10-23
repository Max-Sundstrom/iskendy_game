import { SimEventKind, type SimTuning } from '@kometa/shared';
import { emit } from './events';
import { laneCenterX, SimStatus, type SimState } from './state';
import { TRAFFIC_CAPACITY, vehicleCenterX, vehicleHalfWidth } from './traffic';
import { jumpPhysics } from './vertical';

// Player vs traffic (GDD §5.8–5.9, ARCHITECTURE §4.5). Boxes in lane space; the forward test is swept, using the
// positions at the start and end of the step, so nothing tunnels at 95 m/s (≈ 1.6 m per step).

export const CrashCause = { rear: 1, secondScrape: 2 } as const;

/** Where the player was at the start of this step, captured before anything moved. */
export type StepStart = { x: number; y: number; z: number };

function crash(state: SimState, cause: number): void {
  state.status = SimStatus.crashed;
  emit(state.events, SimEventKind.crash, cause);
}

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
  p.scrapeTimerS = tuning.collision.secondScrapeWindowS;
  p.airLiters = Math.max(0, p.airLiters - tuning.collision.scrapeAirLossL);
  emit(state.events, SimEventKind.scrape);
}

function hop(state: SimState, tuning: SimTuning, roofY: number): void {
  const p = state.player;
  const { gUp } = jumpPhysics(tuning);
  p.y = roofY;
  p.vy = Math.sqrt(2 * gUp * tuning.roofs.hopHeightM);
  p.airborne = true;
  p.slamming = false;
  emit(state.events, SimEventKind.hop);
}

/** Resolves contacts for this step; must run after the player and traffic have moved. */
export function resolveCollisions(state: SimState, tuning: SimTuning, start: StepStart, dt: number): void {
  const p = state.player;
  const t = state.traffic;
  const half = tuning.player.widthM / 2;
  const halfL = tuning.player.lengthM / 2;
  const tol = tuning.roofs.landingToleranceM;

  for (let i = 0; i < TRAFFIC_CAPACITY && state.status === SimStatus.running; i++) {
    if (t.active[i] === 0) continue;
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
    if (!zOverlap1 && !crossedRear) continue;

    const cx = vehicleCenterX(t, tuning, i);
    const vHalf = vehicleHalfWidth(t, tuning, i);
    const lat0 = Math.abs(start.x - cx) < half + vHalf;
    const lat1 = Math.abs(p.x - cx) < half + vHalf;
    if (!lat0 && !lat1) continue;

    const top = v.heightM;
    if (p.y >= top) continue; // clear above
    if (start.y >= top - tol && p.vy <= 0 && v.top !== 'none') {
      hop(state, tuning, top); // came down onto the roof (platform riding arrives in P2-01)
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
