import * as THREE from 'three';
import { ISKENDI_ORANGE, PALETTE } from './palette';

// D0-2 blockouts of the three vehicle concepts (ART_DIRECTION §8) at true scale, built from primitives in
// three.js instead of Blender (no Blender in the cloud workspace). Node names follow ASSETS §5 so the engine's
// bindings can be tried on the blockout. Origin: ground, centred between axles; front = +Z; metres.

export type Concept = 'A' | 'B' | 'C';
export type Livery = 'factory' | 'taxi' | 'neon' | 'courier';

export const CONCEPTS: Record<Concept, string> = {
  A: 'A · "Pobeda R"',
  B: 'B · "Samodelka"',
  C: 'C · "Chaika GT"',
};

export const LIVERIES: Record<Livery, string> = {
  factory: 'Factory Cream',
  taxi: 'City Taxi',
  neon: 'Neon Night',
  courier: 'Iskendi Courier',
};

type Paint = { body: string; roof: string; trim: string; stripe?: string; checker?: boolean; ornament?: boolean };

const PAINTS: Record<Livery, Paint> = {
  factory: { body: PALETTE.enamelCream, roof: PALETTE.duskPlum, trim: '#B8935A' },
  taxi: { body: PALETTE.sunflower, roof: PALETTE.sunflower, trim: '#2a2a2a', checker: true },
  neon: { body: '#15161d', roof: '#15161d', trim: '#3a3a44', stripe: PALETTE.hotRose },
  courier: { body: ISKENDI_ORANGE, roof: '#F6E7C8', trim: PALETTE.enamelCream, ornament: true },
};

const AXLE_Z = 2.65 / 2;
const BEVEL = 0.05;
const WHEEL_R = 0.34;
const TRACK = 1.68;

/** Side profile (z forward, y up) extruded across the car's width and centred on x = 0. */
function extrudeProfile(shape: THREE.Shape, width: number, bevel = 0.05): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 18,
  });
  // Shape x → world z (forward); extrusion → world x.
  geometry.rotateY(-Math.PI / 2);
  geometry.translate((width - 2 * bevel) / 2, 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}

/** Lower hull outline with wheel-arch notches; `top` lists the upper outline from the tail to the nose. */
function hull(top: [number, number][], rearZ: number, frontZ: number, sill = 0.2): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(rearZ, sill + 0.08);
  for (const [z, y] of top) s.lineTo(z, y);
  s.lineTo(frontZ - 0.15, sill + 0.03);
  const archR = WHEEL_R + 0.07;
  s.lineTo(AXLE_Z + archR, sill);
  s.absarc(AXLE_Z, WHEEL_R, archR, -0.3, Math.PI + 0.3, false);
  s.lineTo(-AXLE_Z + archR, sill);
  s.absarc(-AXLE_Z, WHEEL_R, archR, -0.3, Math.PI + 0.3, false);
  s.lineTo(rearZ + 0.1, sill);
  s.closePath();
  return s;
}

function polygon(points: [number, number][]): THREE.Shape {
  const s = new THREE.Shape();
  points.forEach(([z, y], i) => (i === 0 ? s.moveTo(z, y) : s.lineTo(z, y)));
  s.closePath();
  return s;
}

function materials(paint: Paint) {
  const clearcoat = (color: string) =>
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 });
  return {
    body: clearcoat(paint.body),
    roof: paint.ornament ? ornamentMaterial(paint.roof) : clearcoat(paint.roof),
    trim: new THREE.MeshStandardMaterial({ color: paint.trim, roughness: 0.35, metalness: 0.8 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#141824', roughness: 0.05, metalness: 0.2, clearcoat: 1 }),
    tyre: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.85 }),
    disc: new THREE.MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.3, metalness: 0.7 }),
    dark: new THREE.MeshStandardMaterial({ color: '#0b0b0f', roughness: 0.15, metalness: 0.3 }),
    headlight: new THREE.MeshStandardMaterial({ color: '#fff4e0', emissive: '#fff1d6', emissiveIntensity: 2.2 }),
    // Moderate emissive: AgX pushes very bright saturated red toward pink.
    taillight: new THREE.MeshStandardMaterial({ color: '#7a0008', emissive: '#ff1010', emissiveIntensity: 0.75 }),
    nozzle: new THREE.MeshStandardMaterial({
      color: '#2b2f38',
      emissive: PALETTE.lagoonTeal,
      emissiveIntensity: 0.05,
      metalness: 0.6,
      roughness: 0.3,
    }),
  };
}

/** Courier roof: a repeating ornament tile drawn on a canvas (placeholder for the Iskendi pattern). */
function ornamentMaterial(base: string): THREE.MeshPhysicalMaterial {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = ISKENDI_ORANGE;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(size / 2, 8);
    ctx.lineTo(size - 8, size / 2);
    ctx.lineTo(size / 2, size - 8);
    ctx.lineTo(8, size / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = ISKENDI_ORANGE;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return new THREE.MeshPhysicalMaterial({ map: texture, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.1 });
}

function box(w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function wheel(name: string, m: ReturnType<typeof materials>, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.27, 28), m.tyre);
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  g.add(tyre);
  // 21" aero disc with the five-slot motif (ASSETS §5), facing outward.
  const side = Math.sign(x);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.02, 28), m.disc);
  disc.rotation.z = Math.PI / 2;
  disc.position.x = side * 0.13;
  g.add(disc);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.12), m.dark);
    slot.position.set(side * 0.142, Math.sin(a) * 0.16, Math.cos(a) * 0.16);
    slot.rotation.x = -a;
    g.add(slot);
  }
  g.position.set(x, WHEEL_R, z);
  return g;
}

function nozzle(
  name: string,
  m: ReturnType<typeof materials>,
  x: number,
  y: number,
  z: number,
  dir: THREE.Vector3,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.06, 16), m.nozzle);
  mesh.name = name;
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  mesh.position.set(x, y, z);
  return mesh;
}

function addEmpty(
  parent: THREE.Object3D,
  name: string,
  x: number,
  y: number,
  z: number,
  extra?: Record<string, number>,
) {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  if (extra) Object.assign(o.userData, extra);
  parent.add(o);
}

/** B · "Samodelka": knife-edge wedge, low nose, full-width light bar, targa glass, wide flat tail, four round lamps. */
function samodelka(m: ReturnType<typeof materials>, paint: Paint, root: THREE.Group) {
  const rearZ = -2.15;
  const frontZ = 2.13;
  const tailZ = rearZ - BEVEL; // outer surface of the tail
  const body = new THREE.Mesh(
    extrudeProfile(
      hull(
        [
          [rearZ, 0.8],
          [-1.5, 0.84],
          [0.5, 0.8],
          [frontZ, 0.5],
          [frontZ + 0.02, 0.36],
        ],
        rearZ,
        frontZ,
      ),
      1.95,
    ),
    m.body,
  );
  body.name = 'Body';
  body.castShadow = true;
  root.add(body);

  // Greenhouse: narrower trapezoid set back, targa roof panel in the roof colour (two-tone, an A detail).
  const glass = new THREE.Mesh(
    extrudeProfile(
      polygon([
        [-1.2, 0.8],
        [-0.72, 1.13],
        [0.05, 1.13],
        [0.78, 0.8],
      ]),
      1.42,
      0.04,
    ),
    m.glass,
  );
  glass.name = 'Glass';
  glass.castShadow = true;
  root.add(glass);
  const roof = box(1.22, 0.035, 0.74, m.roof, 0, 1.165, -0.33);
  roof.name = 'Body_Roof';
  root.add(roof);

  // Pontoon line along the doors (an A detail): a thin trim strip dipping from the front arch to the rear arch.
  for (const side of [-1, 1]) {
    const strip = box(0.02, 0.035, 2.05, m.trim, side * 0.985, 0.6, 0.0);
    strip.rotation.x = 0.04;
    root.add(strip);
    if (paint.stripe) {
      const pin = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.02, 4.0),
        new THREE.MeshStandardMaterial({ color: paint.stripe, emissive: paint.stripe, emissiveIntensity: 1.6 }),
      );
      pin.position.set(side * 0.99, 0.74, 0);
      root.add(pin);
    }
    if (paint.checker) {
      for (let i = 0; i < 18; i++) {
        const tile = box(
          0.012,
          0.07,
          0.11,
          i % 2 ? m.dark : m.disc,
          side * 0.99,
          0.69 + (Math.floor(i / 9) % 2) * 0.0,
          -1.0 + i * 0.115,
        );
        root.add(tile);
      }
    }
  }

  const front = box(1.7, 0.05, 0.04, m.headlight, 0, 0.47, frontZ + BEVEL + 0.02);
  front.name = 'LightBar_F';
  root.add(front);

  // Rear signature: wide flat tail, four round lamps behind a smoked strip.
  root.add(box(1.84, 0.16, 0.02, m.dark, 0, 0.66, tailZ - 0.012));
  const rear = new THREE.Group();
  rear.name = 'LightBar_R';
  for (const x of [-0.72, -0.33, 0.33, 0.72]) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.02, 20), m.taillight);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(x, 0.66, tailZ - 0.03);
    rear.add(lamp);
  }
  root.add(rear);
  root.add(box(1.5, 0.07, 0.02, m.trim, 0, 0.42, tailZ - 0.012));

  // Nozzles sit in the bodywork so they don't widen the car past 1.95 m.
  const back = new THREE.Vector3(0, 0, -1);
  root.add(nozzle('Thr_Rear_L', m, 0.42, 0.3, tailZ - 0.02, back));
  root.add(nozzle('Thr_Rear_R', m, -0.42, 0.3, tailZ - 0.02, back));
  root.add(nozzle('Thr_Fender_L', m, 0.9, 0.55, tailZ + 0.02, back));
  root.add(nozzle('Thr_Fender_R', m, -0.9, 0.55, tailZ + 0.02, back));
  root.add(nozzle('Thr_Side_L', m, 0.94, 0.3, 0.75, new THREE.Vector3(1, 0, 0)));
  root.add(nozzle('Thr_Side_R', m, -0.94, 0.3, 0.75, new THREE.Vector3(-1, 0, 0)));
}

/** A · "Pobeda R": rounded fastback with pontoon fenders and a thin full-width tail bar. */
function pobeda(m: ReturnType<typeof materials>, _paint: Paint, root: THREE.Group) {
  const rearZ = -2.11;
  const frontZ = 2.11;
  const top: [number, number][] = [];
  // Fastback curve sampled from the tail up to the beltline, then a rounded nose.
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    top.push([rearZ + t * 1.2, 0.55 + Math.sin((t * Math.PI) / 2) * 0.27]);
  }
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    top.push([-1.0 + t * 3.15, 0.82 - Math.pow(t, 2.2) * 0.3]);
  }
  top.push([frontZ, 0.42]);
  const body = new THREE.Mesh(extrudeProfile(hull(top, rearZ, frontZ), 1.86, 0.09), m.body);
  body.name = 'Body';
  body.castShadow = true;
  root.add(body);

  const cabin: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    cabin.push([-1.75 + t * 2.55, 0.8 + Math.sin(t * Math.PI) * 0.32 * (t < 0.5 ? 1 : 1 - (t - 0.5) * 0.6)]);
  }
  const glass = new THREE.Mesh(extrudeProfile(polygon(cabin), 1.38, 0.06), m.glass);
  glass.name = 'Glass';
  root.add(glass);
  const roof = box(1.1, 0.03, 0.9, m.roof, 0, 1.12, -0.35);
  roof.name = 'Body_Roof';
  root.add(roof);

  // Pontoon fenders: elongated half-ellipsoids over each arch.
  for (const side of [-1, 1]) {
    for (const z of [AXLE_Z, -AXLE_Z]) {
      const fender = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), m.body);
      // A bulge over the arch, not a spat: the wheel stays visible below it.
      fender.scale.set(0.1, 0.2, 0.62);
      fender.position.set(side * 0.86, 0.66, z);
      fender.castShadow = true;
      root.add(fender);
    }
    root.add(box(0.02, 0.025, 2.2, m.trim, side * 0.94, 0.63, 0));
  }
  const front = box(1.5, 0.05, 0.05, m.headlight, 0, 0.44, frontZ + 0.07);
  front.name = 'LightBar_F';
  root.add(front);
  const rear = box(1.6, 0.035, 0.02, m.taillight, 0, 0.6, rearZ - 0.1);
  rear.name = 'LightBar_R';
  root.add(rear);
  const back = new THREE.Vector3(0, 0, -1);
  root.add(nozzle('Thr_Rear_L', m, 0.4, 0.32, rearZ - 0.08, back));
  root.add(nozzle('Thr_Rear_R', m, -0.4, 0.32, rearZ - 0.08, back));
}

/** C · "Chaika GT": long hood, short deck, small fins with vertical lamps, chrome side strip. */
function chaika(m: ReturnType<typeof materials>, _paint: Paint, root: THREE.Group) {
  const rearZ = -2.2;
  const frontZ = 2.18;
  const body = new THREE.Mesh(
    extrudeProfile(
      hull(
        [
          [rearZ, 0.74],
          [-1.4, 0.78],
          [frontZ - 0.2, 0.74],
          [frontZ + 0.02, 0.5],
        ],
        rearZ,
        frontZ,
      ),
      1.95,
      0.04,
    ),
    m.body,
  );
  body.name = 'Body';
  body.castShadow = true;
  root.add(body);
  const glass = new THREE.Mesh(
    extrudeProfile(
      polygon([
        [-1.45, 0.78],
        [-1.1, 1.08],
        [-0.45, 1.08],
        [0.15, 0.78],
      ]),
      1.4,
      0.03,
    ),
    m.glass,
  );
  glass.name = 'Glass';
  root.add(glass);
  for (const side of [-1, 1]) {
    root.add(box(0.025, 0.03, 4.3, m.trim, side * 0.985, 0.6, 0));
    const fin = box(0.05, 0.24, 0.7, m.body, side * 0.9, 0.86, rearZ + 0.4);
    fin.rotation.x = 0.25;
    root.add(fin);
    const lamp = box(0.05, 0.26, 0.02, m.taillight, side * 0.9, 0.78, rearZ - 0.06);
    lamp.name = side > 0 ? 'LightBar_R' : 'LightBar_R_2';
    root.add(lamp);
  }
  const front = box(1.75, 0.025, 0.03, m.headlight, 0, 0.6, frontZ + 0.07);
  front.name = 'LightBar_F';
  root.add(front);
  const back = new THREE.Vector3(0, 0, -1);
  root.add(nozzle('Thr_Rear_L', m, 0.45, 0.35, rearZ - 0.07, back));
  root.add(nozzle('Thr_Rear_R', m, -0.45, 0.35, rearZ - 0.07, back));
}

/** Builds a blockout with the ASSETS §5 node hierarchy. */
export function buildCar(concept: Concept, livery: Livery = 'factory'): THREE.Group {
  const root = new THREE.Group();
  root.name = 'KometaR';
  const paint = PAINTS[livery];
  const m = materials(paint);
  ({ A: pobeda, B: samodelka, C: chaika })[concept](m, paint, root);
  const halfTrack = TRACK / 2;
  root.add(wheel('Wheel_FL', m, halfTrack, AXLE_Z));
  root.add(wheel('Wheel_FR', m, -halfTrack, AXLE_Z));
  root.add(wheel('Wheel_RL', m, halfTrack, -AXLE_Z));
  root.add(wheel('Wheel_RR', m, -halfTrack, -AXLE_Z));
  addEmpty(root, 'Cam_Focus', 0, 2.05, 0);
  addEmpty(root, 'Collider_Hint', 0, 0.6, 0, { sizeX: 1.95, sizeY: 1.15, sizeZ: concept === 'C' ? 4.6 : 4.4 });
  return root;
}

/** Bounding size and triangle count, reported next to each render. */
export function measure(car: THREE.Object3D): { size: THREE.Vector3; triangles: number } {
  const size = new THREE.Box3().setFromObject(car).getSize(new THREE.Vector3());
  let triangles = 0;
  car.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const g = o.geometry as THREE.BufferGeometry;
      triangles += (g.index ? g.index.count : (g.attributes['position']?.count ?? 0)) / 3;
    }
  });
  return { size, triangles: Math.round(triangles) };
}
