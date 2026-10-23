import { Action } from '@kometa/sim';

// One place that turns devices into the held action mask the sim reads (GDD §4). A press shorter than a frame — a
// quick key tap or a swipe — is latched until a sim step has seen it, so no input is ever lost between frames.

export type Controls = {
  /** Mask for this frame's steps: held actions plus latched presses. */
  held(): number;
  /** Call after a frame that ran at least one step: latched presses are released. */
  consume(): void;
  press(bit: number): void;
  hold(bit: number, down: boolean): void;
  releaseAll(): void;
};

export function createControls(): Controls {
  let down = 0;
  let latched = 0;
  return {
    held: () => down | latched,
    consume: () => {
      latched = 0;
    },
    press: (bit) => {
      latched |= bit;
    },
    hold: (bit, isDown) => {
      if (isDown) {
        down |= bit;
        latched |= bit;
      } else {
        down &= ~bit;
      }
    },
    releaseAll: () => {
      down = 0;
      latched = 0;
    },
  };
}

const KEYS: Record<string, number> = {
  ArrowLeft: Action.left,
  KeyA: Action.left,
  ArrowRight: Action.right,
  KeyD: Action.right,
  ArrowUp: Action.jump,
  KeyW: Action.jump,
  Space: Action.jump,
  ArrowDown: Action.slam,
  KeyS: Action.slam,
  ShiftLeft: Action.boost,
  ShiftRight: Action.boost,
  KeyE: Action.item,
  Digit2: Action.item,
};

/** Keyboard by `code`, so layouts (ЙЦУКЕН) don't matter. Ignores auto-repeat. */
export function bindKeyboard(target: Window, controls: Controls, enabled: () => boolean): void {
  target.addEventListener('keydown', (e) => {
    const bit = KEYS[e.code];
    if (bit === undefined || !enabled()) return;
    e.preventDefault();
    if (!e.repeat) controls.hold(bit, true);
  });
  target.addEventListener('keyup', (e) => {
    const bit = KEYS[e.code];
    if (bit !== undefined) controls.hold(bit, false);
  });
  target.addEventListener('blur', () => controls.releaseAll()); // keys released off-window never send keyup
}
