import { Action } from '@kometa/sim';
import type { Controls } from './controls';

// Touch per GDD §4: a swipe is ≥ swipeMinPx within swipeMaxMs on the dominant axis. Left/right/down are taps;
// an up-swipe holds Jump until the finger lifts, so keeping the finger down after it flies.

export type SwipeTuning = { swipeMinPx: number; swipeMaxMs: number };

export type Swipe = 'left' | 'right' | 'up' | 'down';

/** Classifies a movement, or returns undefined while it is still too short or too slow. Pure, for tests. */
export function classifySwipe(dx: number, dy: number, ms: number, t: SwipeTuning): Swipe | undefined {
  if (ms > t.swipeMaxMs) return undefined;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < t.swipeMinPx) return undefined;
  if (ax >= ay) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

type Gesture = { id: number; x: number; y: number; t: number; done: boolean; jumpHeld: boolean };

export function bindTouch(surface: HTMLElement, controls: Controls, tuning: SwipeTuning, enabled: () => boolean): void {
  const gestures = new Map<number, Gesture>();
  surface.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !enabled()) return;
    gestures.set(e.pointerId, {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: e.timeStamp,
      done: false,
      jumpHeld: false,
    });
  });
  surface.addEventListener('pointermove', (e) => {
    const g = gestures.get(e.pointerId);
    if (!g || g.done) return;
    const swipe = classifySwipe(e.clientX - g.x, e.clientY - g.y, e.timeStamp - g.t, tuning);
    if (!swipe) {
      if (e.timeStamp - g.t > tuning.swipeMaxMs) {
        // Too slow for this swipe: start measuring again from here.
        g.x = e.clientX;
        g.y = e.clientY;
        g.t = e.timeStamp;
      }
      return;
    }
    g.done = true;
    if (swipe === 'left') controls.press(Action.left);
    else if (swipe === 'right') controls.press(Action.right);
    else if (swipe === 'down') controls.press(Action.slam);
    else {
      g.jumpHeld = true;
      controls.hold(Action.jump, true);
    }
  });
  const end = (e: PointerEvent) => {
    const g = gestures.get(e.pointerId);
    if (g?.jumpHeld) controls.hold(Action.jump, false);
    gestures.delete(e.pointerId);
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
}
