# P2-02b barrel presentation evidence

This card renders the signed barrel state produced by the deterministic simulation. The renderer composes
`Qx(-pitch) * Qz(-roll)` and compensates the rotated centre of mass in all three axes. Safe contacts align
the preceding rotation snapshot per simulation step; this also handles roof HOP and buffered relaunch when
the car immediately remains airborne. A failed landing now retains the actual terminal pitch and roll,
replacing P3-00C's preceding-tick workaround. Crash begin/render/reset and Reduced Motion remain intact.

The inspected and measured source is clean commit `e96d8ffa03ddd59cd21256a61288e93e0ad41985`. It includes
the final crash nose-down correction. Rebase from the checked source changed only the crash evidence/docs;
the orchestrator verified an empty runtime/test diff before browser verification. Runtime tree IDs are:

- `apps/web/src`: `28aea6c2398b1c40417aa3de9fe9b82e9e4120f4`
- `packages`: `14518d555e5bc9002aa09f9d48743289f569d390`

## Actual browser verification

The new barrel suite and existing crash suite passed **14/14 cases on the first run**, workers 1, in 5.6 minutes.
Both use the fresh production build under the deployment CSP, with `frame-ancestors 'none'` for the local
standalone preview. No policy was weakened. `capture.json` records the exact command, CSP, viewport settings,
commit and SHA-256 of each selected PNG. The eight new barrel cases assert an empty list of HTTP/request,
console and page errors. No test or error was suppressed.

The desktop viewport is 1440×900 at DPR 1. Mobile is **Chromium touch emulation**, 390×844 at DPR 3, not a
physical phone. These Low-profile images use the existing vehicle model; the model refinement and its known
underside/rear trim correction are in separate PR #3. No model, ramp, ornament or HUD redesign is part of this card.

| Viewport / direction | Quarter | Inverted | Complete turn | Mixed impact | Retry |
| --- | --- | --- | --- | --- | --- |
| Desktop left | [image](desktop-left-quarter.png) | [image](desktop-left-inverted.png) | [image](desktop-left-complete.png) | [image](desktop-left-mixed-impact.png) | [upright](desktop-left-retry-upright.png), [opposite roll](desktop-left-retry-opposite-roll.png) |
| Desktop right | [image](desktop-right-quarter.png) | [image](desktop-right-inverted.png) | [image](desktop-right-complete.png) | [image](desktop-right-mixed-impact.png) | [upright](desktop-right-retry-upright.png), [opposite roll](desktop-right-retry-opposite-roll.png) |
| Mobile left | [image](mobile-left-quarter.png) | [image](mobile-left-inverted.png) | [image](mobile-left-complete.png) | [image](mobile-left-mixed-impact.png) | [upright](mobile-left-retry-upright.png), [opposite roll](mobile-left-retry-opposite-roll.png) |
| Mobile right | [image](mobile-right-quarter.png) | [image](mobile-right-inverted.png) | [image](mobile-right-complete.png) | [image](mobile-right-mixed-impact.png) | [upright](mobile-right-retry-upright.png), [opposite roll](mobile-right-retry-opposite-roll.png) |

Safe landing images are also retained for each direction/viewport. The tests check the full signed turn
before touchdown, reset to zero on safe touchdown, preserved mixed terminal angles against the saved replay,
and a new opposite roll after Retry. Keyboard and touch adapters receive their normal events; no simulation
state is injected into the browser. Playwright's clock controls observation so a short rotation remains visible
on a software renderer. These screenshot frames are **not performance samples**.

The six existing crash cases also pass: hidden-tab freeze, two retries and single replay recording,
Reduced Motion pixel equality, and a late front-flip landing. The updated terminal landing is captured in
[desktop](desktop-landing-impact.png) and [mobile](mobile-landing-impact.png); static Reduced Motion captures
are [desktop](desktop-reduced-impact-start.png) and [mobile](mobile-reduced-impact-start.png).

The orchestrator independently viewed actual desktop left/right quarter/inversion/completion, mixed impact
and Retry images, plus mobile inversion and mixed impact. This accepts visible rotation and retained pose;
it is not a numeric measurement of angles from pixels. Independent code review found no blocker in the
quaternion order, COM compensation, per-tick snapshot reset or terminal crash selection.

## Static and simulation checks

Node 24.19.0 / pnpm 12.11.2 frozen install, typecheck, lint/boundaries, format, production build and size pass.
The shared gate passed **237 unit tests**, including **90 sim tests**. Focused presentation coverage passed
**27/27**: signed basis vectors, noncommuting mixed axes, world COM for negative/multiple turns, safe road,
roof, platform and buffered relaunch, opposite queued rotation, replay round-trip and terminal crash/reset.
The integrated crash nose-down geometric regression remains intact. Simulation fixtures, golden rationale
and the two explicit product-default flags are documented by the sim owner in the task card and DECISIONS.

## Production performance smoke

Both reports preserve the exact clean measured `e96d8ff` metadata, with `passed: true`, `errors: []`, and
strict production CSP. Each measures 90 seconds of real wall-clock input, normal crashes and Retry. The
matching Low-profile comparisons against `docs/reviews/P3-00C/perf-{desktop,mobile}.json` pass, as do the
150 draw / 300,000 visible triangle hard caps. JS is **216,212 bytes gzip (211.1 KiB)**, below 400 KB.

| Profile | Report | Max draws | Max triangles | Active frames / time | Runs / retries | Farthest run |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Desktop Low | [JSON](perf-desktop.json) | 97 | 89,150 | 337 / 62.58 s | 21 / 20 | 73 m |
| Mobile Low emulator | [JSON](perf-mobile.json) | 94 | 94,910 | 937 / 54.16 s | 31 / 30 | 150 m |

No invalid or overflow frames occurred. End-of-run captures are [desktop](perf-desktop.png) and
[mobile](perf-mobile.png). Source report screenshot paths refer to their original ignored `perf-report/`
location; the PNGs are copied here unchanged.

```sh
PW_CHROMIUM_EXECUTABLE=/usr/bin/chromium pnpm perf:smoke --duration 90 --viewport desktop --quality low --baseline docs/reviews/P3-00C/perf-desktop.json --output perf-report/barrels-desktop.json
PW_CHROMIUM_EXECUTABLE=/usr/bin/chromium pnpm perf:smoke --duration 90 --viewport mobile --quality low --baseline docs/reviews/P3-00C/perf-mobile.json --output perf-report/barrels-mobile.json
```

Chromium 154.0.8037.57 uses ANGLE SwiftShader software rendering. Observed p50/p95 are 183.3/216.8 ms on
desktop and 50.1/83.3 ms in mobile emulation; these are informational, not phone FPS evidence. Barrel rolls
change natural input-script outcomes and thus run coverage. These samples cover early traffic only, not
late-game density or representative full progression. Sustained High-profile timing, physical-phone GPU
performance, GPU texture bytes and GC pauses remain unmeasured. Firefox/WebKit were not run locally for
this card; deterministic cross-engine CI is a separate gate. No merge or deployment is authorized here.
