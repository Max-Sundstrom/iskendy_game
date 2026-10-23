import { Action } from '@kometa/sim';

// Devices enqueue presses; each sim tick samples a held mask (GDD §4). Repeated taps need a release tick between
// them, even when both physical events arrived between frames, because the sim derives presses from mask edges.

const ACTIONS = Object.values(Action);

export type Controls = {
  /** Mask for the next sim tick; reading alone never consumes input. */
  held(): number;
  /** Commit exactly one tick's mask. */
  consume(): void;
  /** Read and consume the next tick's mask. Pass this stable function to the session. */
  sample(): number;
  press(bit: number): void;
  hold(bit: number, down: boolean): void;
  releaseAll(): void;
};

export function createControls(): Controls {
  let down = 0;
  let sampled = 0;
  const pending = new Float64Array(ACTIONS.length);
  const enqueue = (bits: number) => {
    for (let i = 0; i < ACTIONS.length; i++) {
      const bit = ACTIONS[i] ?? 0;
      if ((bits & bit) !== 0) pending[i] = (pending[i] ?? 0) + 1;
    }
  };
  const held = () => {
    let mask = down;
    for (let i = 0; i < ACTIONS.length; i++) {
      if ((pending[i] ?? 0) === 0) continue;
      const bit = ACTIONS[i] ?? 0;
      // A real release/repress must reach the sim as two separate edges, not one uninterrupted hold.
      if ((sampled & bit) !== 0) mask &= ~bit;
      else mask |= bit;
    }
    return mask;
  };
  const consume = () => {
    const mask = held();
    for (let i = 0; i < ACTIONS.length; i++) {
      const bit = ACTIONS[i] ?? 0;
      if ((mask & bit) !== 0 && (pending[i] ?? 0) > 0) pending[i] = (pending[i] ?? 0) - 1;
    }
    sampled = mask;
  };
  return {
    held,
    consume,
    sample: () => {
      const mask = held();
      consume();
      return mask;
    },
    press: (bit) => {
      enqueue(bit & ~down);
    },
    hold: (bit, isDown) => {
      if (isDown) {
        enqueue(bit & ~down);
        down |= bit;
      } else {
        down &= ~bit;
      }
    },
    releaseAll: () => {
      down = 0;
      pending.fill(0);
      // Keep sampled until the next tick: a press just after blur still needs to release the sim's old hold.
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
