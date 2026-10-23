import type { SimTuning } from './schema';

// Replays store this hash so a replay is only re-simulated with the tuning it was recorded with (invariant 3).
// FNV-1a 64 over canonical JSON: integer-only BigInt maths and spec-defined number formatting, so Node, Chromium,
// WebKit and Firefox produce the same value.

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/** JSON with object keys sorted at every level; arrays keep their order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('canonicalJson: non-finite number');
  return JSON.stringify(value);
}

/** UTF-8 bytes of a string; written out because TextEncoder is a DOM/Node API the sim can't rely on. */
export function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return bytes;
}

function fnv1a64(text: string): string {
  let hash = FNV_OFFSET;
  for (const byte of utf8Bytes(text)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, '0');
}

/** 16-hex-digit hash of the sim section only; presentation and server numbers don't affect it. */
export function tuningHash(sim: SimTuning): string {
  return fnv1a64(canonicalJson(sim));
}
