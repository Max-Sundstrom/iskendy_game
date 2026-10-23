import { SimEventKind, type SimEvent, type ScoreReason } from '@kometa/shared';

// Preallocated per-step event buffer (invariants 4–5): no objects are created while stepping.

// Current producers: <=8 raw events + scoring milestones per traffic slot (64 slots),
// <=20 non-traffic events/milestones, <=20 aggregated credits, one settlement and one origin shift:
// <=554 outputs even at fireworksEvery=1. Keep headroom; new producers must update this bound/tests.
const CAPACITY = 1024;

/** Index = FlyStop code from vertical.ts. */
const FLY_STOP_REASONS = [undefined, 'released', 'airEmpty', 'slam', 'landed'] as const;
/** Index = RideEnd code from roofs.ts. */
const RIDE_END_REASONS = [undefined, 'droveOff', 'sideways', 'jumped', 'gone'] as const;

export type EventBuffer = {
  count: number;
  readonly kind: Uint8Array;
  readonly a: Float64Array;
  readonly b: Float64Array;
};

export function createEventBuffer(): EventBuffer {
  return { count: 0, kind: new Uint8Array(CAPACITY), a: new Float64Array(CAPACITY), b: new Float64Array(CAPACITY) };
}

/** Records an event; the producer bound above guarantees room for every current gameplay event. */
export function emit(buf: EventBuffer, kind: SimEventKind, a = 0, b = 0): void {
  if (buf.count >= CAPACITY) return;
  buf.kind[buf.count] = kind;
  buf.a[buf.count] = a;
  buf.b[buf.count] = b;
  buf.count++;
}

/** Decodes the buffer for presentation code (allocates; never call it from inside the sim). */
export function readEvents(buf: EventBuffer): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < buf.count; i++) {
    const a = buf.a[i] ?? 0;
    const b = buf.b[i] ?? 0;
    switch (buf.kind[i]) {
      case SimEventKind.laneChangeStarted:
        out.push({ kind: 'laneChangeStarted', fromLane: a, toLane: b });
        break;
      case SimEventKind.laneChangeQueued:
        out.push({ kind: 'laneChangeQueued', toLane: a });
        break;
      case SimEventKind.laneBump:
        out.push({ kind: 'laneBump', direction: a < 0 ? -1 : 1 });
        break;
      case SimEventKind.originShift:
        out.push({ kind: 'originShift', dz: a });
        break;
      case SimEventKind.jump:
        out.push({ kind: 'jump' });
        break;
      case SimEventKind.flyStart:
        out.push({ kind: 'flyStart' });
        break;
      case SimEventKind.flyStop:
        out.push({ kind: 'flyStop', reason: FLY_STOP_REASONS[a] ?? 'released' });
        break;
      case SimEventKind.slam:
        out.push({ kind: 'slam' });
        break;
      case SimEventKind.land:
        out.push({ kind: 'land', slam: a === 1 });
        break;
      case SimEventKind.airEmpty:
        out.push({ kind: 'airEmpty' });
        break;
      case SimEventKind.hop:
        out.push({ kind: 'hop', chain: a, slam: b === 1 });
        break;
      case SimEventKind.scrape:
        out.push({ kind: 'scrape' });
        break;
      case SimEventKind.crash:
        out.push({ kind: 'crash', cause: a === 3 ? 'landing' : a === 2 ? 'secondScrape' : 'rear' });
        break;
      case SimEventKind.rideStart:
        out.push({ kind: 'rideStart', slot: a, slam: b === 1 });
        break;
      case SimEventKind.rideEnd:
        out.push({ kind: 'rideEnd', reason: RIDE_END_REASONS[a] ?? 'droveOff' });
        break;
      case SimEventKind.clear:
        out.push({ kind: 'clear', vehicleType: a, semi: b === 1 });
        break;
      case SimEventKind.flipStart:
        out.push({ kind: 'flipStart', index: a });
        break;
      case SimEventKind.flipDone:
        out.push({ kind: 'flipDone', count: a });
        break;
      case SimEventKind.rollStart:
        out.push({ kind: 'rollStart', index: a, direction: b < 0 ? -1 : 1 });
        break;
      case SimEventKind.rollDone:
        out.push({ kind: 'rollDone', count: a, direction: b < 0 ? -1 : 1 });
        break;
      case SimEventKind.scoreAddedDirect:
        out.push({ kind: 'scoreAddedDirect', reason: a as ScoreReason, points: b });
        break;
      case SimEventKind.scoreAddedToPot:
        out.push({ kind: 'scoreAddedToPot', reason: a as ScoreReason, points: b });
        break;
      case SimEventKind.streakSettled:
        out.push({ kind: 'streakSettled', banked: a, lost: b });
        break;
      case SimEventKind.streakMilestone:
        out.push({ kind: 'streakMilestone', count: a });
        break;
      case SimEventKind.landingGraded:
        out.push({ kind: 'landingGraded', grade: a === 1 ? 'perfect' : a === 2 ? 'stunt' : 'sloppy', flips: b });
        break;
    }
  }
  return out;
}
