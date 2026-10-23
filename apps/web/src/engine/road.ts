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

// Road as a ring of chunks that leapfrog ahead of the camera (ARCHITECTURE §6). Positions follow the sim's
// origin-shifted z, so an origin shift simply moves every chunk back by the shift.

const CHUNK_M = 200;
const CHUNKS = 3;

function chunk(tuning: SimTuning): Group {
  const width = tuning.lanes.count * tuning.lanes.widthM;
  const g = new Group();
  const asphalt = new Mesh(
    new PlaneGeometry(width + 2, CHUNK_M),
    new MeshStandardMaterial({ color: art.palette.wetAsphalt, roughness: 0.22 }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.receiveShadow = true;
  const verge = new Mesh(
    new PlaneGeometry(400, CHUNK_M),
    new MeshStandardMaterial({ color: '#23202b', roughness: 0.9 }),
  );
  verge.rotation.x = -Math.PI / 2;
  verge.position.y = -0.02;
  g.add(asphalt, verge);

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
  g.add(marks);
  return g;
}

export type Road = { group: Group; update(simZ: number): void };

export function createRoad(tuning: SimTuning): Road {
  const group = new Group();
  const chunks = Array.from({ length: CHUNKS }, () => chunk(tuning));
  group.add(...chunks);
  return {
    group,
    /** Places the chunks so they cover from just behind the camera to ~400 m ahead. */
    update(simZ: number) {
      const first = Math.floor((simZ - 40) / CHUNK_M);
      chunks.forEach((c, k) => {
        const startZ = (first + k) * CHUNK_M; // sim z where this chunk begins
        c.position.z = -(startZ + CHUNK_M / 2); // sim +z is three −z
      });
    },
  };
}
