// Abstract actions (GDD §4). A tick's input is the bitmask of actions *held* during that tick; the sim derives
// presses from changes, so replays only store the mask when it changes (ARCHITECTURE §4.7).

export const Action = {
  left: 1 << 0,
  right: 1 << 1,
  jump: 1 << 2,
  slam: 1 << 3,
  boost: 1 << 4,
  item: 1 << 5,
} as const;

export const ACTION_MASK = 0b111111;

/** Actions pressed this tick: held now, not held on the previous tick. */
export function pressed(held: number, previous: number): number {
  return held & ~previous & ACTION_MASK;
}
