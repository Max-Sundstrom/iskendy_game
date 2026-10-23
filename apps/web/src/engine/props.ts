import art from '@kometa/content/art.json';
import type { SimTuning } from '@kometa/shared';
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { box, tag, vehicleMaterial } from './models/parts';

// Embankment Gold roadside per 200 m chunk (ART_DIRECTION §5–§6): parapets with steel railings on both edges, arched
// lamp posts, linden trees on the embankment to the left with the river beyond, city blocks to the right. Instanced
// per chunk; `layout(index)` reshuffles trees and buildings from the chunk index so the ring of chunks doesn't repeat.

export const CHUNK_M = 200;

function merged(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error('prop parts have mismatched attributes');
  return g;
}

/** Arched lamp post on the right-hand edge, the head reaching over the road (−x). */
function lampGeometry(): BufferGeometry {
  return merged([
    tag(new CylinderGeometry(0.09, 0.13, 9, 8).translate(0, 4.5, 0), '#3a3d45'),
    tag(box(2.6, 0.12, 0.12, -1.25, 9, 0), '#3a3d45'),
    tag(box(0.9, 0.16, 0.34, -2.5, 8.9, 0), '#2a2c32'),
    tag(box(0.8, 0.05, 0.28, -2.5, 8.8, 0), '#ffd9a0', 0, 2.4),
  ]);
}

function railPostGeometry(): BufferGeometry {
  return merged([tag(box(0.07, 1.0, 0.07, 0, 0.5, 0), '#5b5f69')]);
}

/** Linden: trunk and a cluster of soft canopy lobes in two greens warmed by the low sun. */
function treeGeometry(): BufferGeometry {
  const lobes: [number, number, number, number, string][] = [
    [0, 4.6, 0, 2.2, '#4f6b2f'],
    [0.9, 5.3, 0.4, 1.6, '#5f7d36'],
    [-0.8, 5.1, -0.3, 1.7, '#47622b'],
    [0.1, 6.1, -0.2, 1.4, '#6a8a3c'],
  ];
  return merged([
    tag(new CylinderGeometry(0.16, 0.24, 3.6, 7).translate(0, 1.8, 0), '#4a3b30'),
    ...lobes.map(([x, y, z, r, c]) => tag(new IcosahedronGeometry(r, 1).translate(x, y, z), c)),
  ]);
}

/** Lit-window facade, one texture for every building; emissive so the city glows at dusk. */
function facade(): MeshStandardMaterial {
  const w = 64;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    for (let y = 4; y < h; y += 8)
      for (let x = 3; x < w; x += 8) {
        const lit = (x * 7 + y * 13) % 5 < 2;
        ctx.fillStyle = lit ? '#ffcf8a' : '#1a1a22';
        ctx.fillRect(x, y, 4, 5);
      }
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return new MeshStandardMaterial({
    color: '#8d7f8f',
    roughness: 0.8,
    emissive: '#ffffff',
    emissiveMap: tex,
    emissiveIntensity: 0.55,
    map: tex,
  });
}

export type ChunkProps = { group: Group; layout(index: number): void };

/** Small deterministic hash so a chunk index always gets the same trees and buildings. */
function rand(index: number, k: number): number {
  let h = (index * 374761393 + k * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const TREES = 18;
const BUILDINGS = 10;
const LAMPS = 4;
const POSTS = Math.floor(CHUNK_M / 2.5);

export function createChunkProps(tuning: SimTuning, shared: ReturnType<typeof sharedPropAssets>): ChunkProps {
  const half = (tuning.lanes.count * tuning.lanes.widthM) / 2 + 1;
  const group = new Group();
  // Parapets and continuous rails, both sides baked into one mesh each.
  const walls = new Mesh(shared.walls, shared.concrete);
  walls.receiveShadow = true;
  group.add(walls, new Mesh(shared.rails, shared.steel));
  const walk = new Mesh(shared.walk, shared.pavement);
  walk.position.set(-half - 5, 0.02, 0);
  walk.rotation.x = -Math.PI / 2;
  const water = new Mesh(shared.water, shared.waterMat);
  water.position.set(-half - 120, -1.5, 0);
  water.rotation.x = -Math.PI / 2;
  const ground = new Mesh(shared.ground, shared.groundMat);
  ground.position.set(half + 110, -0.05, 0);
  ground.rotation.x = -Math.PI / 2;
  const quay = new Mesh(shared.quay, shared.concrete);
  quay.position.set(-half - 10, -0.78, 0);
  group.add(walk, water, ground, quay);

  const posts = new InstancedMesh(shared.post, shared.material, POSTS * 2);
  const lamps = new InstancedMesh(shared.lamp, shared.material, LAMPS * 2);
  const trees = new InstancedMesh(shared.tree, shared.material, TREES);
  const buildings = new InstancedMesh(shared.building, shared.facade, BUILDINGS);
  trees.castShadow = true;
  lamps.castShadow = true;
  group.add(posts, lamps, trees, buildings);

  const m = new Matrix4();
  const p = new Vector3();
  const q = new Quaternion();
  const s = new Vector3(1, 1, 1);
  const e = new Euler();
  for (let i = 0; i < POSTS; i++) {
    const z = CHUNK_M / 2 - i * 2.5;
    posts.setMatrixAt(i, m.makeTranslation(half + 0.2, 0.6, z));
    posts.setMatrixAt(POSTS + i, m.makeTranslation(-half - 0.2, 0.6, z));
  }
  for (let i = 0; i < LAMPS; i++) {
    const z = CHUNK_M / 2 - (i + 0.5) * (CHUNK_M / LAMPS);
    lamps.setMatrixAt(i, m.compose(p.set(half + 0.4, 0, z), q.identity(), s.set(1, 1, 1)));
    // Left-hand lamps mirror the arm over the road.
    lamps.setMatrixAt(LAMPS + i, m.compose(p.set(-half - 0.4, 0, z - 25), q.setFromEuler(e.set(0, Math.PI, 0)), s));
  }

  return {
    group,
    layout(index) {
      for (let i = 0; i < TREES; i++) {
        const z = CHUNK_M / 2 - (i + rand(index, i) * 0.6) * (CHUNK_M / TREES);
        const k = 0.8 + rand(index, i + 50) * 0.5;
        const x = -half - 3 - rand(index, i + 90) * 6;
        trees.setMatrixAt(
          i,
          m.compose(p.set(x, 0, z), q.setFromEuler(e.set(0, rand(index, i + 7) * 6.28, 0)), s.set(k, k, k)),
        );
      }
      for (let i = 0; i < BUILDINGS; i++) {
        const z = CHUNK_M / 2 - (i + 0.5) * (CHUNK_M / BUILDINGS);
        const tall = rand(index, i + 200);
        const height = 14 + tall * tall * 70;
        const width = 12 + rand(index, i + 300) * 16;
        const x = half + 24 + rand(index, i + 400) * 60 + width / 2;
        buildings.setMatrixAt(
          i,
          m.compose(p.set(x, height / 2, z), q.identity(), s.set(width, height, 14 + rand(index, i + 500) * 8)),
        );
      }
      trees.instanceMatrix.needsUpdate = true;
      buildings.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Geometry and materials shared by every chunk. */
export function sharedPropAssets(tuning: SimTuning) {
  const half = (tuning.lanes.count * tuning.lanes.widthM) / 2 + 1;
  const both = (make: (sx: number) => BufferGeometry[]) => merged([...make(1), ...make(-1)]);
  return {
    material: vehicleMaterial(),
    concrete: new MeshStandardMaterial({ color: '#8f8a86', roughness: 0.85 }),
    steel: new MeshStandardMaterial({ color: '#6b6f7a', roughness: 0.35, metalness: 0.8 }),
    pavement: new MeshStandardMaterial({ color: '#6e6470', roughness: 0.7 }),
    waterMat: new MeshStandardMaterial({
      color: new Color('#1e5f6e').lerp(new Color(art.palette.duskPlum), 0.35),
      roughness: 0.08,
      metalness: 0.4,
    }),
    groundMat: new MeshStandardMaterial({ color: '#2b2630', roughness: 0.95 }),
    facade: facade(),
    walls: both((sx) => [new BoxGeometry(0.45, 0.6, CHUNK_M).translate(sx * (half + 0.2), 0.3, 0)]),
    rails: both((sx) =>
      [1.1, 1.55].map((y) => new BoxGeometry(0.08, 0.08, CHUNK_M).translate(sx * (half + 0.2), y, 0)),
    ),
    walk: new PlaneGeometry(10, CHUNK_M),
    quay: new BoxGeometry(0.6, 1.6, CHUNK_M),
    water: new PlaneGeometry(220, CHUNK_M),
    ground: new PlaneGeometry(200, CHUNK_M),
    post: railPostGeometry(),
    lamp: lampGeometry(),
    tree: treeGeometry(),
    building: new BoxGeometry(1, 1, 1),
  };
}
