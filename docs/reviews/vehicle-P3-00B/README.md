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

Full 90-second desktop/mobile production-profile reports are pending completion. Cloud Chromium uses
software rendering; real-device timing, GPU texture bytes, GC pauses and late-game density remain unmeasured.
