import { SimEventKind, type SimEvent } from '@kometa/shared';

// Preallocated per-step event buffer (invariants 4–5): no objects are created while stepping.

const CAPACITY = 32;

/** Index = FlyStop code from vertical.ts. */
const FLY_STOP_REASONS = [undefined, 'released', 'airEmpty', 'slam', 'landed'] as const;

export type EventBuffer = {
  count: number;
  readonly kind: Uint8Array;
  readonly a: Float64Array;
  readonly b: Float64Array;
};

export function createEventBuffer(): EventBuffer {
  return { count: 0, kind: new Uint8Array(CAPACITY), a: new Float64Array(CAPACITY), b: new Float64Array(CAPACITY) };
}

/** Records an event; drops it if the buffer is full (it is cleared every step, so 32 is far above real use). */
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
        out.push({ kind: 'hop' });
        break;
      case SimEventKind.scrape:
        out.push({ kind: 'scrape' });
        break;
      case SimEventKind.crash:
        out.push({ kind: 'crash', cause: a === 2 ? 'secondScrape' : 'rear' });
        break;
    }
  }
  return out;
}
