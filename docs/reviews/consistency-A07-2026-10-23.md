# A-07 — Consistency review of the docs kit (2026-10-23)

Reviewer: Orchestrator (Claude Code). Inputs: every file in `docs/`, `AGENTS.md`, `CLAUDE.md`, `README.md`,
`.claude/agents/`, `packages/content/tuning.default.json`, the owner answers in ADR-016…020, and the host-side plan
`docs/53-game-kometa.md` in `Max-Sundstrom/iskendy-frontend`.

**Verdict:** the kit was written for a standalone game with an online layer. The owner's answers made v1
something else: an embedded, client-only game with no ranking. Most findings come from that gap. Each one is
fixed with the smallest possible edit. The deferred online design is kept and marked as deferred, not deleted,
so it can come back without rewriting the docs. After these fixes, no contradictions remain between the docs.
They are marked **v1.0 RC** and become v1.0 when the owner signs `docs/ARCHITECTURE_V1_SIGNOFF.ru.md`.

## Findings and resolutions

| # | Where | Contradiction | Resolution |
|---|---|---|---|
| C1 | AGENTS §1 | "scores go to all-time and weekly leaderboards validated by server-side replay" vs ADR-019 (no ranking in v1) | Product paragraph now says runs end on a crash with a local best and a display-only promo code; added a v1-scope paragraph |
| C2 | AGENTS §3, §4 | Backend stack and `apps/server` described as part of the build | Marked deferred / not created in v1 |
| C3 | AGENTS §6 inv. 13 | "Server authority" assumes a server | Added the v1 reading: nothing of value depends on the client; promo code has no value |
| C4 | README "How to start" | No mention of the current scope | Added "Current scope" section |
| C5 | GDD §3 session flow | Results → "Ranking · Share", "async save" | Local save + promo code; Ranking and Share marked deferred (Q19) |
| C6 | GDD §8 | Items tagged [PROPOSED … OPEN] although Q2 is answered | Tagged accepted for v1 (ADR-020) |
| C7 | GDD §15.1 | Menu has sign-in, Ranking, Top 100 | v1 note: none of them; pilot name local |
| C8 | GDD §15.4 | Results with Ranking button and submit states | v1 note: no Ranking, no submit states, Share hidden by default, promo code saved locally |
| C9 | GDD §16, ROADMAP P4-04 | "Weekly Pilot" needs the weekly board; P4-04 expects "all 20" | Weekly Pilot deferred; P4-04 expects 19 |
| C10 | GDD §17, §21, §22 | Sign-in, leaderboards, cloud saves as v1 features; open questions list stale | v1 note in §17; §21 lists them as out of v1; §22 points to DECISIONS and lists answered items |
| C11 | ARCHITECTURE §1, §11, §13, §16 | Diagram and text assume the API and a server copy of runs | v1 shape paragraph; diagram shows the host bridge and marks the server deferred; §11 split into v1 storage + promo code and the deferred online layer; host-bridge contract tests added; resume is local only |
| C12 | ARCHITECTURE §14 | Telemetry events with no collector in v1 | Q17/Q18 defaults: no game telemetry or error service; host may count protocol messages |
| C13 | ADR-017 vs ADR-020 | "No promo codes in v1" vs "a unique promo code is shown" | ADR-017 clarified: the v1 code is display-only and not a reward; reward-eligibility flag arrives with validation |
| C14 | EMBEDDING §1 | Partitioned storage "→ server profile is the backup" | v1 accepts local loss; server profile arrives with the online layer |
| C15 | EMBEDDING §2 vs host docs/53 §10 | "host-side feature flag … without a host deploy" — the Iskendi front-end has no remote config | Kill switch = `disabled` build on the game origin sending `game.error {code:'disabled'}`; host flag + PATCH release is the slow path |
| C16 | EMBEDDING §5 | "v1 already flags reward-eligible validated runs" — no validation in v1 | Removed the claim; recorded the only host backend change (CSP `frame-src`, host Q-34) |
| C17 | INFRASTRUCTURE §1–§9 | Topology, SLOs, backups assume API, Valkey, Postgres, CDN | New §0 "v1 deployment": static container behind the shared Caddy at `play.iskendy.ru`, release archive, L1 egress estimate; rest marked as the deferred design |
| C18 | INFRASTRUCTURE §8, ROADMAP A-04 | Hosting choice open although Q13 = Russia | ADR-021 (proposed) records the A-04 proposal for owner approval |
| C19 | SECURITY header, §4, §6 | Threat register covers server threats only partially relevant to v1 | v1 threat review (A-03): in-scope and deferred threats listed; promo code handling rule; v1 privacy line |
| C20 | SCENARIOS | Many rows need a server (J7, J8, J13, N1–N5, A1–A8, O4…); J14 listed before J13; J1/H3 mention guests/submission | v1-scope table (v1 / reduced / deferred) covering every row; J14 moved; J1 and H3 adjusted |
| C21 | TEST_STRATEGY §1, §6 | Server integration, k6, chaos as release gates | v1 note and v1 gates (static-origin smoke, v1 runbooks, Iskendi embed in the device lab) |
| C22 | ROADMAP P3-03, P3-07; ASSETS §2 | Environment kit lists the v0.1 world (coast, palms, steppe, launch gantry) vs ART_DIRECTION §5 and GDD §12 v0.2 (ski-jump hill, embankment, ring road, panel blocks) | P3-03, P3-07 and the ASSETS conclusion follow ART_DIRECTION §5–§6 |
| C23 | ROADMAP P0-08, P4-01, P4-02, P7-01, P7-07, P7-08 | Staging/IaC/error stack, Ranking in menu, Share card, load/chaos/backup drills | v1 variants written into each row |
| C24 | ROADMAP A-01 | "Q1–Q13" although Q14–Q19 exist | Q1–Q19 |
| C25 | ROADMAP A-06 | Benchmark justified by server validation budget | Re-scoped: client-side sim cost measured in P1-01 |
| C26 | ROADMAP effort line | P5 1.5 weeks, P7 with load/backup work | v1 ≈ 9–10 weeks with P5-09 only |
| C27 | CLAUDE.md, AGENT_SYSTEM §4, PROMPTS "Night batch" | Night batch "≤ 5 cards" vs WIP limit 3 (AGENT_SYSTEM §2) and the host repo's night mode (≤ 3) | ≤ 3 everywhere |
| C28 | DECISIONS Q7 | Default "own site PWA" vs ADR-016 (embedded first) | Default: Iskendi embed only in v1 |
| C29 | `.claude/agents/backend-engineer.md`, `ui-engineer.md`, CLAUDE routing, PROMPTS P5 | Agents told to build leaderboards / ranking screens | v1 notes added |

## Checked and consistent (no change)

- Budgets: AGENTS §11 = ARCHITECTURE §12 = ASSETS §5 (hero LOD0 target 12k, cap 15k; traffic ≤ 3k; Lite set ≤ 3 MB;
  first playable ≤ 8 MB).
- Tuning JSON vs GDD §5–§11: all values match. GDD §1's derived "≈ 85 L/s" while flying with boost is an estimate
  from the screenshots; the tuning (fly 60 + boost 40 = 100 L/s) is the source of truth.
- Protocol: EMBEDDING §3 = host docs/53 §6 (including `promoCode?`).
- Names: KOMETA / Kometa R / LIFTOFF / COSMONAUT / OVERDRIVE are the same in GDD, ART_DIRECTION and tuning.

## New open questions (defaults apply until answered)

- **Q17 Telemetry:** none in the game; the host may count protocol messages.
- **Q18 Error reporting:** none in v1; `game.error` to the host plus Caddy logs.
- **Q19 Share:** hidden in v1.

## Phase A status after this review

A-01 answered except items with accepted defaults · A-02 done (scenario scope table) · A-03 done (v1 threat
review in SECURITY) · A-04 proposed (ADR-021, needs owner approval) · A-05 agreed with the host docs · A-06
re-scoped to P1-01 · A-07 done. Exit gate: the owner signs "Architecture v1.0".
