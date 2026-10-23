# P0-09 browser evidence — checkpoint

Measured on 2026-10-23 with Node 24.19.0, pnpm 12.11.2 and Chromium 154.0.8037.57 / ANGLE SwiftShader.
Reports record an instrumented dirty worktree based on `0a721d6`, before final commit/rebase. PNG paths in JSON
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

**Not complete:** SIGTERM exited 143 before writing JSON. Disabling Playwright signal handlers is applied but
unverified; Vite preview's own auto-exit signal handler still needs correction. Retry is paused under the
repository's two-attempt escalation rule. See [task card](../../tasks/P0-09.md) for the exact pending action.
