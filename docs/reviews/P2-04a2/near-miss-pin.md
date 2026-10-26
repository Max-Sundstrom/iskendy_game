# NEAR MISS E2E hash review

**PASS — the pin change `fc2ed824` → `b3d301a4` is justified by the mode hash layout alone.**
Independent Node comparison used clean baseline `eea81aeba79437abec194787597a67729478433f`
and clean PR #11 head `5e94acf3fa97dbae957391e92401e082b1bbdfa3`, default tuning unchanged.
One execution passed on Node 24.19.0 in approximately 0.46 s. Source hashes were unchanged afterward.
This review changed no runtime, tests, replay fixtures or dependencies and ran no browser.

## Exact scenario and comparison

The entire [E2E scenario](../../../e2e/near-miss.spec.ts) was read, including visibility and Retry.
The main run is seed 1, with precisely `[[350, 2], [351, 0]]` (Right then release), ending naturally
at state tick 509. Hidden time starts after state tick 356 and lasts 5,000 virtual ms. The production
visibility handler releases input and updates the frame timestamp; the paused loop does not advance
or record simulation ticks. The accumulator is already zero at this boundary. This was source review
plus a Node no-step boundary check, not renewed browser acceptance.

Retry creates seed 2, fresh state/recorder/snapshots, released controls and a reset accumulator.
The E2E does not pin an exact tick after `runFor(32)`; its following 31 long frames add 155 ticks.
The independent comparison covers **every seed-2 prefix through natural crash at tick 284**, therefore
also the whole observed Retry window and the previous 150-tick streak deadline. No exact browser Retry
tick is inferred from the Node run. A second reviewer independently confirmed the input/pause/Retry flow.

Across **795 rows** (510 main-run states and 285 Retry states, including both initial states), deep equality
passed for every old state field: player, score, director, RNG, tick/seed/status/held input, all 64 traffic
slots including inactive bytes, and the complete event buffers including unused bytes. Valid raw events
and their order also matched. Only the newly added `mode` object was excluded from legacy equality;
all four mode fields remained zero on every row. Maximum meter was 10 in the main run and 0 on Retry.

| Result                             | Baseline                          | PR #11     |
| ---------------------------------- | --------------------------------- | ---------- |
| Main terminal hash                 | `fc2ed824`                        | `b3d301a4` |
| Main crash                         | tick 509, rear, held 0            | identical  |
| Main distance                      | 316.06451666705124 m              | identical  |
| Main score                         | 366.06451666705124, displayed 366 | identical  |
| Retry terminal hash (supplemental) | `4bde8f55`                        | `7927b6d5` |
| Retry natural crash                | tick 284, rear, held 0            | identical  |

The complete main-run raw event timeline is unchanged: tick 351 `[1,2,3]` (lane change), tick 352
`[26,3,0]` then `[23,11,50]` (NEAR MISS and 50-point credit), tick 502 `[24,50,0]` (bank),
tick 509 `[13,1,0]` (rear crash). All other main-run ticks have no events. Retry emits only its
tick-284 rear crash; it never inherits the previous 50 points or meter.

Both recorders produce identical replay metadata, input transitions and claims except `finalHash`;
both replay validators pass. On **every row**, applying the legacy hash function to the new state
reproduces the old hash, while applying the new hash to the old state plus a zero mode reproduces
the new hash. The reviewed hash diff adds exactly seven zero 32-bit words before traffic/RNG hashing
(kind plus two words each for active ticks, grace ticks and SMASH count); no physics change is hidden.

## Reproduction and scope

Scratch runner: `/workspace/scratch/P2-04a2/near-miss-pin-compare.ts`; compact result and complete
509/284-tick observations are `near-miss-pin-result.json` and `near-miss-pin-timeline.ndjson` beside it.

- E2E source SHA-256: `5d48570075bd85570366f711ffdecb282f9b1948244caefd96799f6d3d458ff0`.
- Runner SHA-256: `d2f6c5403818a49ec3cf2fcad4d03040beb31f4167851bd3aabef9ba8842410a`.
- Timeline SHA-256: `532f81343357a1e1bf675206bc171c8461aaabb3c8adbfc5f72ac1223b033c10`.

Recommendation: update only the stale terminal hash assertion after orchestrator authorization,
preserving all geometry, score, replay, hidden-time, Retry and diagnostic assertions. Exact new-head
browser/CI validation remains required; this evidence does not claim that CI or presentation passed.


## Coordinator corrective browser run

After independent approval, only the fixed expected hash in e2e/near-miss.spec.ts was replaced.
The unchanged production build was served locally with the shipped CSP. Targeted Playwright passed
both original scenarios: desktop 35.8 s, mobile 14.4 s; 2/2 total 52.1 s. Pause, all score/geometry/input
assertions and Retry remained intact, with the original timeout/workers/retries. No full unit/sim rerun
was needed for this test-only correction. Exact-head CI must still run on the corrective commit.
