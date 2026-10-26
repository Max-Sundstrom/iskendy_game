import { SimEventKind, type SimTuning } from '@kometa/shared';
import { describe, expect, it } from 'vitest';
import { runDirector } from './director';
import { emit, readEvents } from './events';
import { stateHash } from './hash';
import { finishNearMisses, invalidateNearMiss, NearPass, prepareNearMisses } from './near-miss';
import { scoreTick } from './score';
import { createSimState, SimStatus, type SimState } from './state';
import { DEFAULT_TUNING } from './tuning';

const T = DEFAULT_TUNING.sim;
const V = T.vehicles[0];
if (!V) throw new Error('missing test vehicle');
const halfL = T.player.lengthM / 2;
const width = (T.player.widthM + V.widthM) / 2;
const exit = V.lengthM + halfL;
const setup = () => {
  const s = createSimState(1, T);
  s.director.nextRowM = Infinity;
  s.traffic.active[0] = 1;
  s.traffic.type[0] = 0;
  s.traffic.lane[0] = s.player.lane;
  return s;
};
function pass(s: SimState, from: number, to: number, fromX = width + 0.3, toX = fromX, tuning: SimTuning = T) {
  s.events.count = 0;
  Object.assign(s.player, { x: toX, y: 0, z: to });
  prepareNearMisses(s, tuning, { x: fromX, y: 0, z: from }, -1, 1 / 60);
  finishNearMisses(s, tuning);
  scoreTick(s, tuning, -1, 0, 0);
  s.tick++;
  return readEvents(s.events).filter((e) => e.kind === 'nearMiss');
}

describe('completed-pass lifecycle (G23)', () => {
  it.each([-1, 1])('awards a full one-tick pass once on side%i and banks50 after150ticks', (sign) => {
    const s = setup();
    expect(pass(s, -halfL - 1, exit, sign * (width + 0.6))).toEqual([{ kind: 'nearMiss', vehicleType: 0, slot: 0 }]);
    expect(s.traffic.nearMiss[0]).toBe(NearPass.awarded);
    expect(s.score).toMatchObject({ total: 0, pot: 50, meter: 10, streakN: 1, streakTicksLeft: 150 });
    expect(pass(s, exit, -halfL - 1, sign * (width + 0.3))).toEqual([]);
    expect(pass(s, -halfL - 1, exit, sign * (width + 0.3))).toEqual([]);
    for (let i = 0; i < 148; i++) {
      s.events.count = 0;
      scoreTick(s, T, -1, 0, 0);
    }
    expect(s.score.total).toBe(50);
    expect(s.score.pot).toBe(0);
  });

  it('arms after exact entry contact and finishes at exact exit', () => {
    const s = setup();
    pass(s, -halfL - 1, -halfL);
    expect(s.traffic.nearMiss[0]).toBe(NearPass.idle);
    pass(s, -halfL, 0);
    expect(s.traffic.nearMiss[0]).toBe(NearPass.qualified);
    expect(pass(s, 0, exit)).toHaveLength(1);
  });

  it('remembers a close interval even if the exit is wide', () => {
    const s = setup();
    pass(s, -halfL - 1, 0, width + 0.8);
    expect(s.traffic.nearMiss[0]).toBe(NearPass.passing);
    pass(s, 0, 1, width + 0.8, width + 0.2);
    expect(s.traffic.nearMiss[0]).toBe(NearPass.qualified);
    expect(pass(s, 1, exit, width + 0.2, width + 2)).toHaveLength(1);
  });

  it('does not arm newly initialized alongside, receding or zero-relative-speed traffic', () => {
    const s = setup();
    expect(pass(s, 0, exit)).toEqual([]);
    expect(pass(s, exit, 0)).toEqual([]);
    expect(pass(s, 0, 0)).toEqual([]);
    expect(s.traffic.nearMiss[0]).toBe(NearPass.idle);
  });

  it('cancels behind separation, permits failed/wide retry, and does not spend a failed pass', () => {
    const s = setup();
    pass(s, -halfL - 1, 0);
    pass(s, 0, -halfL);
    expect(s.traffic.nearMiss[0]).toBe(NearPass.idle);
    expect(pass(s, -halfL, exit, width + 0.7)).toEqual([]);
    pass(s, exit, -halfL - 1, width + 0.7);
    expect(pass(s, -halfL - 1, exit)).toHaveLength(1);
  });

  it('retains qualification through a direction reversal that stays alongside', () => {
    const s = setup();
    pass(s, -halfL - 1, 1);
    pass(s, 1, 0);
    expect(s.traffic.nearMiss[0]).toBe(NearPass.qualified);
    expect(pass(s, 0, exit)).toHaveLength(1);
  });

  it('rejects swept penetration and cancels staged completion on exact-slot contact', () => {
    const s = setup();
    expect(pass(s, -halfL - 1, exit, width + 1, -width - 1)).toEqual([]);
    s.player.z = exit;
    s.player.x = width + 0.3;
    s.events.count = 0;
    prepareNearMisses(s, T, { x: width + 0.3, y: 0, z: -halfL - 1 }, -1, 1 / 60);
    invalidateNearMiss(s, 0);
    finishNearMisses(s, T);
    expect(readEvents(s.events)).toEqual([]);
    expect(s.traffic.nearMiss[0]).toBe(NearPass.disqualified);
  });

  it.each(['start', 'current'] as const)('disqualifies the %s ride slot even after jumping away', (which) => {
    const s = setup();
    Object.assign(s.player, { z: exit, x: width + 0.3, rideSlot: which === 'current' ? 0 : -1 });
    prepareNearMisses(s, T, { x: width + 0.3, y: 0, z: -halfL - 1 }, which === 'start' ? 0 : -1, 1 / 60);
    finishNearMisses(s, T);
    expect(s.traffic.nearMiss[0]).toBe(NearPass.disqualified);
    expect(readEvents(s.events)).toEqual([]);
    s.traffic.nearMiss[0] = NearPass.awarded;
    prepareNearMisses(s, T, { x: width + 0.3, y: 0, z: -halfL - 1 }, 0, 1 / 60);
    invalidateNearMiss(s, 0);
    expect(s.traffic.nearMiss[0]).toBe(NearPass.awarded);
  });

  it('suppresses all completions on a late crash, while unrelated scrape closes the new pot', () => {
    for (const crash of [false, true]) {
      const s = setup();
      Object.assign(s.player, { z: exit, x: width + 0.3 });
      prepareNearMisses(s, T, { x: width + 0.3, y: 0, z: -halfL - 1 }, -1, 1 / 60);
      if (crash) {
        s.status = SimStatus.crashed;
        emit(s.events, SimEventKind.crash, 1);
      } else emit(s.events, SimEventKind.scrape);
      finishNearMisses(s, T);
      scoreTick(s, T, -1, 0, 0);
      expect(readEvents(s.events).filter((e) => e.kind === 'nearMiss')).toHaveLength(crash ? 0 : 1);
      expect(s.score.total).toBe(0);
      expect(s.score.pot).toBe(0);
      expect(s.score.meter).toBe(crash ? 0 : 10);
    }
  });

  it('clears completion scratch across flag-off ticks and interleaved sessions', () => {
    const a = setup();
    const b = setup();
    expect(pass(a, -halfL - 1, exit)).toHaveLength(1);
    expect(pass(b, -halfL - 1, 0)).toEqual([]);
    expect(b.score.pot).toBe(0);
    const disabled = { ...T, scoring: { ...T.scoring, nearMissEnabled: false } };
    expect(pass(b, 0, exit, width + 0.3, width + 0.3, disabled)).toEqual([]);
    expect(b.score.pot).toBe(0);
    const fresh = setup();
    expect(fresh.traffic.nearMiss.every((value) => value === 0)).toBe(true);
  });

  it('hashes all persistent active states and resets them on removal and reuse', () => {
    const s = setup();
    const hashes = new Set<string>();
    for (const value of Object.values(NearPass)) {
      s.traffic.nearMiss[0] = value;
      hashes.add(stateHash(s));
    }
    expect(hashes.size).toBe(5);
    s.traffic.z[0] = -100;
    runDirector(s, T);
    expect(s.traffic.active[0]).toBe(0);
    expect(s.traffic.nearMiss[0]).toBe(0);
    s.traffic.nearMiss[0] = NearPass.awarded; // stale inactive memory must never survive assignment
    s.director.nextRowM = 80;
    runDirector(s, T);
    expect(s.traffic.active[0]).toBe(1);
    expect(s.traffic.nearMiss[0]).toBe(NearPass.idle);
  });
});
