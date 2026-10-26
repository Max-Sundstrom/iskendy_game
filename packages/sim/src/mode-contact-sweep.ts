import type { SimTuning } from '@kometa/shared';
import type { MotionPoint } from './near-sweep';

// Arithmetic representation constants, not gameplay tuning. A finite binary64 is a 53-bit
// signed integer times 2^e, -1074 <= e <= 971. Products therefore start at bit -2148.
// Four base-2^16 limbs per significand and 264 bins cover every product plus signed carry.
const LIMB_BASE = 65536;
const PRODUCT_ORIGIN = 2148;
const productBins = new Float64Array(264);
const leftLimbs = new Uint32Array(4);
const rightLimbs = new Uint32Array(4);
const numberBits = new DataView(new ArrayBuffer(8));

function requireFiniteAxis(from: number, to: number, min: number, max: number): void {
  if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(min) || !Number.isFinite(max)) {
    throw new RangeError('Protected-contact geometry requires finite derived coordinates and bounds');
  }
}

function decodeMagnitude(value: number, limbs: Uint32Array): number {
  numberBits.setFloat64(0, value, true);
  const low = numberBits.getUint32(0, true);
  const high = numberBits.getUint32(4, true);
  const exponent = (high >>> 20) & 2047;
  const significandHigh = (high & 1048575) | (exponent === 0 ? 0 : 1048576);
  limbs[0] = low & 65535;
  limbs[1] = low >>> 16;
  limbs[2] = significandHigh & 65535;
  limbs[3] = significandHigh >>> 16;
  return exponent === 0 ? -1074 : exponent - 1075;
}

function addProduct(a: number, b: number, sign: number): void {
  if (a === 0 || b === 0) return;
  const shift = decodeMagnitude(a, leftLimbs) + decodeMagnitude(b, rightLimbs) + PRODUCT_ORIGIN;
  const offset = Math.floor(shift / 16);
  const factor = (1 << (shift % 16)) * sign * (a < 0 ? -1 : 1) * (b < 0 ? -1 : 1);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const index = offset + i + j;
      productBins[index] = (productBins[index] ?? 0) + (leftLimbs[i] ?? 0) * (rightLimbs[j] ?? 0) * factor;
    }
  }
}

// Compare (aTop-aBase)/(aTo-aFrom) with (bTop-bBase)/(bTo-bFrom), with positive
// denominators. Expanding the cross-product avoids rounding either a difference or a quotient.
// Scratch is wholly overwritten, synchronous and never retained by a sim state or caller.
function compareTimes(
  aTop: number,
  aBase: number,
  aTo: number,
  aFrom: number,
  bTop: number,
  bBase: number,
  bTo: number,
  bFrom: number,
): number {
  productBins.fill(0);
  addProduct(aTop, bTo, 1);
  addProduct(aTop, bFrom, -1);
  addProduct(aBase, bTo, -1);
  addProduct(aBase, bFrom, 1);
  addProduct(bTop, aTo, -1);
  addProduct(bTop, aFrom, 1);
  addProduct(bBase, aTo, 1);
  addProduct(bBase, aFrom, -1);
  // Each bin receives at most 8*4 terms smaller than 2^47: its magnitude is <2^52.
  // Incoming carry has magnitude <2^37, so all accumulated integers remain exact (<2^53).
  // Floor division leaves nonnegative digits even for a negative total; its final carry is negative.
  let carry = 0;
  let nonzero = false;
  for (let i = 0; i < productBins.length; i++) {
    const value = (productBins[i] ?? 0) + carry;
    carry = Math.floor(value / LIMB_BASE);
    if (value - carry * LIMB_BASE !== 0) nonzero = true;
  }
  return carry < 0 ? -1 : nonzero || carry > 0 ? 1 : 0;
}

/** Tests closed player/vehicle AABBs at the endpoint, using player-centre Z relative to the vehicle rear. */
export function hasClosedModeOverlap(
  end: MotionPoint,
  relativeZ: number,
  vehicleX: number,
  vehicle: SimTuning['vehicles'][number],
  tuning: SimTuning,
): boolean {
  const halfWidth = (tuning.player.widthM + vehicle.widthM) / 2;
  const halfLength = tuning.player.lengthM / 2;
  const x = end.x - vehicleX;
  const bottom = -tuning.player.heightM;
  const roof = vehicle.heightM;
  const front = vehicle.lengthM + halfLength;
  // Validate every axis before any early result; finite source values can still overflow in the adapter.
  requireFiniteAxis(x, x, -halfWidth, halfWidth);
  requireFiniteAxis(end.y, end.y, bottom, roof);
  requireFiniteAxis(relativeZ, relativeZ, -halfLength, front);
  return Math.abs(x) <= halfWidth && end.y >= bottom && end.y <= roof && relativeZ >= -halfLength && relativeZ <= front;
}

/** Finds a common closed contact time across x, bottom-height and relative Z over the whole linear tick. */
export function hasClosedModeContact(
  start: MotionPoint,
  end: MotionPoint,
  relativeZ0: number,
  relativeZ1: number,
  vehicleX: number,
  vehicle: SimTuning['vehicles'][number],
  tuning: SimTuning,
): boolean {
  // Missing entry/exit represent t=0/t=1. Restricted bounds retain their original finite
  // binary64 operands, including exact faces; only their ordering needs exact arithmetic.
  let hasEntry = false;
  let entryTop = 0;
  let entryBase = 0;
  let entryTo = 0;
  let entryFrom = 0;
  let hasExit = false;
  let exitTop = 0;
  let exitBase = 0;
  let exitTo = 0;
  let exitFrom = 0;
  const halfWidth = (tuning.player.widthM + vehicle.widthM) / 2;
  const halfLength = tuning.player.lengthM / 2;
  const startX = start.x - vehicleX;
  const endX = end.x - vehicleX;
  const bottom = -tuning.player.heightM;
  const roof = vehicle.heightM;
  const front = vehicle.lengthM + halfLength;
  requireFiniteAxis(startX, endX, -halfWidth, halfWidth);
  requireFiniteAxis(start.y, end.y, bottom, roof);
  requireFiniteAxis(relativeZ0, relativeZ1, -halfLength, front);
  for (let axis = 0; axis < 3; axis++) {
    const from = axis === 0 ? startX : axis === 1 ? start.y : relativeZ0;
    const to = axis === 0 ? endX : axis === 1 ? end.y : relativeZ1;
    const min = axis === 0 ? -halfWidth : axis === 1 ? bottom : -halfLength;
    const max = axis === 0 ? halfWidth : axis === 1 ? roof : front;
    if ((from < min && to < min) || (from > max && to > max)) return false;
    if (from < min || from > max) {
      const ascending = from < min;
      const top = ascending ? min : from;
      const base = ascending ? from : max;
      const target = ascending ? to : from;
      const origin = ascending ? from : to;
      if (!hasEntry || compareTimes(top, base, target, origin, entryTop, entryBase, entryTo, entryFrom) > 0) {
        hasEntry = true;
        entryTop = top;
        entryBase = base;
        entryTo = target;
        entryFrom = origin;
      }
    }
    if (to < min || to > max) {
      const ascending = to > max;
      const top = ascending ? max : from;
      const base = ascending ? from : min;
      const target = ascending ? to : from;
      const origin = ascending ? from : to;
      if (!hasExit || compareTimes(top, base, target, origin, exitTop, exitBase, exitTo, exitFrom) < 0) {
        hasExit = true;
        exitTop = top;
        exitBase = base;
        exitTo = target;
        exitFrom = origin;
      }
    }
    if (
      hasEntry &&
      hasExit &&
      compareTimes(entryTop, entryBase, entryTo, entryFrom, exitTop, exitBase, exitTo, exitFrom) > 0
    ) {
      return false;
    }
  }
  // Equality includes single-time edge/corner/roof contacts; there is no epsilon or per-axis independent hit.
  return true;
}
