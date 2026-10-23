import type { z } from 'zod';
import { TuningSchema, type Tuning } from './schema';

/** One readable line per problem, e.g. `sim.speed.maxMps: Too small: expected number to be >0`. */
export class TuningError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid tuning:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'TuningError';
    this.problems = problems;
  }
}

function formatPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return '(root)';
  return path.reduce<string>((out, key) => {
    if (typeof key === 'number') return `${out}[${key}]`;
    const name = String(key);
    return out === '' ? name : `${out}.${name}`;
  }, '');
}

function describe(issues: readonly z.core.$ZodIssue[]): string[] {
  // zod's messages already name unknown keys and expected types; we only prefix the path.
  return issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`);
}

/** Validates raw tuning data (invariant 3); throws {@link TuningError} listing every problem with its path. */
export function parseTuning(raw: unknown): Tuning {
  const result = TuningSchema.safeParse(raw);
  if (!result.success) throw new TuningError(describe(result.error.issues));
  return result.data;
}
