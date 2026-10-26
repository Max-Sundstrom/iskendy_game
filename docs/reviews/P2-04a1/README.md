# P2-04a1 independent QA — internal clock only

**Result: PASS for the bounded internal timing primitive.** This is not a playable LIFTOFF mode, a policy
approval for R1–R11, or proof of browser behavior. No production integration was added or tested.

Reviewed baseline: `01921e1928cd108764efa19c526f142252d5edf6`. Author froze the helper before QA;
SHA-256 of the tested `packages/sim/src/mode-clock.ts`:
`53ed6eb02bb72721fa4d551a541f5e5951f06d20d52bd8117cd94025708b3bb9`.
The source hash remained unchanged throughout the independent run. Final commit/CI verification is separate.

## Independent checks actually run

The separate scratch runner `/workspace/scratch/P2-04a1/independent-reference.ts` uses a labelled tape of
future active/grace ticks, not the implementation's decrementing counters or its unit tests' endpoint model.
Its duration grid uses exact integer quotient/remainder for binary-fraction seconds; all tuning is schema
validated. Frozen input objects additionally check that the module never changes supplied tuning.

- 70 duration pairs, 8,104 complete advances: default boundaries exactly 300/360, one-tick intervals,
  zero grace, fractional rounding, repeated starts, idle calls and in-place reset.
- 100 seeded traces of 500 actions across three clocks: 12,544 starts, 25,055 advances, 6,235 resets and
  6,166 no-call pauses. In total 166,278 state comparisons; counters remained safe nonnegative integers
  with at most one active interval. The clocks never shared state.
- 10 rejected-conversion checks: unsafe and overflowing products reject atomically at start or active-end.
  Busy starts/ordinary advances do not validate unused durations. Recovery preserves the unconsumed tick.
  Exact `2^47` seconds produces 8,444,249,301,319,680 ticks and five advances each subtract exactly one.
- Actual unchanged 10k scripted run: hash `5e81a89c-04c562d2`, 25 runs. Both existing fixture pins match.
  All three existing golden replays validated with their original ticks, score, distance and final hash.
- SHA-256 comparison against the baseline found 13 protected runtime/lock/tuning/fixture files unchanged.
  The diff of all pre-existing runtime paths is empty. The only caller/import of the new module is its
  focused test; package exports, live step/state/hash, UI and preview have not been connected to it.

The corrected independent run exited 0 in approximately 0.80s. Detailed counts, fixture hashes and replay
results are in [independent-reference.json](independent-reference.json). No expected fixture was regenerated.

## First attempt and correction

The first QA run incorrectly labelled `Number.MAX_SAFE_INTEGER / 60` seconds a safe fixture. Binary64
rounding makes its calculated tick product 9,007,199,254,740,992, so the implementation correctly threw
RangeError. Root reviewed this diagnosis. The corrected run explicitly requires atomic rejection of this
input and uses exact `2^47` seconds for the large-safe case. Production source and tests were not changed
or weakened. There was one corrected repeat; no implementation counterexample remained.

## Scope and remaining verification

A separate read-only policy review found no R1–R11 decision: idle-only start protects the clock from being
overwritten; it does not choose automatic activation, meter consumption, star/repeat policy or game effects.
The eligibility helper is omitted. Start/reset/advance only implement the agreed numerical timing boundary.

Author-reported checks, separate from this independent run: focused 12/12, full unit 329/329, sim 176/176,
workspace typecheck, lint/dependency boundaries and formatting passed. Exact-head CI still needs its own
result. No browser or cross-engine execution of this unwired helper was run; unchanged game cross-engine
CI alone must not be described as covering the helper. Owner product decisions remain pending.
