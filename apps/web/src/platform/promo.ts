// Display-only promo code shown after every run (ADR-020, DECISIONS Q16, ARCHITECTURE §11): 40 random bits from the
// platform CSPRNG as ISK-XXXX-XXXX in Crockford Base32. Generated outside the sim and never derived from the seed or
// the score; it carries no value and nothing checks it in v1.

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Formats 40 bits (five bytes) as ISK-XXXX-XXXX. */
export function formatPromo(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes.subarray(0, 5)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >> (bits - 5)) & 31];
      bits -= 5;
      value &= (1 << bits) - 1;
    }
  }
  return `ISK-${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

export function newPromoCode(
  random: (bytes: Uint8Array<ArrayBuffer>) => void = (b) => void crypto.getRandomValues(b),
): string {
  const bytes = new Uint8Array(5);
  random(bytes);
  return formatPromo(bytes);
}

/** Normalises what a person might type: case, separators, and Crockford's O→0, I/L→1. */
export function normalisePromo(input: string): string {
  const raw = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  // Strip the prefix before mapping look-alikes, or the I in "ISK" would become 1.
  const body = (raw.startsWith('ISK') ? raw.slice(3) : raw).replace(/O/g, '0').replace(/[IL]/g, '1');
  return `ISK-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

export const PROMO_PATTERN = /^ISK-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
