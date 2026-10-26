# P3-00C paused-particle follow-up

Runtime: `7559c647fef96e3e05fb5835b4524c2dc33d08b9`. Browser test blob:
`98b97f7f92df2ce05fb696ed023904ee67b08add`. Runtime paths were unchanged from that commit during the run;
the working changes were the reviewed harness and evidence/docs. No source changed during the suite.

Production build with deployment CSP, Chromium 154.0.8037.57, Playwright 1.64.0, `q=low`. Desktop 1440×900,
scale 1; mobile 390×844 touch emulation, scale 3. Software rendering, not physical-phone evidence.
[Manifest](capture.json) includes the CSP, all six test outcomes, exact saved replay identities and no page/console errors.

## Browser result

The single authorized production run passed **6/6 cases** with two workers, zero retries and the unchanged 120 s
per-test deadline. Both viewports passed hidden-for-5,000-ms strict canvas PNG equality, live and initial reduced
motion, exactly three valid replays, two real UI Retry actions, frozen distance/results and the actual late-flip crash.

| Case | Desktop setup/body | Mobile setup/body |
| --- | --- | --- |
| Three crashes, hidden/resume, live reduced motion, two Retry | 93.6 s | 45.0 s |
| Initial reduced motion | 37.5 s | 15.2 s |
| Actual late-flip landing | 33.8 s | 10.8 s |

The repeated case now uses consecutive seeds 96/97/98 with exact crash ticks 339/324/313. Its 976 simulated ticks
replace the previous 1,406; it preserves the requested lifecycle assertions, not equivalent stress/duration or
performance coverage. Initial reduced motion remains seed 28 and the bad landing remains seed 5. The public
clock advances the same 800 ms results horizon through eight 100 ms frames; the 125 ms impact and 32 ms reduced
motion pixel checks are unchanged. [Failure evidence and review rationale](../ci-harness.md).

## Captures

Start, peak, reduced-motion and results images use the first repeated-case collision, seed 96. Landing uses seed 5.
These are the crash branch's older car models, not the separate model PR #3 or the integrated private preview;
the existing bumper bands are not introduced by the vapour fix.

| Viewport | Impact start | Peak near 125 ms | Reduced motion | Bad landing | Results |
| --- | --- | --- | --- | --- | --- |
| Desktop | [start](desktop-start.png) | [peak](desktop-peak.png) | [static](desktop-reduced.png) | [landing](desktop-landing.png) | [results](desktop-results.png) |
| Mobile | [start](mobile-start.png) | [peak](mobile-peak.png) | [static](mobile-reduced.png) | [landing](mobile-landing.png) | [results](mobile-results.png) |

## Full performance runs and remaining gates

Both full **90 s** runs passed at clean checkpoint
`c7bdbf682ccc77db6d724b976d70594dd8f18ab1` (`dirty: false`). This contains the same runtime and test blob used
for the browser evidence above. Both used a fresh production build with deployment CSP and the matching
P0-09 seed/quality/viewport baselines. Absolute draw/triangle budgets and the 10% geometry regression gate passed;
runtime/CSP errors, invalid samples and sample overflow were zero. Each report includes 17 real runs / 16 Retry.

| Profile | Active / rendered frames | Max draws | Max triangles | p50 / p95 ms | Report |
| --- | --- | --- | --- | --- | --- |
| Desktop | 366 / 468 | 97 | 92,558 | 183.3 / 233.3 | [JSON](perf-desktop.json) |
| Mobile | 1,186 / 1,510 | 94 | 97,094 | 66.6 / 83.3 | [JSON](perf-mobile.json) |

Wall-clock inputs can reach different sim ticks on different renderers; these are not deterministic replays.
Timing is informational software-renderer evidence, not phone performance. GPU texture bytes, GC pauses and
physical-device performance were not measured. Reports were written outside the worktree; only documentation
and evidence were added after this measured checkpoint.

Full local suite: **189/189 tests passed**, including the unchanged sim/golden tests; workspace typecheck,
lint/boundaries, format, assets, production build and size passed. Initial JS gzip is 193.8 KiB, below 400 KiB.
Vite's informational >500 kB uncompressed-chunk warning remains. Independent QA accepted the runtime correction,
exact test diff, manifest/trace evidence and both viewports' peak/reduced/landing images. Exact published-head CI
remains pending; the earlier `509ee1d` performance results are historical, with this runtime fix measured above.

No simulation, tuning, dependency, scanner, security exception, merge, deployment or private-preview change.
