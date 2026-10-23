import art from '@kometa/content/art.json';
import type { Object3D } from 'three';
import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
  Material,
} from 'three';
import { loft, type Station } from './models/loft';
import { archBody, bevelBox as rbox, mergeByMaterial } from './hero/geometry';
import { finishGeometry, heroSurface, type Finish } from './hero/surfaces';

type Coating = Finish & { material: Material };
type Surface = Material | Coating;

// Kometa R, concept B "Samodelka" (ART_DIRECTION §8, ADR-019) in the v1 Iskendi Courier livery: knife-edge wedge,
// low nose, full-width light bar, targa glass, wide flat tail with four round lamps behind a smoked strip, and visible
// cold-gas nozzles — main thrusters at the tail, lift nozzles beside each wheel, attitude nozzles on the flanks.
// Procedural until the P3-01 Blender model; built front = +z, then turned so the front faces three −z (sim +z).

const AXLE_Z = 1.325;
const TRACK = 1.72;
const WHEEL_R = 0.34;

const BODY: Station[] = [
  { z: -2.2, ys: 0.32, wb: 0.86, ysh: 0.62, wsh: 0.93, yt: 0.8, wt: 0.84, crown: 0.01 },
  { z: -2.08, ys: 0.26, wb: 0.88, ysh: 0.63, wsh: 0.975, yt: 0.85, wt: 0.86, crown: 0.01 },
  { z: -1.65, ys: 0.24, wb: 0.8, ysh: 0.66, wsh: 0.975, yt: 0.87, wt: 0.82, crown: 0.02 },
  { z: -1.0, ys: 0.22, wb: 0.84, ysh: 0.6, wsh: 0.96, yt: 0.85, wt: 0.78, crown: 0.02 },
  { z: -0.2, ys: 0.22, wb: 0.86, ysh: 0.56, wsh: 0.95, yt: 0.8, wt: 0.76, crown: 0.02 },
  { z: 0.6, ys: 0.22, wb: 0.84, ysh: 0.54, wsh: 0.95, yt: 0.72, wt: 0.78, crown: 0.03 },
  { z: 1.3, ys: 0.24, wb: 0.8, ysh: 0.56, wsh: 0.965, yt: 0.64, wt: 0.8, crown: 0.03 },
  { z: 1.85, ys: 0.22, wb: 0.82, ysh: 0.46, wsh: 0.92, yt: 0.54, wt: 0.78, crown: 0.02 },
  { z: 2.15, ys: 0.24, wb: 0.74, ysh: 0.35, wsh: 0.8, yt: 0.42, wt: 0.66, crown: 0.01 },
  { z: 2.22, ys: 0.28, wb: 0.62, ysh: 0.32, wsh: 0.66, yt: 0.36, wt: 0.56, crown: 0 },
];

/** The lowest 0.2 m of the body, a hair proud of the paint, for the two-tone sill band. */
const SILL: Station[] = BODY.map((b) => ({
  z: b.z,
  ys: b.ys - 0.005,
  wb: b.wb + 0.008,
  ysh: b.ys + 0.1,
  wsh: Math.min(b.wsh, b.wb + 0.05) + 0.008,
  yt: Math.min(b.ys + 0.19, b.ysh),
  wt: Math.min(b.wsh, b.wb + 0.07) + 0.006,
  crown: 0,
}));

const glassStation = (z: number, base: number, top: number, w: number): Station => ({
  z,
  ys: base - 0.04,
  wb: w,
  ysh: base + (top - base) * 0.2,
  wsh: w,
  yt: top,
  wt: w * 0.8,
  crown: 0.015,
});

const CANOPY: Station[] = [
  glassStation(-1.3, 0.84, 0.86, 0.72),
  glassStation(-0.86, 0.84, 1.1, 0.66),
  glassStation(0.0, 0.8, 1.1, 0.66),
  glassStation(0.86, 0.71, 0.73, 0.74),
];

export type CarRig = {
  group: Group;
  /** Rolls (about z) and pitches (about x) in model space, front = +z; the wheels stay on the ground. */
  body: Group;
  wheels: Object3D[];
  nozzles: { rear: Object3D[]; lift: Object3D[]; left: Object3D; right: Object3D };
  /** Inner glow of the nozzles; brightened while the thrusters fire. */
  nozzleGlow: MeshStandardMaterial;
  /** Soft contact shadow kept on the road: it grounds the car and shows the height of a jump. */
  shadow: Mesh;
};

function contactShadow(): Mesh {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const m = new Mesh(
    new PlaneGeometry(2.6, 5.4),
    new MeshBasicMaterial({ map: new CanvasTexture(canvas), transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

function mesh(geometry: BufferGeometry, material: Surface, x = 0, y = 0, z = 0, shadow = true): Mesh {
  const m = new Mesh(
    material instanceof Material ? geometry : finishGeometry(geometry, material),
    material instanceof Material ? material : material.material,
  );
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

function wheel(x: number, z: number, tyre: Surface, rim: Surface, dark: Surface, caliper: Surface): Object3D {
  const g = new Group();
  const hw = 0.135;
  const r = WHEEL_R;
  const profile = [
    new Vector2(r * 0.7, -hw),
    new Vector2(r * 0.94, -hw),
    new Vector2(r, -hw * 0.5),
    new Vector2(r, hw * 0.5),
    new Vector2(r * 0.94, hw),
    new Vector2(r * 0.7, hw),
  ];
  const t = mesh(new LatheGeometry(profile, 24), tyre);
  t.rotation.z = Math.PI / 2;
  g.add(t);
  const side = Math.sign(x);
  // 21" aero disc with the five-slot motif (ASSETS §5) and a lip ring.
  const disc = mesh(new CylinderGeometry(r * 0.72, r * 0.72, 0.03, 24), rim, side * hw * 0.85);
  disc.rotation.z = Math.PI / 2;
  const lip = mesh(new TorusGeometry(r * 0.72, 0.012, 4, 24), dark, side * hw * 0.95);
  lip.rotation.y = Math.PI / 2;
  g.add(disc, lip);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const slot = mesh(
      new BoxGeometry(0.02, 0.05, 0.13),
      dark,
      side * hw * 1.02,
      Math.sin(a) * 0.15,
      Math.cos(a) * 0.15,
      false,
    );
    slot.rotation.x = -a;
    g.add(slot);
  }
  const wheelGroup = new Group();
  wheelGroup.add(g);
  // The caliper doesn't spin, so it sits beside the rotating group.
  const cal = mesh(new BoxGeometry(0.05, 0.14, 0.2), caliper, side * hw * 0.55, 0.12, -0.08, false);
  const holder = new Group();
  holder.add(wheelGroup, cal);
  holder.position.set(x, r, z);
  holder.userData['spin'] = g;
  return holder;
}

function nozzle(
  x: number,
  y: number,
  z: number,
  dir: [number, number, number],
  ring: Surface,
  glow: Material,
): Object3D {
  const o = new Group();
  const shell = mesh(new CylinderGeometry(0.055, 0.07, 0.08, 18, 1, true), ring, 0, 0, 0, false);
  const core = mesh(new CylinderGeometry(0.045, 0.045, 0.01, 18), glow, 0, -0.03, 0, false);
  o.add(shell, core);
  o.position.set(x, y, z);
  // The cylinder's −y end is the exhaust: point it along `dir`.
  const [dx, dy, dz] = dir;
  o.lookAt(x - dx, y - dy, z - dz);
  o.rotateX(Math.PI / 2);
  return o;
}

/** Builds the original Samodelka hero with three shared finish materials. */
export function createCar(): CarRig {
  const group = new Group();
  group.name = 'KometaR';
  const model = new Group();
  model.rotation.y = Math.PI; // front → three −z
  const body = new Group();
  model.add(body);
  group.add(model);

  const surface = heroSurface(art.palette.iskendiOrange);
  const coating = (finish: Finish): Coating => ({ ...finish, material: surface });
  const paint = coating({ color: art.palette.iskendiOrange, roughness: 0.29, metalness: 0.08 });
  const glass = new MeshPhysicalMaterial({ color: '#25313b', roughness: 0.13, metalness: 0.2, clearcoat: 1 });
  const dark = coating({ color: '#11151a', roughness: 0.35, metalness: 0.3 });
  const satin = coating({ color: '#20252b', roughness: 0.58, metalness: 0.15 });
  const trim = coating({ color: art.palette.enamelCream, roughness: 0.32, metalness: 0.35 });
  const tyre = coating({ color: '#111318', roughness: 0.9 });
  const rim = coating({ color: '#d8d4cc', roughness: 0.24, metalness: 0.78 });
  const caliper = coating({ color: art.palette.lagoonTeal, roughness: 0.42 });
  const head = coating({ color: '#fff4e0', roughness: 0.2, emission: '#fff1d6' });
  const tail = coating({ color: '#63090d', roughness: 0.22, emission: '#d72517' });
  const ring = coating({ color: '#454d58', roughness: 0.26, metalness: 0.85 });
  const roof = coating({ color: '#ffffff', roughness: 0.4, roof: true });
  const nozzleGlow = new MeshStandardMaterial({
    color: '#1b2a30',
    emissive: art.palette.lagoonTeal,
    emissiveIntensity: 0.15,
  });

  body.add(mesh(archBody(BODY), paint));
  body.add(mesh(loft(CANOPY, { side: 12, between: 3 }), glass));
  // The dark sill follows the wheel openings and keeps the two-tone body visually light.
  body.add(mesh(archBody(SILL, true), satin));
  body.add(mesh(rbox(1.02, 0.03, 0.8), roof, 0, 1.14, -0.43));

  // Tail: ducktail lip, smoked strip with four round lamps, diffuser with fins.
  const lip = mesh(rbox(1.74, 0.055, 0.2), paint, 0, 0.88, -2.04);
  lip.rotation.x = -0.12;
  body.add(lip, mesh(rbox(1.84, 0.21, 0.04), dark, 0, 0.66, -2.215));
  for (const x of [-0.72, -0.33, 0.33, 0.72]) {
    const lamp = mesh(new CylinderGeometry(0.078, 0.078, 0.03, 20), tail, x, 0.66, -2.235, false);
    lamp.rotation.x = Math.PI / 2;
    const bezel = mesh(new TorusGeometry(0.083, 0.009, 4, 20), ring, x, 0.66, -2.25, false);
    body.add(lamp, bezel);
  }
  body.add(mesh(rbox(1.5, 0.05, 0.03), trim, 0, 0.5, -2.22, false));
  body.add(mesh(rbox(1.6, 0.14, 0.3), dark, 0, 0.3, -2.06));
  for (const x of [-0.5, -0.17, 0.17, 0.5]) body.add(mesh(rbox(0.02, 0.12, 0.28), dark, x, 0.24, -2.08, false));

  // Nose: full-width light bar (pop-up headlamp nod) and a lower intake.
  body.add(mesh(rbox(1.24, 0.045, 0.04), head, 0, 0.39, 2.215, false));
  body.add(mesh(rbox(1.1, 0.08, 0.05), dark, 0, 0.29, 2.2, false));

  // A targa hoop and window rail connect the canopy to the shoulders instead of a floating black block.
  body.add(mesh(rbox(1.12, 0.045, 0.1), trim, 0, 1.14, -0.88));
  for (const side of [-1, 1]) {
    const pillar = mesh(rbox(0.045, 0.29, 0.085), trim, side * 0.61, 0.99, -0.88);
    pillar.rotation.z = side * 0.3;
    body.add(pillar);
    const frontPillar = mesh(rbox(0.035, 0.035, 0.94), paint, side * 0.615, 0.95, 0.43);
    frontPillar.lookAt(side * 0.69, 0.745, 0.86);
    body.add(frontPillar);
    const rail = mesh(rbox(0.035, 0.025, 1.48), dark, side * 0.7, 0.81, -0.18);
    rail.rotation.x = 0.075;
    body.add(rail);
    body.add(mesh(rbox(0.025, 0.026, 0.18), trim, side * 0.955, 0.63, -0.25, false));
    for (const z of [-AXLE_Z, AXLE_Z]) {
      const arch = mesh(new TorusGeometry(0.385, 0.018, 4, 24, Math.PI), satin, side * 0.965, WHEEL_R, z);
      arch.rotation.y = Math.PI / 2;
      body.add(arch);
    }
  }
  body.add(mesh(rbox(1.35, 0.022, 0.035), dark, 0, 0.764, 0.82, false));

  // Flanks: side intakes ahead of the rear wheels, mirrors, and the pontoon trim line (an A detail).
  for (const s of [-1, 1]) {
    const intakeSurround = mesh(rbox(0.04, 0.14, 0.32), paint, s * 0.947, 0.54, -0.64, false);
    const intake = mesh(rbox(0.026, 0.075, 0.23), dark, s * 0.963, 0.54, -0.64, false);
    intakeSurround.rotation.x = intake.rotation.x = -0.2;
    body.add(intakeSurround, intake);
    body.add(mesh(rbox(0.12, 0.06, 0.16), paint, s * 0.92, 0.86, 0.5));
    const mirrorStem = mesh(rbox(0.028, 0.13, 0.04), dark, s * 0.875, 0.802, 0.5);
    mirrorStem.rotation.z = -s * 0.55;
    body.add(mirrorStem);
    const strip = mesh(rbox(0.02, 0.025, 1.25), trim, s * 0.962, 0.58, 0, false);
    strip.rotation.x = 0.03;
    body.add(strip);
  }

  // Cold-gas nozzles: four main thrusters at the tail, a lift nozzle beside each wheel, attitude nozzles on the flanks.
  const rear = [-0.75, -0.42, 0.42, 0.75].map((x) =>
    nozzle(x, Math.abs(x) > 0.6 ? 0.52 : 0.33, -2.25, [0, 0, -1], ring, nozzleGlow),
  );
  const lift = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => nozzle(sx * 0.8, 0.2, sz * (AXLE_Z + 0.48), [0, -1, 0], ring, nozzleGlow)),
  );
  const left = nozzle(0.965, 0.36, 0.95, [1, 0, 0], ring, nozzleGlow);
  const right = nozzle(-0.965, 0.36, 0.95, [-1, 0, 0], ring, nozzleGlow);
  body.add(...rear, ...lift, left, right);
  mergeByMaterial(body);

  const wheels = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => wheel((sx * TRACK) / 2, sz * AXLE_Z, tyre, rim, dark, caliper)),
  );
  for (const w of wheels) {
    const spin = w.userData['spin'] as Object3D;
    mergeByMaterial(spin);
  }
  model.add(...wheels);
  return { group, body, wheels, nozzles: { rear, lift, left, right }, nozzleGlow, shadow: contactShadow() };
}
