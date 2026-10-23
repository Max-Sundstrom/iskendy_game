import { CylinderGeometry, IcosahedronGeometry, type BufferGeometry } from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tag } from './models/parts';

// Linden trees for the embankment (ART_DIRECTION §5): a tapered trunk with three limbs and a clustered canopy whose
// lobes are gently lumped by a fixed noise and shaded from a dark underside to sunlit tips, so the crown reads as
// foliage rather than spheres. One geometry, instanced per chunk.

/** Cheap fixed 3D noise in [−1, 1], so every tree has the same lumps (deterministic and allocation-free). */
function noise(x: number, y: number, z: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

function lobe(x: number, y: number, z: number, r: number): BufferGeometry {
  // Welded so the lumps shade smoothly instead of as facets.
  const g = mergeVertices(new IcosahedronGeometry(r, 1).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const k = 1 + 0.16 * noise(px * 1.7, py * 1.7, pz * 1.7);
    pos.setXYZ(i, px * k + x, py * k * 0.85 + y, pz * k + z);
  }
  g.computeVertexNormals();
  return g;
}

/** Height shading: the colour attribute goes from `low` under the crown to `high` at the top. */
function shade(
  g: BufferGeometry,
  y0: number,
  y1: number,
  low: [number, number, number],
  high: [number, number, number],
) {
  const pos = g.getAttribute('position');
  const col = g.getAttribute('color');
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - y0) / (y1 - y0)));
    const n = 0.02 * noise(pos.getX(i), pos.getY(i), pos.getZ(i));
    col.setXYZ(
      i,
      low[0] + (high[0] - low[0]) * t + n,
      low[1] + (high[1] - low[1]) * t + n,
      low[2] + (high[2] - low[2]) * t,
    );
  }
}

export function lindenGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [tag(new CylinderGeometry(0.13, 0.26, 3.4, 8).translate(0, 1.7, 0), '#4a3b30')];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    const limb = new CylinderGeometry(0.05, 0.1, 1.9, 6)
      .translate(0, 0.95, 0)
      .rotateZ(0.7)
      .rotateY(a)
      .translate(0, 2.7, 0);
    parts.push(tag(limb, '#4a3b30'));
  }
  const crown: [number, number, number, number][] = [
    [0, 5.0, 0, 2.0],
    [1.3, 4.6, 0.5, 1.5],
    [-1.2, 4.7, -0.6, 1.6],
    [0.4, 4.4, -1.4, 1.4],
    [-0.5, 4.5, 1.4, 1.4],
    [0.6, 6.1, 0.3, 1.5],
    [-0.6, 6.0, -0.4, 1.4],
    [0, 7.0, 0, 1.1],
  ];
  for (const [x, y, z, r] of crown) {
    const g = tag(lobe(x, y, z, r), '#ffffff');
    shade(g, 3.2, 7.8, [0.025, 0.06, 0.018], [0.13, 0.22, 0.05]); // linear RGB: deep shade → sunlit leaves
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('tree parts have mismatched attributes');
  return merged;
}
