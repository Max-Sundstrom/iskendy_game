# CLAUDE.md — Project KOMETA

@AGENTS.md

The import above is the canonical rule set. This file adds only how Claude Code works in this repo.

## Working loop

1. Start from a task card (`docs/tasks/<ID>.md`). If none exists and the work spans more than one package,
   write the card first using the template in AGENTS.md §9.
2. For multi-file changes, plan before editing (plan mode). Name the subagents you will use and their order.
3. Freeze shared contracts in `packages/shared` before delegating parallel work.
4. Delegate by ownership (table below). Keep the main session for orchestration, integration and final review.
5. Verify: `pnpm typecheck && pnpm lint && pnpm test`. Sim work adds `pnpm test:sim`. Render/UI work adds
   `pnpm perf:smoke` plus Playwright screenshots at 1440×900 and 390×844 portrait.
6. Fill in the handoff note, update ROADMAP status, append one dated line to `docs/PROGRESS.md`.

## Subagent routing (`.claude/agents/`)

| The task is about… | Delegate to |
|---|---|
| movement, collisions, scoring, streaks, modes, pickups, spawn director, replays, tuning schema | `sim-engineer` |
| scene, camera, VFX, shaders, instancing, chunk streaming, set pieces, quality tiers | `render-engineer` |
| screens, HUD binder, touch/keyboard/gamepad input, settings, i18n, accessibility | `ui-engineer` |
| Blender models, LODs, atlas, glTF pipeline, license ledger entries | `tech-artist` |
| SFX, music stems, mixing, haptics | `audio-designer` |
| API, identity, leaderboards, replay validation, weekly seed (deferred in v1, ADR-019) | `backend-engineer` |
| test plans, golden replays, E2E, property tests, device matrix | `qa-engineer` |
| CI/CD, PWA, deploy, error reporting, portal adapters | `release-engineer` |
| "Does this feel good? Does it match the GDD?" | `game-design-critic` (read-only) |
| frame time, memory, bundle size, load time | `perf-auditor` |
| licenses, attribution, brand-name scan | `license-auditor` (read-only) |
| any non-trivial diff before merge | `code-reviewer` (read-only) |
| threats, auth, parsing untrusted input, headers/CSP, anti-cheat, dependencies, CI security | `security-engineer` |
| palette, lighting, look of any asset or screen, Design Agreement | `art-director` |

Run subagents in parallel only when their write paths don't overlap.

## Pre-production first

Phases A (architecture and scenarios) and D0 (Design Agreement) must be signed before gameplay code. If asked to
start P1+ earlier, point to ROADMAP's hard gate and ask the owner to confirm the exception.

## Night batches with Codex

Follow AGENT_SYSTEM.md §4: prepare ≤ 3 independent cards (the WIP limit) with frozen contracts in the evening; in the morning,
review each Codex PR with `code-reviewer` + `qa-engineer` (+ security/perf/license when the card lists them).

## Context hygiene

- One roadmap task per session where possible. Before ending, make sure the handoff note lets the next
  session start cold.
- Read long docs by section (GDD and ARCHITECTURE are large). Don't load every doc for a small task.
- Reference file paths instead of pasting large generated files into the conversation.

## Connectors and tools

- If a Blender connector (MCP) is available, `tech-artist` builds and exports models through it. Otherwise it
  writes bpy scripts in `tools/blender/` and runs Blender headless: `blender -b <file>.blend -P <script>.py`.
- If a Figma connector is available, HUD and menu mockups may be pulled from Figma; layout truth is still GDD §14.
- Use Playwright for visual checks; attach screenshots to the handoff note.
- Claude in Chrome can run exploratory tests on staging in a real browser (never on production with real accounts).
- HyperFrames (HeyGen) can turn captured gameplay into vertical promo reels once the look is final.
- Store approval boards and signed checklists in Google Drive and record the links in DECISIONS.md.

## Project-specific gotchas

- three.js: dispose geometries, materials and textures on chunk unload; share materials across instanced
  traffic; no `new Vector3()` inside per-frame code.
- iOS Safari: audio unlocks only after a user gesture (the Play button does it); block pinch-zoom and
  overscroll on the game surface; respect safe-area insets; auto-pause on `visibilitychange`.
- A golden replay failing after a "visual only" change means presentation code leaked into the sim. Fix the
  leak; never update the golden to hide it.
- Never change sim behaviour to make a test pass without a `SIM_VERSION` bump and a note in DECISIONS.md.
