import { Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loft, type Station } from '../models/loft';

/** Small bevels give trim a highlight without spending hundreds of triangles per fitting. */
export function bevelBox(w: number, h: number, d: number): RoundedBoxGeometry {
  return new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.3);
}

/** Raise the outer body's lower edge around each tyre, leaving a real opening in side silhouette. */
export function archBody(stations: readonly Station[], sill = false): BufferGeometry {
  const geometry = loft(stations, { side: sill ? 8 : 14, between: 3 });
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = Math.abs(position.getX(i));
    const z = position.getZ(i);
    const dz = Math.min(Math.abs(z - 1.325), Math.abs(z + 1.325));
    if (x < 0.64 || dz >= 0.4) continue;
    const arch = 0.34 + Math.sqrt(0.4 * 0.4 - dz * dz);
    const blend = Math.min(1, (x - 0.64) / 0.12);
    const amount = blend * blend * (3 - 2 * blend);
    const y = position.getY(i);
    position.setY(i, y + Math.max(0, arch - y) * amount);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Bake static parts per material while retaining anchors and every finish attribute. */
export function mergeByMaterial(root: Object3D): void {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const groups = new Map<Material, { geometries: BufferGeometry[]; shadow: boolean }>();
  const parts: Mesh[] = [];
  root.traverse((object) => {
    if (!(object instanceof Mesh) || object === root) return;
    const material = object.material as Material;
    const source = object.geometry as BufferGeometry;
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    geometry.applyMatrix4(object.matrixWorld.clone().premultiply(inverse));
    const entry = groups.get(material) ?? { geometries: [], shadow: false };
    entry.geometries.push(geometry);
    entry.shadow ||= object.castShadow;
    groups.set(material, entry);
    parts.push(object);
  });
  for (const part of parts) {
    part.removeFromParent();
    part.geometry.dispose();
  }
  for (const [material, { geometries, shadow }] of groups) {
    const geometry = mergeGeometries(geometries, false);
    if (!geometry) throw new Error('Hero parts have incompatible finish attributes');
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = shadow;
    root.add(mesh);
    for (const part of geometries) part.dispose();
  }
}
