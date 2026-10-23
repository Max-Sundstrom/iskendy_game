# P2-03a browser regression plan

Scope: new `e2e/scoring.spec.ts`; no UI, sim or existing-test edits. This plan was prepared against the frozen
`02d4fc8` scoring contract. Execution on runtime `f775e3a` passed at both viewports; the separate
[browser review](browser-review.md) records the exact evidence and limits.

Use the real production entrypoint with seed 28 and no intro. Through keyboard input on desktop and
touch-adapter gestures on mobile, jump and slam early twice. A small Node physics probe confirmed actual
road slam landings on ticks 7 and 20 for presses at ticks 3/6 and 16/19; without further input, this seed
still crashes into a rear on tick 258. These early landings leave enough time for the second action's
150-tick timeout before that collision. While the pot is active, exercise the production visibility adapter:
hide the document, advance 5000 virtual milliseconds and require unchanged HUD/distance. Resume and verify
from the recorded replay that the bank still occurs exactly 150 sim ticks after the second touchdown.

The independent ledger expectation is `50 + 50 × 1.25 = 112.5` points. Before settlement the visible HUD
must show distance alone. After settlement, `floor(distance + 112.5) - floor(distance)` must be 112 or 113;
the test must not mistake this legitimate flooring difference for rounded-away fractional awards. Read the
actual saved replay after the natural crash, parse it through its schema and independently re-step the recorded
input masks in Node. Require exactly two real slam touchdowns, credits 50 and 62.5, one 112.5 bank after
150 ticks, no direct awards, and final fractional total equal to distance points plus 112.5. Validate the
exact replay hash/claim separately with `playReplay`. The final HUD text, visible results, saved replay score
and local personal best must all equal `floor(banked total)`.

Click/tap Retry, require a fresh low HUD score and unchanged saved first replay. The second run uses seed29
without inputs, naturally ending at tick505; its replay must contain no input changes, style awards or
settlements, and its visible results must contain distance points only. This detects carried score and
unsolicited inputs across Retry without injecting state or adding test-only UI attributes. Inputs in the
first run were already released; clearing an actively held control at Retry is not claimed by this test.
After the second results screen, the local best must retain the maximum displayed banked total of the two
runs, together with the corresponding winning run's distance.

The clock controls browser frame timing only. Bounded catch-up frames invoke the production accumulator;
they never call a sim/debug API. The crash helper will incorporate the PR4 diagnosis result before validation
so slow software rendering is not hidden by extended test deadlines. Attach real screenshots at both
viewports for banked HUD, results and fresh Retry, plus a JSON ledger and console/page/network errors.

Limits: synthetic mobile pointer gestures exercise the actual adapter but do not replace physical-phone
tests. This scoring test does not claim cross-engine replay coverage, renderer performance or a new UI.
