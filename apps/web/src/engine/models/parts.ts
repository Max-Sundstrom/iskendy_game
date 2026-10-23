import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  MeshStandardMaterial,
  Quaternion,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Building blocks for vehicle meshes that draw in one call per vehicle type. Every part carries four attributes:
// `color` (its own colour), `paint` (1 where the per-instance body colour applies) and `glow` (emissive strength,
// for lamps and arrow boards), plus `surface` (roughness/metalness). Glass, rubber and paint share a draw call.

export type Part = BufferGeometry;
type Point = readonly [number, number, number];

export const Surface = {
  paint: [0.34, 0.16],
  glass: [0.12, 0.08],
  rubber: [0.9, 0],
  trim: [0.66, 0.08],
  metal: [0.24, 0.72],
  concrete: [0.94, 0],
} as const;

const tmp = new Color();

/** Tags a geometry with the vehicle attributes and drops what the merge doesn't need. */
export function tag(
  geometry: BufferGeometry,
  color: string,
  paint = 0,
  glow = 0,
  surface: readonly [number, number] = Surface.paint,
): Part {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const n = g.getAttribute('position').count;
  tmp.set(color);
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([tmp.r, tmp.g, tmp.b], i * 3);
  g.setAttribute('color', new Float32BufferAttribute(c, 3));
  g.setAttribute('paint', new Float32BufferAttribute(new Float32Array(n).fill(paint), 1));
  g.setAttribute('glow', new Float32BufferAttribute(new Float32Array(n).fill(glow), 1));
  const finish = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) finish.set(surface, i * 2);
  g.setAttribute('surface', new Float32BufferAttribute(finish, 2));
  return g;
}

export function box(w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry {
  return new BoxGeometry(w, h, d).translate(x, y, z);
}

/** A narrow structural member between two anchors, used for the glazing pillars. */
export function strut(from: Point, to: Point, widthM: number): BufferGeometry {
  const a = new Vector3(...from);
  const b = new Vector3(...to);
  const direction = b.clone().sub(a);
  const g = new BoxGeometry(widthM, direction.length(), widthM);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()));
  const centre = a.add(b).multiplyScalar(0.5);
  return g.translate(centre.x, centre.y, centre.z);
}

/** A four-corner surface, wound counterclockwise from the visible side; two triangles, no hidden box faces. */
export function panel(a: Point, b: Point, c: Point, d: Point): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/** Rounded tyre and dished metal rim, axle along x, resting on the ground. */
export function wheelParts(x: number, z: number, radiusM: number, widthM: number, rim = '#9aa0a8'): Part[] {
  const r = radiusM;
  const hw = widthM / 2;
  const profile = [
    new Vector2(r * 0.7, -hw),
    new Vector2(r * 0.93, -hw),
    new Vector2(r, -hw * 0.55),
    new Vector2(r, hw * 0.55),
    new Vector2(r * 0.93, hw),
    new Vector2(r * 0.7, hw),
  ];
  const tyre = new LatheGeometry(profile, 14).rotateZ(Math.PI / 2).translate(x, r, z);
  const side = Math.sign(x) || 1;
  const disc = new LatheGeometry(
    [
      new Vector2(r * 0.12, -side * hw * 0.45),
      new Vector2(r * 0.57, -side * hw * 0.78),
      new Vector2(r * 0.69, -side * hw * 0.92),
      new Vector2(r * 0.71, -side * hw * 0.8),
    ],
    14,
  )
    .rotateZ(Math.PI / 2)
    .translate(x, r, z);
  const hub = new CylinderGeometry(r * 0.16, r * 0.16, 0.03, 8)
    .rotateZ(Math.PI / 2)
    .translate(x + side * hw * 0.55, r, z);
  // Reverse the inside-out dish on the left without changing its position or the shared material's side mode.
  if (side < 0) {
    const index = disc.getIndex();
    if (index)
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i);
        index.setX(i, index.getX(i + 2));
        index.setX(i + 2, a);
      }
    disc.computeVertexNormals();
  }
  return [
    tag(tyre, '#17191d', 0, 0, Surface.rubber),
    tag(disc, rim, 0, 0, Surface.metal),
    tag(hub, '#30333a', 0, 0, Surface.trim),
  ];
}

/** Two wheels on one axle. */
export function axle(z: number, trackM: number, radiusM: number, widthM = 0.24, rim?: string): Part[] {
  return [...wheelParts(trackM / 2, z, radiusM, widthM, rim), ...wheelParts(-trackM / 2, z, radiusM, widthM, rim)];
}

/** Merges parts into one geometry; models are built front = +z and centred, then moved so the rear sits at z = 0. */
export function assemble(parts: Part[], lengthM: number): BufferGeometry {
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('vehicle parts have mismatched attributes');
  merged.rotateY(Math.PI).translate(0, 0, -lengthM / 2); // front → three −z (sim +z), rear at the origin
  merged.computeBoundingSphere();
  return merged;
}

/** Standard material that tints only painted parts by the instance colour and lights the glowing ones. */
export function vehicleMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ vertexColors: true });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float paint;\nattribute float glow;\nattribute vec2 surface;\nvarying float vGlow;\nvarying vec2 vSurface;',
      )
      .replace(
        '#include <color_vertex>',
        `vColor = vec4(1.0);
        vColor.rgb *= color;
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb = mix(vColor.rgb, vColor.rgb * instanceColor.rgb, paint);
        #endif
        vGlow = glow;
        vSurface = surface;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;\nvarying vec2 vSurface;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vSurface.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vSurface.y;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vGlow;',
      );
  };
  return m;
}
