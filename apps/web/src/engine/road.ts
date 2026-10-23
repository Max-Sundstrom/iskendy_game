import art from '@kometa/content/art.json';
import type { SimTuning } from '@kometa/shared';
import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Euler,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHUNK_M, createChunkProps, sharedPropAssets, type ChunkProps } from './props';

// Road as a ring of chunks that leapfrog ahead of the camera (ARCHITECTURE §6). Positions follow the sim's
// origin-shifted z, so an origin shift simply moves every chunk back by the shift.

const CHUNKS = 3;

type Chunk = { group: Group; props: ChunkProps; index: number };

function chunk(tuning: SimTuning, shared: ReturnType<typeof sharedPropAssets>): Chunk {
  const width = tuning.lanes.count * tuning.lanes.widthM;
  const g = new Group();
  const asphalt = new Mesh(
    new PlaneGeometry(width + 2, CHUNK_M),
    new MeshStandardMaterial({ color: art.palette.wetAsphalt, roughness: 0.22 }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.receiveShadow = true;
  g.add(asphalt);

  const dashes = Math.floor(CHUNK_M / 9);
  const marks = new InstancedMesh(
    new PlaneGeometry(0.15, 3),
    new MeshStandardMaterial({ color: art.palette.enamelCream, roughness: 0.5 }),
    dashes * (tuning.lanes.count - 1),
  );
  const m = new Matrix4();
  const flat = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0));
  const one = new Vector3(1, 1, 1);
  let i = 0;
  for (let lane = 1; lane < tuning.lanes.count; lane++) {
    const x = -width / 2 + lane * tuning.lanes.widthM;
    for (let d = 0; d < dashes; d++)
      marks.setMatrixAt(i++, m.compose(new Vector3(x, 0.005, CHUNK_M / 2 - d * 9 - 1.5), flat, one));
  }
  // Solid edge lines.
  const edges = mergeGeometries(
    [-1, 1].map((sx) =>
      new PlaneGeometry(0.18, CHUNK_M).rotateX(-Math.PI / 2).translate(sx * (width / 2 - 0.3), 0.005, 0),
    ),
  );
  if (edges) g.add(new Mesh(edges, marks.material));
  g.add(marks);
  const props = createChunkProps(tuning, shared);
  g.add(props.group);
  return { group: g, props, index: Number.NaN };
}

export type Road = { group: Group; update(simZ: number, distanceM: number): void };

export function createRoad(tuning: SimTuning): Road {
  const group = new Group();
  const shared = sharedPropAssets(tuning);
  const chunks = Array.from({ length: CHUNKS }, () => chunk(tuning, shared));
  group.add(...chunks.map((c) => c.group));
  return {
    group,
    /**
     * Places the chunks so they cover from just behind the camera to ~400 m ahead. Chunks are indexed by absolute
     * distance (sim z plus the origin shifts so far, a multiple of the chunk length), so an origin shift moves them
     * without reshuffling the trees and buildings around the player.
     */
    update(simZ, distanceM) {
      const offset = Math.round((distanceM - simZ) / CHUNK_M) * CHUNK_M;
      const first = Math.floor((simZ + offset - 40) / CHUNK_M);
      for (let k = 0; k < CHUNKS; k++) {
        const index = first + k;
        // Each ring slot always shows the chunk whose index ≡ slot (mod CHUNKS), so a slot only re-lays out when it
        // leapfrogs ahead.
        const c = chunks[((index % CHUNKS) + CHUNKS) % CHUNKS];
        if (!c) continue;
        c.group.position.z = -(index * CHUNK_M - offset + CHUNK_M / 2); // sim +z is three −z
        if (c.index !== index) {
          c.index = index;
          c.props.layout(index);
        }
      }
    },
  };
}
