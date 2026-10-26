import { ScoreReason, SimEventKind, type SimTuning } from '@kometa/shared';
import { describe, expect, it } from 'vitest';
import { emit, readEvents } from './events';
import { scoreTick } from './score';
import { createSimState, SimStatus, type SimState } from './state';
import { DEFAULT_TUNING } from './tuning';

const T = DEFAULT_TUNING.sim;
const fresh = () => createSimState(28, T);
const score = (s: SimState, tuning: SimTuning = T) => scoreTick(s, tuning, -1, 0, 0);
const emptyTick = (s: SimState) => {
  s.events.count = 0;
  score(s);
};

// G7/G10/G11: numeric source events are scored in their real producer order, not sorted by reason.
describe('style awards and streak settlement', () => {
  it('scores two flips, a roll and perfect landing with linear extra-flip points and unmultiplied meter', () => {
    const s = fresh();
    emit(s.events, SimEventKind.flipDone, 1);
    emit(s.events, SimEventKind.flipDone, 2);
    emit(s.events, SimEventKind.rollDone, 1, -1);
    emit(s.events, SimEventKind.landingGraded, 1, 2);
    score(s);
    expect(s.score).toEqual({
      total: 0,
      pot: 1290,
      streakN: 4,
      streakTicksLeft: 150,
      meter: 230,
      boostTicks: 0,
      roofDistanceM: 0,
    });
    expect(readEvents(s.events).slice(4)).toEqual([
      { kind: 'scoreAddedToPot', reason: ScoreReason.frontFlip, points: 900 },
      { kind: 'scoreAddedToPot', reason: ScoreReason.barrelRoll, points: 180 },
      { kind: 'scoreAddedToPot', reason: ScoreReason.perfectLanding, points: 210 },
    ]);
  });

  it.each([
    [0, 1, 4050],
    [1, 0, 3375],
  ])('keeps CLEAR/SEMI producer order (%i,%i)', (first, second, expected) => {
    const s = fresh();
    emit(s.events, SimEventKind.clear, 0, first);
    emit(s.events, SimEventKind.clear, 0, second);
    score(s);
    expect(s.score.pot).toBe(expected);
    expect(s.score.meter).toBe(260);
  });

  it('scores HOP then SLAM and retains a fractional sloppy bank', () => {
    const s = fresh();
    emit(s.events, SimEventKind.hop, 3, 1);
    score(s);
    expect(s.score.pot).toBe(212.5);
    s.events.count = 0;
    emit(s.events, SimEventKind.landingGraded, 3);
    score(s);
    expect(s.score.total).toBe(106.25);
    expect(s.score.pot).toBe(0);
    expect(s.score.streakN).toBe(0);
    expect(readEvents(s.events).at(-1)).toEqual({ kind: 'streakSettled', banked: 106.25, lost: 106.25 });
  });

  it('normalizes only the adjacent road slam/grade pair and never double-counts a platform slam', () => {
    for (const platform of [false, true]) {
      const s = fresh();
      if (platform) emit(s.events, SimEventKind.landingGraded, 1);
      emit(s.events, SimEventKind.land, 1);
      if (platform) emit(s.events, SimEventKind.rideStart, 0, 1);
      else emit(s.events, SimEventKind.landingGraded, 1);
      score(s);
      expect(s.score.pot).toBe(182.5);
      expect(s.score.streakN).toBe(2);
      expect(s.score.meter).toBe(40);
    }
    const separate = fresh();
    emit(separate.events, SimEventKind.land, 1);
    emit(separate.events, SimEventKind.clear, 0, 0);
    emit(separate.events, SimEventKind.landingGraded, 1);
    score(separate);
    expect(separate.score.pot).toBe(50 + 375 + 180);
  });

  it('keeps grade → HOP → SLAM order, and STUNT never also earns PERFECT', () => {
    const s = fresh();
    emit(s.events, SimEventKind.landingGraded, 1);
    emit(s.events, SimEventKind.hop, 1, 1);
    score(s);
    expect(s.score.pot).toBe(382.5);
    const stunt = fresh();
    emit(stunt.events, SimEventKind.landingGraded, 2);
    score(stunt);
    expect(stunt.score.pot).toBe(20);
    expect(stunt.score.meter).toBe(10);
    expect(stunt.score.streakN).toBe(1);
  });

  it('ignores input/start/plain land events and counts complete roll directions equally', () => {
    const s = fresh();
    emit(s.events, SimEventKind.slam);
    emit(s.events, SimEventKind.flipStart, 1);
    emit(s.events, SimEventKind.rollStart, 1, -1);
    emit(s.events, SimEventKind.land, 0);
    emit(s.events, SimEventKind.rideStart, 0, 1);
    score(s);
    expect(s.score.pot).toBe(0);
    expect(s.score.streakN).toBe(0);
    s.events.count = 0;
    emit(s.events, SimEventKind.rollDone, 1, -1);
    emit(s.events, SimEventKind.rollDone, 2, 1);
    score(s);
    expect(s.score.pot).toBe(270);
    expect(s.score.meter).toBe(80);
  });

  it('banks on the 150th empty tick, while an award at exact expiry refreshes the old series', () => {
    for (const awardAfter of [149, 150, 151]) {
      const s = fresh();
      emit(s.events, SimEventKind.land, 1);
      score(s);
      for (let tick = 1; tick < awardAfter; tick++) emptyTick(s);
      expect(s.score.streakTicksLeft).toBe(awardAfter <= 150 ? 151 - awardAfter : 0);
      s.events.count = 0;
      emit(s.events, SimEventKind.land, 1);
      score(s);
      expect(s.score.streakTicksLeft).toBe(150);
      expect(s.score.streakN).toBe(awardAfter <= 150 ? 2 : 1);
      expect(s.score.total).toBe(awardAfter <= 150 ? 0 : 50);
      expect(s.score.pot).toBe(awardAfter <= 150 ? 112.5 : 50);
    }
    const s = fresh();
    emit(s.events, SimEventKind.land, 1);
    score(s);
    for (let tick = 0; tick < 149; tick++) emptyTick(s);
    expect(s.score.streakTicksLeft).toBe(1);
    expect(s.score.total).toBe(0);
    emptyTick(s);
    expect(s.score.total).toBe(50);
    expect(s.score.streakN).toBe(0);
    emptyTick(s);
    expect(readEvents(s.events)).toEqual([]);
  });

  it.each(['event', 'status'] as const)(
    'late crash dominates sloppy, scrape, timeout and later awards via %s',
    (terminal) => {
      const s = fresh();
      Object.assign(s.score, { total: 77.25, pot: 100, streakN: 1, streakTicksLeft: 1 });
      emit(s.events, SimEventKind.landingGraded, 3);
      emit(s.events, SimEventKind.scrape);
      emit(s.events, SimEventKind.land, 1);
      if (terminal === 'event') emit(s.events, SimEventKind.crash, 1);
      else s.status = SimStatus.crashed;
      emit(s.events, SimEventKind.clear, 0, 0);
      score(s);
      expect(s.score.total).toBe(77.25);
      expect(s.score.pot).toBe(0);
      expect(s.score.streakN).toBe(0);
      expect(readEvents(s.events).filter((e) => e.kind === 'streakSettled')).toEqual([
        { kind: 'streakSettled', banked: 0, lost: 612.5 },
      ]);
    },
  );

  it('scrape takes precedence over sloppy and honors the explicit scrape bank ratio', () => {
    for (const ratio of [0, 0.25]) {
      const s = fresh();
      Object.assign(s.score, { pot: 100, streakN: 1, streakTicksLeft: 1 });
      emit(s.events, SimEventKind.landingGraded, 3);
      emit(s.events, SimEventKind.scrape);
      emit(s.events, SimEventKind.hop, 1, 1);
      score(s, { ...T, streak: { ...T.streak, scrapeBankRatio: ratio } });
      expect(s.score.total).toBe(362.5 * ratio);
      expect(s.score.pot).toBe(0);
      expect(s.score.streakN).toBe(0);
    }
  });

  it('caps multipliers at ×8 and meter at capacity, emits milestones10/20 before loss', () => {
    const s = fresh();
    for (let i = 0; i < 30; i++) emit(s.events, SimEventKind.hop, i + 1, 0);
    emit(s.events, SimEventKind.crash, 1);
    score(s);
    const out = readEvents(s.events);
    expect(out.filter((e) => e.kind === 'streakMilestone')).toEqual(
      [10, 20, 30].map((count) => ({ kind: 'streakMilestone', count })),
    );
    expect(out.at(-1)).toEqual({ kind: 'streakSettled', banked: 0, lost: 20775 });
    expect(s.score.meter).toBe(1000);
  });

  it('preserves >32 raw events, caps appended credits, and emits all milestones even at every=1', () => {
    const s = fresh();
    for (let i = 0; i < 64; i++) emit(s.events, SimEventKind.clear, i, 0);
    emit(s.events, SimEventKind.crash, 1);
    const prefix = readEvents(s.events);
    score(s, { ...T, streak: { ...T.streak, fireworksEvery: 1 } });
    const out = readEvents(s.events);
    expect(s.events.kind.length).toBe(1024);
    expect(out.slice(0, 65)).toEqual(prefix);
    expect(out).toHaveLength(65 + 1 + 64 + 1);
    expect(out.filter((e) => e.kind === 'streakMilestone').map((e) => e.count)).toEqual(
      Array.from({ length: 64 }, (_, i) => i + 1),
    );
    expect(s.score.total).toBe(0);
    expect(s.score.pot).toBe(0);
  });
});
