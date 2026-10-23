# P3-00C crash presentation evidence

The actual simulation crash now leads to a short readable response before results cover the car. The simulation
stops and records the replay at the original crash tick. No sim outcomes, golden replays or determinism fixtures changed.

Measured source: [`509ee1d7fd1f83ae250b8431d5a09cddd5b05077`](https://github.com/Max-Sundstrom/iskendy_game/commit/509ee1d7fd1f83ae250b8431d5a09cddd5b05077).
Both performance runs report this exact commit with `dirty: false`. The zero-time vapour correction in `7559c647`
has [separate follow-up browser evidence](followup/README.md); these older performance runs do not cover that fix.

**Current CI status:** published head `5c5fd2c` fails the repeated-crash browser scenario's 120 s deadline; a separate
container run also failed hidden-frame PNG equality.
[Investigation and reviewed fixture](ci-harness.md) record the unsuccessful attempts, actual replay progress,
public-clock correction, zero-time particle fix and authorized resumption. The local follow-up now passes all six
production browser cases, 189 unit tests and both full 90 s performance profiles at clean `c7bdbf6`.
Exact published-head CI remains pending; the card is not fully verified.

## Actual browser images

Production Vite build, Chromium 154.0.8037.57, `q=low`. Desktop: 1440×900, device scale 1. Mobile: 390×844 touch
viewport, device scale 3. These are software-rendered browser captures, not physical-phone evidence. Playwright controls
browser time while real input adapters, fixed simulation ticks and rendering run normally.

| Viewport | Impact start | Peak near 125 ms | Reduced motion | Bad landing | Results |
| --- | --- | --- | --- | --- | --- |
| Desktop | [start](desktop-start.png) | [peak](desktop-peak.png) | [static](desktop-reduced.png) | [landing](desktop-landing.png) | [results](desktop-results.png) |
| Mobile | [start](mobile-start.png) | [peak](mobile-peak.png) | [static](mobile-reduced.png) | [landing](mobile-landing.png) | [results](mobile-results.png) |

[Capture metadata](capture.json) records both viewports, no page errors and pixel-identical frames after live OS reduced
motion is enabled. Independent code/visual review inspected the images and accepted the bounded response, readable cue,
static reduced-motion view, landing pose and results. These images use the existing car/traffic base; they do **not**
combine model PR #3. The old model's bumper bands are a separately fixed model issue, not a crash regression.

The first .06 m compression alone was too subtle in actual screenshots. Review requested a bounded 6° body pitch inside
the same .25 s envelope. A subsequent real-image check found its sign was nose-up because the body faces local +z inside
a model rotated by π. The final correction uses positive x pitch; its regression checks actual transformed front/rear
anchor heights, not just a numeric Euler sign. Reduced motion omits pitch, compression, camera pullback and particles.

A bad landing retains the preceding actual simulation tick's flip orientation because the landing grader resets the
terminal angle. This has at most 1/60 s of lag (about 10.91° at the current flip duration); it is not claimed as the exact
touchdown angle. No collision contact point or normal is invented.

## Verification

- Full local unit suite: **185/185 passed**; sim suite: **56/56 passed**, including unchanged goldens.
- Typecheck, lint/boundaries, format, assets, production build and size: passed. Initial JS gzip: **198,413 bytes / 193.8 KiB**,
  below 400 KiB. Vite retains its informational warning about the >500 kB uncompressed bundle.
- Six production browser cases passed at `a1cef528c1e3364a690d58d70fdbe3d5c414d75b` in 3.4 min: desktop/mobile actual rear
  collisions, delayed results, hidden/resume, two Retry, exactly three validated replays at ticks 258/505/643, live OS
  preference, static initial reduced motion, keyboard/touch late-flip landing. Visibility is explicitly injected through
  the real visibility adapter because headless focus does not reliably hide a tab.
- The only subsequent runtime change is the pitch direction in `509ee1d`. Its six focused crash tests passed and all
  start/peak/reduced/landing/results images above were recaptured at that exact source. The independent replay/browser
  sequence was not redundantly rerun after the sign-only correction; CI must run the full suite on the published head.
- Earlier attempt: desktop 3/3 passed, mobile did not start because the author changed tuning during the suite and a new
  worker saw new JSON with a cached old schema. It is preserved under `/workspace/scratch/kometa-crash/attempt-1`;
  this was corrected by using immutable source checkpoints, without weakening assertions.
- Independent QA passed 46 relevant lifecycle/camera/tuning tests before the sign correction, reviewed the final sign
  regression and inspected final images. Final CI status is a publication gate, not implied by these local results.

## Full performance runs

Both 90 s runs used the production CSP, matching P0-09 viewport/quality/seed baselines, and passed absolute geometry
budgets plus the 10% regression gate. Runtime/CSP errors, invalid samples and sample overflow: zero.

| Profile | Active / rendered frames | Max draws | Max triangles | p50 / p95 ms | Report |
| --- | --- | --- | --- | --- | --- |
| Desktop | 360 / 454 | 97 | 91,262 | 183.4 / 233.4 | [JSON](perf-desktop.json) |
| Mobile | 1,200 / 1,528 | 94 | 104,402 | 66.6 / 83.3 | [JSON](perf-mobile.json) |

Timing describes software rendering in this cloud session only; it is informational, not a phone performance claim.
GPU texture memory, GC pauses and physical-device performance were not measured. Full container/header regression and
cross-engine browser jobs were not rerun locally for this presentation-only card; they remain CI checks. No dependency,
scanner, security exception, merge or deployment change is included.
