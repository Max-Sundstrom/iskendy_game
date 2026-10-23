import art from '@kometa/content/art.json';
import type { SimTuning } from '@kometa/shared';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildingKinds, facadeMaterial } from './buildings';
import { lindenGeometry } from './flora';
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

export type ChunkProps = { group: Group; layout(index: number): void };

/** Small deterministic hash so a chunk index always gets the same trees and buildings. */
function rand(index: number, k: number): number {
  let h = (index * 374761393 + k * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const TREES = 18;
const PER_KIND = 8; // instances per building kind and chunk
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
  const blocks = shared.buildings.map((k) => new InstancedMesh(k.geometry, shared.facade, PER_KIND));
  trees.castShadow = true;
  lamps.castShadow = true;
  group.add(posts, lamps, trees, ...blocks);

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
      // Buildings in a row along the chunk, each of a random kind, with gaps; a kind's mesh holds its instances.
      for (const b of blocks) b.count = 0;
      let z = CHUNK_M / 2;
      for (let i = 0; z > -CHUNK_M / 2 && i < 40; i++) {
        const kind = Math.floor(rand(index, i + 200) * blocks.length);
        const spec = shared.buildings[kind];
        const mesh = blocks[kind];
        if (!spec || !mesh || mesh.count >= PER_KIND) break;
        const k = 0.85 + rand(index, i + 300) * 0.35;
        const depth = spec.depthM * k;
        z -= depth / 2;
        const x = half + 26 + rand(index, i + 400) * 40 + (spec.widthM * k) / 2;
        const turn = rand(index, i + 500) < 0.5 ? 0 : Math.PI;
        mesh.setMatrixAt(mesh.count++, m.compose(p.set(x, 0, z), q.setFromEuler(e.set(0, turn, 0)), s.set(k, k, k)));
        z -= depth / 2 + 4 + rand(index, i + 600) * 10;
      }
      trees.instanceMatrix.needsUpdate = true;
      for (const b of blocks) b.instanceMatrix.needsUpdate = true;
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
    facade: facadeMaterial(),
    buildings: buildingKinds(),
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
    tree: lindenGeometry(),
  };
}
