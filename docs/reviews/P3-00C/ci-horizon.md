# P3-00C: first-impact observation without per-frame protocol reads

## Published CI failure and evidence boundary

Published head `a1a05d30061809f3959d6d1796d9a1bdcbef1b81` failed both
[PR CI 40036937523](https://github.com/Max-Sundstrom/iskendy_game/actions/runs/40036937523) and
[push CI 40036933318](https://github.com/Max-Sundstrom/iskendy_game/actions/runs/40036933318).
All four browser/container jobs exceeded the unchanged 120 s deadline in the desktop repeated-crash test,
inside `reachCrash`'s attribute read or clock step; each reported 19 passed, 4 skipped and 1 failed.
No PNG/replay mismatch was reported. Build and static/unit/sim checks passed in both runs; PR cross-engine
determinism passed, while the push cross-engine job was cancelled during browser installation.

The artifact connector returned file references for PR artifact `12537443427` and push artifact `12537782166`.
Transferring either authorized file failed with `Tunnel connection failed: 403 Forbidden`. The supported Library
materialization action supplied URLs, but no local path. No CI ZIP was read, no access restriction was bypassed,
and the exact one of the three runs active at the CI deadline is **unknown**. Artifact metadata confirmed the
head/run associations; timing and frame-count evidence below comes from our saved local traces, not CI traces.

## Causal proposal and unchanged coverage

The prior local production pass used the same runtime and fixture as published head `a1a05d3`. Its desktop
repeated case took 93.6 s. Reaching seeds 96/97/98's crashes required 68/65/63 public `fastForward(100)` calls
and 69/66/64 `data-screen` reads. Those 199 reads occupied 33.72 s; the 196 catch-up clock calls occupied 27.88 s.
Removing the reads removes protocol operations, but renderer backpressure may move some wall time into remaining
calls. This trace does not predict a guaranteed 33.72 s speedup or establish CI's complete CPU profile.

Increasing each step to 200 ms would not reduce the real frame count: the production accumulator independently
clamps to 100 ms and five sim ticks per frame. Private Playwright clock APIs and asynchronous Node notification
ordering are unnecessary. The revised test uses only public clock/evaluation APIs and the existing DOM screen.

`reachCrash(page, expectedTicks)` now executes the independently verified idle horizon: 68/65/63 real catch-up
frames, or 52 for the separate seed-28 reduced-motion case. It imports the real `MAX_STEPS_PER_FRAME`, requires
the existing cap of five, and verifies that 0–2 startup ticks cannot change the calculated frame count. Independent
QA exercised the real session and accumulator for four fixtures × three startup counts × three carry values:
all 36 cases crashed on precisely the expected final frame, with the original terminal ticks.

Before driving, a page-local `MutationObserver` must arm while the app is `playing`. It records the first mocked
`Date.now()` and counts transitions into `crashing`, including multiple transitions batched in one microtask.
One endpoint evaluation drains pending mutation records, disconnects, and returns screen/count/first-time/current-time.
The test requires `crashing`, exactly one transition and equal timestamps. An extra post-impact frame therefore
fails explicitly. This does not depend on a binding callback reaching Node before the next clock call. Each Retry
arms a fresh observer; the helper disconnects on failure and disposes its handle. Page teardown releases the observer
if the page closes during a failing call.

All three real crashes, two real UI Retry actions, seed/tick/replay checks, hidden PNG equality, live/initial reduced
motion, 125 ms peak capture, fine-grained 32 ms pixel checks, results/focus/frozen-distance/one-record checks and
bad landing remain. The repeated fixture is still **976 sim ticks**, with no further shortening. Worker count is
still two, retry count zero, and deadline 120 s. Production runtime, tuning, dependencies, simulation and preview
are unchanged. The earlier 1,406 → 976 fixture coverage reduction remains documented in [the prior investigation](ci-harness.md).

## Verification

The new synthetic DOM-only suite passed **12/12** across desktop/mobile in 4.33 s. It proves that a final-frame
impact succeeds, an earlier/missing/duplicate transition rejects, arming after impact rejects, two new runs rearm
independently, and an injected clock rejection leaves zero active observers. It uses no game or WebGL runtime.

Scoped E2E TypeScript, ESLint, Prettier and `git diff --check` passed. A fresh production build passed with the
existing informational uncompressed-chunk warning. The single authorized six-case production run ended with
**5 passed, 1 failed; the suite failed**:

| Case | Desktop | Mobile |
| --- | --- | --- |
| Three crashes, two Retry, hidden/live reduced motion | **120 s timeout** | 51.725 s, passed |
| Initial reduced motion | 45.987 s, passed | 18.268 s, passed |
| Actual bad landing | 45.190 s, passed | 10.368 s, passed |

The desktop trace proves that its first two endpoint guards passed at trace times 42.52/91.04 s, and the first
two saved replays retained ticks 339/324 and hashes `97c6d523`/`27d0477e`. The deadline fired during the third
clock loop. Playwright's timeout teardown allowed the remaining asynchronous calls to complete; the third guard
assertions passed at 122.44 s **after the deadline**, then the next cue-visibility assertion reported the expired
budget. This is not evidence of a hidden cue, nor a successful third replay/result check. Those final assertions
did not complete. The mobile case completed all three guards and exact replays, including tick 313/hash `3c1697fe`.

All 199 per-frame screen reads were removed, but the desktop's public clock calls now occupied 95.70 s in the
browser trace (212 calls logged, one without a recorded completion). The three driving loops occupied
32.29/32.89/26.08 s in the test trace, including the late teardown continuation. The preserved 68/65/63-frame
budget is confirmed; fewer protocol reads did **not** establish an elapsed-time improvement. The old and new
measurements are not a controlled comparison of machine load, software rendering or trace-capture overhead.
The remaining clock/render cost needs a new diagnosis; no additional browser attempt was made.

[Sanitized machine-readable evidence](ci-horizon.json) includes exact source/test hashes, local trace profiles,
both suites' results, observed timestamps and replay identities. Full traces and reports remain at
`/workspace/scratch/kometa-crash/ci-oct26/`. Browser processes finished and the owned production preview was stopped.
No production code, fixture, timeout or assertion was changed after the run. The parent authorized a local
diagnostic checkpoint after independent evidence review; it is not a CI fix or release-ready result. No push,
merge or preview deployment is authorized by this checkpoint. The clean `c7bdbf6` 90 s reports remain applicable
to the unchanged runtime; performance smoke was not repeated for this test-only change. Published-head CI remains red.

## Proposed next experiment — not executed

The current scheduling runs the repeated desktop case alongside the other two desktop WebGL cases. A possible
explanation for the high clock-call cost is contention between software-rendered browser contexts, including
trace capture. This is an inference, not an established cause: the existing traces cannot isolate renderer,
protocol, CPU scheduling or recorder costs, and elapsed times vary between machines/runs.

The orchestrator also reported differing CI outcomes on other stacked branches with identical source/tests in
each pair: preview head `d087632` failed PR E2E while push E2E job `121597929335` passed; the scoring branch's
PR container job `121595625735` passed while its paired push container job failed. These are separate integrations,
not PR #4 validation. They support result variability but do not prove a worker-count cause or solution.

A controlled next experiment would use the same build, source/test hashes, Chromium, CSP, viewports, trace options
and six cases, changing only the CLI worker count:

```sh
BASE_URL=http://127.0.0.1:5183 PW_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
  pnpm exec playwright test e2e/crash.spec.ts --workers=1 --trace on \
  --output /workspace/scratch/kometa-crash/ci-oct26/horizon-one-worker
```

This command has **not** run. It needs the parent's decision and an exclusive browser slot. Repository worker
configuration remains two. The experiment would retain all cases, 196 repeated-case driving frames/976 sim ticks,
exact replay assertions, first-impact guards, PNG comparisons, two Retry, the 120 s per-test deadline and zero
retries. It would stop testing contention between two concurrently executing E2E cases; it would not demonstrate
physical-device performance, two-worker CI success or a complete container/dev-server CI pass. A one-worker pass
would support a scheduling hypothesis, but not alone establish causation or authorize changing the CI config.

The browser and container CI jobs each have a **25-minute total deadline**, including installation and container
setup; existing workflow notes record browser dependency installation taking up to 14 minutes. Serializing the
whole smoke suite could increase job wall time even if individual cases become faster. Any eventual scheduling
change therefore needs full-job timing evidence, without silently increasing either test or job deadlines. No
additional fixture reduction, production change or unchecked browser repeat is part of this proposal.
