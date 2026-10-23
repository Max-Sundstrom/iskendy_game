import { SimEventKind } from '@kometa/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CrashCause } from './collisions';
import { difficulty, runDirector } from './director';
import { Action } from './input';
import { laneCenterX } from './lanes';
import { createSimState, SimStatus, type SimState } from './state';
import { step } from './step';
import { moveTraffic, TRAFFIC_CAPACITY } from './traffic';
import { DEFAULT_TUNING } from './tuning';

const T = DEFAULT_TUNING.sim;
const has = (s: SimState, kind: number) => Array.from(s.events.kind.slice(0, s.events.count)).includes(kind);
const typeIndex = (id: string) => T.vehicles.findIndex((v) => v.id === id);

/** An empty-road run with hand-placed traffic. */
function scene(...cars: { id: string; lane: number; dz: number; speed?: number }[]): SimState {
  const s = createSimState(1, T);
  s.director.nextRowM = Infinity;
  cars.forEach((c, i) => {
    const type = typeIndex(c.id);
    s.traffic.active[i] = 1;
    s.traffic.type[i] = type;
    s.traffic.lane[i] = c.lane;
    s.traffic.z[i] = s.player.z + c.dz;
    s.traffic.speed[i] = c.speed ?? T.vehicles[type]?.minMps ?? 0;
  });
  return s;
}

/** True if the player box intersects a vehicle box below its roof (what tunnelling would look like). */
function overlapsTraffic(s: SimState): boolean {
  const p = s.player;
  for (let i = 0; i < TRAFFIC_CAPACITY; i++) {
    if (s.traffic.active[i] === 0) continue;
    const v = T.vehicles[s.traffic.type[i] ?? 0];
    if (!v) continue;
    const rear = s.traffic.z[i] ?? 0;
    const lat = Math.abs(p.x - laneCenterX(s.traffic.lane[i] ?? 0, T)) < (T.player.widthM + v.widthM) / 2;
    const lon = p.z + T.player.lengthM / 2 > rear && p.z - T.player.lengthM / 2 < rear + v.lengthM;
    if (lat && lon && p.y < v.heightM - 1e-9) return true;
  }
  return false;
}

describe('director v0', () => {
  it('spawns rows ahead, keeps a lane free in every row and respects fromM', () => {
    const s = createSimState(3, T);
    const rows = new Map<number, Set<number>>();
    for (let t = 0; t < 60 * 40; t++) {
      s.player.distanceM += 0.5; // a ghost player; traffic is what's under test here
      s.player.z += 0.5;
      moveTraffic(s.traffic, T, 1 / 60);
      runDirector(s, T);
      for (let i = 0; i < TRAFFIC_CAPACITY; i++) {
        if (s.traffic.active[i] === 0) continue;
        const v = T.vehicles[s.traffic.type[i] ?? 0];
        expect(v && ['constant', 'slow'].includes(v.behaviour)).toBe(true);
        expect((s.traffic.z[i] ?? 0) - s.player.z).toBeLessThanOrEqual(T.director.spawnAheadM + 1);
      }
    }
    // Inspect a fresh set of rows at a known distance.
    const r = createSimState(5, T);
    r.director.nextRowM = 300;
    r.player.distanceM = 200;
    runDirector(r, T);
    for (let i = 0; i < TRAFFIC_CAPACITY; i++) {
      if (r.traffic.active[i] === 0) continue;
      const key = Math.round(r.traffic.z[i] ?? 0);
      rows.set(key, (rows.get(key) ?? new Set()).add(r.traffic.lane[i] ?? 0));
      expect(T.vehicles[r.traffic.type[i] ?? 0]?.fromM).toBeLessThanOrEqual(r.director.nextRowM);
    }
    expect(rows.size).toBeGreaterThan(3);
    for (const lanes of rows.values()) expect(lanes.size).toBeLessThan(T.lanes.count);
    expect(difficulty(0, T)).toBe(0);
    expect(difficulty(1e9, T)).toBe(1);
  });

  it('G13: vehicles in a lane never overlap, for any seed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 }), (seed) => {
        const s = createSimState(seed, T);
        s.player.distanceM = 6000; // dense, mixed traffic
        s.director.nextRowM = 6080;
        for (let t = 0; t < 60 * 30; t++) {
          s.player.distanceM += 0.6;
          s.player.z += 0.6;
          moveTraffic(s.traffic, T, 1 / 60);
          runDirector(s, T);
          for (let i = 0; i < TRAFFIC_CAPACITY; i++) {
            if (s.traffic.active[i] === 0) continue;
            for (let j = i + 1; j < TRAFFIC_CAPACITY; j++) {
              if (s.traffic.active[j] === 0 || s.traffic.lane[j] !== s.traffic.lane[i]) continue;
              const a = s.traffic.z[i] ?? 0;
              const b = s.traffic.z[j] ?? 0;
              const la = T.vehicles[s.traffic.type[i] ?? 0]?.lengthM ?? 0;
              const lb = T.vehicles[s.traffic.type[j] ?? 0]?.lengthM ?? 0;
              if (a < b + lb && b < a + la) return false;
            }
          }
        }
        return true;
      }),
      { numRuns: 25 },
    );
  });
});

describe('collisions (GDD §5.9)', () => {
  it('crashes into the back of a vehicle in the same lane', () => {
    const s = scene({ id: 'sedan', lane: 2, dz: 20 });
    let crashed = false;
    for (let t = 0; t < 120 && !crashed; t++) {
      step(s, 0, T);
      crashed = has(s, SimEventKind.crash);
    }
    expect(crashed).toBe(true);
    expect(s.status).toBe(SimStatus.crashed);
    expect(s.events.a[s.events.count - 1]).toBe(CrashCause.rear);
    const z = s.player.z;
    step(s, Action.right, T);
    expect(s.player.z).toBe(z); // a crashed run no longer moves
  });

  it('jumps clean over a sedan', () => {
    const s = scene({ id: 'sedan', lane: 2, dz: 14 });
    for (let t = 0; t < 120; t++) step(s, t === 0 ? Action.jump : 0, T);
    expect(s.status).toBe(SimStatus.running);
  });

  it('scrapes on side contact during a lane change: reverts, slows, costs AIR; a second scrape crashes', () => {
    const s = scene({ id: 'van', lane: 3, dz: -2 }, { id: 'van', lane: 1, dz: -2 });
    step(s, Action.right, T);
    let scraped = false;
    for (let t = 0; t < 20 && !scraped; t++) {
      step(s, 0, T);
      scraped = has(s, SimEventKind.scrape);
    }
    expect(scraped).toBe(true);
    expect(s.player.laneTo).toBe(2);
    expect(s.player.penaltyS).toBeGreaterThan(0);
    expect(s.player.airLiters).toBe(T.air.startL - T.collision.scrapeAirLossL);
    for (let t = 0; t < 15; t++) step(s, 0, T);
    expect(s.player.x).toBeCloseTo(laneCenterX(2, T), 6);
    step(s, Action.left, T); // into the other van, within secondScrapeWindowS
    let cause = 0;
    for (let t = 0; t < 20 && s.status === SimStatus.running; t++) {
      step(s, 0, T);
      if (has(s, SimEventKind.crash)) cause = s.events.a[s.events.count - 1] ?? 0;
    }
    expect(cause).toBe(CrashCause.secondScrape);
  });

  it('hops off a car roof when coming down onto it', () => {
    const s = scene({ id: 'sedan', lane: 2, dz: -1 }); // the sedan is right under the player
    s.player.airborne = true;
    s.player.y = (T.vehicles[typeIndex('sedan')]?.heightM ?? 0) + 0.1;
    s.player.vy = -2;
    let hopped = false;
    for (let t = 0; t < 30 && !hopped; t++) {
      step(s, 0, T);
      hopped = has(s, SimEventKind.hop);
    }
    expect(hopped).toBe(true);
    expect(s.player.vy).toBeGreaterThan(0);
    expect(s.status).toBe(SimStatus.running);
  });

  it('never tunnels: 100 000 fuzzed steps at up to 95 m/s (and boosted) end with no overlap', () => {
    let steps = 0;
    let seed = 11;
    let crashes = 0;
    const rngInputs = fc.sample(fc.integer({ min: 0, max: 63 }), { numRuns: 4000, seed: 42 });
    while (steps < 100_000) {
      const s = createSimState(seed, T);
      s.player.distanceM = 30_000; // ≈ 94.7 m/s, ×1.25 when boosting
      s.director.nextRowM = 30_080;
      for (let t = 0; t < 4000 && s.status === SimStatus.running; t++) {
        step(s, rngInputs[(t * 7 + seed) % rngInputs.length] ?? 0, T);
        steps++;
        if (s.status === SimStatus.running && overlapsTraffic(s))
          throw new Error(`tunnelled at seed ${seed} tick ${t}`);
      }
      if (s.status === SimStatus.crashed) crashes++;
      seed++;
    }
    expect(steps).toBeGreaterThanOrEqual(100_000);
    expect(crashes).toBeGreaterThan(0);
  });
});
