import { DEFAULT_TUNING } from '@kometa/sim';
import { Group, Mesh, MeshStandardMaterial, Object3D, Points, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { CarRig } from './car';
import { createThrusters, type ThrusterInput } from './thrusters';
import type { Burst, Vapour } from './vapour';

type Emission = { burst: Burst; count: number };

function setup() {
  const group = new Group();
  const body = new Group();
  group.add(body);
  const nozzle = (x: number, y: number, z: number, pitch = 0) => {
    const n = new Object3D();
    n.position.set(x, y, z);
    n.rotation.x = pitch;
    body.add(n);
    return n;
  };
  const rig: CarRig = {
    group,
    body,
    wheels: [],
    nozzles: {
      rear: [nozzle(-0.5, 0.5, 2, Math.PI / 2), nozzle(0.5, 0.5, 2, Math.PI / 2)],
      lift: [nozzle(-0.8, 0.2, 0.5), nozzle(0.8, 0.2, -0.5)],
      left: nozzle(-1, 0.5, 0),
      right: nozzle(1, 0.5, 0),
    },
    nozzleGlow: new MeshStandardMaterial({ emissiveIntensity: 0.15 }),
    shadow: new Mesh(),
  };
  const emissions: Emission[] = [];
  const vapour: Vapour = {
    points: new Points(),
    // The production emitter reuses its burst object; capture values at the moment each nozzle fires.
    emit: (burst, count) => emissions.push({ burst: { ...burst }, count }),
    update: vi.fn(),
    shift: vi.fn(),
    reset: vi.fn(),
  };
  return { rig, emissions, thrusters: createThrusters(rig, vapour) };
}

const input: ThrusterInput = {
  dt: 0.05,
  vx: 12,
  vy: 8,
  vz: -70,
  boosting: false,
  flying: false,
  airborne: false,
  lane: 2,
  crashed: false,
};

describe('thruster crash and retry lifecycle', () => {
  it('stops boost, flight and transition emissions with an immediate idle glow on crash', () => {
    const { rig, emissions, thrusters } = setup();
    thrusters.update({ ...input, boosting: true, flying: true, airborne: true });
    expect(emissions.length).toBeGreaterThan(0);
    expect(rig.nozzleGlow.emissiveIntensity).toBeGreaterThan(0.15);
    emissions.length = 0;

    // dt 0 must still stop the glow; stopping it cannot depend on another animation frame elapsing.
    thrusters.update({ ...input, dt: 0, boosting: true, flying: true, airborne: true, crashed: true });
    expect(rig.nozzleGlow.emissiveIntensity).toBe(0.15);
    thrusters.update({ ...input, dt: 1, boosting: true, flying: true, lane: 3, crashed: true });
    expect(emissions).toEqual([]);
    expect(rig.nozzleGlow.emissiveIntensity).toBe(0.15);
  });

  it('emits one tuned cloud from each real rear/lift nozzle without carrying the pre-crash velocity', () => {
    const { rig, emissions, thrusters } = setup();
    const tuning = DEFAULT_TUNING.presentation.crash;
    rig.group.position.set(8, 3, -12);
    rig.group.rotation.y = 0.5;
    rig.body.position.y = 0.1;
    thrusters.update({ ...input, boosting: true });
    emissions.length = 0;

    thrusters.crash(tuning);
    const nozzles = [...rig.nozzles.rear, ...rig.nozzles.lift];
    expect(emissions).toHaveLength(nozzles.length);
    nozzles.forEach((nozzle, index) => {
      const position = nozzle.getWorldPosition(new Vector3());
      const velocity = new Vector3(0, -1, 0)
        .transformDirection(nozzle.matrixWorld)
        .multiplyScalar(tuning.cloudSpeedMps);
      expect(emissions[index]).toEqual({
        count: tuning.cloudCountPerNozzle,
        burst: {
          x: position.x,
          y: position.y,
          z: position.z,
          vx: velocity.x,
          vy: velocity.y,
          vz: velocity.z,
          spread: tuning.cloudSpreadMps,
          lifeS: tuning.cloudLifeS,
          sizeM: tuning.cloudSizeM,
          growM: tuning.cloudGrowM,
          alpha: tuning.cloudAlpha,
          smearS: 0,
          carryX: 0,
          carryY: 0,
          carryZ: 0,
        },
      });
    });
    thrusters.crash(tuning);
    thrusters.crash(tuning);
    expect(emissions).toHaveLength(nozzles.length);
  });

  it('clears fractional emission carry and glow so the next small frame cannot emit old gas', () => {
    const { rig, emissions, thrusters } = setup();
    thrusters.update({ ...input, dt: 0.003, boosting: true, flying: true });
    expect(emissions).toEqual([]);
    expect(rig.nozzleGlow.emissiveIntensity).toBeGreaterThan(0.15);

    thrusters.reset();
    expect(rig.nozzleGlow.emissiveIntensity).toBe(0.15);
    thrusters.update({ ...input, dt: 0.002, boosting: true, flying: true });
    expect(emissions).toEqual([]);
    // A second fresh frame crosses the continuous-emission threshold, so the reset did not disable the system.
    thrusters.update({ ...input, dt: 0.003, boosting: true, flying: true });
    expect(emissions).toHaveLength(rig.nozzles.rear.length);
  });

  it('clears transition history, stored velocity and the one-shot latch on each of two retries', () => {
    const { rig, emissions, thrusters } = setup();
    const tuning = DEFAULT_TUNING.presentation.crash;
    const cloudNozzles = rig.nozzles.rear.length + rig.nozzles.lift.length;
    for (let run = 0; run < 3; run++) {
      if (run > 0) {
        thrusters.reset();
        thrusters.launch();
        expect(emissions).toHaveLength(rig.nozzles.rear.length);
        for (const { burst } of emissions) {
          expect([burst.carryX, burst.carryY, burst.carryZ, burst.smearS]).toEqual([0, 0, 0, 0]);
        }
        emissions.length = 0;
        thrusters.update({ ...input, dt: 0, lane: 0 });
        expect(emissions).toEqual([]); // no stale touchdown or lane-change puff
      }
      thrusters.update({ ...input, airborne: true, lane: 4 });
      emissions.length = 0;
      thrusters.crash(tuning);
      expect(emissions).toHaveLength(cloudNozzles);
      thrusters.crash(tuning);
      expect(emissions).toHaveLength(cloudNozzles);
      emissions.length = 0;
    }
  });
});
