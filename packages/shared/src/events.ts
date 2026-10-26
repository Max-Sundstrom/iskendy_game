/** Stable mode identities; OVERDRIVE will augment a base mode, not replace its identity. */
export const ModeKind = { none: 0, liftoff: 1 } as const;
export type ModeKind = (typeof ModeKind)[keyof typeof ModeKind];

/** Stable numeric reasons for score credits; append new mechanics without renumbering. */
export const ScoreReason = {
  boost: 1,
  clear: 2,
  semiCleared: 3,
  hop: 4,
  roofRide: 5,
  frontFlip: 6,
  barrelRoll: 7,
  perfectLanding: 8,
  stuntLanding: 9,
  slam: 10,
  nearMiss: 11,
  smash: 12,
} as const;
export type ScoreReason = (typeof ScoreReason)[keyof typeof ScoreReason];

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
  hop: 11,
  scrape: 12,
  crash: 13,
  /** a: vehicle slot, b: 1 when the landing was a slam (GDD §5.8, scenario G10). */
  rideStart: 14,
  /** a: RideEnd reason (1 drove off the end, 2 left sideways, 3 jumped, 4 vehicle gone). */
  rideEnd: 15,
  /** a: vehicle type index, b: 1 for a platform vehicle (SEMI CLEARED), 0 for a car or van (CLEAR). */
  clear: 16,
  /** a: the flip's number within this jump (1, 2, …). */
  flipStart: 17,
  /** a: flips completed in this jump. */
  flipDone: 18,
  /** a: LandingGrade (1 perfect, 2 stunt, 3 sloppy), b: flips in the jump (GDD §5.7). */
  landingGraded: 19,
  /** a: roll index in this jump, b: direction (-1 left, +1 right). */
  rollStart: 20,
  /** a: rolls completed in this jump, b: direction (-1 left, +1 right). */
  rollDone: 21,
  /** a: ScoreReason, b: actual fractional points added directly to total. */
  scoreAddedDirect: 22,
  /** a: ScoreReason, b: actual fractional points added to the pending pot. */
  scoreAddedToPot: 23,
  /** a: points banked, b: points lost when the streak closes. */
  streakSettled: 24,
  /** a: streak event-count threshold crossed; b unused. */
  streakMilestone: 25,
  /** a: vehicle type index, b: traffic slot at event time (do not dereference after director reuse). */
  nearMiss: 26,
  /** a: ModeKind, b: full active ticks; effects begin on the next physics tick. */
  modeStarted: 27,
  /** a: ModeKind, b: full grace ticks, possibly zero. */
  modeEnded: 28,
  modeGraceEnded: 29,
  /** a: vehicle type index, b: episode SMASH chain; payload survives traffic slot reuse. */
  smash: 30,
  /** a: vehicle type index retired on grace exit, without score or SMASH credit. */
  trafficPhasedOut: 31,
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
  | { kind: 'airEmpty' }
  | { kind: 'hop'; chain: number; slam: boolean }
  | { kind: 'scrape' }
  | { kind: 'crash'; cause: 'rear' | 'secondScrape' | 'landing' }
  | { kind: 'rideStart'; slot: number; slam: boolean }
  | { kind: 'rideEnd'; reason: 'droveOff' | 'sideways' | 'jumped' | 'gone' }
  | { kind: 'clear'; vehicleType: number; semi: boolean }
  | { kind: 'flipStart'; index: number }
  | { kind: 'flipDone'; count: number }
  | { kind: 'rollStart'; index: number; direction: -1 | 1 }
  | { kind: 'rollDone'; count: number; direction: -1 | 1 }
  | { kind: 'scoreAddedDirect'; reason: ScoreReason; points: number }
  | { kind: 'scoreAddedToPot'; reason: ScoreReason; points: number }
  | { kind: 'streakSettled'; banked: number; lost: number }
  | { kind: 'streakMilestone'; count: number }
  | { kind: 'nearMiss'; vehicleType: number; slot: number }
  | { kind: 'modeStarted'; mode: 'liftoff'; activeTicks: number }
  | { kind: 'modeEnded'; mode: 'liftoff'; graceTicks: number }
  | { kind: 'modeGraceEnded' }
  | { kind: 'smash'; vehicleType: number; chain: number }
  | { kind: 'trafficPhasedOut'; vehicleType: number }
  | { kind: 'landingGraded'; grade: 'perfect' | 'stunt' | 'sloppy'; flips: number };
