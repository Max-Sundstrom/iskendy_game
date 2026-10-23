import { z } from 'zod';

// Replay format (ARCHITECTURE §4.7). Untrusted input (invariant 11, SECURITY T10): the text is size-capped before
// parsing, prototype keys are rejected, and the shape is validated before anything is simulated.

export type ReplayLimits = { maxTicks: number; maxDecompressedBytes: number };

const hex = (n: number) => z.string().regex(new RegExp(`^[0-9a-f]{${n}}$`));

export function replaySchema(limits: ReplayLimits) {
  return z
    .strictObject({
      schemaVersion: z.literal(1),
      simVersion: z.number().int().positive(),
      seed: z.number().int().min(0).max(0xffffffff),
      tuningHash: hex(16),
      mode: z.enum(['endless', 'weekly']),
      ticks: z.number().int().min(0).max(limits.maxTicks),
      /** [tick, heldMask] whenever the held mask changes; the mask holds until the next entry. */
      inputs: z.array(z.tuple([z.number().int().min(0), z.number().int().min(0).max(63)])).max(limits.maxTicks),
      claimedScore: z.number().int().min(0),
      claimedDistanceM: z.number().min(0),
      finalHash: hex(8),
    })
    .refine((r) => r.inputs.every(([t], i, all) => t < r.ticks && (i === 0 || t > (all[i - 1]?.[0] ?? -1))), {
      message: 'input ticks must be strictly increasing and below ticks',
      path: ['inputs'],
    });
}

export type Replay = z.infer<ReturnType<typeof replaySchema>>;

export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayError';
  }
}

/** Parses replay JSON from an untrusted source. */
export function parseReplay(text: string, limits: ReplayLimits): Replay {
  if (text.length > limits.maxDecompressedBytes)
    throw new ReplayError(`replay is larger than ${limits.maxDecompressedBytes} bytes`);
  let raw: unknown;
  try {
    raw = JSON.parse(text, (key: string, value: unknown) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype')
        throw new ReplayError(`forbidden key "${key}"`);
      return value;
    });
  } catch (error) {
    throw error instanceof ReplayError ? error : new ReplayError('replay is not valid JSON');
  }
  const result = replaySchema(limits).safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ReplayError(`replay ${issue?.path.join('.') || '(root)'}: ${issue?.message ?? 'invalid'}`);
  }
  return result.data;
}
