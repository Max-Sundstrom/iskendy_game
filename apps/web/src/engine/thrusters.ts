import { Vector3, type Object3D } from 'three';
import type { Tuning } from '@kometa/shared';
import type { CarRig } from './car';
import type { Burst, Vapour } from './vapour';

// Which nozzles fire, and when (GDD §5–§6): main tail thrusters while boosting, lift nozzles beside the wheels for
// the jump kick, flight and touchdown, an attitude puff on the flank opposite each lane change, and a cloud on a
// crash. Emission is rate-based so it doesn't depend on the frame rate.

export type ThrusterInput = {
  dt: number;
  /** Car velocity in three coordinates, m/s. */
  vx: number;
  vy: number;
  vz: number;
  boosting: boolean;
  flying: boolean;
  airborne: boolean;
  lane: number;
  crashed: boolean;
};

export type Thrusters = {
  update(i: ThrusterInput): void;
  launch(): void;
  crash(tuning: Tuning['presentation']['crash']): void;
  reset(): void;
};

const BASE_GLOW = 0.15;

export function createThrusters(rig: CarRig, vapour: Vapour): Thrusters {
  const p = new Vector3();
  const d = new Vector3();
  const burst: Burst = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    spread: 1,
    lifeS: 0.5,
    sizeM: 0.2,
    growM: 1,
    alpha: 0.5,
    smearS: 0,
    carryX: 0,
    carryY: 0,
    carryZ: 0,
  };
  let frameDt = 0;
  const carry = new Map<Object3D, number>();
  let wasAirborne = false;
  let crashEmitted = false;
  let lastLane = -1;
  let glow = BASE_GLOW;
  const v = { x: 0, y: 0, z: 0 };

  /** Fires `count` particles from a nozzle along its exhaust axis at `jetMps` on top of the car's velocity. */
  const fire = (
    n: Object3D,
    count: number,
    jetMps: number,
    spread: number,
    lifeS: number,
    sizeM: number,
    growM: number,
    alpha: number,
  ) => {
    if (count <= 0) return;
    n.getWorldPosition(p);
    d.set(0, -1, 0).transformDirection(n.matrixWorld);
    burst.x = p.x;
    burst.y = p.y;
    burst.z = p.z;
    burst.vx = v.x + d.x * jetMps;
    burst.vy = v.y + d.y * jetMps;
    burst.vz = v.z + d.z * jetMps;
    burst.spread = spread;
    burst.lifeS = lifeS;
    burst.sizeM = sizeM;
    burst.growM = growM;
    burst.alpha = alpha;
    burst.smearS = frameDt;
    burst.carryX = v.x;
    burst.carryY = v.y;
    burst.carryZ = v.z;
    vapour.emit(burst, count);
  };
  /** Continuous emission at `perS` particles per second, keeping the fractional remainder per nozzle. */
  const stream = (n: Object3D, perS: number, dt: number) => {
    const acc = (carry.get(n) ?? 0) + perS * dt;
    const whole = Math.floor(acc);
    carry.set(n, acc - whole);
    return whole;
  };

  return {
    update(i) {
      v.x = i.vx;
      v.y = i.vy;
      v.z = i.vz;
      frameDt = Math.min(i.dt, 0.1);
      rig.group.updateMatrixWorld(true);
      const { rear, lift, left, right } = rig.nozzles;
      // Dense, thin and fast: at ~240 particles/s the plume reads as a continuous jet streaming back past the camera.
      if (i.boosting && !i.crashed) for (const n of rear) fire(n, stream(n, 240, i.dt), 34, 0.5, 0.4, 0.09, 0.75, 0.7);
      if (i.flying && !i.crashed) for (const n of lift) fire(n, stream(n, 120, i.dt), 18, 0.9, 0.45, 0.12, 1.0, 0.55);
      if (i.airborne && !wasAirborne && !i.crashed) for (const n of lift) fire(n, 18, 15, 3, 0.7, 0.35, 1.9, 0.55);
      if (!i.airborne && wasAirborne && !i.crashed) for (const n of lift) fire(n, 10, 4, 4, 0.5, 0.3, 1.5, 0.4);
      if (lastLane >= 0 && i.lane !== lastLane && !i.crashed) {
        // Moving right (+x) needs gas pushed left, from the left-hand nozzle; and vice versa.
        fire(i.lane > lastLane ? left : right, 14, 12, 1, 0.35, 0.18, 0.9, 0.5);
      }
      wasAirborne = i.airborne;
      lastLane = i.lane;
      const target = i.boosting ? 3 : i.flying ? 2 : BASE_GLOW;
      glow = i.crashed ? BASE_GLOW : glow + (target - glow) * Math.min(1, i.dt * 12);
      rig.nozzleGlow.emissiveIntensity = glow;
    },
    crash(t) {
      if (crashEmitted) return;
      crashEmitted = true;
      frameDt = 0;
      v.x = v.y = v.z = 0;
      rig.group.updateMatrixWorld(true);
      // These are the real gas nozzles, not an invented collision contact point or direction.
      const cloud = (n: Object3D) =>
        fire(
          n,
          t.cloudCountPerNozzle,
          t.cloudSpeedMps,
          t.cloudSpreadMps,
          t.cloudLifeS,
          t.cloudSizeM,
          t.cloudGrowM,
          t.cloudAlpha,
        );
      for (const n of rig.nozzles.rear) cloud(n);
      for (const n of rig.nozzles.lift) cloud(n);
    },
    reset() {
      wasAirborne = false;
      crashEmitted = false;
      lastLane = -1;
      carry.clear();
      frameDt = 0;
      v.x = v.y = v.z = 0;
      glow = BASE_GLOW;
      rig.nozzleGlow.emissiveIntensity = glow;
    },
    /** The kick at the bottom of the intro ramp. */
    launch() {
      frameDt = 0;
      rig.group.updateMatrixWorld(true);
      for (const n of rig.nozzles.rear) fire(n, 30, 22, 2, 0.8, 0.3, 2, 0.6);
    },
  };
}
