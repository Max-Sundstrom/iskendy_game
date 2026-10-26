# Progress log

One line per finished task: `YYYY-MM-DD · <ID> · <owner> · <one-sentence outcome> · <PR link>`

- 2026-10-23 · KIT · Orchestrator · Docs kit created (AGENTS, CLAUDE, GDD, ARCHITECTURE, ROADMAP, ASSETS, PROMPTS, DECISIONS).
- 2026-10-23 · KIT-v0.2 · Orchestrator · Added ART_DIRECTION, SECURITY, INFRASTRUCTURE, SCENARIOS, EMBEDDING, TEST_STRATEGY, AGENT_SYSTEM; Phases A and D0.
- 2026-10-23 · A-01 (partial) · Orchestrator · Recorded answers: Iskendi embedded edition, rewards later; car choice from photos in progress.
- 2026-10-23 · REPO · Orchestrator · Kit imported into Max-Sundstrom/iskendy_game; owner answers recorded as ADR-018 (Q4 answered, Q15 added).
- 2026-10-23 · A-01 · Orchestrator · Owner answers: no ranking in v1, hosting in Russia, car concept B chosen (ADR-019).
- 2026-10-23 · A-01 · Orchestrator · Owner answers: run end and results, promo code display, all bonus mechanics (ADR-020); Q16 added.
- 2026-10-23 · A-07 · Orchestrator · Consistency review: 29 contradictions fixed, docs marked v1.0 RC, ADR-021 hosting proposed, Q17–Q19 added; Architecture v1.0 sign-off page ready (`docs/ARCHITECTURE_V1_SIGNOFF.ru.md`).
- 2026-10-23 · A · Owner · Architecture v1.0 and hosting approved (ADR-022): docs v1.0, ADR-021 accepted; Phase A signed, P0 ready.
- 2026-10-23 · P0-01 · Orchestrator · pnpm monorepo (sim, shared, content, web), TS strict, ESLint + Prettier, Vitest, Playwright, dependency-cruiser boundaries proven by failing fixtures; versions pinned (14-day rule enforced by pnpm).
- 2026-10-23 · P0-03 · Orchestrator · zod tuning schema with path-level errors and cross-field rules; DEFAULT_TUNING loaded in the sim; tuningHash (FNV-1a 64, sim section only) pinned and cross-checked in Python.
- 2026-10-23 · P0-05 · Orchestrator · PR template (handoff note + DoD) and issue forms for bug, feel and perf.
- 2026-10-23 · P0-02 · Orchestrator · GitHub Actions CI: checks, build with bundle-size and no-source-map gate, Playwright smoke on two viewports; actions pinned by SHA.
- 2026-10-23 · P0-04 · Orchestrator · assets/ structure, LICENSES.json schema and validator, brand-name scan, assets:check in CI, assets:build stub.
- 2026-10-23 · P0-07 · Orchestrator · Security workflow (gitleaks, Semgrep with proven project rules, CodeQL, OSV), Renovate config, Caddyfile header skeleton checked against a local Caddy, owner settings runbook.
- 2026-10-23 · P0-08 · Orchestrator · Game container (Caddy, nobody, healthcheck), kill switch KOMETA_MODE=off, reproducible release archive + GitHub Release on tags, CI container job with live headers and embed E2E; Trusted Types enforced; deploy, kill-switch and rollback runbooks.
- 2026-10-23 · D0-1…D0-4 · Orchestrator · Design lab (apps/lab) with art board, A/B/C blockouts + liveries, style-test chunk with frame-time readout, HUD/results frames; 28 captures in docs/reviews/art-D0; owner review page published; D0-5 sign-off open.
- 2026-10-23 · D0-5 · Owner · Design Agreement signed (ADR-023); hard gate open, P1 starts.
- 2026-10-23 · P1-01 · Orchestrator · Sim core: seeded RNG, LUT speed curve, lanes and lane change (G1/G2), origin shift, state hash; 10 000-tick hash identical in Node and Chromium.
- 2026-10-23 · P1-02 · Orchestrator · Jump (exact kinematics), fly with glide easing and ceiling, slam, boost, AIR costs/regen; G3, G5; goldens logged under ADR-024.
- 2026-10-23 · P1-03 · Orchestrator · Traffic SoA, director v0 rows, swept collisions (crash, scrape, roof hop); 100k-step no-tunnelling fuzz; vehicles moved into the hashed tuning.
- 2026-10-23 · P1-04 · Orchestrator · Grey-box renderer: fixed-step loop with interpolation, chase cam (portrait-aware), road chunks, instanced traffic, floating origin, #perf readout; clean under the strict CSP.
- 2026-10-23 · P1-05 · Orchestrator · Playable loop: keyboard + swipe input with latch, BOOST button, DOM HUD, results with local best and ISK promo code, Retry; Russian by default; e2e start→crash→retry on both viewports.
- 2026-10-23 · P1-06 · Orchestrator · Replays: recorder/player, replay:verify, three golden replays, tamper suite, in-game recording; cross-engine CI job for WebKit and Firefox.
- 2026-10-23 · P1-08 · Orchestrator · Novice and Chaos bots with a nightly dashboard; first report: Novice median 498 m (target 600), nobody past ~850 m — input for P2-06/P2-10.
- 2026-10-23 · P1-07 · Orchestrator · Provisional feel review from numbers and bots with four tuning deltas; owner playtest checklist for the P1 exit gate.
- 2026-10-23 · P3-00 · Orchestrator · Owner feedback (ADR-026): detailed procedural car and 13 traffic models, roadside and horizon, cold-gas vapour from the nozzles, launch gantry intro with 3-2-1, BOOST visibly working; 108 draws in the run.
- 2026-10-23 · P2-01/P2-02a + P3-00 r2 · Orchestrator · Platforms, hop chains, CLEAR; front flips and landing grades; C-shaped launch ramp like the reference demo, whole-car pose, double tap to flip, smoother cars, trees and buildings (ADR-027).
- 2026-10-23 · P1-09 · Codex + independent QA · Preserved per-tick input edges and replay masks; controlled-clock double input verifies safe landing. Exact-head CI green; P2 initially integrated into main as fbc1b2d. · [PR #1](https://github.com/Max-Sundstrom/iskendy_game/pull/1)
- 2026-10-23 · P0-09 · Codex + independent QA · Reproducible 90 s perf smoke, bounded reports and interrupted-cleanup regression; both exact-head CI runs passed, draft only. · [PR #2](https://github.com/Max-Sundstrom/iskendy_game/pull/2)
- 2026-10-23 · P3-00B · Codex + independent visual QA · Original hero/traffic refinement within geometry/material budgets, both viewport captures and 90 s reports; both exact-head CI runs passed, draft only. · [PR #3](https://github.com/Max-Sundstrom/iskendy_game/pull/3)
- 2026-10-26 · P3-00C · Codex + independent QA · Crash/hidden/Retry checks retained; one-worker configuration passed complete exact-head CI 40338232302 at 958ab89; draft, not merged. · [PR #4](https://github.com/Max-Sundstrom/iskendy_game/pull/4)
- 2026-10-26 · P2-02b/P2-03a/P2-03b · Codex + independent QA · Barrels, fractional score/streaks and actual near miss have complete exact-head CI at c6f370c / 9f250bb / 8e19074; draft, not merged. · [PR #5](https://github.com/Max-Sundstrom/iskendy_game/pull/5), [PR #6](https://github.com/Max-Sundstrom/iskendy_game/pull/6), [PR #8](https://github.com/Max-Sundstrom/iskendy_game/pull/8)
- 2026-10-26 · P2-04a1 · Codex + independent QA · Internal clock with 166278 independent comparisons; both CI runs green at eea81ae, runtime not wired. Actual keyboard/synthetic-touch route preparation validated separately on unchanged P2-03b. · [PR #10](https://github.com/Max-Sundstrom/iskendy_game/pull/10)
