import {
  CatmullRomCurve3,
  Mesh,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
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

/** Follow the actual upper glass edge, so the front frame cannot float above a guessed straight rake. */
export function canopyFrame(glass: BufferGeometry, side: number): BufferGeometry {
  const rings = new Map<number, Vector3[]>();
  const positions = glass.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    if (x < 0 || z < 0) continue;
    const points = rings.get(z) ?? [];
    points.push(new Vector3(x, positions.getY(i), z));
    rings.set(z, points);
  }
  const path = [...rings.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, points]) => {
      const top = Math.max(...points.map((point) => point.y));
      const bottom = Math.min(...points.map((point) => point.y));
      const corner = Math.max(...points.map((point) => point.x)) * 0.8;
      const upper = points.filter((point) => point.y >= top - (top - bottom) * 0.3);
      upper.sort((a, b) => Math.abs(a.x - corner) - Math.abs(b.x - corner));
      const point = upper[0]?.clone();
      if (!point) throw new Error('Canopy ring has no upper edge');
      return point.set(side * (point.x + 0.004), point.y + 0.006, point.z);
    });
  const start = path[0];
  if (!start) throw new Error('Canopy has no front frame');
  path.unshift(new Vector3(side * 0.525, 1.135, -0.04));
  return new TubeGeometry(new CatmullRomCurve3(path), 12, 0.014, 4, false);
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
