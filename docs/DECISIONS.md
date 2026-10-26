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
| 2026-10-23 | P1-06 | golden replays `early-crash` `5fff0579`, `busy-inputs` `aa0d3369`, `long-run` `34563692` | first goldens (`tools/make-golden-replays.ts`) |
| 2026-10-23 | P1-05 | determinism `cb0aae87-91cfb58f` | `score.total` (1 point per metre, GDD §9) joins the state; events, streaks and the pot follow in P2-03 |
| 2026-10-23 | P2-01 + P2-02 (flips) | determinism `9685154f-ea4436ea`; golden replays `early-crash` `0ec6d8a9`, `busy-inputs` `950f5632`, `long-run` `a6039b65` | platforms ridden with coyote time, hop chains and slam hops, CLEAR tracking; front flips, landing grades and the sloppy penalty; new state joins the hash |
| 2026-10-23 | P1-03 | determinism `7083bcea-3e3cf928` (now a session with restarts after crashes); tuningHash `38343d24…` | traffic, director v0, collisions; new keys `sim.player`, `sim.traffic`, `sim.vehicles`, `sim.director.firstRowM/spawnAheadM/despawnBehindM` |
| 2026-10-23 | P2-02b | determinism `9685154f-ea4436ea` → `5d224451-353277e8` (both Node/browser fixtures); tuningHash `38343d240df13aa3` → `9e2e6e03faddfbea`; replays `early-crash` `0ec6d8a9` → `538c5a99`, `busy-inputs` `950f5632` → `923a1653`, `long-run` `a6039b65` → `c82fb955`; cosine table/spacing/error pin `2b04aa6753db261b` | Accepted airborne lane changes now commit signed barrel rolls; five new fields join the hash. Q22/Q23 add queue and orientation flags. All three replays retain exact duration, score, distance and crash cause. The 10k retry session changes from 21 to 25 runs because actual roll landings affect penalties/crashes. Terminal crash pitch/roll are preserved instead of erased; renderer consumes that same-tick pose. SIM_VERSION remains 1 under ADR-024. |
| 2026-10-23 | P2-03a | determinism `5d224451-353277e8` → `8be91f5c-6f883e35` (both Node/browser fixtures); tuningHash `9e2e6e03faddfbea` → `cc1f730496d3c9cc`; replays `early-crash` `538c5a99` → `a73a2af9`, `busy-inputs` `923a1653` → `9fe5fb3b`, `long-run` `c82fb955` → `d101ad75` | Scoring/streak ledger and interval counters now join the hash. New Q24–Q26 passive-credit policies and SCRAPE ratio are in tuning. No physics changes: all three replay inputs/ticks/distances/causes and final displayed scores remain identical; 10k retry count remains25. The busy replay earns pot120+150+180 then loses450 on its landing crash, retaining meter110. SIM_VERSION remains1 under ADR-024. |
| 2026-10-26 | P2-03b | determinism `8be91f5c-6f883e35` → `5e81a89c-04c562d2` (both Node/browser fixtures); tuningHash `cc1f730496d3c9cc` → `9e91b7802bf1b6b1`; replays `early-crash` `a73a2af9` → `93946362`, `busy-inputs` `9fe5fb3b` → `3e19786b`, `long-run` `d101ad75` → `04f57e5b` | Q27 adds the near-miss flag and persistent active-slot pass states to hashing. Independent comparison before regeneration proved all three physical trajectories, old raw event order, scores, inputs, ticks and distances unchanged, plus 10k scripted ticks across the same 25 runs. Those fixtures earn no near awards. Separate default-input seed1 Right350 now earns 50 on tick352, banks on502 and crashes on509 with score366; flag-off has identical physics and score316. SIM_VERSION remains 1 under ADR-024. |
| 2026-10-26 | P2-04a2 | determinism `5e81a89c-04c562d2` → `ab3be31c-99f78172` (both Node/browser fixtures); unchanged tuningHash `9e91b7802bf1b6b1`; replays `early-crash` `93946362` → `1df1ea82`, `busy-inputs` `3e19786b` → `fc6dfa0b`, `long-run` `04f57e5b` → `c7bfecbb`; new `liftoff` `66e41f15`; NEAR E2E `fc2ed824` → `b3d301a4` | Q28 adds mode kind, active/grace counters and SMASH chain to persistent hashing. Independent pre-regeneration comparison proves all legacy fields/events unchanged across the three old goldens and the same 10k/25-run session (12,462 rows); none activates a mode. Auto-trigger disabled also preserves the meter routes (13,599 rows). The new unchanged 50-input seed-1 route starts LIFTOFF at 525, SMASHes real traffic at 688, ends active/grace at 825/885 and crashes naturally at 928, score 18,828. A separate 928-row ledger audit and exact contact oracle justify that new outcome; the oracle caught 11 rounding errors, then passed all 7,873 unchanged cases after the causal exact-arithmetic correction. SIM_VERSION remains 1 under ADR-024. |

P2-04a2 independent comparison, geometric counterexamples/correction and mode-route ledger evidence are
in `docs/reviews/P2-04a2/`. The original three replay inputs, durations, distances and displayed scores stay
unchanged; the fourth adds active-mode coverage to the exact catalogue and browser engine checks. Hashes
were regenerated only after independent outcome approval. No tuning or dependency update is included.
The first exact-head CI exposed one additional hard-coded NEAR E2E hash missed by the golden/pin update.
Independent comparison of all 795 seed-1/Retry rows, every legacy field/typed-array byte and raw event
proved this is solely the added zero mode hash layout: score/distance/crash/input remained unchanged.
See `docs/reviews/P2-04a2/near-miss-pin.md`; only that expected hash was changed, with all assertions kept.

P2-03b independent lifecycle and physical comparison evidence is in `docs/reviews/P2-03b/`; the default-input
replay records a completed close pass without retuning or state injection. The new hash layout stores all
five future-affecting encounter states, rather than a boolean "already awarded" approximation. See Q27 for
the proposed product policy and its disable flag. No accepted physical behaviour was altered to force awards.

P2-03a outcome evidence is in `docs/reviews/P2-03a/sim-outcomes.json`. Early crash still has no style events;
the long-run dodger also earns no style points. Their final hash differences reflect the expanded state layout.
The busy replay completes rolls on ticks42/101 and lands perfectly on48: its pending pot reaches450, then
its existing tick106 landing crash loses all450 before any bank. Therefore all three claimed scores remain
155/62/1531 despite the intentional scoring implementation. New actual-input regression separately performs
two SLAM landings, banks112.5 after150 ticks and validates final total = distance +112.5 through record/play.
Fractional points, final-tick priorities, event order and all seven hashed fields have explicit regressions.

Numerical roof interval comparison allows `32*Number.EPSILON*max(interval,remainder)` (approximately
7.1e-14m at the default10m threshold), then clamps a tiny negative remainder to0. It accepts100×0.1m
without waiting an extra tick, while10m−1e-10m and zero travel stay incomplete. This is a bounded local
roundoff allowance, not gameplay grace or a claim of exact arbitrary-length decimal accumulation. Relative
platform movement uses its actual post-follow-slowdown velocity ×dt, before origin shift, not subtraction of
large coordinates. No gameplay speed, collision or rotation values changed.

P2-02b outcome evidence: `early-crash` still ends on tick 258, rear collision, score 155 and distance
155.37045680500898 m; only the expanded state layout changes its hash. `long-run` still ends on tick 2070,
second scrape, score 1531 and distance 1531.9897301506035 m; its policy never requests an airborne lane
change, so its hash change likewise reflects the expanded layout. `busy-inputs` still ends on tick 106,
landing crash, score 62 and distance 62.645557488526215 m. It now completes the first left roll on tick 42,
lands perfectly on tick 48, completes a right roll on tick 101 and immediately begins its queued left roll.
Its crash retains pitch 0.7272727272727268 turns and roll 0.8148148148148151 turns, replacing the old zeroed
pitch. Active/queued trick flags are cleared, but counts and terminal angles remain for crash presentation.

The 10k session's first physical outcome difference is global tick 459 (seed 8, run tick 177): the queued
left roll lands at 0.888888888888889 turns, 40° from upright, so it receives the existing 0.8 s SLOPPY penalty.
The previous sim had no roll and treated that jump as plain. This changes distance and subsequent traffic
encounters (the earlier implementation crashes into a rear at global tick 697 while the new run survives),
so later retries use different seeds/timings. The new fixture follows these intended rules; no assertion was
relaxed. Independent quaternion tests and the old pure-axis boundaries constrain the new grading.

## ADR-026 · accepted · Owner playtest feedback: launch gantry intro and a visual slice before P2 (owner, 2026-10-23)
After playing the P1 build, the owner asked for:
- BOOST that visibly works;
- a far more detailed, more realistic car and world;
- a start like the reference: the car on a ramp, a countdown, then the run;
- vapour jets from the nozzles by the wheels, as in the reference roadster's cold-gas thruster concept;
- obstacles of many vehicle types from cars to trucks;
- the reference's movement mechanics and physics reproduced exactly.

Decisions:
- **Intro:** a steel truss launch gantry with a curved ramp and the 3-2-1, as in the reference, replaces the ski-jump hill
  of ART_DIRECTION §5 (GDD §2/§12 updated). The structure is a generic gantry, not a copy of the reference's layout.
- **Visual slice first:** P3-00 pulls the art work forward with procedural models (no Blender in the cloud workspace). The
  Blender assets of P3-01…P3-03 replace them later.
- **Mechanics and physics:** they follow the reference through GDD §1's derived numbers (speeds, jump, fly, AIR), and the
  cold-gas concept matches it: main thrusters at the tail for boost, lift nozzles under the car for the jump and hover,
  attitude nozzles on the flanks. Flips, roof hops, streaks and modes arrive in P2.
- **Guardrail kept (AGENTS §12):** the car stays the original Kometa R (concept B); no real brand names, model names or
  copied body shapes. Realism means detail and materials, not a replica.

## ADR-027 · accepted · Owner feedback round 2: C-shaped launch ramp, tap-to-jump, flips, more detail (owner, 2026-10-23)
The owner asked for:
- the launch ramp exactly like the reference roadster demo: a C-shaped ramp on a steel truss tower, with photos supplied;
- a fix for wheels that floated above the body and sank into the ramp at the bottom of the old ramp;
- flips on a double tap or a double Space;
- smoother, more detailed cars, trees and buildings, with bevels instead of raw primitives.

Decisions:
- **Intro:**
  - The car drives in along the road and climbs the inside of a C (an ellipse half, 24 m tall) to the top arm.
  - It runs along the arm upside down and leaves the lip with the thrusters firing.
  - It rolls 1½ times about its length and lands upright at the start line as tick 0 begins.
  - LED edges and the truss follow the photos. The shape is a generic stunt ramp; no names or logos.
- **Car pose:** the whole car (body and wheels) is oriented from the travel direction and the surface normal, and it
  turns about its centre of mass in the air. This fixes the floating and sinking wheels.
- **Input:** a quick tap on the screen is a Jump press. In the air a press flips (Q21), so a double tap jumps and
  flips. Keyboard: Space twice. GDD §4 updated.
- **Detail:**
  - Bodies are lofted with Catmull-Rom between stations: the hero is dense, traffic stays within the 3k budget.
  - Hero parts have rounded edges, and the sills have a two-tone satin band.
  - Lindens have welded, lumpy, height-shaded crowns.
  - City blocks come in three kinds (stepped with a spire, glass slab, panel block) with cornices and metre-scaled
    windows.

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

- **Q21 (default applied, 2026-10-23): a Jump press in the air flips, except near the road.** GDD §4 maps a second press in
  the air to a front flip, and scenario G3 buffers a press made just before landing. Default: the press is a buffered
  jump when the free-fall time to the road is under `jump.bufferS` (120 ms); otherwise it starts or queues a flip.
  While flying, a flip needs a re-press, so the 150 ms hold threshold costs a little height; a double flip wants
  altitude, for example after a roof hop.

- **Q22 (proposed default implemented behind flag, P2-02b): barrel-roll queue.** GDD commits each 0.45 s
  roll but does not specify inputs during one. `sim.tricks.barrelRollQueuedInputs=1` keeps the first pending
  direction from an actual airborne lane-change start; overflow is ignored for rolls only. Mode `0` has no
  pending roll. Merely queued lane input, bumps, ground starts and scrape return do not request a roll.
  Direction cannot reverse the current roll; completed counts are independent of signed net rotation.
- **Q23 (proposed default implemented behind flag, P2-02b): what is "upright" for a mixed landing?**
  `sim.landing.orientationMode="uprightForward"` grades shortest quaternion distance from the original
  upright/forward orientation. This rejects pitch180°+roll180° (wheels down but facing backward). Alternate
  `"upVector"` ignores heading and accepts that pose. The default avoids silently accepting a reversed car;
  owner confirmation remains open. Both options use deterministic lookup interpolation, not runtime trig.

- **Q24 (proposed default implemented behind flags, P2-03a): passive BOOST ledger.**
  `sim.scoring.boostTarget="total"` credits the base pulse directly; `"activePot"` uses the current series
  multiplier only if N>0, falling back to total otherwise. `boostIntervalS=0.25` means15 actual consecutive
  boosting ticks at60Hz; partial intervals reset on stop/AIR exhaustion. BOOST neither extends nor increments
  the streak. Fractional ledger points are kept, with flooring only at existing HUD/replay boundaries.
- **Q25 (proposed default implemented behind flags, P2-03a): ROOF RIDE distance and ledger.**
  `roofRideDistanceBasis="world"` measures player travel; `"relative"` subtracts actual platform travel,
  clamped at0. Post-follow-slowdown speed ×dt is the exact movement used by traffic, avoiding cancellation
  from subtracting large origin-relative positions. `roofRideIntervalM=10`; target `"activePot"` by default
  or `"total"`. With no current series, points go directly to total. Only a full tick on the same active
  platform counts; exit/change/same-slot re-entry resets the remainder. A pulse refreshes an existing timer,
  without increasing N or creating a series. Owner confirmation of these policies remains open.
- **Q26 (proposed default implemented behind flag, P2-03a): SCRAPE and same-tick loss policy.**
  `sim.streak.scrapeBankRatio=0` loses the pot when SCRAPE breaks a series; the ratio is explicit and tested
  at0.25 as an alternative. Settlement priority after all staged credits is CRASH → SCRAPE → SLOPPY → timeout.
  Previously banked score/direct distance remain. The linear extra-flip bonus adds20% of base points per
  extra flip, not compounded points and not multiplied meter. No four deferred tuning proposals are applied.
- **Q27 (proposed default implemented behind flag, P2-03b): completed untouched NEAR MISS.**
  `sim.scoring.nearMissEnabled=true` requires a fresh forward front-entry crossing, then rear-exit completion;
  a vehicle initialized alongside never arms. Remember an interval with simultaneous strictly positive
  longitudinal/vertical body overlap and an inclusive lateral surface gap of 0…`nearMissLateralM` (0.6 m).
  Use unrotated lane-space boxes and exact linear interval clipping, without substeps or an epsilon grace.
  Entry uses `r0<=-halfL && r1>-halfL`; completion uses `r0<length+halfL && r1>=length+halfL`.
  Swept penetration, exact-slot contact, HOP, starting/current ride or CLEAR excludes that encounter;
  an unrelated road touchdown does not. A failed encounter may retry after separation, while an awarded
  vehicle remains spent until removal/reuse. Current motor content uses `vehicle.top !== 'none'`, which
  excludes cones/barriers; future vehicle taxonomy requires review. Finalize in slot order after every
  collision: terminal crash suppresses new near events, unrelated SCRAPE may lose an otherwise valid pot.
  Disabling the flag removes near events/points without changing previous physical outcomes. The 50 base
  points and 10 meter already come from GDD tuning; this policy bundle is proposed, not owner-approved.

- **Q28 (selected under delegated gameplay authority, 2026-10-26): finite LIFTOFF episode.**
  The owner delegated gameplay-rule choices to the orchestrator; the wait for R1–R11 is lifted. This does
  not authorize dependency updates, main merges or deployments. The new phone-preview request was cancelled.
  P2-04a2 implements the first slice using existing tuning: auto-start from full meter after a surviving
  ordinary tick, effects on the next tick, 300 active ticks then 60 grace ticks. A full meter earned during
  active/grace is retained; activation requires a tick that started idle, so continuous protection is finite.
  R1 preserves finite AIR during active without drain/regen; zero stored AIR permits flight and BOOST.
  R2 destroys actual contacted traffic once, including support, without extra HOP/landing/SLAM/coyote.
  R3 gives STUNT alignment to actual protected touchdowns; ordinary grading returns after grace.
  R4 replaces the earlier proposed until-exit tail: final protected-tick closed end-overlaps are retired
  without rewards, before contact-free awards/director reuse. Actual last-active-tick SMASH has priority.
  R5 resets SMASH chain per episode; base/step/cap come from tuning, award uses the existing pot/N exactly
  once, meter +0. Active speed multiplies existing BOOST and penalty factors. Protected contact is closed
  swept AABB on one common x/y/relative-z time interval, with no substeps/epsilon; ordinary collisions stay
  unchanged. No indefinite per-object immunity or safety-until-landing promise is introduced.
  These choices prevent repeat rewards and expiry inside a trapped object; they do not prove full-route
  fairness or balance. Independent outcome/replay/geometry checks are required before completion.
  COSMONAUT/OVERDRIVE/pickup choices remain subsequent implementation cards under the same authority,
  not questions awaiting a further owner response. The four unrelated deferred tuning proposals remain untouched.

## Change log
- 2026-10-26 — Q28: delegated gameplay choices; finite LIFTOFF contract P2-04a2, no preview publication.
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
- 2026-10-23 — ADR-026: owner playtest feedback; launch gantry intro returns; visual slice P3-00 before P2.
- 2026-10-23 — P2-01 platforms and hops; P2-02 front flips and landing grades; Q21 (air press vs jump buffer).
- 2026-10-23 — ADR-027: C-shaped launch ramp, whole-car pose, tap to jump / double tap to flip, smoother models.
