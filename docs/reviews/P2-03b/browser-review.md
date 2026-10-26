# P2-03b browser acceptance

Both desktop and mobile cases passed on immutable runtime
`6f8b142696b221c6a4c7a3fbeb024b807b2e3b64`. The new test and evidence were uncommitted during measurement;
no runtime files changed. A fresh production build and size gate passed immediately before the browser run:
**213.3 KiB JavaScript gzip / 400 KiB**. This branch preserves the earlier vehicle models; it does not update
the separate published phone preview.

Run: `playwright test e2e/near-miss.spec.ts --workers=2`, unchanged **120 s** test timeout, retries **0**.
Chromium 154, Node 24.19.0, pnpm 12.11.2; desktop 1440×900 DPR 1, mobile 390×844 DPR 3 with touch emulation.
Production Vite preview served the deployment CSP with local `frame-ancestors 'none'`. Both cases report
JavaScript, request, console and CSP errors **[]**. [Raw results and diagnostics](browser-results.json).

| Profile | Result | Duration | Approach before completion                              | Pending series                                 | Banked HUD                                        | Results                                        | Fresh Retry                                        |
| ------- | ------ | -------- | ------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| Desktop | passed | 65.665 s | [image](browser-desktop-approach-before-completion.png) | [image](browser-desktop-near-miss-pending.png) | [image](browser-desktop-near-miss-banked-hud.png) | [image](browser-desktop-near-miss-results.png) | [image](browser-desktop-near-miss-retry-fresh.png) |
| Mobile  | passed | 48.862 s | [image](browser-mobile-approach-before-completion.png)  | [image](browser-mobile-near-miss-pending.png)  | [image](browser-mobile-near-miss-banked-hud.png)  | [image](browser-mobile-near-miss-results.png)  | [image](browser-mobile-near-miss-retry-fresh.png)  |

## Real input, visible UI and replay evidence

The browser uses seed 1 and default simulation tuning. After 70 bounded public-clock frames, the production
input adapter receives Right at replay tick 350 and release at 351: keyboard on desktop, a complete synthetic
pointerdown/move/up swipe on mobile. No simulation state, score or tuning is injected. The exact recorded
input log is asserted, rather than inferred from approximate wall time.

A 25 ms frame advances one tick to state 351, before the completed pass. The next 100 ms frame runs five ticks
and drops the accumulator backlog, reaching tick 356. At that point the visible banked score still equals displayed
distance. Hidden time advances 5000 virtual ms through the production visibility adapter without changing
either value. After resume, 29 five-tick frames reach tick 501 with the award still pending; another reaches 506,
inside the narrow bank 502…508 / crash 509 window. The HUD visibly reads **364 at 314 m**, an extra 50 banked points.

The natural rear collision ends at tick 509. Results visibly show **366 at 316 m**, matching the stored replay,
validated final hash `fc2ed824`, and local best. Exact banked total remains fractional:
`316.06451666705124 distance + 50 award = 366.06451666705124`; only the display/claimed score is floored.
Retry uses the actual button, reaches visible fresh gameplay below 5 points, then advances past a complete old
150-tick streak window without inheriting the previous award. The original saved replay remains unchanged.

The current HUD does **not** expose pot, meter or N. Those claims come from an independent Node replay audit:
exactly one NEAR MISS at tick 352, vehicle type 3 / slot 0; credit 50, pot 50, meter 10, N 1, timer 150; one settlement of 50
with zero loss at tick 502; rear crash at 509. The browser provides actual input, banked HUD/result, pause and Retry evidence;
the replay audit and the separate geometry/lifecycle QA provide the internal ledger and geometry evidence.

## Initial failed precheck and reviewed correction

The initial attempt failed in the new test's Node oracle before `page.goto` and before any gameplay input.
It incorrectly required the state 351 lateral gap to be at most 0.6 m; the actual gap was
`0.6131184895833335`. The production contract detects a close interval inside a swept tick, not just at endpoints.
Both failed case results, traces and original test are preserved in `/workspace/scratch/P2-03b-browser-attempt1/`.

The orchestrator authorized one corrective repeat. The replacement independently interpolates the two physical
endpoint positions, without calling the production sweep helper. It proves corridor entry fraction
`.01635883905 < forward exit .09210444133 < lateral penetration`, all within the tick; their midpoint has gap
`.56962902161 m` with positive longitudinal/vertical body overlap. Thus proximity occurs before the player clears
the van, and lateral penetration begins only after forward separation. Exact event tick 352, credit 50, bank tick 502,
input ticks 350/351 and replay hash assertions were retained. Explicit HUD/results visibility assertions were also added.
Scoped TypeScript, ESLint and formatting passed before the sole repeat, which passed both viewports.

## Visual limits and unrun checks

The orchestrator and independent QA viewed the actual screenshots. Desktop shows the adjacent van at the right edge during the approach; the narrow
mobile viewport crops almost all of that van. Mobile pixels therefore do not independently establish the complete
geometry witness or a measured 0.6 m gap. Both viewports show the banked HUD, readable result and fresh Retry.
The state 351 image intentionally depicts approach before completion, not an already-emitted near-miss event.

This is Chromium emulation, not a physical phone or actual OS backgrounding. No new UI, popup or near-miss label
was added; full event-feed UI remains P2-07. No hosted-preview, full-suite, cross-engine or performance run is
claimed by this browser evidence. Simulation/static author checks and independent geometry/lifecycle/physics
comparisons are recorded separately. Browser and local preview closed after the successful run; no additional
browser attempts were made. Exact-head CI and publication belong to the orchestrator.
