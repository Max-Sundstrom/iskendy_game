import art from '@kometa/content/art.json';
import { laneCenterX, TRAFFIC_CAPACITY, type Traffic } from '@kometa/sim';
import type { SimTuning } from '@kometa/shared';
import { BoxGeometry, Color, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';

// Grey-box traffic: one instanced unit box scaled per vehicle type — one draw call for all 64 slots (invariant 5).

export type TrafficView = { mesh: InstancedMesh; update(traffic: Traffic, prevZ: Float64Array, alpha: number): void };

export function createTrafficView(tuning: SimTuning): TrafficView {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, -0.5); // origin at the rear bottom centre; length runs toward three −z (sim +z)
  const mesh = new InstancedMesh(
    geometry,
    new MeshStandardMaterial({ roughness: 0.35, metalness: 0.1 }),
    TRAFFIC_CAPACITY,
  );
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  const colors = art.traffic.map((c) => new Color(c));
  const m = new Matrix4();
  const pos = new Vector3();
  const scale = new Vector3();
  const rot = new Quaternion();
  const hidden = new Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < TRAFFIC_CAPACITY; i++) mesh.setColorAt(i, colors[(i * 7) % colors.length] ?? new Color());

  return {
    mesh,
    update(traffic, prevZ, alpha) {
      for (let i = 0; i < TRAFFIC_CAPACITY; i++) {
        const v = tuning.vehicles[traffic.type[i] ?? 0];
        if (traffic.active[i] === 0 || !v) {
          mesh.setMatrixAt(i, hidden);
          continue;
        }
        const z = (prevZ[i] ?? 0) + ((traffic.z[i] ?? 0) - (prevZ[i] ?? 0)) * alpha;
        pos.set(laneCenterX(traffic.lane[i] ?? 0, tuning), 0, -z);
        scale.set(v.widthM, v.heightM, v.lengthM);
        mesh.setMatrixAt(i, m.compose(pos, rot, scale));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
