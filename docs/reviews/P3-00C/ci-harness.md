# P3-00C CI timeout investigation

For the later published `a1a05d3` deadline failures and October 26 public-API horizon/observer investigation,
see [the follow-up](ci-horizon.md). Its synthetic guard regressions passed, but the full production run still
failed the desktop deadline; the historical local successes below do not establish a green current CI gate.

PR #4 at `5c5fd2cb6217ec23d5a2c3bf99af79dc0566077d` is **not fully verified**. CI's repeated-crash test
exceeded its existing 120 s deadline; a separately completed container job also failed hidden-frame PNG equality.
The local timing investigation below reproduces the deadline failure without
changing production code, simulation inputs, assertions, retries, worker count or timeout.

Environment: Node 24.19.0, pnpm 12.11.2, Playwright 1.64.0, system Chromium 154.0.8037.57, software rendering.
Desktop 1440×900; mobile 390×844, scale 3, touch emulation. These are not physical-device measurements.
An isolated Vite server on port 5183 served the exact crash worktree because port 5173 was already occupied;
the first command refused to start before any tests ran. No unrelated server was stopped.

## Evidence

[Sanitized trace summary](ci-harness.json) retains timings and replay identities without full browser archives.
The original trace archives remain in the cloud scratch workspace.

1. **Unchanged published head**, targeted repeated-crash scenario, both projects, two workers, trace enabled:
   mobile passed in about 85 s; desktop exceeded 120 s while awaiting the final results screen. Desktop had
   already recorded all three correct natural crashes: seeds 28/29/30, ticks 258/505/643, hashes
   `0ec6d8a9` / `c940e801` / `e90c746c`. They were observed at trace times 24.1 / 75.6 / 116.7 s.
   The first two `clock.runFor(800)` calls alone consumed 15.15 and 14.43 s of wall time; the third did not finish.
   This is continuing simulation/rendering followed by a test deadline, not a mismatched game outcome.
2. **Narrow public-clock correction**, full six crash cases, two workers, trace enabled: five passed; the repeated
   desktop case again exceeded 120 s, now inside `reachCrash` during its third run. Its first two saved replays
   remained correct. Across that test, 277 attribute reads consumed 44.54 s and 287 fast-forward calls consumed
   43.02 s. The other desktop cases passed in 39.5 / 34.3 s; mobile repeated/reduced/landing cases passed in
   60.0 / 15.4 / 9.0 s. The full suite initially runs two desktop cases together, unlike the first targeted pair;
   these two runs are not a controlled performance comparison.

The correction only replaces the three post-crash `runFor(800)` call sites with eight sequential public
`fastForward(100)` calls. Each frame is below the production 250 ms clamp; the visible crash clock still receives
the same 800 ms horizon. The fine-grained 125 ms impact and 32 ms reduced-motion pixel checks stay intact.
The production runtime, 1,406 simulated ticks, three distinct replays, two UI Retry actions, hidden/resume checks,
assertions and 120 s deadline are unchanged. Independent QA reviewed both the timing semantics and exact diff.
It reduced unnecessary presentation frames, but that clock-only attempt **did not make the full suite pass**.

## Reviewed fixture and bounded resumption

Independent deterministic scanning of seeds 1–128 found a shorter consecutive natural rear-collision fixture:

| Seed | Terminal tick | Final state hash | Distance, m |
| --- | --- | --- | --- |
| 96 | 339 | `97c6d523` | 206.19015153506737 |
| 97 | 324 | `27d0477e` | 196.70486388136058 |
| 98 | 313 | `3c1697fe` | 189.77035624879835 |

The reviewed fixture changes only the repeated-case starting seed and its exact seed/tick assertions. It retains three
real consecutive seeded runs, two real Retry actions and every lifecycle/replay/pixel assertion. It reduces
the repeated case's simulated trajectory coverage from 1,406 to 976 ticks (30.6%); it no longer exercises
the old 28–30 trajectories in that case. The task card has no minimum run duration or late-distance criterion.
The separate initial reduced-motion case remains seed 28; the actual bad-landing case remains seed 5. This is
equivalent lifecycle coverage, not equivalent stress, duration or performance coverage.

The concrete review patch was saved at
`/workspace/scratch/kometa-crash/fixture-candidate.patch`. Independent QA accepted the narrower fixture's lifecycle
coverage with the explicit tick-coverage boundary above. The orchestrator escalated approval for another attempt
under [AGENT_SYSTEM §2.6](../../AGENT_SYSTEM.md): “Two failed attempts on a card → escalate to the owner with a
summary, don't loop.” Dependent browser retries were paused. The parent subsequently authorized one new production
run after separate mobile acceptance on an integrated build containing the reviewed vapour fix. The fixture is now
applied on runtime `7559c647fef96e3e05fb5835b4524c2dc33d08b9`; the test blob is
`98b97f7f92df2ce05fb696ed023904ee67b08add`. Its single authorized six-case production run **passed 6/6** with the
same two workers, 120 s deadline, zero retries and strict assertions. Both viewports recorded the exact three
replays in the table above; hidden and reduced-motion PNG comparisons passed. Desktop repeated-case setup/body
took 93.6 s; mobile took 45.0 s. [The manifest and images](followup/README.md) record all six cases, deployment
CSP and zero browser page/console errors. No source changed during the run.

The clock/fixture work above changes no production runtime. No new CI run is claimed; the PR remains blocked by
its failing published-head checks. The separate runtime correction below is not covered by the earlier 90 s
performance and visual evidence at source `509ee1d`.

Before resumption, the partial harness correction passed `tsc --noEmit -p e2e`, ESLint on `e2e/crash.spec.ts`,
Prettier on the changed test/docs/summary and `git diff --check`. Those static checks did not replace the failed
browser gate. After the production pass, the full suite passed **189/189 tests**, together with workspace
typecheck, lint/boundaries, format, asset checks and the production build/size gate (193.8 KiB JS gzip).
At the initial escalation, unit/sim/build/performance checks had not been repeated for the test-only follow-up,
and all owned browser/server processes were closed. The runtime-only vapour fix was subsequently committed as
`7559c647` for the parent's integrated preview; the harness/doc follow-up is separate and unpublished.

## Separate hidden-frame particle defect

Independent CI review subsequently found a different failure in container job `120678983827`: the before/after
canvas PNG comparison after hiding the document and advancing 5,000 ms failed. That job reported 19 passed and
4 skipped cases. PNG byte inequality alone does not identify changed pixels or prove the exact visual cause;
the original image artifacts were unavailable. The shorter fixture and clock wait do not address this failure.

The production hidden crash path passes `deltaS = 0` to `vapour.update`. Independent probes and a new failing unit
test establish a real zero-time mutation: after eight 0.016 s updates, 16 alpha attributes changed from
`0.17991642653942108` to `0.17991644144058228` during `update(0)`. The positive update computed alpha using a local
double age; the zero-time update recomputed it from the rounded stored Float32 age. A fresh below-road particle
also moved to the road and sampled randomness on a zero-time update. These defects violate a frozen scene even
though their specific contribution to the unavailable CI images has not been established.

Red evidence: four new tests failed while the four existing vapour tests passed. The tests snapshot **every**
rendered particle attribute, check random-call counts, compare resumed evolution with an uninterrupted reference,
and exercise nonpositive time, resize projection, fresh below-road emission, visible ring-slot reuse, origin shift
and reset. Logs are retained at `/workspace/scratch/kometa-crash/vapour-zero-delta-red.log`.

The narrow runtime correction updates the point-scale uniform, then skips integration for `dt <= 0`. Mutation
sites publish their own changes: `emit` initializes the reused slot's age-zero size and zero alpha and marks its
attributes dirty; `shift` marks positions dirty. This avoids stale visible slots or missing origin-shift uploads
when the next update is paused. No new allocation, particle capacity, random draw during a pause or tuning change
is introduced. Emission increments attribute versions before rendering; Three uploads the latest buffer version
when rendering rather than issuing a GL upload at each version increment. The full performance smoke below checks
geometry budgets; GPU texture bytes and GC pauses remain unmeasured.

Focused green evidence: **29/29 tests across five files** (vapour, thrusters, crash view, crash controller and
camera) passed. The corresponding log is `/workspace/scratch/kometa-crash/vapour-zero-delta-green.log`.
Web TypeScript checking, targeted vapour ESLint, changed-file Prettier and `git diff --check` also passed.
Independent QA accepted runtime blob `f54541f32fbe989374b4ceda56ffe737608c2b2b` after a separate Node probe:
both 0.016 and 1/60 s initial ages remained stable across 200 paused/nonpositive updates, with no random draws,
attribute/array changes or altered resumed evolution. Projection, below-road birth, full-ring overwrite,
origin shift and reset passed. Its compact result is included in [the JSON evidence](ci-harness.json).
The resumed production browser run passes hidden PNG equality in both viewports. Both subsequent full 90 s
performance runs passed at clean `c7bdbf682ccc77db6d724b976d70594dd8f18ab1`, with deployment CSP, matching
P0-09 baseline gates and no errors. Desktop maximum: 97 draws / 92,558 triangles; mobile: 94 / 97,094.
[Final reports and timing limits](followup/README.md). This confirms the local scenario and measured budgets,
not the exact cause of unavailable earlier CI images or a green final-head CI run. Simulation,
tuning, dependencies, scanner, security exceptions, merges and deployment remain unchanged.
