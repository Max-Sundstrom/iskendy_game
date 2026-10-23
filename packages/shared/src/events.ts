// Sim → presentation event kinds (ARCHITECTURE §4.6). The sim writes them into a preallocated numeric buffer;
// presentation decodes them. Codes are part of the replay-independent contract: append, never renumber.

export const SimEventKind = {
  laneChangeStarted: 1,
  laneChangeQueued: 2,
  laneBump: 3,
  originShift: 4,
  jump: 5,
  flyStart: 6,
  flyStop: 7,
  slam: 8,
  land: 9,
  airEmpty: 10,
} as const;

export type SimEventKind = (typeof SimEventKind)[keyof typeof SimEventKind];

/** Decoded form for presentation code; `a`/`b` meaning depends on the kind. */
export type SimEvent =
  | { kind: 'laneChangeStarted'; fromLane: number; toLane: number }
  | { kind: 'laneChangeQueued'; toLane: number }
  | { kind: 'laneBump'; direction: -1 | 1 }
  | { kind: 'originShift'; dz: number }
  | { kind: 'jump' }
  | { kind: 'flyStart' }
  | { kind: 'flyStop'; reason: 'released' | 'airEmpty' | 'slam' | 'landed' }
  | { kind: 'slam' }
  | { kind: 'land'; slam: boolean }
  | { kind: 'airEmpty' };
