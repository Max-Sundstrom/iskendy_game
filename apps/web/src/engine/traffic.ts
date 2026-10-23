import art from '@kometa/content/art.json';
import { laneCenterX, TRAFFIC_CAPACITY, type Traffic } from '@kometa/sim';
import type { SimTuning } from '@kometa/shared';
import { Color, Group, InstancedMesh, Matrix4 } from 'three';
import { vehicleGeometry } from './models';
import { vehicleMaterial } from './models/parts';

// Traffic: one instanced mesh per vehicle type (13 draw calls at most, invariant 5). Each frame the active sim slots
// are packed into their type's mesh; a slot keeps its paint colour for as long as it lives.

export type TrafficView = { group: Group; update(traffic: Traffic, prevZ: Float64Array, alpha: number): void };

export function createTrafficView(tuning: SimTuning): TrafficView {
  const group = new Group();
  const material = vehicleMaterial();
  const meshes = tuning.vehicles.map((_, type) => {
    const mesh = new InstancedMesh(vehicleGeometry(tuning, type), material, TRAFFIC_CAPACITY);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // instances span the whole road; the bounding sphere is the template's
    mesh.count = 0;
    group.add(mesh);
    return mesh;
  });
  const colors = art.traffic.map((c) => new Color(c));
  const m = new Matrix4();

  return {
    group,
    update(traffic, prevZ, alpha) {
      for (const mesh of meshes) mesh.count = 0;
      for (let i = 0; i < TRAFFIC_CAPACITY; i++) {
        if (traffic.active[i] === 0) continue;
        const mesh = meshes[traffic.type[i] ?? 0];
        if (!mesh) continue;
        const z = (prevZ[i] ?? 0) + ((traffic.z[i] ?? 0) - (prevZ[i] ?? 0)) * alpha;
        const k = mesh.count++;
        mesh.setMatrixAt(k, m.makeTranslation(laneCenterX(traffic.lane[i] ?? 0, tuning), 0, -z));
        const color = colors[(i * 7) % colors.length];
        if (color) mesh.setColorAt(k, color);
      }
      for (const mesh of meshes) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
  };
}
