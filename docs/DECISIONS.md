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
Rule: the newest stable release published at least 14 days before pinning (SECURITY T15); pnpm enforces it with
`minimumReleaseAge` in `pnpm-workspace.yaml`. Rows filled in P0-01; the rest arrive with the task that adds them.

| Package | Version | Date pinned |
|---|---|---|
| node (LTS) | 24 in CI (`.node-version`); ≥ 22.12 supported (`engines`) | 2026-10-23 |
| pnpm | 12.11.2 (`packageManager`) | 2026-10-23 |
| typescript | 6.0.3 — not 7.x: typescript-eslint 8.71 supports TypeScript < 6.1 | 2026-10-23 |
| vite | 8.3.4 | 2026-10-23 |
| three | 0.186.1 (lab now; game in P1-04) | 2026-10-23 |
| postprocessing | 6.39.5 | 2026-10-23 |
| react / react-dom | | |
| zustand | | |
| howler | | |
| zod | 4.6.5 | 2026-10-23 |
| vitest / fast-check | 5.0.3 / 4.10.2 | 2026-10-23 |
| @playwright/test | 1.64.0 | 2026-10-23 |
| eslint / @eslint/js / typescript-eslint / globals | 10.12.0 / 10.0.1 / 8.71.1 / 17.13.0 | 2026-10-23 |
| prettier | 3.9.9 | 2026-10-23 |
| dependency-cruiser | 18.5.0 | 2026-10-23 |
| tsx / @types/node | 4.23.15 / 26.6.4 | 2026-10-23 |
| fastify / drizzle-orm / pg-boss | | |
| @gltf-transform/cli | | |
| CI actions | checkout v7.0.1 · setup-node v7.1.0 · upload-artifact v7.0.2 · codeql-action v4.38.3 · osv-scanner-action v2.6.0 (all by SHA) | 2026-10-23 |
| security tools | gitleaks 8.30.1 (sha256) · Semgrep 1.180.0 (image digest) | 2026-10-23 |
| caddy (game container) | 2.11.6-alpine @ sha256:d44355d3… (deploy/Dockerfile) | 2026-10-23 |
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

## ADR-009 · accepted (ADR-023) · Visual direction "Moscow Vice"
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
*Clarified by ADR-019/020 (A-07):* v1 has no run validation, so the reward-eligibility flag arrives with the
online layer; the v1 promo code is display-only and is not a promo code in the sense of this ADR.

## ADR-018 · accepted · Owner answers 2026-10-23 (repository, identity, ranking, devices)
- The game launches from the **"Сыграть" (Play) card** on the Iskendi order screen; no sign-in — guests play while they wait.
- **Ranking is server-side** (invariant 13). Where it lives is open question 15.
- The game lives in its **own repository** (`Max-Sundstrom/iskendy_game`), developed both in the cloud and locally, then
  integrated with the Iskendi guest front-end (`Max-Sundstrom/iskendy-frontend`) and backend (`Greatjaaack/iskendy`).
- Targets: **phones, tablets and desktop**.
Host-side integration plan: `docs/53-game-kometa.md` and ADR-021 in the front-end repository.

## ADR-019 · accepted · v1 without leaderboards; car concept B; hosting in Russia (owner, 2026-10-23)
- **No ranking in v1.** No leaderboards, no game service, no database and no player accounts. Personal bests stay
  on the device (IndexedDB). The game ships as static files plus the host embed (EMBEDDING.md), so P5-01…P5-08 are
  deferred; P5-09 (host embedding) stays in v1. The sim stays deterministic and replays keep being recorded locally
  (ADR-002), so server-validated leaderboards can be added later without reworking the core. Supersedes the
  leaderboard parts of ADR-010, ADR-011 and ADR-015 for v1; they apply again when ranking returns.
- **Vehicle concept B "Samodelka"** with two A details (pontoon line along the doors, two-tone enamel), as
  recommended in ART_DIRECTION §8 — chosen by the orchestrator at the owner's request. Blockouts (D0-2) still go
  to the owner for a look before detailing.
- **Hosting in Russia** (Q13). Static client on a Russian host/CDN next to the Iskendi server; no personal data is
  collected in v1, so 152-FZ obligations stay minimal (SECURITY §6).

## ADR-020 · accepted · Run end, results screen and promo code; all items in v1 (owner, 2026-10-23)
- **Run end as in the reference:** endless, a run ends on a crash. The results screen shows the score and a
  Retry button (plus distance, time, NEW BEST and Menu). No Ranking button in v1 (ADR-019).
- **Promo code:** after a run the player sees a **unique generated promo code**. Its meaning, value, redemption
  and visual treatment are defined later by the owner; v1 only generates and displays it. Until a server issues
  and checks codes (ADR-017, SECURITY T20) the code is generated on the client, carries no value and must not be
  treated as a reward. Details and defaults: open question 16.
- **All bonus mechanics ship in v1:** rings, star token (COSMONAUT), AIR canister, item capsule with RADAR,
  MAGNET, SHIELD and EMP (GDD §8).

## ADR-021 · accepted · v1 hosting: static container behind the shared Caddy (A-04, 2026-10-23)
The game origin `play.iskendy.ru` is served by a separate static-files container on the existing Iskendi server in
Russia, behind the shared Caddy (its config lives in the `iskendy_analytic` repository). CI publishes a versioned
release archive with a SHA-256; the server pulls a pinned version. No CDN in v1: L1 egress is a few GB per month
(INFRASTRUCTURE §0). Kill switch = the `disabled` build (EMBEDDING §2).
**Why:** no server-side code in v1 (ADR-019); same region and server as the host keeps latency and cost minimal;
a different origin still satisfies invariant 12 (no shared origin, storage or credentials).
**Alternatives:** a Russian CDN/object storage (needed only for a public standalone build or L3); a subpath on
the host origin (breaks invariant 12 and the host CSP model).
**Needs:** owner approval (infrastructure change, AGENTS §13); a Caddy block from the server owner; host CSP
`frame-src` line (front-end Q-34). Note: game ADR numbers are separate from the front-end repository's ADRs.
**Accepted by the owner** 2026-10-23 (ADR-022). The Caddy block and the server container are still set up together
with the server owner at the first deploy (P7); agents get no server credentials.

## ADR-022 · accepted · Phase A signed: Architecture v1.0 (owner, 2026-10-23)
The owner approved Architecture v1.0 and the hosting proposal in writing: "утверждаю Архитектуру v1.0 и хостинг,
вливай в main" (summary: `docs/ARCHITECTURE_V1_SIGNOFF.ru.md`). Consequences:
- Docs are v1.0; the Phase A exit gate is passed. P0 tooling may start; gameplay code (P1+) still waits for D0.
- ADR-021 (hosting) is accepted.
- The defaults of open questions 3, 5, 6, 7, 8, 12, 14, 16, 17, 18 and 19, listed on the signed page, become
  decisions. Any of them can be reopened by the owner with a new ADR.

## ADR-023 · accepted · Design Agreement signed (owner, 2026-10-23)
The owner approved the D0 evidence (`docs/reviews/art-D0/`, review page) in writing: "Давай подтверждаю продолжай".
- Accepted: the "Moscow Vice" palette and per-biome grading, the world archetypes and landmark rule, vehicle concept
  B "Samodelka" with the A details, the four liveries (Iskendi Courier default in v1), the HUD and results frames,
  and the IP guardrails. ADR-009 (visual direction) is accepted with it. AgX tone mapping is chosen.
- Item 5 (p95 ≤ 16.7 ms on the Mid phone) is still to be measured. It moves into P1-04's acceptance, on the real
  renderer, and becomes a release gate (P7-02) if a phone readout misses the budget.
- Consequence: the hard gate is open; P1 starts. Courier roof ornament: our own placeholder pattern until the
  owner supplies one (open question 20).

## ADR-024 · accepted · SIM_VERSION and goldens before the first release
`SIM_VERSION` stays 1 until the first build ships (P7). No replays exist outside the repo before then, so a version
bump would protect nothing. Every change to a golden (the determinism hash, golden replays, the default `tuningHash`)
is still logged below with its reason, as AGENTS §8 requires. From the first release on, any change to sim outcomes
bumps `SIM_VERSION` (invariant 10).

### Sim changelog (pre-release)
| Date | Task | Golden | Reason |
|---|---|---|---|
| 2026-10-23 | P1-01 | determinism `eb26e68b` | first sim core (lanes, speed curve, origin shift) |
| 2026-10-23 | P1-02 | determinism `6ae1d455`; tuningHash `908b5867…` | jump, fly, slam, boost and AIR join the step; new key `sim.fly.glideEaseS` (0.25 s) |
| 2026-10-23 | P1-03 | determinism `7083bcea-3e3cf928` (now a session with restarts after crashes); tuningHash `38343d24…` | traffic, director v0, collisions; new keys `sim.player`, `sim.traffic`, `sim.vehicles`, `sim.director.firstRowM/spawnAheadM/despawnBehindM` |

## Open questions (owner) — defaults are used until answered

Since ADR-022 every default in this table is an accepted decision; a new owner answer supersedes it.

| # | Question | Default |
|---|---|---|
| 1 | How does a run end: crash only, or also a Route mode with a destination? | **Answered 2026-10-23: endless, crash ends the run; results show score + Retry** (ADR-020). Route mode stays a v1.1 idea |
| 2 | What does ITEM do (reference shows an eye icon)? | **Answered 2026-10-23: all of them ship in v1** — RADAR, MAGNET, SHIELD, EMP (ADR-020) |
| 3 | Final title, premise text and hero car name | KOMETA / pies-to-the-dacha premise / Kometa R |
| 4 | Sign-in providers and backend region | **Answered 2026-10-23: no sign-in, guests only** (ADR-018). Region still open (Q13) |
| 5 | Portrait only, or landscape too? | Both, portrait first |
| 6 | LIFTOFF automatic or manual? | Automatic; manual in settings |
| 7 | Distribution targets | Iskendi embed only in v1 (ADR-016); own-site PWA and portal adapters later |
| 8 | Monetisation | None in v1 |
| 9 | Scope: standalone, embedded in Iskendi order tracking, or both? | **Answered 2026-10-23: Iskendi "play while you wait" (embedded).** Standalone deferred |
| 10 | Real rewards (promo codes/discounts) for scores or achievements? | **Answered 2026-10-23: later.** v1 keeps hooks only (reward-eligibility flag on validated runs); no issuance |
| 11 | Vehicle concept A / B / C (ART_DIRECTION §8) | **Answered 2026-10-23: B "Samodelka"** with two A details (ADR-019) |
| 12 | Fictional city with archetypes, or recognisable real landmarks? | Fictional Kometograd, archetypes only |
| 13 | Audience and hosting region | **Answered 2026-10-23: Russia** (ADR-019); provider chosen in A-04 |
| 14 | How strong is the GTA VI-style saturation vs a calmer palette (or Iskendi brand moderation)? | Full "Moscow Vice" palette; brand only on billboards/livery/UI chrome |
| 15 | "Ranking is managed on the backend": this game service (ADR-012) or the Iskendi FastAPI backend? | **Answered 2026-10-23: no ranking in v1** (ADR-019). Iskendi FastAPI untouched except one CSP `frame-src` line (front-end Q-34) |
| 16 | Promo code rules: when it appears, format, whether the host page shows it too | After every finished run; format `ISK-XXXX-XXXX` from a CSPRNG (Crockford Base32, ARCHITECTURE §11); shown on the results screen and sent to the host in `game.runEnded.promoCode`; display only, no value until server-issued |
| 17 | Telemetry in v1: does the game collect gameplay analytics? | No: no analytics in the game and no third-party scripts on its origin. The host may record its own analytics goals from `game.ready`, `game.runEnded` (without the promo code) and `game.error` |
| 18 | Error reporting in v1 | No reporting service; fatal errors reach the host as `game.error { code }`; Caddy access logs on the server. Revisit before a public build |
| 20 | Ornament on the Iskendi Courier roof livery | Our own pattern in Iskendi orange and cream, made for KOMETA; replaced if the owner supplies the brand ornament |
| 19 | Share button on the results screen in v1 | Hidden: there is no public standalone build for a share link to open, and a share image would spread the promo code. Share returns with the standalone build |

## Change log
- 2026-10-23 — Kit created from reference screenshot analysis.
- 2026-10-23 — v0.2: Moscow × GTA VI-inspired direction (proposed), security/anti-cheat, infrastructure and
  load model, scenario catalogue, host embedding contract, test strategy, multi-agent system, Phases A and D0.
- 2026-10-23 — Owner answers: Q9 Iskendi embedded edition; Q10 rewards later; Q11 choosing from photos.
- 2026-10-23 — Owner answers: Play card entry, no sign-in, server-side ranking, separate repo, phones/tablets/desktop (ADR-018); Q15 added.
- 2026-10-23 — Owner answers: no ranking in v1, car concept left to the orchestrator (B chosen), hosting in Russia (ADR-019).
- 2026-10-23 — Owner answers: crash ends the run, results with score + Retry, unique promo code shown (meaning later), all bonus mechanics in v1 (ADR-020); Q16 added.
- 2026-10-23 — A-07 consistency review (`docs/reviews/consistency-A07-2026-10-23.md`): docs aligned to the v1 scope and marked v1.0 RC; ADR-017 clarified; ADR-021 (hosting) proposed; Q7 default updated; Q17–Q19 added; night batch ≤ 3 cards.
- 2026-10-23 — Owner signed the Design Agreement (ADR-023); P1 starts; phone p95 moves into P1-04; Q20 added.
- 2026-10-23 — Owner signed Architecture v1.0 and the hosting (ADR-022): docs v1.0, ADR-021 accepted, open-question defaults accepted.
