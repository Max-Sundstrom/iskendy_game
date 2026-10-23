import { Action } from '@kometa/sim';

// Keyboard → held action mask (GDD §4). Keys are matched by `code`, so layouts (ЙЦУКЕН) don't matter.

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

export type Keyboard = { held(): number };

export function createKeyboard(target: Window): Keyboard {
  let mask = 0;
  target.addEventListener('keydown', (e) => {
    const bit = KEYS[e.code];
    if (bit === undefined) return;
    mask |= bit;
    e.preventDefault();
  });
  target.addEventListener('keyup', (e) => {
    const bit = KEYS[e.code];
    if (bit !== undefined) mask &= ~bit;
  });
  target.addEventListener('blur', () => {
    mask = 0; // keys released while the window had no focus never send keyup
  });
  return { held: () => mask };
}
