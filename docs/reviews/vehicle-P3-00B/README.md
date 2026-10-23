# P3-00B vehicle refinement evidence

This procedural refinement preserves the approved original Samodelka shape, soft pontoon shoulders,
Courier two-tone palette, targa and four round rear lamps. The roof still uses the existing diamond/dot
placeholder; this is not an owner-approved replacement ornament or a new design signoff.

## Changes and budgets

The hero has open wheel arches, a connected glass/roof frame, attached mirrors, a recessed side intake
and more legible rear lamps. Opaque finishes share a 256² atlas/material; glass and dynamic nozzle glow
remain separate. The frozen rig, wheel spin markers, nozzle anchors and contact shadow are retained.
Rear and nose sill caps are separated from the paint caps to eliminate chase-view z-fighting.

| Model | Before triangles | After triangles |
| --- | ---: | ---: |
| Hero | 17,044 | 12,760 |
| Sedan | 1,716 | 2,140 |
| Compact | 1,740 | 2,174 |
| Taxi | 2,064 | 2,484 |
| Van | 1,416 | 1,646 |
| Bus | 1,396 | 1,556 |
| Semi | 2,504 | 2,812 |
| Car carrier | 2,608 | 2,812 |
| Cones | 400 | 400 |
| Barrier | 352 | 352 |
| Marshrutka | 1,452 | 1,682 |
| Trolleybus | 1,432 | 1,592 |
| Sweeper | 1,688 | 1,836 |
| Works truck | 1,492 | 1,640 |

Hero material count falls from 13 to **3**, with **11 meshes** instead of 26, excluding its separate shadow.
Every traffic type remains a single combined geometry with no material groups and a shared instanced material.
New per-vertex finishes distinguish glass/rubber/metal. Cabin trim follows the hull surface; traffic loft
subdivision is unchanged. Caps remain 15,000 triangles for hero and 3,000 for each traffic type.

## Images and review

`hero-{rear,front,side,top}.png` show unobstructed model inspection views. The optional gallery `studio=1`
uses a plain floor so long-truck side cameras are not obstructed by the highway barrier. `fleet-rear.png`
retains the real road. Traffic close-ups include sedan, compact, van, bus, semi and car carrier.

`game-desktop-high.png` and `game-mobile-high.png` are actual gameplay with `q=high`, seed 5 and intro disabled.
Low-profile comparison captures are `game-desktop.png` and `game-mobile.png`. Desktop viewport is 1440×900;
mobile is 390×844 **Chromium touch emulation**, DPR 1 for screenshots, not a physical phone. No game camera,
HUD or world changes are part of this card. The pre-existing desktop instruction overlay crosses the rear of
the car; HUD layout remains a separate card.

Screenshot time is paused at a fixed early run frame using Playwright's clock. Geometry counters are actual
renderer counters, but synthetic frame intervals are deliberately excluded from `browser-report.json`.
These static captures do not establish frame rate or late-game density. Studio counters also include the
floor/sky and shadow passes and cannot be compared to full gameplay totals.

The final capture exits successfully with no HTTP, request, page or console errors. High-quality early-game
geometry counters are **89 draws / 136,714 triangles** on desktop and **87 / 136,690** on mobile emulation.

Independent agent review by the orchestrator and CI reviewer found and drove fixes for roof/glass overlap,
floating frames and coplanar sill caps. This review supports a draft PR, not an owner design signoff.

## Validation and limitations

Node 24.19.0 / pnpm 12.11.2, frozen lockfile install. Workspace typecheck, lint/boundaries, full unit suite,
formatting, production build, bundle budget and assets ledger checks pass. The final unit run passed
**157/157 tests in 29 files**; bundle size is **196.4 KB gzip** against the 400 KB limit. Model-specific coverage includes
hero rig/budget/finish attributes, rear-cap separation, all traffic bounds/budgets, rim-facing normals and
2 mm surface patches verified against the actual hull. No simulation, tuning, dependencies, golden replays
or determinism fixtures changed.

The first two capture passes reported a missing `/favicon.ico`; a narrow normal-navigation diagnostic
identified the exact URL. Gallery HTML now declares the same `data:,` favicon as the main page. No errors
were suppressed. An intermediate routed-HTML diagnostic caused Chromium Local Network Access errors in
Vite HMR and was discarded; no network or browser security settings were relaxed to bypass it.

## Production smoke measurements

Both 90-second runs completed successfully on clean commit `a16f8ee4af95d1a50f6ed770356671c83690fbaa`
(`dirty: false`), using Chromium 154.0.8037.57, a fresh production build/preview and the strict CSP from
`deploy/Caddyfile`. The reports retain their original measured commit and screenshot paths; their PNGs
are copied alongside the reports here. Both report `passed: true`, `errors: []` and pass the matching
P0-09 Low-profile baseline comparison as well as the 150 draw / 300,000 triangle hard caps.

| Profile | Wall duration | Active frames | Max draws | Max triangles | Runs / retries | Farthest run |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [Desktop Low](models-desktop.json) | 90.000 s | 434 | 82 | 93,450 | 19 / 18 | 130 m |
| [Mobile Low emulator](models-mobile.json) | 90.001 s | 1,429 | 79 | 99,244 | 21 / 20 | 163 m |

Both runs start at seed 5, exercise normal inputs, crashes and Retry, and increment subsequent run seeds.
No invalid or overflow frames were recorded. Desktop uses 1440×900; mobile uses 390×844 touch emulation
at DPR 3, unlike the DPR 1 inspection screenshots. The emitted JS is 201,094 bytes gzip (196.4 KB).
The preserved end-of-run captures are [desktop](models-desktop.png) and [mobile](models-mobile.png).

Commands (with Node 24 / pnpm 12.11.2 on PATH):

```sh
PW_CHROMIUM_EXECUTABLE=/usr/bin/chromium pnpm perf:smoke --duration 90 --viewport desktop --quality low --baseline docs/reviews/perf-P0-09/desktop.json --output perf-report/models-desktop.json
PW_CHROMIUM_EXECUTABLE=/usr/bin/chromium pnpm perf:smoke --duration 90 --viewport mobile --quality low --baseline docs/reviews/perf-P0-09/mobile.json --output perf-report/models-mobile.json
```

The orchestrator independently inspected both complete reports and accepted these bounded results. Cloud
Chromium uses ANGLE SwiftShader software rendering: observed p50/p95 are 199.9/233.4 ms on desktop and
66.6/83.3 ms in mobile emulation. These timings are informational and do not prove a phone frame-rate
budget. Wall-clock input delivery is not a deterministic replay. The short natural runs cover early traffic;
late-game density, High-profile 90-second timing, physical-device performance, GPU texture bytes and GC
pauses remain unmeasured. No simulation, golden or cross-engine fixture changes are required for this card.

The measured runtime tree IDs are `7dba25cab43fb330efb313a5b7c415367a7c1cba` for `apps/web/src` and
`71be3dffae7e4f5f8c1e99446a535bb31741befa` for `packages`. After rebasing onto perf head
`cbf084b452b2c62825af8b9dce347de270c8ab55`, both tree IDs match exactly and
`git diff --exit-code a16f8ee4af95d1a50f6ed770356671c83690fbaa HEAD -- apps/web/src packages` is empty.
The base update changes only perf cleanup tooling, its tests and documentation. Game runtime is identical
to the measured source; the preserved report measurements are not relabelled as a new run.

The branch is stacked on [P0-09 draft PR #2](https://github.com/Max-Sundstrom/iskendy_game/pull/2).
Its independent visual acceptance covers the implementation for draft review. CI on the published model
branch and eventual owner design review are separate gates; this card does not authorize merge or deployment.
