import { ScoreReason, SimEventKind, type SimTuning } from '@kometa/shared';
import { awardAction, awardPulse, beginCredits, finishCredits, refreshStreak, settleStreak } from './score-ledger';
import { SimStatus, type SimState } from './state';
import { LandingGrade } from './tricks';

function landingAward(state: SimState, tuning: SimTuning, grade: number): void {
  if (grade === LandingGrade.perfect) {
    awardAction(
      state,
      tuning,
      ScoreReason.perfectLanding,
      tuning.score.perfectLanding,
      tuning.meterGain.perfectLanding,
    );
  } else if (grade === LandingGrade.stunt) {
    awardAction(state, tuning, ScoreReason.stuntLanding, tuning.score.stuntLanding, tuning.meterGain.stuntLanding);
  }
}

function boostPulse(state: SimState, tuning: SimTuning): void {
  const s = state.score;
  if (!state.player.boosting) {
    s.boostTicks = 0;
    return;
  }
  s.boostTicks++;
  if (s.boostTicks < Math.ceil(tuning.scoring.boostIntervalS * tuning.tickRateHz)) return;
  s.boostTicks = 0;
  awardPulse(
    state,
    tuning,
    ScoreReason.boost,
    tuning.score.boostPerQuarterSecond,
    tuning.meterGain.boostPerQuarterSecond,
    tuning.scoring.boostTarget,
  );
}

function roofPulse(
  state: SimState,
  tuning: SimTuning,
  startRideSlot: number,
  distanceM: number,
  platformTravelM: number,
  boundary: boolean,
): void {
  const s = state.score;
  const t = state.traffic;
  if (
    boundary ||
    startRideSlot < 0 ||
    state.player.rideSlot !== startRideSlot ||
    t.active[startRideSlot] !== 1 ||
    tuning.vehicles[t.type[startRideSlot] ?? 0]?.top !== 'platform'
  ) {
    s.roofDistanceM = 0;
    return;
  }
  s.roofDistanceM +=
    tuning.scoring.roofRideDistanceBasis === 'world' ? distanceM : Math.max(0, distanceM - platformTravelM);
  // Numerical comparison band, not extra gameplay distance: 7.2e-14 m at the default 10 m interval.
  // This absorbs ordinary accumulated/subtracted roundoff; an interval short by 1e-10 m stays incomplete.
  const allowance = 32 * Number.EPSILON * Math.max(tuning.scoring.roofRideIntervalM, s.roofDistanceM);
  const pulses = Math.floor((s.roofDistanceM + allowance) / tuning.scoring.roofRideIntervalM);
  if (pulses === 0) return;
  s.roofDistanceM = Math.max(0, s.roofDistanceM - pulses * tuning.scoring.roofRideIntervalM);
  // Every pulse has the same N, ledger and multiplier; aggregate without an unbounded loop for tiny intervals.
  awardPulse(
    state,
    tuning,
    ScoreReason.roofRide,
    pulses * tuning.score.roofRidePer10m,
    pulses * tuning.meterGain.roofRidePer10m,
    tuning.scoring.roofRideTarget,
  );
  refreshStreak(state, tuning);
}

/** Scores the original physics-event prefix, then settles once after every possible same-tick loss. */
export function scoreTick(
  state: SimState,
  tuning: SimTuning,
  startRideSlot: number,
  distanceM: number,
  platformTravelM: number,
): void {
  const events = state.events;
  const count = events.count;
  const previousN = state.score.streakN;
  if (state.score.streakTicksLeft > 0) state.score.streakTicksLeft--;
  beginCredits();
  let crashed = state.status === SimStatus.crashed;
  let scraped = false;
  let sloppy = false;
  let rideBoundary = false;
  for (let i = 0; i < count; i++) {
    const kind = events.kind[i];
    const a = events.a[i] ?? 0;
    const b = events.b[i] ?? 0;
    switch (kind) {
      case SimEventKind.nearMiss:
        awardAction(state, tuning, ScoreReason.nearMiss, tuning.score.nearMiss, tuning.meterGain.nearMiss);
        break;
      case SimEventKind.clear:
        if (b === 1)
          awardAction(state, tuning, ScoreReason.semiCleared, tuning.score.semiCleared, tuning.meterGain.semiCleared);
        else awardAction(state, tuning, ScoreReason.clear, tuning.score.clear, tuning.meterGain.clear);
        break;
      case SimEventKind.flipDone:
        awardAction(
          state,
          tuning,
          ScoreReason.frontFlip,
          tuning.score.frontFlip * (1 + tuning.score.extraFlipBonus * (a - 1)),
          tuning.meterGain.frontFlip,
        );
        break;
      case SimEventKind.rollDone:
        awardAction(state, tuning, ScoreReason.barrelRoll, tuning.score.barrelRoll, tuning.meterGain.barrelRoll);
        break;
      case SimEventKind.landingGraded:
        landingAward(state, tuning, a);
        if (a === LandingGrade.sloppy) sloppy = true;
        break;
      case SimEventKind.hop:
        awardAction(state, tuning, ScoreReason.hop, tuning.score.hop, tuning.meterGain.hop);
        if (b === 1) awardAction(state, tuning, ScoreReason.slam, tuning.score.slam, tuning.meterGain.slam);
        break;
      case SimEventKind.land:
        if (a !== 1) break;
        // Road integration emits land before its grade; roof integration already emits grade first.
        // Normalize just this adjacent pair, preserving all other producer/traffic-slot order.
        if (i + 1 < count && events.kind[i + 1] === SimEventKind.landingGraded) {
          const grade = events.a[++i] ?? 0;
          landingAward(state, tuning, grade);
          if (grade === LandingGrade.sloppy) sloppy = true;
        }
        awardAction(state, tuning, ScoreReason.slam, tuning.score.slam, tuning.meterGain.slam);
        break;
      case SimEventKind.crash:
        crashed = true;
        break;
      case SimEventKind.scrape:
        scraped = true;
        break;
      case SimEventKind.rideStart:
      case SimEventKind.rideEnd:
        rideBoundary = true;
        break;
    }
  }
  boostPulse(state, tuning);
  roofPulse(state, tuning, startRideSlot, distanceM, platformTravelM, rideBoundary);
  finishCredits(state, tuning, previousN);
  if (crashed) settleStreak(state, 0);
  else if (scraped) settleStreak(state, tuning.streak.scrapeBankRatio);
  else if (sloppy) settleStreak(state, tuning.streak.sloppyBankRatio);
  else if (state.score.streakTicksLeft === 0) settleStreak(state, 1);
}
