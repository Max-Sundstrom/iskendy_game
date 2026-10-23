# P2-03a browser score regression — 2026-10-23

Passed on runtime commit `f775e3a43d546ff5c720f0e75b88502426ebc757`, freshly built and served by a local Vite
preview with the deployment CSP. The only dirty paths before the run were this new browser test and its plan;
production sources were unchanged. `frame-ancestors 'none'` replaces the deployment host placeholder locally.
The preview closed after the run; no deployment or public host was involved.

Command: `playwright test e2e/scoring.spec.ts --workers=2`, system Chromium, Node 24.19.0. The global 120 s
timeout was unchanged. Both cases passed on the first attempt: desktop 1440×900 in **58.946 s** and mobile
390×844, DPR 3 in **39.388 s**; total runner elapsed about 61 s. Each reports **errors: []** and the expected
strict CSP. The compact [JSON report](browser-results.json) preserves timings, exact runtime SHA, diagnostics
and fractional ledgers without embedding image data.

Both real input streams produced SLAM touchdowns on ticks **6 and 18**, followed by one **112.5** point bank
on tick **168**. The independent test expectation is `50 + 50 × 1.25`, not the scoring implementation's
output reused as its expected value. Pausing through the actual visibility adapter for 5000 virtual ms while
the pot was active changed neither HUD nor distance; bank timing still measured exactly 150 sim ticks after
the second touchdown. All settlement events, including zero-valued ones, were counted so extras cannot hide.

The first natural rear collision remains tick 258. Its unrounded banked total is
**267.87045680500904**, while HUD/results/replay claim/local best display **267**. Retry starts with visible
score **0** and distance **0 m**, then an idle second run ends on its original tick505. It contains no input
changes, style credits or settlements: total **313.42881941505215**, displayed **313**. The local best then
contains that maximum displayed score and its matching distance. Both stored replays validate their exact
hash, claimed score, distance and tick count.

The six unmodified PNG captures were visually inspected: the banked HUD clearly reads **222** at **110 m**,
the first results screen visibly reads **267**, and fresh Retry visibly reads **0** on both viewports. Text
and the Retry button remain readable within the viewport. This card does not add or restyle UI/models.

| Viewport | Banked HUD | Results | Fresh Retry |
|---|---|---|---|
| Desktop | [PNG](browser-desktop-fractional-bank-hud.png) | [PNG](browser-desktop-fractional-bank-results.png) | [PNG](browser-desktop-retry-fresh-score.png) |
| Mobile | [PNG](browser-mobile-fractional-bank-hud.png) | [PNG](browser-mobile-fractional-bank-results.png) | [PNG](browser-mobile-retry-fresh-score.png) |

Limits: keyboard input is dispatched through Playwright; mobile uses complete synthetic pointer gestures
through the production touch adapter, so physical-phone behavior is not claimed. Visibility is controlled
through the existing production adapter, not an actual mobile OS interruption. Inputs were released well
before Retry; actively held-control cleanup is outside this test. Clock control schedules real production
frames and fixed-step updates, with no sim-state injection. This run establishes score presentation and
replay agreement, not device performance or Firefox/WebKit coverage. Exact-head CI remains the orchestrator's
gate. The unrelated PR4 hidden crash-particle issue is not exercised by a paused playing-state scenario.

Review: the orchestrator and an independent QA agent inspected the actual PNGs and compact JSON; neither
found a blocking issue in this scoped score scenario. The new E2E file also passes TypeScript, ESLint and
Prettier checks. Vehicle-refinement PR3 remains a separate branch, so these captures show the models in the
measured scoring runtime. Base PR4's CI is still blocked by its separate crash investigation at this handoff;
the later zero-delta vapour correction is not included in these `f775e3a` captures.
