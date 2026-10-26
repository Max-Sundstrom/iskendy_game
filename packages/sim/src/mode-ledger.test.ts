import { ModeKind, ScoreReason, SimEventKind } from '@kometa/shared';
import { describe, expect, it } from 'vitest';
import { createEventBuffer, emit, readEvents } from './events';
import { stateHash } from './hash';
import { arm, emptyRoad, obstacle, T } from './mode-test-helpers';
import { scoreTick } from './score';
import { SimStatus } from './state';
import { step } from './step';

describe('persistent mode hash and numeric event contract', () => {
  it('hashes all four persistent mode fields independently', () => {
    const s = emptyRoad();
    const idleHash = stateHash(s);
    for (const field of ['kind', 'activeTicksLeft', 'graceTicksLeft', 'smashChain'] as const) {
      s.mode[field] = 1;
      expect(stateHash(s), field).not.toBe(idleHash);
      s.mode[field] = 0;
      expect(stateHash(s), field).toBe(idleHash);
    }
  });

  it.each(['activeTicksLeft', 'graceTicksLeft', 'smashChain'] as const)(
    'preserves upper bits and adjacent safe integers in %s',
    (field) => {
      const s = emptyRoad();
      s.mode.kind = ModeKind.liftoff;
      const values = [0, 1, 2 ** 32 - 1, 2 ** 32, 2 ** 32 + 1, Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER];
      const hashes = values.map((value) => {
        s.mode[field] = value;
        return stateHash(s);
      });
      // 0 vs 2^32 catches truncation; the final neighbours catch precision lost through decimal quantization.
      expect(new Set(hashes).size).toBe(values.length);
    },
  );

  it('decodes the frozen raw codes and payloads without truncating counters or fractional credits', () => {
    expect(ModeKind).toEqual({ none: 0, liftoff: 1 });
    expect(ScoreReason.smash).toBe(12);
    expect([
      SimEventKind.modeStarted,
      SimEventKind.modeEnded,
      SimEventKind.modeGraceEnded,
      SimEventKind.smash,
      SimEventKind.trafficPhasedOut,
    ]).toEqual([27, 28, 29, 30, 31]);
    const buffer = createEventBuffer();
    buffer.count = 6;
    buffer.kind.set([27, 28, 29, 30, 31, 23]);
    buffer.a.set([1, 1, 123, 12, 6, 12]);
    buffer.b.set([2 ** 32 + 3, 2 ** 32 + 5, 456, Number.MAX_SAFE_INTEGER, 0, 137.5]);
    expect(readEvents(buffer)).toEqual([
      { kind: 'modeStarted', mode: 'liftoff', activeTicks: 2 ** 32 + 3 },
      { kind: 'modeEnded', mode: 'liftoff', graceTicks: 2 ** 32 + 5 },
      { kind: 'modeGraceEnded' },
      { kind: 'smash', vehicleType: 12, chain: Number.MAX_SAFE_INTEGER },
      { kind: 'trafficPhasedOut', vehicleType: 6 },
      { kind: 'scoreAddedToPot', reason: ScoreReason.smash, points: 137.5 },
    ]);
  });
});

// G25 / GDD §9: chain changes the SMASH base; producer order independently changes the current streak multiplier.
describe('SMASH style ledger', () => {
  it.each([
    { clearFirst: false, pot: 632.5, smashCredit: 257.5, clearCredit: 375 },
    { clearFirst: true, pot: 582.5, smashCredit: 282.5, clearCredit: 300 },
  ])('retains producer order with CLEAR first=$clearFirst', ({ clearFirst, pot, smashCredit, clearCredit }) => {
    const s = emptyRoad();
    if (clearFirst) emit(s.events, SimEventKind.clear, 0, 0);
    emit(s.events, SimEventKind.smash, 0, 1);
    if (!clearFirst) emit(s.events, SimEventKind.clear, 0, 0);
    emit(s.events, SimEventKind.smash, 0, 2);
    const source = readEvents(s.events);
    scoreTick(s, T, -1, 0, 0);
    // SMASH bases 100/105 and CLEAR 300 receive ×1/×1.25/×1.5 in their original order.
    expect(s.score.pot).toBe(pot);
    expect(s.score.total).toBe(0);
    expect(s.score.streakN).toBe(3);
    expect(s.score.meter).toBe(60); // only CLEAR fills the meter
    expect(readEvents(s.events).slice(0, 3)).toEqual(source);
    expect(readEvents(s.events).slice(3)).toEqual([
      { kind: 'scoreAddedToPot', reason: ScoreReason.clear, points: clearCredit },
      { kind: 'scoreAddedToPot', reason: ScoreReason.smash, points: smashCredit },
    ]);
  });

  it('scores 64 real destructions against an independent capped-chain sum, with zero meter gain', () => {
    const s = emptyRoad();
    arm(s, 2);
    for (let slot = 0; slot < 64; slot++) obstacle(s, slot);
    step(s, 0, T);

    // GDD defaults: Σ(k=0…20)(100+5k)(1+k/4) = 11987.5;
    // next seven awards: 200 × (6.25+…+7.75) = 9800; final 36: 200 × 8 × 36 = 57600.
    const expectedPot = 11987.5 + 9800 + 57600;
    const events = readEvents(s.events);
    expect(s.score.pot).toBe(expectedPot);
    expect(s.score.total).toBe(s.player.distanceM * T.score.perMeter);
    expect(s.score.streakN).toBe(64);
    expect(s.score.meter).toBe(0);
    expect(s.mode.smashChain).toBe(64);
    expect(events.filter((e) => e.kind === 'smash').map((e) => e.chain)).toEqual(
      Array.from({ length: 64 }, (_, i) => i + 1),
    );
    expect(events.filter((e) => e.kind === 'scoreAddedToPot')).toEqual([
      { kind: 'scoreAddedToPot', reason: ScoreReason.smash, points: expectedPot },
    ]);
    expect(events.some((e) => e.kind === 'streakSettled')).toBe(false);
  });
});

// G7/G24: phase transitions do not introduce a second settlement policy for the ordinary style pot.
describe('mode expiry and ordinary settlement priority', () => {
  it.each(['active', 'grace'] as const)('keeps a live pot through %s expiry without banking or losing it', (phase) => {
    const s = emptyRoad();
    arm(s, phase === 'active' ? 1 : 0, phase === 'grace' ? 1 : 0);
    Object.assign(s.score, { total: 17.25, pot: 73.25, streakN: 2, streakTicksLeft: 4 });
    step(s, 0, T);
    expect(s.score.pot).toBe(73.25);
    expect(s.score.streakN).toBe(2);
    expect(s.score.streakTicksLeft).toBe(3);
    expect(s.score.total).toBe(17.25 + s.player.distanceM * T.score.perMeter);
    expect(readEvents(s.events)).toEqual([
      phase === 'active' ? { kind: 'modeEnded', mode: 'liftoff', graceTicks: 60 } : { kind: 'modeGraceEnded' },
    ]);
  });

  it.each(['active', 'grace'] as const)('banks an ordinary timeout once before the %s-expiry event', (phase) => {
    const s = emptyRoad();
    arm(s, phase === 'active' ? 1 : 0, phase === 'grace' ? 1 : 0);
    Object.assign(s.score, { pot: 125.5, streakN: 2, streakTicksLeft: 1 });
    step(s, 0, T);
    expect(readEvents(s.events)).toEqual([
      { kind: 'streakSettled', banked: 125.5, lost: 0 },
      phase === 'active' ? { kind: 'modeEnded', mode: 'liftoff', graceTicks: 60 } : { kind: 'modeGraceEnded' },
    ]);
    expect(s.score.total).toBe(s.player.distanceM * T.score.perMeter + 125.5);
    expect(s.score.pot).toBe(0);
    expect(s.score.streakN).toBe(0);
    step(s, 0, T);
    expect(readEvents(s.events).some((e) => e.kind === 'streakSettled')).toBe(false);
  });

  it('refreshes the old series with a last-active-tick SMASH at the exact streak deadline', () => {
    const s = emptyRoad();
    arm(s, 1);
    Object.assign(s.score, { pot: 40, streakN: 1, streakTicksLeft: 1 });
    obstacle(s, 0);
    step(s, 0, T);
    expect(s.score.pot).toBe(40 + 100 * 1.25);
    expect(s.score.streakN).toBe(2);
    expect(s.score.streakTicksLeft).toBe(150);
    expect(s.score.meter).toBe(0);
    expect(readEvents(s.events).some((e) => e.kind === 'streakSettled')).toBe(false);
    expect(readEvents(s.events).at(-1)).toEqual({ kind: 'modeEnded', mode: 'liftoff', graceTicks: 60 });
  });

  it('loses the pending pot to a real ordinary crash immediately after grace, even at timeout', () => {
    const s = emptyRoad();
    arm(s, 0, 1);
    Object.assign(s.score, { total: 17.25, pot: 42.5, streakN: 1, streakTicksLeft: 2 });
    step(s, 0, T);
    expect(s.mode.kind).toBe(ModeKind.none);
    expect(s.score.streakTicksLeft).toBe(1);
    obstacle(s, 0, 'sedan', s.player.z);
    step(s, 0, T);
    expect(s.status).toBe(SimStatus.crashed);
    expect(s.score.total).toBeCloseTo(17.25 + s.player.distanceM * T.score.perMeter, 10);
    expect(s.score.pot).toBe(0);
    expect(s.score.streakN).toBe(0);
    expect(readEvents(s.events)).toEqual([
      { kind: 'crash', cause: 'rear' },
      { kind: 'streakSettled', banked: 0, lost: 42.5 },
    ]);
  });

  it.each(['event', 'status'] as const)('settles all late SMASH credits once when crash is reported by %s', (via) => {
    const tuning = { ...T, streak: { ...T.streak, scrapeBankRatio: 0.25 } };
    const s = emptyRoad(tuning);
    Object.assign(s.score, { total: 77.25, pot: 100, streakN: 1, streakTicksLeft: 1 });
    emit(s.events, SimEventKind.landingGraded, 3);
    emit(s.events, SimEventKind.scrape);
    emit(s.events, SimEventKind.smash, 0, 1);
    if (via === 'event') emit(s.events, SimEventKind.crash, 1);
    else s.status = SimStatus.crashed;
    emit(s.events, SimEventKind.smash, 1, 2);
    scoreTick(s, tuning, -1, 0, 0);
    // This isolates the scoring contract: a later source event cannot reopen an already broken same-tick series.
    expect(s.score.total).toBe(77.25);
    expect(s.score.pot).toBe(0);
    expect(s.score.streakN).toBe(0);
    expect(s.score.meter).toBe(0);
    expect(readEvents(s.events).filter((e) => e.kind === 'scoreAddedToPot')).toEqual([
      { kind: 'scoreAddedToPot', reason: ScoreReason.smash, points: 282.5 },
    ]);
    expect(readEvents(s.events).filter((e) => e.kind === 'streakSettled')).toEqual([
      { kind: 'streakSettled', banked: 0, lost: 382.5 },
    ]);
    expect(readEvents(s.events).at(-1)?.kind).toBe('streakSettled');
  });
});
