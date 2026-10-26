# P2-04a2 independent simulation QA

**Result: PASS for the corrected frozen simulation outcome.** Independent QA recommends the justified
fixture updates below. The orchestrator owns authorization, final commit, full suites and exact-head CI.
This is not browser, HUD, whole-frame performance or physical-phone acceptance.

Tested runtime: worktree head `b1d80d1a2e8e0a73389df1ac5fdba201b8cc218a` plus the frozen uncommitted blobs
in [tested-source-freeze.json](tested-source-freeze.json). The corrected sweep is
`70fc9d11de12e20f107f7569dd5279cb43c7559b`; other production blobs match the prior freeze. Runtime hashes
were checked before/after execution. The head alone does not identify the tested dirty runtime.

## Compatibility and justified hash changes

Baseline was clean `eea81aeba79437abec194787597a67729478433f` in `/workspace/kometa-mode-clock`.
The comparison records every old persistent player/score/director/RNG field, active traffic lifetime data
and exact raw numeric events for every tick, plus explicit Retry boundaries. Only the new mode state is
excluded from legacy-field equality; hashes are compared separately.

- Automatic activation disabled: **13,599 rows** exactly match legacy fields/events across all six routes.
- Defaults: **12,462 rows** from three goldens and the 10k/25-run script exactly match legacy fields/events.
  Maximum meter values are 110/0/0/245; none activates a mode. Changes below are hash-layout changes only.
- Actual default-input prefix: physical state and old events match through state tick 525. That tick consumes
  meter 1000→0 and appends exactly `modeStarted(1,300)`. First physical divergence is state tick 526.

| Existing expectation      | Old                 | Independently observed corrected value |
| ------------------------- | ------------------- | -------------------------------------- |
| busy-inputs               | `3e19786b`          | `fc6dfa0b`                             |
| early-crash               | `93946362`          | `1df1ea82`                             |
| long-run                  | `04f57e5b`          | `c7bfecbb`                             |
| Both 10k determinism pins | `5e81a89c-04c562d2` | `ab3be31c-99f78172`                    |

Original inputs, ticks, scores, distances, physical trajectories and raw event order are unchanged for these
four expectations. QA did not regenerate or edit them. [Off comparison](comparison-auto-off-corrected.json)
and [default comparison](comparison-default-corrected.json) preserve the measured distinction.

## Geometry failure, correction and adversarial checks

The first independent differential found 11 arithmetic-boundary discrepancies. They remain documented in
[first-candidate.md](first-candidate.md) and [counterexamples](sweep-first-failures.json); no expected result
was weakened. The production fix compares exact binary64 ratio products in preallocated signed limbs.
The original oracle, cases and runner were preserved byte-for-byte for **one corrective execution**.

Corrected differential: **7,873 cases / 15,746 sweep and endpoint comparisons, zero mismatches**.
The independent oracle uses exact BigInt fractions and boundary-time enumeration, not the production
algorithm. See [geometry review](closed-sweep-corrected.md) and [data](closed-sweep-corrected.json).
The matrix does not claim independent coverage of the newly added nonfinite-derived-geometry RangeError;
that technical guard is covered by the author's targeted tests. Whole-step atomicity is not claimed.

**16 adversarial groups passed again** on the corrected source: 300 active + 60 grace ticks; mandatory
ordinary tick between episodes; zero grace; same-tick crash; AIR zero/freeze/expiry; speed/BOOST/penalty;
protected and later unsafe road landings; SLAM; support removal and preserved Jump; grace phasing;
endpoint cleanup and crossed-but-exited traffic; pending near/CLEAR exclusion; immediate slot reuse;
origin shift; upper hash bits; pause and interleaved sessions.

The 64-contact stress case with `fireworksEvery=1` emits **130/1024 events**, including all SMASH and
milestone events. A separate quarter-unit integer ledger yields pot **79,387.5**, meter zero.
This validates that case, not every conceivable producer combination. [Scenario results](adversarial-corrected.json).

## Independently reviewed real-input mode route

Seed 1 uses the original **50 input transitions**, last `[589,0]`, then holds zero until natural crash.
No state, traffic, events or tuning were injected into this route. The corrected source reproduces:

```text
[state tick, event kind, a, b]
[525, 27, 1, 300]  mode started
[688, 30, 0, 1]    sedan SMASH
[825, 28, 1, 60]   active ended
[885, 29, 0, 0]    grace ended
[928, 13, 1, 0]    ordinary rear crash
```

Terminal hash **`66e41f15`**, claimed score **18,828**, raw total `18828.474375929447`, distance
`638.4743759294411` m, AIR `270.5` L, retained meter `130`. Recorder/replay validation and fresh Retry
initialization passed. The corrected result equals the first source-bound observation.

A separate offline verifier imports no sim/scoring module. It checks all **928 rows** using physical-event
awards, absolute streak deadlines and distance plus banked style, and verifies emitted credit/settlement
amounts. The route earns five flips, fifteen rolls, four PERFECT landings, one STUNT, one CLEAR and one
SMASH; **18,190 style points bank at tick 838**, with no lost pot at terminal crash. Stored AIR and mode
intervals also match every row. Saved pre-contact traffic independently confirms slot 6/type 0 contact at
688 over a positive rational interval `[160969364201075/454656575584128, 1]`; it is not a numerical singleton.
[Ledger/contact proof](route-independent-ledger.json) and [observed snapshots](observed-route-corrected.json).

QA recommends pinning this independently reviewed route as the additional mode replay, while retaining
its original inputs. The existing 10k inputs do not cover LIFTOFF; mode cross-engine coverage remains required.
The scratch recorded replay is `/workspace/scratch/P2-04a2/observed-mode-route-corrected.replay.json`.

## Cost evidence and remaining limits

[Author's geometry-cost.json](geometry-cost.json) compares the exact old/new blobs in one Node 24.19.0
process: preallocated inputs, 5,000 warm-up queries per group, three alternating rounds of 50,000 queries.
Median cost extrapolated to 64 queries is about **0.0014–0.0021 ms** for ordinary early-result paths and
**0.1467 ms** for the selected exact common-time path (previously about **0.0017 ms**). This is a geometry-only
Node microbenchmark, not full-simulation/frame/device acceptance; exact arithmetic has a measurable cost.
QA read the report and did not rerun that benchmark.

Full suites after authorized fixture changes, build, final commit and exact-head CI are orchestrator work.
Browser/controller execution, pause/Retry UI, visual proof, performance budgets and physical-device behavior
remain separate gates. This review implements or approves no COSMONAUT, OVERDRIVE, pickups, main merge,
preview, deployment or dependency change. Detailed scratch runners and full timelines remain available in
`/workspace/scratch/P2-04a2/`; compact evidence is retained here.
