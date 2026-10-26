# P2-03b simulation evidence

The proposed Q27 policy awards completed untouched forward close passes. An active traffic slot stores
idle/passing/qualified/disqualified/awarded, included in the state hash and reset on removal/reuse. No
physical movement, collision conditions, director randomness or existing event order changes. The scoring
ledger adds reason 11; event 26 carries vehicle type and event-time slot. Current motor vehicles are the
content entries with `top !== 'none'`; future taxonomy or moving taxi lanes need separate review.

Geometry clips normalized linear time against open longitudinal/vertical body-overlap intervals and the
two closed lateral gap corridors. Exact roof contact is excluded; a low airborne pass is eligible. Any
swept penetration disqualifies, including between-endpoint penetration that existing physical collision
checks miss. This only removes the award; it does not invent a physical collision. No substeps, epsilon
grace, trigonometry or per-tick allocations are introduced.

Entry includes a start exactly on the plane but excludes an end merely touching it. Completion includes
an end exactly on the exit plane. Slot-specific contact, HOP, CLEAR and both starting/current ride cancel
the encounter. Starting ride matters when jump/updateRide already cleared current ride. After all
collisions, surviving completions emit in ascending slot order; terminal crashes suppress them all.
Unrelated SCRAPE can coexist with a valid award and then lose its pot under the existing settlement rule.

The previous conservative capacity proof is 554. At most 64 near events, 64 associated milestones and two
aggregated credit buckets add 130, yielding 684 below the unchanged 1024 buffer. This overestimates producer
coexistence deliberately; raw event prefix and final settlement must remain intact.

## Actual input

`sim-actual-input.json` records default tuning, seed 1 and only Right on zero-based input tick 350, then
release 351. No state injection, traffic placement or retuning is used. The near event occurs on completed
tick 352 (type 3, slot 0): pot 50, meter 10, N 1, timer 150. Tick 501 retains pot 50/timer 1; tick 502 banks 50. A natural
rear crash on 509 ends at 316.06451666705124m and total 366.06451666705124, displayed 366. The recorder output
parses and replays with exact final hash `fc2ed824`. Every physical player field/status matches the disabled
policy throughout this same run. Retry seed 2 starts with a clear tracker and earns distance only.

This is simulation/input evidence, not a visual browser or physical-device check. Browser acceptance is
owned separately and remains pending here.

## Verification checkpoint

- Preserved pre-resumption author checks: 32 focused geometry/lifecycle/collision tests passed.
- Independent geometry reviewer:500/500 exact-rational partition vectors passed, including mirrored cases;
  helper SHA256 `06f7f2fb0c4598c3bd8e8da325121c4409b71c3fb2fd33c108ca9243ebe9c0d2`.
- Independent physics proof before fixture regeneration: 3 golden trajectories plus 10,000 scripted ticks
  across 25 runs match baseline 8e8fc39 in every pre-existing physical field and raw 1–21 event order. Flag-off
  also matches every old event 1–25 and all score fields. None of these old trajectories earns a near miss;
  their scores/ticks/distances/causes remain unchanged. Expanded active-slot state explains their new hashes.
- Resumed Node 24.19.0 / pnpm 12.11.2: new actual-input replay/Retry regression and tuning parsing passed 11/11.
- Independent lifecycle acceptance passed 17/17 checks with the same 40-file runtime manifest before/after.
  It separately reproduced the actual input and compared its old physical state/events against baseline.
  The 64-completion stress case retained slot order, every-action milestones and the old source prefix:
  130 observed events in the unchanged 1024 buffer. See `sim-independent-lifecycle.json` and
  `sim-independent-physics.json` for the reviewer evidence.
- Final Node 24.19.0 / pnpm 12.11.2 gates passed: `pnpm typecheck`, `pnpm lint`, `pnpm test --maxWorkers=1`
  (313/313 in 44 files), `pnpm test:sim --maxWorkers=1` (164/164 in 19 files), `pnpm build`,
  `pnpm check:size` (213.2 KiB total JS gzip, budget 400) and `pnpm format:check`.
- The first full pass passed typecheck but lint rejected 9 non-null assertions in the new tests. Explicit
  missing-fixture guards and kind-based indices replaced them without relaxing event assertions. The
  complete second pass passed; no runtime fix or independent-QA rerun was needed.
- Regenerated all three goldens only after independent physics and lifecycle acceptance. A structured
  before/after comparison verified that only `tuningHash` and `finalHash` changed; all input logs, ticks,
  scores and distances are equal. Both 10k pins are `5e81a89c-04c562d2` (25 runs); tuning pin is
  `9e91b7802bf1b6b1`. Rationale and every old/new replay hash are in the Sim changelog.

SIM_VERSION remains 1 only under prerelease ADR-024. Q27 is proposed behind `scoring.nearMissEnabled`, not
an owner-approved product policy. No dependencies, public deployment, preview update or merge is part of
this card. Local Firefox/WebKit and physical mobile device checks have not been run for this change.
Chromium visual acceptance, rebased-head cross-engine CI and publication are orchestrator follow-ups;
the immutable author checkpoint is ready for those checks. Build retains the existing Vite large-chunk
advisory, while the enforced compressed JS budget passes.
