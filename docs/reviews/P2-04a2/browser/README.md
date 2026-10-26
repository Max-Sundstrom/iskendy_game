# P2-04a2 — Production browser route, pause and Retry

**PASS, one run per profile:** desktop keyboard **70.720 s**, mobile synthetic multi-pointer touch **26.313 s**, each within the unchanged 120 s watchdog. Both used the actual production input adapters and the app's normal crash/results recorder export. No source, simulation state, controls or session was injected or changed.

The measured candidate was **uncommitted runtime on base `b1d80d1a2e8e0a73389df1ac5fdba201b8cc218a`**, not that commit alone. Its 89 production-source blobs and the corrected sweep blob `70fc9d11de12e20f107f7569dd5279cb43c7559b` were pinned before/after. The served JS was `index-DA6YPkha.js`, SHA-256 `8e2da9abd328dcd556eed4526565959352ba6916c05b80c68057a8e53c50569f`; index SHA-256 `cea9a4a17ffb24dd8751c5cb6445f828eef3dbef655dabd029269210abacf301`. [Summary](summary.json) retains the complete manifest, exact replay masks, hashes, timing, error arrays and references. A later final commit must be shown to contain these same production blobs before inheriting this result.

Both real saved replays matched the independently accepted seed 1 route, including **all 50 input transitions** (last release at input tick 589):

| Post-step tick | Replay-confirmed event |
| --- | --- |
| 525 | LIFTOFF starts with 300 active ticks; meter consumed; finite AIR 219 L |
| 610 | Actual protected road landing is STUNT; finite AIR remains 219 L |
| 688 | One SMASH, vehicle type 0, chain 1 |
| 825 | Active ends; 60 grace ticks begin |
| 885 | Grace ends |
| 928 | Natural rear crash; hash `66e41f15`, score 18 828, distance 638.4743759294411 m |

At tick 625, after all controls were released, the existing visibility adapter was exercised by setting `document.hidden` and dispatching `visibilitychange`. Advancing the public clock by 5000 ms while hidden left DOM observations and PNG bytes identical in both viewports. Resuming preserved the exact 50-transition replay and timer trajectory. This is **emulated visibility**, not a physical phone app switch.

A real Retry button click/tap then produced a fresh seed 2 run. Its first rendered tick showed score 0, distance 0 and AIR 600. It naturally crashed at tick 284, exported a second valid replay with no inputs, hash `7927b6d5`, meter 0 and all mode fields zero. The first replay was preserved and local best remained 18 828 at the winning distance.

## What the screenshots show

The green traffic vehicle is visible immediately ahead at tick 687 and absent at tick 688 while the player's car continues. Coordinator and independent review inspected this pair. The mobile activation checkpoint shows the rotating car and finite AIR 219; fresh Retry shows the reset HUD. These pixels corroborate visible behavior, **not a visible mode timer or AIR∞ indicator**: this older HUD does not yet provide them.

[Desktop before SMASH](desktop-keyboard-before-smash.png) · [desktop after SMASH](desktop-keyboard-after-smash-replay-proven.png) · [mobile activation checkpoint](mobile-touch-mode-start-replay-proven.png) · [mobile fresh Retry](mobile-touch-fresh-retry-tick1.png)

Both profiles used Chromium 154.0.8037.57, low quality, the existing `intro=0` entry, desktop 1440×900 DPR 1 and mobile 390×844 DPR 3. Document/CSS/JS returned HTTP 200 under strict CSP with no bypass; page/console/request/CSP error arrays are empty. HUD/results visibility was explicitly checked. Both trace ZIPs passed CRC inspection. Browser, contexts and local preview closed; the owned port 5188 refused connections afterward. Independent read-only QA found no blocking harness defect.

The clock advances discrete frames: a 100 ms `fastForward` reaches the production five-step cap and drops excess backlog. Exact recorder equality proves the intended ticks; this is **not normal-cadence, full-motion or performance acceptance**. Synthetic touch events are untrusted PointerEvents through the real adapter, not physical-device evidence. The current renderer predates the separate PR #3 model refinement; no new-model, SMASH VFX, rocket, audio, mode HUD or infinity-indicator acceptance is claimed.

Full runners/oracles, both run and Retry replays, 24 screenshots and two traces remain in `/workspace/scratch/P2-04a2-browser/`. Only this compact report and four reviewed PNGs are prepared for repository evidence; the 12.25 MB desktop trace stays outside Git. No browser retry, source edit, dependency install, deployment, publication preview/archive, performance smoke or full cross-engine/E2E matrix was performed by this task. Those gates remain separate.
