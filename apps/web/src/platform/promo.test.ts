import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatPromo, newPromoCode, normalisePromo, PROMO_PATTERN } from './promo';

describe('promo code (ADR-020, Q16)', () => {
  it('formats 40 bits as ISK-XXXX-XXXX in Crockford Base32', () => {
    expect(formatPromo(new Uint8Array([0, 0, 0, 0, 0]))).toBe('ISK-0000-0000');
    expect(formatPromo(new Uint8Array([255, 255, 255, 255, 255]))).toBe('ISK-ZZZZ-ZZZZ');
    expect(formatPromo(new Uint8Array([0x84, 0x21, 0x08, 0x42, 0x10]))).toBe('ISK-GGGG-GGGG');
  });

  it('only ever uses the unambiguous alphabet (no I, L, O, U)', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 5, maxLength: 5 }), (bytes) => PROMO_PATTERN.test(formatPromo(bytes))),
    );
  });

  it('is a different code each time from the platform CSPRNG', () => {
    const codes = new Set(Array.from({ length: 200 }, () => newPromoCode()));
    expect(codes.size).toBe(200);
  });

  it('normalises typed input', () => {
    expect(normalisePromo('isk o1lI-zzzz')).toBe('ISK-0111-ZZZZ');
  });
});
