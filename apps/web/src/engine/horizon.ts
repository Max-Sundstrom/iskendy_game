import art from '@kometa/content/art.json';
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  BoxGeometry,
} from 'three';

// Horizon backdrop that travels with the camera so it is never reached: the Kometograd skyline, hazy hills and the
// Cosmos Park rocket on its pedestal (GDD §2, §12). It lies beyond the fog's far plane, so it uses unfogged
// materials with the haze baked into their colours (ART_DIRECTION §7: silhouettes fade toward the horizon colour).

const GRADE = art.grading.embankment_gold;

function hazed(base: string, k: number): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: new Color(base).lerp(new Color(GRADE.horizon), k), fog: false });
}

export type Horizon = { group: Group; update(cameraZ: number): void };

export function createHorizon(): Horizon {
  const group = new Group();
  const towers = 46;
  const skyline = new InstancedMesh(new BoxGeometry(1, 1, 1), hazed(art.palette.duskPlum, 0.55), towers);
  const m = new Matrix4();
  const p = new Vector3();
  const s = new Vector3();
  const q = new Quaternion();
  for (let i = 0; i < towers; i++) {
    const t = i / towers;
    const x = (t - 0.5) * 1500 + Math.sin(i * 12.9) * 25;
    const h = 30 + Math.abs(Math.sin(i * 7.3)) * 110 * (1 - Math.abs(t - 0.62));
    skyline.setMatrixAt(
      i,
      m.compose(p.set(x, h / 2 - 5, -760 - Math.abs(Math.sin(i * 3.1)) * 80), q, s.set(18 + (i % 4) * 9, h, 20)),
    );
  }
  // Stepped towers with spires: a generic "Moscow high-rise" cue, not a replica of any real building (AGENTS §12).
  const spireMat = hazed(art.palette.duskPlum, 0.48);
  for (const [x, h] of [
    [210, 150],
    [-420, 120],
  ] as const) {
    const t = new Group();
    for (let k = 0; k < 4; k++) {
      const w = 46 - k * 10;
      const tier = new Mesh(new BoxGeometry(w, h * 0.3, w), spireMat);
      tier.position.y = h * 0.15 + k * h * 0.24;
      t.add(tier);
    }
    const spire = new Mesh(new ConeGeometry(3, 50, 6), spireMat);
    spire.position.y = h * 0.95 + 25;
    t.add(spire);
    t.position.set(x, -5, -720);
    group.add(t);
  }
  const hills = new InstancedMesh(new IcosahedronGeometry(1, 1), hazed('#5a3a5e', 0.7), 9);
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 230 + Math.sin(i * 5.1) * 60;
    hills.setMatrixAt(i, m.compose(p.set(x, -20, -880), q, s.set(160 + (i % 3) * 40, 70 + (i % 2) * 40, 60)));
  }
  // Cosmos Park rocket on a pedestal, off to the left of the road; it launches on LIFTOFF in P2-04/P3-07.
  const rocketMat = hazed('#e9e2d6', 0.35);
  const rocket = new Group();
  const pedestal = new Mesh(new BoxGeometry(28, 16, 28), hazed('#7d6f80', 0.5));
  pedestal.position.y = 8;
  const hull = new Mesh(new CylinderGeometry(4.5, 5, 70, 16), rocketMat);
  hull.position.y = 16 + 35;
  const nose = new Mesh(new ConeGeometry(4.5, 18, 16), rocketMat);
  nose.position.y = 16 + 70 + 9;
  rocket.add(pedestal, hull, nose);
  for (let k = 0; k < 4; k++) {
    const booster = new Mesh(new CylinderGeometry(2.2, 2.6, 34, 10), rocketMat);
    const a = (k / 4) * Math.PI * 2;
    booster.position.set(Math.cos(a) * 7, 16 + 17, Math.sin(a) * 7);
    rocket.add(booster);
  }
  const gantry = new Mesh(new BoxGeometry(6, 110, 6), hazed('#4a3f50', 0.5));
  gantry.position.set(16, 55, 0);
  rocket.add(gantry);
  rocket.position.set(-260, -4, -700);
  group.add(skyline, hills, rocket);
  for (const o of [skyline, hills]) o.frustumCulled = false;
  return {
    group,
    update(cameraZ) {
      group.position.z = cameraZ;
    },
  };
}
