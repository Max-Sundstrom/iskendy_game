import { loft, type Station } from './loft';
import { axle, box, strut, Surface, tag, type Part } from './parts';

// Passenger traffic (GDD §7): sedan, retro compact, taxi, van and marshrutka. Original shapes, no real models or
// badges (AGENTS §12). Built front = +z, centred, in metres; sizes come from the hashed vehicle tuning.

export type Size = { L: number; W: number; H: number };

const GLASS = '#1b2230';
const TRIM = '#26282e';
const TAIL = '#ff2a1a';
const HEAD = '#fff1d6';

/** Lower body of a three-box car: tail deck, beltline, bonnet. `boxy` flattens the rounding for the retro compact. */
function carBody({ L, W }: Size, beltY: number, hoodY: number, deckY: number, boxy = 0): Station[] {
  const hw = W / 2;
  const sill = 0.3;
  const round = 0.88 + boxy * 0.1;
  return [
    {
      z: -L / 2,
      ys: sill + 0.12,
      wb: hw * 0.8,
      ysh: deckY - 0.18,
      wsh: hw * 0.95,
      yt: deckY - 0.04,
      wt: hw * round * 0.92,
    },
    { z: -L / 2 + 0.3, ys: sill, wb: hw * 0.84, ysh: deckY - 0.2, wsh: hw, yt: deckY, wt: hw * round },
    { z: -L * 0.18, ys: sill, wb: hw * 0.84, ysh: beltY - 0.25, wsh: hw, yt: beltY, wt: hw * round },
    { z: L * 0.12, ys: sill, wb: hw * 0.84, ysh: beltY - 0.25, wsh: hw, yt: beltY, wt: hw * round },
    { z: L / 2 - 0.4, ys: sill, wb: hw * 0.84, ysh: hoodY - 0.2, wsh: hw * 0.99, yt: hoodY, wt: hw * round * 0.98 },
    {
      z: L / 2,
      ys: sill + 0.1,
      wb: hw * 0.78,
      ysh: hoodY - 0.24,
      wsh: hw * 0.9,
      yt: hoodY - 0.08,
      wt: hw * round * 0.82,
    },
  ];
}

/** Glasshouse between z0 (rear) and z1 (front), sloping to a roof from zr0 to zr1. */
function cabin(z0: number, zr0: number, zr1: number, z1: number, baseY: number, topY: number, w: number): Station[] {
  const s = (z: number, yt: number, k: number): Station => ({
    z,
    ys: baseY - 0.04,
    wb: w * k,
    ysh: baseY + (yt - baseY) * 0.25,
    wsh: w * k,
    yt,
    wt: w * k * 0.82,
    crown: 0.03,
  });
  return [s(z0, baseY + 0.02, 0.95), s(zr0, topY, 0.86), s(zr1, topY, 0.86), s(z1, baseY + 0.02, 0.95)];
}

/** Painted end pillars and dark centre pillars keep the glasshouse attached to the body from every angle. */
function cabinFrame(
  size: Size,
  ends: readonly [number, number, number, number],
  baseY: number,
  w: number,
  colour: string,
  paint: number,
): Part[] {
  const { L, W, H } = size;
  const [rear, roofRear, roofFront, front] = ends;
  const parts: Part[] = [];
  for (const side of [-1, 1]) {
    for (const [lower, upper] of [
      [rear, roofRear],
      [front, roofFront],
    ] as const)
      parts.push(
        tag(strut([side * w * 0.94, baseY + 0.035, lower], [side * w * 0.705, H, upper], 0.07), colour, paint),
      );
    parts.push(
      tag(
        strut([side * w * 0.86, baseY + 0.04, -L * 0.02], [side * w * 0.705, H, -L * 0.02], 0.055),
        TRIM,
        0,
        0,
        Surface.trim,
      ),
      tag(box(0.045, 0.065, L * 0.68, side * (W / 2 - 0.015), 0.42, 0), TRIM, 0, 0, Surface.trim),
      tag(box(0.12, 0.12, 0.23, side * (W / 2 + 0.06), baseY + 0.13, roofFront + L * 0.04), colour, paint),
      tag(box(0.025, 0.045, 0.17, side * (W / 2 + 0.006), baseY - 0.12, -L * 0.06), '#b5bbc1', 0, 0, Surface.metal),
    );
  }
  return parts;
}

function lamps({ L, W }: Size, y: number, tailW = 0.34): Part[] {
  const hw = W / 2;
  return [
    tag(box(tailW, 0.12, 0.04, hw - tailW / 2 - 0.08, y, -L / 2 - 0.01), TAIL, 0, 1.6),
    tag(box(tailW, 0.12, 0.04, -(hw - tailW / 2 - 0.08), y, -L / 2 - 0.01), TAIL, 0, 1.6),
    tag(box(0.3, 0.1, 0.04, hw - 0.25, y - 0.1, L / 2 + 0.01), HEAD, 0, 1.2),
    tag(box(0.3, 0.1, 0.04, -(hw - 0.25), y - 0.1, L / 2 + 0.01), HEAD, 0, 1.2),
    tag(box(W * 0.84, 0.18, 0.035, 0, y, -L / 2 - 0.002), TRIM, 0, 0, Surface.trim), // recessed lamp surround
    tag(box(W * 0.94, 0.16, 0.12, 0, 0.42, -L / 2 + 0.02), TRIM, 0, 0, Surface.trim), // rear bumper
    tag(box(W * 0.94, 0.16, 0.12, 0, 0.4, L / 2 - 0.02), TRIM, 0, 0, Surface.trim), // front bumper
  ];
}

export function sedan(size: Size, colour?: string): Part[] {
  const { L, W, H } = size;
  const paint = colour ? 0 : 1;
  const c = colour ?? '#ffffff';
  return [
    tag(loft(carBody(size, 0.92, 0.82, 0.95)), c, paint),
    tag(loft(cabin(-L * 0.28, -L * 0.16, L * 0.06, L * 0.2, 0.9, H, W / 2 - 0.06)), GLASS, 0, 0, Surface.glass),
    tag(box(W * 0.68, 0.04, L * 0.2, 0, H + 0.005, -L * 0.05), c, paint), // painted roof panel
    ...cabinFrame(size, [-L * 0.28, -L * 0.16, L * 0.06, L * 0.2], 0.9, W / 2 - 0.06, c, paint),
    ...lamps(size, 0.8),
    ...axle(L * 0.31, W - 0.22, 0.32),
    ...axle(-L * 0.3, W - 0.22, 0.32),
  ];
}

/** Retro compact: boxy three-box saloon with a chrome strip, inspired by Soviet-era family cars. */
export function compact(size: Size): Part[] {
  const { L, W, H } = size;
  return [
    tag(loft(carBody(size, 0.9, 0.86, 0.9, 1)), '#ffffff', 1),
    tag(loft(cabin(-L * 0.26, -L * 0.2, L * 0.1, L * 0.18, 0.88, H, W / 2 - 0.05)), GLASS, 0, 0, Surface.glass),
    tag(box(W * 0.74, 0.04, L * 0.28, 0, H + 0.005, -L * 0.05), '#ffffff', 1),
    ...cabinFrame(size, [-L * 0.26, -L * 0.2, L * 0.1, L * 0.18], 0.88, W / 2 - 0.05, '#ffffff', 1),
    tag(box(0.02, 0.03, L * 0.8, W / 2 + 0.005, 0.66, 0), '#d8dbe0', 0, 0.1, Surface.metal),
    tag(box(0.02, 0.03, L * 0.8, -W / 2 - 0.005, 0.66, 0), '#d8dbe0', 0, 0.1, Surface.metal),
    ...lamps(size, 0.78, 0.26),
    ...axle(L * 0.3, W - 0.2, 0.3, 0.2, '#c9ccd2'),
    ...axle(-L * 0.3, W - 0.2, 0.3, 0.2, '#c9ccd2'),
  ];
}

export function taxi(size: Size): Part[] {
  const { L, W, H } = size;
  const checker: Part[] = [];
  for (let i = 0; i < 14; i++) {
    const z = -L * 0.35 + (i * L * 0.7) / 14;
    const ink = i % 2 ? '#111111' : '#f3f3f3';
    checker.push(tag(box(0.02, 0.08, (L * 0.7) / 14, W / 2 + 0.006, 0.7, z), ink));
    checker.push(tag(box(0.02, 0.08, (L * 0.7) / 14, -W / 2 - 0.006, 0.7, z), ink));
  }
  return [
    ...sedan(size, '#ffd23f'),
    ...checker,
    tag(box(0.55, 0.16, 0.24, 0, H + 0.1, -L * 0.05), '#fff6c8', 0, 0.9), // roof sign
  ];
}

/** Van body: tall rounded box with a raked windscreen. Shared by the marshrutka. */
function vanBody({ L, W, H }: Size): Station[] {
  const hw = W / 2;
  const s = (z: number, yt: number, k = 1): Station => ({
    z,
    ys: 0.36,
    wb: hw * 0.92 * k,
    ysh: Math.min(yt - 0.2, H * 0.55),
    wsh: hw * k,
    yt,
    wt: hw * 0.9 * k,
    crown: 0.04,
  });
  return [
    s(-L / 2, H - 0.06, 0.97),
    s(-L / 2 + 0.12, H),
    s(L / 2 - 1.15, H),
    s(L / 2 - 0.55, H * 0.72),
    s(L / 2, H * 0.48, 0.95),
  ];
}

function vanGlass({ L, W, H }: Size, windows: number): Part[] {
  const parts: Part[] = [
    tag(box(W * 0.84, H * 0.26, 0.04, 0, H * 0.7, -L / 2 - 0.012), GLASS, 0, 0, Surface.glass), // rear windows
    tag(box(0.045, H * 0.8, 0.045, 0, H * 0.5, -L / 2 - 0.018), TRIM, 0, 0, Surface.trim), // split rear doors
    tag(box(W * 0.7, 0.07, 0.045, 0, H * 0.53, -L / 2 - 0.02), TRIM, 0, 0, Surface.trim),
  ];
  const len = L - 1.9;
  for (let i = 0; i < windows; i++) {
    const z = -L / 2 + 0.5 + (i + 0.5) * (len / windows);
    for (const sx of [1, -1])
      parts.push(
        tag(box(0.03, H * 0.22, len / windows - 0.12, sx * (W / 2 + 0.005), H * 0.73, z), GLASS, 0, 0, Surface.glass),
      );
  }
  // Windscreen: a dark slab tilted to the raked front.
  const rise = H * 0.28;
  const slab = box(W * 0.86, Math.hypot(0.6, rise) * 0.92, 0.04, 0, 0, 0).rotateX(-Math.atan2(0.6, rise));
  parts.push(tag(slab.translate(0, H * 0.86 + 0.015, L / 2 - 0.85 + 0.015), GLASS, 0, 0, Surface.glass));
  for (const side of [-1, 1])
    parts.push(
      tag(box(0.12, 0.22, 0.18, side * (W / 2 + 0.06), H * 0.69, L / 2 - 0.9), TRIM, 0, 0, Surface.trim),
      tag(box(0.04, 0.07, L * 0.76, side * (W / 2 + 0.005), H * 0.41, -L * 0.04), TRIM, 0, 0, Surface.trim),
    );
  return parts;
}

export function van(size: Size, colour?: string): Part[] {
  const { L, W } = size;
  return [
    tag(loft(vanBody(size)), colour ?? '#ffffff', colour ? 0 : 1),
    ...vanGlass(size, 2),
    ...lamps(size, 0.95, 0.2),
    ...axle(L / 2 - 0.9, W - 0.2, 0.36, 0.24),
    ...axle(-L / 2 + 1.0, W - 0.2, 0.36, 0.24),
  ];
}

/** Marshrutka minibus: a longer van in the classic route-taxi yellow with a destination board. */
export function marshrutka(size: Size): Part[] {
  const { L, W, H } = size;
  return [
    tag(loft(vanBody(size)), '#f2c230'),
    ...vanGlass(size, 3),
    tag(box(W * 0.5, 0.14, 0.04, 0, H * 0.92, -L / 2 - 0.02), '#ffb347', 0, 1.0), // route board
    ...lamps(size, 1.0, 0.2),
    ...axle(L / 2 - 0.95, W - 0.2, 0.36, 0.24),
    ...axle(-L / 2 + 1.2, W - 0.2, 0.36, 0.24),
  ];
}
