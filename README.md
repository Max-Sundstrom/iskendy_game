# KOMETA starter kit — AI-agent docs for a 3D web highway runner

This folder is the "brain" of the project. Drop it into an empty repository root
before any code exists. Every AI agent (Claude Code, OpenAI Codex / ChatGPT, Cursor)
reads these files and works as one small studio.

## What's inside

| File | Purpose |
|---|---|
| `AGENTS.md` | Canonical rules for every agent: stack, invariants, roles, delegation protocol, Definition of Done. Codex reads it automatically. |
| `CLAUDE.md` | Claude Code entry point. Imports `AGENTS.md`, adds the Claude workflow and subagent routing. |
| `.claude/agents/*.md` | 14 Claude Code subagents (sim, render, UI, tech-artist, audio, backend, QA, critic, perf, license, review, release, security, art director). |
| `docs/GDD.md` | Game design document reverse-engineered from the 20 reference screenshots, plus our additions. |
| `docs/ARCHITECTURE.md` | Technical design: deterministic sim, renderer, UI, input, backend, anti-cheat, budgets, tests. |
| `docs/ROADMAP.md` | Phases 0–7 with task IDs, owners, acceptance criteria and exit gates. |
| `docs/ASSETS.md` | 3D model research with license verdicts, hero car spec, Blender + glTF pipeline, license ledger. |
| `docs/PROMPTS.md` | Copy-paste prompts for each phase — Claude Code and ChatGPT versions — plus specialist prompts. |
| `docs/DECISIONS.md` | Architecture decision records and open questions. |
| `docs/ART_DIRECTION.md` | "Moscow Vice" look, palette, world archetypes, vehicle concepts A/B/C, Design Agreement checklist. |
| `docs/SECURITY.md` | Threat register (STRIDE), anti-cheat, web security baseline, privacy and compliance notes. |
| `docs/INFRASTRUCTURE.md` | Topology, load scenarios with capacity math, caching, SLOs, DR, cost guardrails. |
| `docs/SCENARIOS.md` | Catalogue of journeys, edge cases, platform, network, abuse, ops, embedding, rewards, privacy scenarios. |
| `docs/EMBEDDING.md` | Running inside a host page (Iskendi order tracking, portals, Telegram): isolation and message protocol. |
| `docs/TEST_STRATEGY.md` | Test layers, synthetic players, security tests, release gates. |
| `docs/AGENT_SYSTEM.md` | Multi-agent workflow: Claude Code orchestration, Codex night batches, cross-model review. |
| `packages/content/tuning.default.json` | Every gameplay number in one place (starting values derived from the screenshots). |

## Current scope

v1 is the Iskendi "play while you wait" edition: a static client embedded from the "Сыграть" card, guests only,
no game server and no leaderboards (ADR-016, ADR-019, ADR-020 in `docs/DECISIONS.md`). Owner sign-off page:
`docs/ARCHITECTURE_V1_SIGNOFF.ru.md`.

## Developer setup

Node ≥ 22.12 (CI uses 24) and pnpm 12.11.2. Corepack 0.34 cannot run pnpm 12 yet, so install it with
`npm i -g pnpm@12.11.2`. Then `pnpm i` and the commands in `AGENTS.md §5`. In a container with a preinstalled
Chromium that doesn't match Playwright, run E2E with `PW_CHROMIUM_EXECUTABLE=<path to chrome> pnpm test:e2e`
instead of downloading browsers.

## Performance smoke

`PW_CHROMIUM_EXECUTABLE=/path/to/chromium pnpm perf:smoke` builds the game, serves an isolated local production
preview, drives a fixed keyboard script for **90 seconds of real wall time**, retries naturally after crashes,
and writes `perf-report/desktop.json` plus a screenshot. The command owns and closes its browser/server.
Use `--viewport mobile` for 390×844 (desktop is 1440×900), `--quality high`, `--seed 5`, `--output <file.json>`
or `--url http://localhost:8080` to measure an already running build. `--duration 5` is only a quick harness check;
it does not replace the full run. No new dependencies or browser downloads are performed by the command.

The JSON includes active-play frame p50/p95, max draw calls/triangles, coverage, input/retry counts, browser/GPU,
V8 heap and local JS gzip bytes. It fails on empty/inactive samples, browser errors, or geometry above
150 draws / 300k triangles. Frame milliseconds on headless software rendering are **informational**, not phone
performance. Wall-timed inputs can land on different simulation ticks across machines, so this smoke is not a
determinism replay or a complete late-game/device profile. `--baseline <previous.json>` additionally rejects
geometry growth over 10% for the same seed/duration/viewport/quality; it never gates timing. CI artifact upload
and a maintained main-branch baseline are separate integration work; this command does not claim either exists.

The existing `#perf` overlay now uses CSP-compatible stylesheet rules. Its internal snapshot/reset events change
diagnostic counters only; they never change the simulation or disable collisions. The owned preview applies the
deployment CSP from `deploy/Caddyfile` with standalone `frame-ancestors 'none'`; enforced and report-only CSP
violations, WebGL context loss and page crashes fail the command. An external URL retains its own policy, which
is recorded in the report. The smoke does not replace the container's response-header tests.

## How to start

1. Phase A: answer the open questions in `docs/DECISIONS.md` and sign off the architecture (prompt "Phase A").
2. Phase D0: agree on the look and the car (prompts "Phase D0"); sign ART_DIRECTION §9.
3. Only then: Claude Code, prompt **P0** from `docs/PROMPTS.md`.
4. ChatGPT / Codex: Codex picks up `AGENTS.md` automatically; in plain ChatGPT, attach `AGENTS.md`
   plus the docs named in the prompt and use the ChatGPT variant of each prompt.
5. Work phase by phase. Don't skip exit gates — determinism and fairness tests are what make
   leaderboards, replays and balancing possible later.

"KOMETA" is a working codename. Rename freely (search-and-replace `KOMETA`, `Kometa`, `kometa`).
