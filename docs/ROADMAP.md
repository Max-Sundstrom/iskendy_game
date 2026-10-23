# KOMETA — Roadmap

Owners are roles from AGENTS.md §9. Every row becomes a task card in `docs/tasks/<ID>.md`.
A phase starts only after the previous exit gate passes, except rows marked ∥ (may overlap).

Rough effort for one director + AI agents, part-time: A 3–4 days · D0 1–1.5 weeks (overlaps A) · P0 2–3 days ·
P1 1 week · P2 1–1.5 weeks · P3 2 weeks · P4 1 week · P5 1.5 weeks · P7 1.5 weeks → **v1 in ≈ 10–12 weeks**.
P6 is v1.1. With ADR-019 (no server in v1) P5 shrinks to P5-09 (≈ 0.5 week) and P7 loses the load, chaos and
backup work, so **v1 ≈ 9–10 weeks**.

**Hard gate:** no gameplay code (P1+) before Phase A and Phase D0 are signed off. P0 tooling may start once A is signed.

---

## Phase A — Architecture and scenario sign-off (pre-production)

Goal: every architectural question answered and every scenario mapped before development.

| ID | Owner | Task | Acceptance |
|---|---|---|---|
| A-01 | Orchestrator | Owner answers open questions Q1–Q19 (DECISIONS.md); update affected docs | no blocking question left open |
| A-02 | Orchestrator | Walk through SCENARIOS.md with the owner; add missing scenarios; assign test types | every row has expected behaviour + test reference |
| A-03 | Security engineer | Threat-model review of SECURITY.md against final scope (embedded? rewards?) | signed threat register |
| A-04 | Release engineer | Choose hosting/CDN/region (INFRASTRUCTURE §8) with an egress cost estimate for L1–L3 | ADR recorded |
| A-05 | Backend + host owner | If embedded: agree the postMessage contract and the kill switch with the host front-end; if rewards: agree the server-to-server endpoint | EMBEDDING.md v1.0 signed |
| A-06 | Sim engineer | Spike: measure sim step cost in Node with 60 vehicles (validation budget ≤ 100 ms per 2-min run). **Re-scoped by A-07:** no server validation in v1, so the client-side number is measured in P1-01 instead (sim step ≤ 1 ms on Low) | benchmark in DECISIONS |
| A-07 | Orchestrator | Final review of all docs for consistency; bump versions to 1.0 | docs v1.0 |

**Exit gate:** owner signs "Architecture v1.0".

---

## Phase D0 — Design agreement (pre-production)

Goal: agree on the look and the car before any production art. Owned by `art-director` with `tech-artist`.

| ID | Owner | Task | Acceptance |
|---|---|---|---|
| D0-1 | Art director | Art-direction board in Figma: palette, per-biome grading, world archetypes, traffic, UI tone (ART_DIRECTION §4–7) | owner approval |
| D0-2 | Tech artist | Blockouts of vehicle concepts A, B, C in Blender at true scale; renders from chase cam, side, rear ¾ and top under Embankment Gold lighting; pick one; paint-over liveries | owner picks a concept |
| D0-3 | Render engineer + tech artist | Style-test chunk (200 m of Embankment Gold, wet road, bloom, fog, 30 traffic cars, chosen car) running on the Mid device | p95 ≤ 16.7 ms; owner approval of the look |
| D0-4 | UI engineer + art director | HUD and menu style frames in Figma (390×844, 1440×900) incl. odometer score | owner approval |
| D0-5 | Art director | Fill and sign ART_DIRECTION §9 checklist | signed |

**Exit gate:** Design Agreement signed.

---

## Phase 0 — Foundations

Goal: a repository where any agent can work safely and every check runs in CI.

| ID | Owner | Task | Acceptance |
|---|---|---|---|
| P0-01 | Orchestrator | pnpm monorepo, TS strict, ESLint + Prettier, Vitest, Playwright, dependency-cruiser rules (ARCH §2) | `pnpm typecheck`, `lint`, `test` green on empty packages; boundary fixture fails as expected |
| P0-02 | Release | CI: typecheck, lint, unit, sim, E2E smoke, `assets:check`, bundle-size check | every PR shows all checks |
| P0-03 | Sim | zod schema for tuning; load `packages/content/tuning.default.json`; `tuningHash` of sim sections | invalid tuning fails with a readable path-level error |
| P0-04 | Tech artist | `assets/` structure, `LICENSES.json` schema + validator, gltf-transform pipeline stub, budget checker | an asset without a ledger entry fails CI |
| P0-05 | Orchestrator | `docs/tasks/`, `docs/PROGRESS.md`, PR template, issue templates (bug, feel, perf) | templates in place |
| P0-06 | Orchestrator | Record pinned versions and confirmed defaults in DECISIONS.md | ADR-001 version table filled |
| P0-07 | Security engineer | Security baseline: gitleaks, Semgrep, CodeQL, OSV-Scanner, Renovate (14-day minimum release age), branch protection, Actions pinned by SHA, CSP/headers skeleton | CI shows all security checks |
| P0-08 | Release engineer | Environments (preview/staging/prod), IaC skeleton, error reporting, metrics stack. **v1:** per-PR static preview + release archive (INFRASTRUCTURE §0); no error-reporting or metrics stack (Q17, Q18) | v1: a PR shows a preview URL; the release archive builds with a checksum |

**Exit gate:** CI green; an agent can create a task card and complete the DoD checklist end to end.

---

## Phase 1 — Grey-box vertical slice

Goal: the core loop with primitive shapes, playable on a phone and on desktop.

| ID | Owner | Task | Acceptance |
|---|---|---|---|
| P1-01 | Sim | state, fixed step, RNG, LUT math, lanes, speed curve, lane change | unit tests; 10 000-tick hash identical in Node and Chromium |
| P1-02 | Sim | jump, gravity, fly, slam, boost, AIR drain/regen | apex height and AIR rates match tuning within 1 % |
| P1-03 | Sim | traffic SoA, basic random rows, swept collisions, crash, scrape | no tunnelling at 95 m/s in a 100k-step fuzz test |
| P1-04 | Render | boxes-and-planes scene, interpolation, chase cam, floating origin | 60 fps on Mid with 40 vehicles visible |
| P1-05 | UI | input mapper (keyboard, swipe, hold, buttons), minimal HUD (score, distance, AIR), results stub, retry | E2E: start → crash → retry on both viewports |
| P1-06 | QA | replay recorder/player, `replay:verify`, first 3 golden replays | goldens reproduce in Node + Chromium + WebKit |
| P1-07 | Critic | feel review #1: lane snappiness, jump arc, speed perception | review with concrete tuning deltas |
| P1-08 | QA + Sim | Synthetic players v0 (Novice, Chaos) running nightly | dashboard with distance distribution |

**Exit gate:** a first-time player understands what to do within two attempts; determinism holds across engines.

---

## Phase 2 — Mechanics complete

| ID | Owner | Task | Acceptance |
|---|---|---|---|
| P2-01 | Sim | roofs, hops, platforms (bus/semi/car-carrier), coyote time | hop chain and platform ride tests |
| P2-02 | Sim | front flips, barrel rolls, landing grades | grade boundaries tested at ±1° |
| P2-03 | Sim | full event table (GDD §9), streak window, multiplier, pot banking | scripted scenario produces the exact expected score |
| P2-04 | Sim | LIFTOFF meter; LIFTOFF / COSMONAUT / OVERDRIVE; smash; grace | mode timings and stacking tests |
| P2-05 | Sim | rings, star, AIR canister, item capsule; RADAR / MAGNET / SHIELD / EMP | per-item tests |
| P2-06 | Sim | director v2: patterns, difficulty curve, waves, fairness solver | fairness property test: 10 000 seeds × 10 km, zero unsolvable rows |
| P2-07 | UI | full HUD (GDD §14) with the binder; mode bar; streak; event feed; mobile buttons | no React renders per frame (profiler screenshot) |
| P2-08 | Sim | 20 hand-authored patterns + pattern ASCII preview CLI | patterns validate; preview renders |
| P2-09 | QA | golden replay per mechanic; property suite in CI | suite < 3 min in CI |
| P2-10 | Critic | feel review #2 and tuning proposal | review doc; Orchestrator applies accepted deltas |
| P2-11 | QA + Sim | Synthetic players v1 (Average, Expert) + balance alerts; mutation testing on scoring/streak/landing | mutation score ≥ 80 % |

**Exit gate:** every rule in GDD §5–11 implemented and tested; a skilled run reaches 5 km with ≥ 60 % of
score from style.

---

## Phase 3 — Art, audio, game feel (∥ asset work may start during P2)

| ID | Owner | Task | Acceptance |
|---|---|---|---|
| P3-00 | Orchestrator | Visual slice pulled forward (ADR-026): procedural hero car and 13 traffic models, roadside and horizon, thruster vapour, launch gantry intro with 3-2-1, BOOST feedback | done 2026-10-23 — see `docs/tasks/P3-00.md` |
| P3-01 | Tech artist | Hero car Kometa R: blockout → owner review → final mesh, LODs, node hierarchy (ASSETS §5) | budget check passes; review sign-off |
| P3-02 | Tech artist | Traffic: Kenney Car Kit restyled to the palette atlas + 4 original Soviet-inspired bodies | ≤ 3k tris each; ledger entries with proof |
| P3-03 | Tech artist | Environment kits per ART_DIRECTION §5–§6: launch gantry intro (ADR-026), embankment with steel arch bridge, river and linden trees, Cosmos Park rocket on a pedestal, elevated ring road with tunnels, glass towers and billboards, panel-block districts with kiosks and sodium lamps, construction props | chunk prefabs per biome |
| P3-04 | Render | biome streaming, sky dome + fog per time of day, 300 m blends | no frame > 8 ms extra at biome swap |
| P3-05 | Render | VFX: thrusters, dust, sparks, debris, fireworks, speed lines, mode grades | reduced-motion variant |
| P3-06 | Render | post-processing, quality tiers, dynamic resolution | budgets met on Low / Mid / High |
| P3-07 | Render | intro cinematic polish (P3-00 has the gantry and countdown); rocket launch on LIFTOFF | timing synced to sim events |
| P3-08 | Audio | SFX set, three music stems, mixer, haptics | every cue mapped; ledger entries |
| P3-09 | Perf | full audit + prioritised fix list | report with before/after |
| P3-10 | Critic | art and feel review against GDD §19 | sign-off or fix list |

**Exit gate:** budgets met on all three device classes; art review signed off.

---

## Phase 4 — Screens, onboarding, UX polish

| ID | Owner | Task | Acceptance |
|---|---|---|---|
| P4-01 | UI | main menu (v1: without sign-in, Ranking and Top 100), pause, settings, controls, credits (generated from the ledger) | visual snapshots approved |
| P4-02 | UI | results screen with score, Retry and the promo code (ADR-020); share-card generator (1080×1920) only if Q19 says so | J14 passes; with Share: Web Share works on iOS and Android, fallback copy-link |
| P4-03 | UI | first-run tutorial (GDD §15.6) | 5 of 5 hallway testers finish it in < 60 s |
| P4-04 | Sim + UI | achievements: data, sim checks, toasts, grid screen | all 19 v1 achievements unlockable in scripted tests (Weekly Pilot deferred) |
| P4-05 | UI | i18n EN/RU, accessibility settings, left-handed layout, key remapping | axe scan clean; keyboard-only pass |
| P4-06 | QA | visual regression baselines, a11y audit report | baselines committed |

**Exit gate:** a new player goes from first launch to a second run without help.

---

## Phase 5 — Online

> **v1 (ADR-019):** only P5-09 (host embedding) ships in v1. P5-01…P5-08 (server, replay validation,
> leaderboards) are deferred until ranking returns.

| ID | Owner | Task | Acceptance |
|---|---|---|---|
| P5-01 | Backend | server skeleton, DB schema, migrations, guest sessions | integration tests green |
| P5-02 | Backend | run submission + replay validation worker | tamper suite: 100 % rejected |
| P5-03 | Backend | all-time and weekly leaderboards; weekly seed rotation | rank correct around boundaries |
| P5-04 | Backend | OAuth adapters (providers per DECISIONS) | link/unlink flows tested |
| P5-05 | UI | ranking screens, menu Top-100 panel, name editing, offline submit queue | E2E online/offline |
| P5-06 | QA | k6 load test on `/v1/runs` | p95 submit → rank < 1.5 s at 50 req/s |
| P5-07 | Backend + Security | Run tickets, cheat heuristics, flagged-run review queue, public replay viewer | A1–A6 scenarios pass |
| P5-08 | Backend | Valkey leaderboards and rate limits; edge caching of boards | L3 read load served from cache |
| P5-09 | UI + Backend | Host embedding (v1 scope): `platform/host.ts`, Lite asset set, order chip, order-ready interrupt, run resume, kill switch | H1–H9 scenarios pass |

**Exit gate:** tampered replays are always rejected; leaderboards stable under load.

---

## Phase 6 — Progression (v1.1 candidate)

Rings economy · upgrades (tank size, regen, magnet time, start boost) · garage with unlockable bodies and
paints · daily missions · Route mode with a destination and story endings · ghosts of your best run (v1.2).

---

## Phase 7 — Release

| ID | Owner | Task | Acceptance |
|---|---|---|---|
| P7-01 | Release | PWA manifest and service worker, CDN headers, error reporting, staging/prod pipelines (v1: Caddy-served static origin, release archive, no error reporting — INFRASTRUCTURE §0) | offline restart works; source maps private |
| P7-02 | QA | device matrix pass (iPhone SE-class, iPhone 11-class, recent iPhone, Pixel 6a-class, low-end Android, iPad, desktop Chrome/Safari/Firefox); 30-run soak with no memory growth | checklist 100 % |
| P7-03 | License auditor | final ledger audit, attribution screen, brand-name scan of assets and strings | zero findings |
| P7-04 | Release | analytics consent, privacy policy, terms | pages live |
| P7-05 | Orchestrator | launch checklist; portal adapters if chosen | sign-off |
| P7-06 | Security engineer | OWASP ZAP baseline, ASVS L1 checklist (L2 for auth/rewards), external pen test if rewards | no high findings open |
| P7-07 | QA + Release | Viral-spike load test (INFRASTRUCTURE L3–L5) + chaos drills. **Deferred** (ADR-019); v1 runs the static-origin smoke (TEST_STRATEGY §6) | SLOs hold; degradation ladder verified |
| P7-08 | Release | Backup restore drill; runbooks for every O* scenario. **v1:** runbooks for O2, O6, O7, O8 only; no database to restore | RTO/RPO met |

**Exit gate:** release checklist complete.

---

## Status board

| Phase | Status | Notes |
|---|---|---|
| A | **signed 2026-10-23** (ADR-022) | Architecture v1.0; defaults accepted; A-04 = ADR-021; A-06 moved into P1-01 |
| D0 | **signed 2026-10-23** (ADR-023) | evidence in `docs/reviews/art-D0/`; phone p95 measured in P1-04 |
| P0 | **done** (2026-10-23) | P0-01…P0-08; P0-06 table keeps filling as libraries arrive; server setup is an owner action (`docs/runbooks/deploy-game-origin.md`); P1+ waits for D0 |
| P1 | in progress | P1-01…P1-06 done — playable loop, replays across engines (phone p95 readout pending); next P1-08 bots, P1-07 feel review |
| P2 | not started | |
| P3 | P3-00 done (ADR-026) | visual slice ahead of P2 on the owner's request; Blender assets P3-01…03 later |
| P4 | not started | |
| P5 | not started | v1: P5-09 only; P5-01…08 deferred (no ranking) |
| P6 | later | v1.1 |
| P7 | not started | |
