import { SimEventKind } from '@kometa/shared';
import { describe, expect, it } from 'vitest';
import { Action } from './input';
import { RideEnd } from './roofs';
import { createSimState, SimStatus, type SimState } from './state';
import { step } from './step';
import { DEFAULT_TUNING } from './tuning';

const T = DEFAULT_TUNING.sim;
const typeIndex = (id: string) => T.vehicles.findIndex((v) => v.id === id);
const vehicle = (id: string) => {
  const v = T.vehicles[typeIndex(id)];
  if (!v) throw new Error(id);
  return v;
};
const events = (s: SimState) =>
  Array.from({ length: s.events.count }, (_, i) => ({ kind: s.events.kind[i], a: s.events.a[i], b: s.events.b[i] }));

/** An empty-road run with hand-placed traffic in the player's lane unless a lane is given. */
function scene(...cars: { id: string; dz: number; lane?: number }[]): SimState {
  const s = createSimState(1, T);
  s.director.nextRowM = Infinity;
  cars.forEach((c, i) => {
    const type = typeIndex(c.id);
    s.traffic.active[i] = 1;
    s.traffic.type[i] = type;
    s.traffic.lane[i] = c.lane ?? s.player.lane;
    s.traffic.z[i] = s.player.z + c.dz;
    s.traffic.speed[i] = T.vehicles[type]?.minMps ?? 0;
  });
  return s;
}

/** Puts the player in the air above `heightM`, falling. */
function airborneAt(s: SimState, heightM: number, vy = -2): void {
  s.player.airborne = true;
  s.player.y = heightM;
  s.player.vy = vy;
}

/** Steps with `held` until `until` is true or `max` ticks pass; returns every event seen. */
function run(s: SimState, until: (s: SimState) => boolean, held = 0, max = 600) {
  const seen: ReturnType<typeof events> = [];
  for (let k = 0; k < max && !until(s); k++) {
    step(s, held, T);
    seen.push(...events(s));
  }
  return seen;
}

describe('platforms (GDD §5.8)', () => {
  it('lands on a bus roof and rides it to the front, then falls with coyote time', () => {
    const bus = vehicle('bus');
    const s = scene({ id: 'bus', dz: -2 });
    airborneAt(s, bus.heightM + 0.1);
    const landing = run(s, (x) => x.player.rideSlot >= 0, 0, 30);
    expect(s.player.rideSlot).toBe(0);
    expect(s.player.airborne).toBe(false);
    expect(s.player.y).toBe(bus.heightM);
    expect(landing.some((e) => e.kind === SimEventKind.rideStart)).toBe(true);
    const seen = run(s, (x) => x.player.rideSlot < 0);
    expect(s.status).toBe(SimStatus.running);
    expect(seen.find((e) => e.kind === SimEventKind.rideEnd)?.a).toBe(RideEnd.droveOff);
    expect(s.player.airborne).toBe(true);
    expect(s.player.coyoteS).toBeCloseTo(T.jump.coyoteS, 9);
  });

  it('G4: a jump 80 ms after leaving the trailer still launches', () => {
    const s = scene({ id: 'semi', dz: -2 });
    airborneAt(s, vehicle('semi').heightM + 0.1);
    run(s, (x) => x.player.rideSlot < 0 && x.tick > 1);
    for (let k = 0; k < Math.round(0.08 * T.tickRateHz) - 1; k++) step(s, 0, T);
    step(s, Action.jump, T);
    expect(events(s).some((e) => e.kind === SimEventKind.jump)).toBe(true);
    expect(s.player.vy).toBeGreaterThan(0);
  });

  it('a press after coyote time is an air press (a flip), not a jump', () => {
    const s = scene({ id: 'semi', dz: -2 });
    airborneAt(s, vehicle('semi').heightM + 0.1);
    run(s, (x) => x.player.rideSlot < 0 && x.tick > 1);
    for (let k = 0; k < Math.round(0.2 * T.tickRateHz); k++) step(s, 0, T);
    step(s, Action.jump, T);
    expect(events(s).some((e) => e.kind === SimEventKind.jump)).toBe(false);
    expect(events(s).some((e) => e.kind === SimEventKind.flipStart)).toBe(true);
  });

  it('jumps off a platform from the platform height', () => {
    const s = scene({ id: 'bus', dz: -2 });
    airborneAt(s, vehicle('bus').heightM + 0.1);
    run(s, (x) => x.player.rideSlot >= 0, 0, 30);
    step(s, Action.jump, T);
    expect(s.player.rideSlot).toBe(-1);
    expect(s.player.airborne).toBe(true);
    expect(s.player.y).toBeGreaterThan(vehicle('bus').heightM);
    expect(events(s).find((e) => e.kind === SimEventKind.rideEnd)?.a).toBe(RideEnd.jumped);
  });

  it('G10: a slam onto a bus roof lands as a slam and rides, no crash', () => {
    const s = scene({ id: 'bus', dz: -4 });
    airborneAt(s, 7, 0);
    step(s, Action.slam, T);
    const seen = run(s, (x) => x.player.rideSlot >= 0, 0, 60);
    expect(s.status).toBe(SimStatus.running);
    expect(seen.find((e) => e.kind === SimEventKind.rideStart)?.b).toBe(1);
    expect(seen.find((e) => e.kind === SimEventKind.land)?.a).toBe(1);
  });

  it('a lane change off the platform drops the car', () => {
    const s = scene({ id: 'bus', dz: -4 });
    airborneAt(s, vehicle('bus').heightM + 0.1);
    run(s, (x) => x.player.rideSlot >= 0, 0, 30);
    step(s, Action.right, T);
    const seen = run(s, (x) => x.player.rideSlot < 0, 0, 60);
    expect(seen.find((e) => e.kind === SimEventKind.rideEnd)?.a).toBe(RideEnd.sideways);
  });
});

describe('roof hops (GDD §5.5, §5.8)', () => {
  it('counts the hop chain until the road and slams bounce higher', () => {
    const s = scene({ id: 'sedan', dz: -1 });
    airborneAt(s, vehicle('sedan').heightM + 0.1);
    const first = run(s, (x) => x.player.hopChain > 0, 0, 30);
    expect(first.find((e) => e.kind === SimEventKind.hop)?.a).toBe(1);
    const normalVy = s.player.vy;
    expect(normalVy).toBeCloseTo(Math.sqrt(2 * ((2 * 4.2) / 0.45 ** 2) * T.roofs.hopHeightM), 6);

    const slam = scene({ id: 'sedan', dz: -1 });
    airborneAt(slam, 6, 0);
    slam.player.slamming = true;
    slam.player.vy = T.slam.vyMps;
    run(slam, (x) => x.player.hopChain > 0, 0, 60);
    expect(slam.player.vy).toBeGreaterThan(normalVy);

    run(s, (x) => !x.player.airborne, 0, 600);
    expect(s.status).toBe(SimStatus.running);
    expect(s.player.hopChain).toBe(0);
  });
});

describe('CLEAR and SEMI CLEARED (GDD §9)', () => {
  /** Jumps from the road toward a vehicle `dz` ahead and returns the CLEAR events seen. */
  const clears = (id: string, dz: number, held = Action.jump) => {
    const s = scene({ id, dz });
    const seen = run(s, (x) => x.tick > 10 && !x.player.airborne && x.player.rideSlot < 0, held, 400);
    return { s, seen: seen.filter((e) => e.kind === SimEventKind.clear) };
  };

  it('passing over a sedan in one jump is a CLEAR', () => {
    const { s, seen } = clears('sedan', 22);
    expect(s.status).toBe(SimStatus.running);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.a).toBe(typeIndex('sedan'));
    expect(seen[0]?.b).toBe(0);
  });

  it('flying over a whole bus is a SEMI CLEARED', () => {
    // Hold jump: the car jumps, then flies at glide height over the 12 m bus.
    const { s, seen } = clears('bus', 26);
    expect(s.status).toBe(SimStatus.running);
    expect(seen.some((e) => e.b === 1)).toBe(true);
  });

  it('touching the roof in between is not a CLEAR', () => {
    const s = scene({ id: 'sedan', dz: -1 });
    airborneAt(s, vehicle('sedan').heightM + 0.1);
    const seen = run(s, (x) => x.tick > 5 && !x.player.airborne, 0, 400);
    expect(seen.some((e) => e.kind === SimEventKind.hop)).toBe(true);
    expect(seen.some((e) => e.kind === SimEventKind.clear)).toBe(false);
  });
});
