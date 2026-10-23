import { describe, expect, it } from 'vitest';
import { createControls } from './controls';
import { classifySwipe } from './touch';

const T = { swipeMinPx: 24, swipeMaxMs: 180 };

describe('swipe classification (GDD §4)', () => {
  it('needs 24 px within 180 ms on the dominant axis', () => {
    expect(classifySwipe(23, 0, 50, T)).toBeUndefined();
    expect(classifySwipe(24, 5, 50, T)).toBe('right');
    expect(classifySwipe(-30, 10, 100, T)).toBe('left');
    expect(classifySwipe(5, -40, 100, T)).toBe('up');
    expect(classifySwipe(5, 40, 100, T)).toBe('down');
    expect(classifySwipe(100, 0, 181, T)).toBeUndefined();
  });
});

describe('controls latch', () => {
  it('keeps a press shorter than a frame until a step has seen it', () => {
    const c = createControls();
    c.hold(1, true);
    c.hold(1, false); // released before any frame ran
    expect(c.held() & 1).toBe(1);
    c.consume();
    expect(c.held() & 1).toBe(0);
  });

  it('keeps a held action across frames', () => {
    const c = createControls();
    c.hold(4, true);
    c.consume();
    expect(c.held() & 4).toBe(4);
    c.releaseAll();
    expect(c.held()).toBe(0);
  });
});
