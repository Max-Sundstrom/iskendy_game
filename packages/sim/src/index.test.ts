import { describe, expect, it } from 'vitest';
import { SIM_SCHEMA_VERSION, SIM_VERSION } from './index';

describe('sim package', () => {
  it('exposes positive integer versions', () => {
    expect(Number.isInteger(SIM_VERSION) && SIM_VERSION > 0).toBe(true);
    expect(Number.isInteger(SIM_SCHEMA_VERSION) && SIM_SCHEMA_VERSION > 0).toBe(true);
  });
});
