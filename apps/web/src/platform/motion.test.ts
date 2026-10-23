import { describe, expect, it } from 'vitest';
import { createMotionPreference, type MotionPreference } from './motion';

// J12: either source can request reduction; the adapter must not guess or own a persisted settings key.
describe('effective reduced motion preference', () => {
  it.each([
    [false, false, false],
    [false, true, true],
    [true, false, true],
    [true, true, true],
  ])('combines OS %s and supplied preference %s as %s', (os, supplied, expected) => {
    const reducedMotion = createMotionPreference({ matches: os }, () => ({ reducedMotion: supplied }));
    expect(reducedMotion()).toBe(expected);
  });

  it('reads changing OS and supplied preferences without recreating the adapter', () => {
    const media = { matches: false };
    let preference: MotionPreference = { reducedMotion: false };
    const reducedMotion = createMotionPreference(media, () => preference);
    expect(reducedMotion()).toBe(false);

    media.matches = true;
    expect(reducedMotion()).toBe(true);
    media.matches = false;
    preference = { reducedMotion: true };
    expect(reducedMotion()).toBe(true);
    preference = { reducedMotion: false };
    expect(reducedMotion()).toBe(false);
  });

  it('uses the live OS preference when no game settings source is supplied', () => {
    const media = { matches: false };
    const reducedMotion = createMotionPreference(media);
    expect(reducedMotion()).toBe(false);
    media.matches = true;
    expect(reducedMotion()).toBe(true);
  });
});
