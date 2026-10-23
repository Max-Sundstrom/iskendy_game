import type { BufferGeometry } from 'three';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  MeshStandardMaterial,
  Vector2,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Building blocks for vehicle meshes that draw in one call per vehicle type. Every part carries three attributes:
// `color` (its own colour), `paint` (1 where the per-instance body colour applies) and `glow` (emissive strength,
// for lamps and arrow boards). `vehicleMaterial` reads them.

export type Part = BufferGeometry;

const tmp = new Color();

/** Tags a geometry with the vehicle attributes and drops what the merge doesn't need. */
export function tag(geometry: BufferGeometry, color: string, paint = 0, glow = 0): Part {
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
  return g;
}

export function box(w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry {
  return new BoxGeometry(w, h, d).translate(x, y, z);
}

/** A tyre with rounded shoulders (lathed) plus a rim disc, axle along x, resting on the ground. */
export function wheelParts(x: number, z: number, radiusM: number, widthM: number, rim = '#9aa0a8'): Part[] {
  const r = radiusM;
  const hw = widthM / 2;
  const profile = [
    new Vector2(r * 0.62, -hw),
    new Vector2(r * 0.93, -hw),
    new Vector2(r, -hw * 0.55),
    new Vector2(r, hw * 0.55),
    new Vector2(r * 0.93, hw),
    new Vector2(r * 0.62, hw),
  ];
  const tyre = new LatheGeometry(profile, 14).rotateZ(Math.PI / 2).translate(x, r, z);
  const side = Math.sign(x) || 1;
  const disc = new CylinderGeometry(r * 0.64, r * 0.64, 0.02, 14)
    .rotateZ(Math.PI / 2)
    .translate(x + side * hw * 0.8, r, z);
  const hub = new CylinderGeometry(r * 0.16, r * 0.16, 0.03, 8)
    .rotateZ(Math.PI / 2)
    .translate(x + side * hw * 0.9, r, z);
  return [tag(tyre, '#151517'), tag(disc, rim), tag(hub, '#30333a')];
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
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.15 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float paint;\nattribute float glow;\nvarying float vGlow;',
      )
      .replace(
        '#include <color_vertex>',
        `vColor = vec4(1.0);
        vColor.rgb *= color;
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb = mix(vColor.rgb, vColor.rgb * instanceColor.rgb, paint);
        #endif
        vGlow = glow;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vGlow;',
      );
  };
  return m;
}
