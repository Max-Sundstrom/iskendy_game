# P0-09 browser evidence

Measured on 2026-10-23 with Node 24.19.0, pnpm 12.11.2 and Chromium 154.0.8037.57 / ANGLE SwiftShader.
The full reports record an instrumented dirty worktree based on `0a721d6`, before final commit/rebase. PNG paths in JSON
retain their original generated locations; the corresponding screenshots are adjacent here.

| Profile | Wall time | Active / rendered frames | Maximum draws / triangles | Natural retries | Maximum distance |
|---|---:|---:|---:|---:|---:|
| [Desktop JSON](desktop.json) · [PNG](desktop.png) | 90.019 s | 384 / 419 | 97 / 90314 | 20 | 92 m |
| [Mobile JSON](mobile.json) · [PNG](mobile.png) | 90.001 s | 1321 / 1389 | 95 / 100982 | 19 | 319 m |

Both use seed 5, low quality and a fixed 500 ms script through production keyboard handlers. Repeated short runs
are early-game coverage, not a full late-game density profile. Frame milliseconds are informational; static/unit
checks overlapped part of desktop measurement. No phone performance, GPU bytes or GC-pause claim is made.

Independent QA inspected both full reports/screenshots and verified exit code 1 / `passed:false` for real
[page exceptions](pageerror.json), [strict-CSP violations](csp.json) and [WebGL context loss](context-loss.json).
These deliberately failed reports are evidence that the gates reject failures, and are not valid baselines.

After fixing competing Playwright/Vite auto-exit signal handlers, independent QA completed the owner's authorized
single targeted repeat: [SIGTERM](sigterm.json) and [SIGINT](sigint.json) each exit 1 with `passed:false` and
`Performance smoke interrupted`. Owned ports closed; all observed browser descendants stopped (10 / 9).
A subsequent [8.001-second success](short-success.json) exited 0 with 28 active samples, 97 draws / 92306 triangles,
and verified server/browser cleanup. [QA summary](qa-summary.json) records exit codes and cleanup evidence.
These lifecycle checks used `c67ede4` with the uncommitted scoped fix. Interrupted reports and the short success
do not replace the full 90-second measurements. See the [task card](../../tasks/P0-09.md) for limits and remaining CI.
