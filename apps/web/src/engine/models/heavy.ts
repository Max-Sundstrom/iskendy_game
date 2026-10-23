import { ConeGeometry, CylinderGeometry } from 'three';
import { type Size } from './cars';
import { loft, type Station } from './loft';
import { axle, box, tag, type Part } from './parts';

// Heavy traffic and road works (GDD §7): bus, trolleybus, semi, car-carrier, street-sweeper, road-works truck, cones
// and a concrete barrier. Front = +z, centred, metres.

const GLASS = '#1b2230';
const STEEL = '#2c2f36';
const TAIL = '#ff2a1a';
const AMBER = '#ff9a1f';

/** Rounded box body from z0 to z1 (rear to front), bottom ys, top yt. */
function slab(z0: number, z1: number, hw: number, ys: number, yt: number, round = 0.92): Station[] {
  const s = (z: number, k: number): Station => ({
    z,
    ys,
    wb: hw * 0.97 * k,
    ysh: ys + (yt - ys) * 0.5,
    wsh: hw * k,
    yt,
    wt: hw * round * k,
    crown: 0.05,
  });
  return [s(z0, 0.97), s(z0 + 0.1, 1), s(z1 - 0.1, 1), s(z1, 0.97)];
}

function tails(z: number, hw: number, y: number): Part[] {
  return [
    tag(box(0.22, 0.2, 0.04, hw - 0.2, y, z), TAIL, 0, 1.6),
    tag(box(0.22, 0.2, 0.04, -(hw - 0.2), y, z), TAIL, 0, 1.6),
  ];
}

/** Side window band and the rear window of a bus-like body. */
function windowBand(L: number, W: number, y0: number, y1: number, panes: number): Part[] {
  const parts: Part[] = [tag(box(W * 0.8, (y1 - y0) * 0.9, 0.04, 0, (y0 + y1) / 2, -L / 2 - 0.012), GLASS)];
  const len = L - 1.2;
  for (let i = 0; i < panes; i++) {
    const z = -L / 2 + 0.4 + (i + 0.5) * (len / panes);
    for (const sx of [1, -1])
      parts.push(tag(box(0.03, y1 - y0, len / panes - 0.1, sx * (W / 2 + 0.005), (y0 + y1) / 2, z), GLASS));
  }
  parts.push(tag(box(W * 0.9, (y1 - y0) * 1.2, 0.04, 0, (y0 + y1) / 2 + 0.05, L / 2 + 0.012), GLASS));
  return parts;
}

export function bus({ L, W, H }: Size): Part[] {
  const hw = W / 2;
  return [
    tag(loft(slab(-L / 2, L / 2, hw, 0.35, H - 0.25)), '#ffffff', 1),
    tag(box(W * 0.6, 0.25, L * 0.3, 0, H - 0.12, -L * 0.1), '#d7d9dd'), // roof air unit
    ...windowBand(L, W, H * 0.45, H * 0.82, 6),
    ...tails(-L / 2 - 0.012, hw, 0.9),
    ...axle(L / 2 - 2.6, W - 0.25, 0.5, 0.3),
    ...axle(-L / 2 + 3.0, W - 0.25, 0.5, 0.3),
  ];
}

/** Trolleybus: a bus with two current-collector poles; the overhead wires are cosmetic only (GDD §7). */
export function trolleybus(size: Size): Part[] {
  const { L, H } = size;
  const poles: Part[] = [];
  for (const sx of [0.35, -0.35]) {
    const pole = box(0.06, 0.06, 6.0, 0, 0, 0)
      .rotateX(-0.22)
      .translate(sx, H + 0.55, -L * 0.18);
    poles.push(tag(pole, STEEL));
  }
  return [...bus({ ...size, H: H - 0.2 }), ...poles, tag(box(1.2, 0.2, 2.0, 0, H - 0.3, L * 0.18), STEEL)];
}

/** Cab-over truck cab occupying z ∈ [z0, z0 + len]. */
function cab(z0: number, len: number, W: number, H: number, colour?: string): Part[] {
  const hw = W / 2;
  const c = colour ?? '#ffffff';
  const p = colour ? 0 : 1;
  return [
    tag(loft(slab(z0, z0 + len, hw, 0.6, H, 0.88)), c, p),
    tag(box(W * 0.86, H * 0.32, 0.04, 0, H * 0.72, z0 + len + 0.012), GLASS),
    tag(box(0.03, H * 0.28, len * 0.45, hw + 0.005, H * 0.74, z0 + len * 0.7), GLASS),
    tag(box(0.03, H * 0.28, len * 0.45, -hw - 0.005, H * 0.74, z0 + len * 0.7), GLASS),
    tag(box(W * 0.96, 0.3, 0.2, 0, 0.55, z0 + len - 0.05), STEEL), // bumper
    tag(box(0.3, 0.12, 0.04, hw - 0.3, 0.75, z0 + len + 0.015), '#fff1d6', 0, 1.2),
    tag(box(0.3, 0.12, 0.04, -(hw - 0.3), 0.75, z0 + len + 0.015), '#fff1d6', 0, 1.2),
  ];
}

export function semi({ L, W, H }: Size): Part[] {
  const hw = W / 2;
  const cabLen = 2.4;
  const trailerLen = L - cabLen - 0.4;
  return [
    ...cab(L / 2 - cabLen, cabLen, W, 3.1),
    tag(loft(slab(-L / 2, -L / 2 + trailerLen, hw, 1.1, H)), '#e4e4df'), // box trailer
    tag(box(W * 0.9, 0.12, trailerLen * 0.96, 0, H * 0.62, -L / 2 + trailerLen / 2), '#ffffff', 1, 0), // livery band
    tag(box(W * 0.5, 0.25, L, 0, 0.75, 0), STEEL), // chassis
    ...tails(-L / 2 - 0.012, hw, 1.0),
    ...axle(L / 2 - 0.9, W - 0.3, 0.5, 0.3),
    ...axle(L / 2 - cabLen - 0.3, W - 0.3, 0.5, 0.3),
    ...axle(-L / 2 + 1.2, W - 0.3, 0.5, 0.3),
    ...axle(-L / 2 + 2.5, W - 0.3, 0.5, 0.3),
  ];
}

/** Small car silhouette for the carrier decks (fixed colours so the load reads as a mix of cars). */
function cargoCar(z: number, y: number, colour: string): Part[] {
  const st: Station[] = [
    { z: z - 2.0, ys: y + 0.25, wb: 0.75, ysh: y + 0.6, wsh: 0.85, yt: y + 0.8, wt: 0.72 },
    { z: z - 0.6, ys: y + 0.2, wb: 0.78, ysh: y + 0.7, wsh: 0.87, yt: y + 1.3, wt: 0.62, crown: 0.04 },
    { z: z + 0.6, ys: y + 0.2, wb: 0.78, ysh: y + 0.7, wsh: 0.87, yt: y + 1.25, wt: 0.62, crown: 0.04 },
    { z: z + 2.0, ys: y + 0.25, wb: 0.72, ysh: y + 0.5, wsh: 0.82, yt: y + 0.7, wt: 0.66 },
  ];
  return [tag(loft(st), colour)];
}

export function carCarrier({ L, W, H }: Size): Part[] {
  const hw = W / 2;
  const cabLen = 2.4;
  const deckLen = L - cabLen - 0.4;
  const z0 = -L / 2;
  const parts: Part[] = [
    ...cab(L / 2 - cabLen, cabLen, W, 3.0),
    tag(box(W, 0.12, deckLen, 0, 1.15, z0 + deckLen / 2), STEEL), // lower deck
    tag(box(W, 0.12, deckLen, 0, H - 0.2, z0 + deckLen / 2), STEEL), // upper deck (the rideable top)
  ];
  for (let i = 0; i <= 6; i++) {
    const z = z0 + (i * deckLen) / 6;
    for (const sx of [1, -1]) parts.push(tag(box(0.1, H - 1.1, 0.1, sx * (hw - 0.05), (H + 1.1) / 2, z), STEEL));
  }
  const colours = ['#c9ccd2', '#8e1f2c', '#16171c', '#6fa8d6', '#e9e6df', '#1f4b3a'];
  for (let i = 0; i < 3; i++) {
    const z = z0 + 2.4 + i * 4.6;
    parts.push(...cargoCar(z, 1.2, colours[i] ?? '#ffffff'), ...cargoCar(z, H - 1.55, colours[i + 3] ?? '#ffffff'));
  }
  parts.push(...tails(z0 - 0.012, hw, 1.0), ...axle(L / 2 - 0.9, W - 0.3, 0.5, 0.3));
  parts.push(...axle(z0 + 1.4, W - 0.3, 0.45, 0.3), ...axle(z0 + 2.6, W - 0.3, 0.45, 0.3));
  return parts;
}

/** Street-sweeper: cab, rounded water tank, rotating brushes and an amber beacon. */
export function sweeper({ L, W, H }: Size): Part[] {
  const hw = W / 2;
  const brush = new CylinderGeometry(0.45, 0.45, 0.25, 12).translate(0, 0.45, 0);
  return [
    ...cab(L / 2 - 2.2, 2.2, W, 2.9, '#f3e9d2'),
    tag(loft(slab(-L / 2, L / 2 - 2.4, hw * 0.95, 0.8, H, 0.8)), '#f3e9d2'),
    tag(box(W * 0.98, 0.18, L - 2.4, 0, 1.1, -1.2), AMBER, 0, 0.3), // warning stripe
    tag(brush.clone().translate(hw - 0.3, 0, L / 2 - 0.4), '#d9752b'),
    tag(brush.translate(-(hw - 0.3), 0, L / 2 - 0.4), '#d9752b'),
    tag(box(0.3, 0.18, 0.3, 0, H + 0.1, L / 2 - 1.0), AMBER, 0, 2.0),
    ...tails(-L / 2 - 0.012, hw, 0.9),
    ...axle(L / 2 - 1.0, W - 0.3, 0.48, 0.3),
    ...axle(-L / 2 + 1.4, W - 0.3, 0.48, 0.3),
  ];
}

/** Road-works truck with a rear arrow board pointing at the open side (GDD §7). */
export function worksTruck({ L, W, H }: Size): Part[] {
  const hw = W / 2;
  const z0 = -L / 2;
  const parts: Part[] = [
    ...cab(L / 2 - 2.3, 2.3, W, 2.9, '#f08a24'),
    tag(box(W, 0.2, L - 2.5, 0, 1.1, z0 + (L - 2.5) / 2), STEEL),
    tag(box(W * 0.9, H - 1.4, 0.12, 0, (H + 1.2) / 2, z0 + 0.1), '#141416'), // board
  ];
  // Chevron of glowing tiles on the board, facing the player behind the truck.
  const cy = (H + 1.2) / 2;
  const tiles: [number, number][] = [
    [-0.9, 0],
    [-0.55, 0],
    [-0.2, 0],
    [0.15, 0],
    [0.5, 0],
    [0.2, 0.3],
    [0.2, -0.3],
    [-0.1, 0.55],
    [-0.1, -0.55],
  ];
  for (const [x, y] of tiles) parts.push(tag(box(0.24, 0.24, 0.04, x, cy + y * 0.8, z0 + 0.03), AMBER, 0, 2.2));
  for (let i = 0; i < 8; i++) {
    const stripe = box(0.25, 0.15, 0.03, -hw + 0.2 + i * 0.3, 0.75, z0 - 0.02);
    parts.push(tag(stripe, i % 2 ? '#f3f3f3' : '#d0302a'));
  }
  parts.push(...axle(L / 2 - 1.0, W - 0.3, 0.48, 0.3), ...axle(z0 + 1.6, W - 0.3, 0.48, 0.3));
  return parts;
}

/** A small construction cluster: three cones and a striped barrel inside a 1 × 1 m cell. */
export function cones({ H }: Size): Part[] {
  const cone = (x: number, z: number): Part[] => [
    tag(new ConeGeometry(0.18, H * 0.75, 14).translate(x, (H * 0.75) / 2 + 0.03, z), '#ff6a13'),
    tag(new CylinderGeometry(0.105, 0.125, 0.1, 14).translate(x, H * 0.4, z), '#f3f3f3', 0, 0.6),
    tag(box(0.42, 0.05, 0.42, x, 0.025, z), '#1a1a1a'),
  ];
  return [
    ...cone(-0.3, 0.25),
    ...cone(0.3, 0.3),
    ...cone(0, -0.3),
    tag(new CylinderGeometry(0.22, 0.22, H * 0.85, 14).translate(0.15, (H * 0.85) / 2, -0.05), '#ff6a13'),
    tag(new CylinderGeometry(0.225, 0.225, 0.12, 14).translate(0.15, H * 0.55, -0.05), '#f3f3f3', 0, 0.6),
  ];
}

/** Concrete lane-closure barrier with red-and-white panels and an arrow sign. */
export function barrier({ L, W, H }: Size): Part[] {
  const hw = W / 2;
  const jersey: Station[] = [];
  for (const z of [-L / 2, -L / 2 + 0.05, L / 2 - 0.05, L / 2])
    jersey.push({ z, ys: 0, wb: hw, ysh: 0.3, wsh: hw * 0.98, yt: H * 0.8, wt: hw * 0.9, crown: 0.01 });
  const parts: Part[] = [tag(loft(jersey), '#b9b4a8')];
  for (let i = 0; i < 6; i++)
    parts.push(
      tag(
        box(W / 6 - 0.02, 0.3, 0.04, -hw + (i + 0.5) * (W / 6), H - 0.1, -L / 2 - 0.02),
        i % 2 ? '#f3f3f3' : '#d0302a',
        0,
        0.25,
      ),
    );
  return parts;
}
