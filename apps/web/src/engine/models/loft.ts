import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from 'three';

// Smooth bodies from cross-sections: each station is a rounded outline (sill → shoulder → roof) and consecutive
// stations are stitched into one surface, so cars read as cars instead of boxes. Procedural because there is no
// Blender in the cloud workspace; the P3-01 Blender model can replace the hero later. Front = +z, metres.

export type Station = {
  /** Position along the car. */
  z: number;
  /** Bottom (sill) height and half-width. */
  ys: number;
  wb: number;
  /** Shoulder (widest line) height and half-width. */
  ysh: number;
  wsh: number;
  /** Top height and half-width of the flat top; `crown` lifts the centre line above it. */
  yt: number;
  wt: number;
  crown?: number;
};

const SIDE_SAMPLES = 9; // per side, sill to centre top

/** Right half of the outline from the bottom centre to the top centre (x ≥ 0). */
function halfOutline(s: Station, out: Vector3[]): void {
  const crown = s.crown ?? 0.02;
  const curve = new CatmullRomCurve3(
    [
      new Vector3(s.wb * 0.85, s.ys, 0),
      new Vector3(s.wb, s.ys + 0.04, 0),
      new Vector3(s.wsh, s.ysh, 0),
      new Vector3(s.wt, s.yt, 0),
      new Vector3(s.wt * 0.5, s.yt + crown * 0.85, 0),
      new Vector3(0, s.yt + crown, 0),
    ],
    false,
    'centripetal',
  );
  out.push(new Vector3(0, s.ys, 0));
  for (let i = 0; i <= SIDE_SAMPLES; i++) out.push(curve.getPoint(i / SIDE_SAMPLES));
}

/** Closed ring: bottom centre → right side → top centre → left side. */
function ring(s: Station): Vector3[] {
  const right: Vector3[] = [];
  halfOutline(s, right);
  const left = right
    .slice(1, -1)
    .reverse()
    .map((p) => new Vector3(-p.x, p.y, 0));
  return [...right, ...left].map((p) => p.setZ(s.z));
}

/** Stitches the stations (ordered by z) into a closed, capped, smooth-shaded surface. */
export function loft(stations: readonly Station[]): BufferGeometry {
  const rings = stations.map(ring);
  const n = rings[0]?.length ?? 0;
  const pos: number[] = [];
  const index: number[] = [];
  for (const r of rings) for (const p of r) pos.push(p.x, p.y, p.z);
  for (let r = 0; r + 1 < rings.length; r++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = r * n + i;
      const b = r * n + j;
      const c = (r + 1) * n + j;
      const d = (r + 1) * n + i;
      index.push(a, c, d, a, b, c);
    }
  }
  // Caps get their own vertices so the end faces shade flat; fans around the centroid, wound to face outward.
  const cap = (pts: Vector3[], outward: number) => {
    const base = pos.length / 3;
    const c = pts.reduce((acc, p) => acc.add(p), new Vector3()).multiplyScalar(1 / pts.length);
    pos.push(c.x, c.y, c.z);
    for (const p of pts) pos.push(p.x, p.y, p.z);
    for (let i = 0; i < pts.length; i++) {
      const p = base + 1 + i;
      const q = base + 1 + ((i + 1) % pts.length);
      if (outward > 0) index.push(base, p, q);
      else index.push(base, q, p);
    }
  };
  cap(rings[0] ?? [], -1);
  cap(rings[rings.length - 1] ?? [], 1);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
