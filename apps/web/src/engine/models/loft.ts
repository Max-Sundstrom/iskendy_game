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

/** Mesh density: outline samples per side, and extra stations interpolated between each given pair. */
export type LoftDetail = { side: number; between: number };
/** Traffic default: keeps every vehicle within the 3 000-triangle budget. */
export const TRAFFIC_DETAIL: LoftDetail = { side: 9, between: 1 };
/** The hero car: dense enough for smooth highlights in close-ups. */
export const HERO_DETAIL: LoftDetail = { side: 16, between: 4 };

const KEYS = ['z', 'ys', 'wb', 'ysh', 'wsh', 'yt', 'wt', 'crown'] as const;

/** Catmull-Rom between stations b and c (a, d their neighbours), so the body flows instead of creasing at stations. */
function blend(a: Station, b: Station, c: Station, d: Station, t: number): Station {
  const out = { ...b };
  for (const k of KEYS) {
    const p0 = a[k] ?? 0.02;
    const p1 = b[k] ?? 0.02;
    const p2 = c[k] ?? 0.02;
    const p3 = d[k] ?? 0.02;
    if (k === 'z') {
      out[k] = p1 + (p2 - p1) * t; // stations stay evenly spaced and never pass the ends
      continue;
    }
    const t2 = t * t;
    const v =
      0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t2 * t);
    out[k] = Math.min(Math.max(p1, p2), Math.max(Math.min(p1, p2), v)); // no bulges past either neighbour
  }
  return out;
}

function refine(stations: readonly Station[], between: number): Station[] {
  if (between <= 0) return [...stations];
  const out: Station[] = [];
  for (let i = 0; i + 1 < stations.length; i++) {
    const b = stations[i];
    const c = stations[i + 1];
    if (!b || !c) continue;
    const a = stations[i - 1] ?? b;
    const d = stations[i + 2] ?? c;
    out.push(b);
    for (let k = 1; k <= between; k++) out.push(blend(a, b, c, d, k / (between + 1)));
  }
  const last = stations[stations.length - 1];
  if (last) out.push(last);
  return out;
}

/** Right half of the outline from the bottom centre to the top centre (x ≥ 0). */
function halfOutline(s: Station, out: Vector3[], samples: number): void {
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
  for (let i = 0; i <= samples; i++) out.push(curve.getPoint(i / samples));
}

/** Closed ring: bottom centre → right side → top centre → left side. */
function ring(s: Station, samples: number): Vector3[] {
  const right: Vector3[] = [];
  halfOutline(s, right, samples);
  const left = right
    .slice(1, -1)
    .reverse()
    .map((p) => new Vector3(-p.x, p.y, 0));
  return [...right, ...left].map((p) => p.setZ(s.z));
}

/** Stitches the stations (ordered by z) into a closed, capped, smooth-shaded surface. */
export function loft(stations: readonly Station[], detail: LoftDetail = TRAFFIC_DETAIL): BufferGeometry {
  const rings = refine(stations, detail.between).map((st) => ring(st, detail.side));
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
