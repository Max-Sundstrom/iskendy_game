# KOMETA — Decisions (ADR log) and open questions

Format: ID · status · decision · why · alternatives considered. New decisions append; superseded ones stay
with a pointer to the replacement.

## ADR-001 · accepted · Stack
TypeScript, Vite, three.js (WebGLRenderer), React 19 + Zustand for the UI shell, howler.js, zod, Vitest +
fast-check, Playwright, Fastify + PostgreSQL + Drizzle.
**Why:** instant web reach on mobile; small payload; full control of the game loop; the owner already knows
React + Zustand; one language end to end so the server can run the same sim for validation.
**Alternatives:** Unity WebGL (large download and slow mobile startup for a 2-minute arcade game);
Babylon.js (solid; three.js picked for ecosystem and smaller core); PlayCanvas (editor-centric workflow);
React Three Fiber for gameplay (reconciler overhead and indirection in a 60 Hz loop — unnecessary here).

### Pinned versions (fill in at P0-06)
| Package | Version | Date pinned |
|---|---|---|
| node (LTS) | | |
| pnpm | | |
| typescript | | |
| vite | | |
| three | | |
| postprocessing | | |
| react / react-dom | | |
| zustand | | |
| howler | | |
| zod | | |
| vitest / fast-check | | |
| @playwright/test | | |
| fastify / drizzle-orm / pg-boss | | |
| @gltf-transform/cli | | |
| Blender | | |

## ADR-002 · accepted · Deterministic fixed-step simulation in its own package
**Why:** enables input-log replays (tiny files), server-side score validation, shared weekly seeds, headless
balance testing and golden-replay regression tests.
**Cost:** discipline — no clocks, no Math.random, no transcendental Math in the sim; LUTs instead.

## ADR-003 · accepted · No physics engine
Arcade kinematics in lane space with swept AABB collisions.
**Why:** the game is lane-based; a rigid-body engine adds payload, tuning difficulty and cross-platform
determinism risk without gameplay benefit. Visual wobble and debris are renderer-only.

## ADR-004 · accepted · HUD hot path outside React renders
**Why:** per-frame React reconciliation of score/AIR/timers costs frame time on low-end phones.

## ADR-005 · accepted · Asset strategy
Original hero car built in Blender; traffic from Kenney Car Kit (CC0) restyled plus original Soviet-inspired
bodies; selected CC-BY models with credit; mandatory license ledger with proof.
**Why:** no game-ready, commercially clean low-poly Soviet car was found (see ASSETS.md §2); the hero needs a
custom node structure anyway.

## ADR-006 · accepted · Original theme and names
Soviet space-age retrofuturism; no real brand, model or product names in shipped content.
**Why:** avoid trademark/trade-dress issues and avoid looking like a clone of the reference game.

## ADR-007 · accepted · Portable backend
Docker image + Postgres; host and region chosen by the target audience (open question 4).

## ADR-008 · accepted · Portrait-first mobile layout
Portrait primary on phones, landscape supported; desktop uses keyboard with optional key hints.

---

## ADR-009 · proposed · Visual direction "Moscow Vice"
Fictional Moscow-inspired city (Kometograd) with a GTA VI–trailer mood; archetypes not replicas; strict IP
guardrails. Details: ART_DIRECTION.md. **Needs Design Agreement (D0-5).**

## ADR-010 · accepted · Run tickets
Server issues the seed at run start; one submission per ticket. Stops seed shopping (SECURITY T3).

## ADR-011 · accepted · Valkey for leaderboards and rate limits
Sorted sets give O(log n) ranks and "around me"; Postgres stays the source of truth.

## ADR-012 · accepted · Game service isolated from host products
Separate origin, deploy, database and credentials; postMessage contract; kill switch. Host backends
(e.g. Iskendi FastAPI) are not modified unless rewards are enabled (EMBEDDING.md).
Node for the game service (not Python) because replay validation must run the exact TypeScript sim.

## ADR-013 · accepted · Multi-agent development system
Claude Code orchestrates, reviews, tests and deploys; Codex implements (including night batches); cross-model
review; least-privilege agents; human gates (AGENT_SYSTEM.md).

## ADR-014 · accepted · Synthetic players for balance and robustness
Headless bots on the real sim produce nightly balance dashboards and fuzz the game (TEST_STRATEGY §3).

## ADR-015 · accepted · Submit only meaningful runs
Clients submit personal bests, board-eligible runs and achievement syncs; cuts validation load ~4×.

## ADR-016 · accepted · v1 scope: Iskendi "play while you wait" edition
The game ships first inside the Iskendi order-tracking flow (EMBEDDING.md §5). Consequences: in-store load
profile (L1) is primary; Lite asset set and lazy embed are mandatory; order-ready interrupt and run resume are
v1 features; Iskendi branding via a content pack (courier livery, dürüm pickups, billboards, premise).
A public standalone build is deferred; the architecture keeps it possible.

## ADR-017 · accepted · Rewards deferred
No promo codes or discounts in v1. Validated runs carry a reward-eligibility flag and identities can later be
linked to an Iskendi customer id, so rewards can be added without reworking anti-cheat. Legal review of
promotion mechanics happens before enabling them.

## Open questions (owner) — defaults are used until answered

| # | Question | Default |
|---|---|---|
| 1 | How does a run end: crash only, or also a Route mode with a destination? | Endless in v1; Route mode in v1.1 |
| 2 | What does ITEM do (reference shows an eye icon)? | RADAR, MAGNET, SHIELD, EMP |
| 3 | Final title, premise text and hero car name | KOMETA / pies-to-the-dacha premise / Kometa R |
| 4 | Sign-in providers and backend region | Guest only in v1.0; providers added in P5-04 once chosen |
| 5 | Portrait only, or landscape too? | Both, portrait first |
| 6 | LIFTOFF automatic or manual? | Automatic; manual in settings |
| 7 | Distribution targets | Own site PWA; portal adapters later |
| 8 | Monetisation | None in v1 |
| 9 | Scope: standalone, embedded in Iskendi order tracking, or both? | **Answered 2026-10-23: Iskendi "play while you wait" (embedded).** Standalone deferred |
| 10 | Real rewards (promo codes/discounts) for scores or achievements? | **Answered 2026-10-23: later.** v1 keeps hooks only (reward-eligibility flag on validated runs); no issuance |
| 11 | Vehicle concept A / B / C (ART_DIRECTION §8) | Owner is choosing from reference photos of real Soviet/modern cars; blockouts follow the choice |
| 12 | Fictional city with archetypes, or recognisable real landmarks? | Fictional Kometograd, archetypes only |
| 13 | Audience and hosting region | Decide in A-04 after Q9 |
| 14 | How strong is the GTA VI-style saturation vs a calmer palette (or Iskendi brand moderation)? | Full "Moscow Vice" palette; brand only on billboards/livery/UI chrome |

## Change log
- 2026-10-23 — Kit created from reference screenshot analysis.
- 2026-10-23 — v0.2: Moscow × GTA VI-inspired direction (proposed), security/anti-cheat, infrastructure and
  load model, scenario catalogue, host embedding contract, test strategy, multi-agent system, Phases A and D0.
- 2026-10-23 — Owner answers: Q9 Iskendi embedded edition; Q10 rewards later; Q11 choosing from photos.
