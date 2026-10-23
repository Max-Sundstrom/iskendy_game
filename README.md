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

## How to start

1. Phase A: answer the open questions in `docs/DECISIONS.md` and sign off the architecture (prompt "Phase A").
2. Phase D0: agree on the look and the car (prompts "Phase D0"); sign ART_DIRECTION §9.
3. Only then: Claude Code, prompt **P0** from `docs/PROMPTS.md`.
4. ChatGPT / Codex: Codex picks up `AGENTS.md` automatically; in plain ChatGPT, attach `AGENTS.md`
   plus the docs named in the prompt and use the ChatGPT variant of each prompt.
5. Work phase by phase. Don't skip exit gates — determinism and fairness tests are what make
   leaderboards, replays and balancing possible later.

"KOMETA" is a working codename. Rename freely (search-and-replace `KOMETA`, `Kometa`, `kometa`).
