import { Action } from '@kometa/sim';
import { describe, expect, it } from 'vitest';
import { bindKeyboard, createControls } from './controls';

describe('tick input edges', () => {
  it('preserves two quick key presses without an intervening sim tick', () => {
    const controls = createControls();
    controls.hold(Action.jump, true);
    controls.hold(Action.jump, false);
    controls.hold(Action.jump, true);
    controls.hold(Action.jump, false);
    expect(Array.from({ length: 4 }, controls.sample)).toEqual([Action.jump, 0, Action.jump, 0]);
  });

  it('preserves a release and repress after the first press was already sampled', () => {
    const controls = createControls();
    controls.hold(Action.jump, true);
    expect(controls.sample()).toBe(Action.jump);
    controls.hold(Action.jump, false);
    controls.hold(Action.jump, true);
    expect(controls.sample()).toBe(0);
    expect(controls.sample()).toBe(Action.jump);
    expect(controls.sample()).toBe(Action.jump); // the second press is now physically held
  });

  it('keeps three touch pulses distinct while preserving an unrelated boost hold', () => {
    const controls = createControls();
    controls.hold(Action.boost, true);
    controls.press(Action.jump);
    controls.press(Action.jump);
    controls.press(Action.jump);
    const both = Action.jump | Action.boost;
    expect(Array.from({ length: 6 }, controls.sample)).toEqual([
      both,
      Action.boost,
      both,
      Action.boost,
      both,
      Action.boost,
    ]);
  });

  it('does not invent another edge while an action is physically held', () => {
    const controls = createControls();
    controls.hold(Action.jump, true);
    expect(controls.sample()).toBe(Action.jump);
    controls.hold(Action.jump, true);
    controls.press(Action.jump);
    expect(controls.sample()).toBe(Action.jump);
    expect(controls.sample()).toBe(Action.jump);
    controls.hold(Action.jump, false);
    expect(controls.sample()).toBe(0);
  });

  it('discards queued presses on interruption and preserves a fresh press after it', () => {
    const controls = createControls();
    controls.press(Action.jump);
    expect(controls.sample()).toBe(Action.jump);
    controls.press(Action.jump);
    controls.press(Action.left);
    controls.releaseAll();
    controls.hold(Action.jump, true);
    expect(controls.sample()).toBe(0); // release the previous tick's jump before delivering the fresh one
    expect(controls.sample()).toBe(Action.jump);
    controls.hold(Action.jump, false);
    expect(controls.sample()).toBe(0);
    expect(controls.sample()).toBe(0); // no stale pulse or lane input survives
  });

  it('ignores keyboard repeats and clears held and queued input on blur', () => {
    const controls = createControls();
    const target = new EventTarget();
    bindKeyboard(target as unknown as Window, controls, () => true);
    const key = (type: string, repeat = false) =>
      target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { code: 'Space', repeat }));
    key('keydown');
    expect(controls.sample()).toBe(Action.jump);
    key('keydown', true);
    expect(controls.sample()).toBe(Action.jump);
    key('keyup');
    key('keydown');
    target.dispatchEvent(new Event('blur'));
    expect(controls.sample()).toBe(0);
    expect(controls.sample()).toBe(0);
    key('keydown');
    expect(controls.sample()).toBe(Action.jump);
  });
});
