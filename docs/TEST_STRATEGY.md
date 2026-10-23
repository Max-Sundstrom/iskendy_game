# KOMETA — Test strategy v1.0 RC

Every scenario in SCENARIOS.md maps to at least one automated test or a named manual check. CI blocks merges
on red. Flaky tests are quarantined within 24 h with an owner and a fix-by date — never silently retried.

**v1 (ADR-019):** no server, so the server integration, load (k6), chaos and tamper layers are deferred with the
online layer, and `apps/server` has no coverage target. Contract tests cover the host ↔ game protocol only.
The scenario rows in scope for v1 are listed at the top of SCENARIOS.md.

## 1. Test layers

| Layer | Tooling | What it proves | When |
|---|---|---|---|
| Unit | Vitest | systems behave per GDD at exact ticks | every PR |
| Property | fast-check | invariants: AIR ∈ [0, cap], score monotonic, no NaN/Infinity, no overlapping spawns, fairness, determinism under random inputs | every PR (short), nightly (long) |
| Mutation | Stryker (sim scoring, streak, landing modules) | tests actually catch wrong logic; target score ≥ 80 % | weekly |
| Golden replays | `replay:verify` | recorded runs still produce the same hash | every PR |
| Cross-engine determinism | Playwright (Chromium, WebKit, Firefox) + Node | same replay → same hash everywhere | every PR touching sim |
| Synthetic players | headless bots on the sim (§3) | balance and difficulty targets; no unwinnable seeds | nightly |
| Integration (server) | Vitest + disposable Postgres/Valkey | API contracts, auth, tickets, validation, tamper suite | every PR |
| Contract | shared zod/JSON Schema | client↔API and host↔game messages stay compatible | every PR |
| E2E | Playwright (desktop 1440×900, mobile 390×844, touch emulation) | journeys J*, platform P*, network N*, host H* | every PR (smoke), nightly (full) |
| Visual regression | Playwright screenshots | menus, HUD, results stay on spec | every PR touching UI |
| Accessibility | axe + keyboard-only E2E | WCAG 2.2 AA for menus/HUD text | every PR touching UI |
| Performance | `perf:smoke` (seeded scripted run) + bundle-size check | budgets in ARCHITECTURE §12 | every PR (smoke), nightly (3 profiles) |
| Load | k6 against staging | INFRASTRUCTURE §2 L3–L5 | before each release |
| Soak | 30 consecutive runs / 2 h session | no memory growth, no leaks, no fps decay | nightly + release |
| Chaos | kill validators/Valkey/API in staging | degradation ladder works (INFRASTRUCTURE §3) | before release |
| Security | §4 | threats T1–T23 | per PR / nightly / release |
| Device lab | manual checklist | real iOS/Android quirks | per release |
| Playtests | 5 hallway testers + feel review | fun, clarity, onboarding | each phase exit |

## 2. Coverage targets

`packages/sim` ≥ 90 % lines / 85 % branches · `apps/server` ≥ 85 % / 80 % · UI: every screen has a visual
snapshot and an E2E path · every SCENARIOS row has a test reference.

## 3. Synthetic players (in-game agents for testing)

Headless bots drive the real sim through the same Action interface as humans.
| Bot | Behaviour |
|---|---|
| Novice | 350 ms reaction, ground layer only, 10 % input errors |
| Average | 220 ms reaction, jumps cars, occasional flips |
| Expert | 150 ms reaction, uses solver look-ahead, air layer, chains streaks |
| Chaos | random inputs at random rates — finds crashes, NaNs, stuck states |

Nightly: 1 000 runs per bot on the current build → distance and score distributions, death causes, style
share, mode frequency. Alerts when outside targets (e.g. Novice median < 600 m or Expert style share < 60 %).
The dashboard is the critic's main evidence for tuning.

## 4. Security tests

Semgrep + CodeQL (PR) · OSV-Scanner + `pnpm audit` (PR) · gitleaks (pre-commit + PR) · tamper suite (PR) ·
fuzzing of replay parser, API schemas and postMessage handlers (nightly) · header/CSP assertions in E2E (PR) ·
OWASP ZAP baseline on staging (release) · ASVS checklist (pre-launch) · external pen test before real-money rewards.

## 5. Known web-game bug classes we test for explicitly

WebGL context loss · iOS audio unlock and interruptions · Low Power Mode 30 fps · 120 Hz displays ·
orientation/resize mid-run · Safari dynamic toolbar (`dvh`) · edge-swipe/back gestures · storage quota,
private mode and partitioned iframe storage · device clock skew · float precision far from origin ·
shader compile hitches · asset/CDN partial failures · service-worker version skew · memory growth over many
runs · locale/plural/font fallback issues · double-tap and duplicate submission · timezones at weekly reset.

## 6. Release gates

A release ships only if: all CI green · nightly bots within targets · perf budgets met on Low/Mid/High ·
k6 L3 passes with SLOs · ZAP baseline has no high findings · license audit clean · device-lab checklist 100 % ·
runbooks exist for every O* scenario.

**v1 gates:** the same, except that k6 L3 is replaced by a static-origin smoke (cache headers, CSP, `disabled`
page, archive checksum), runbooks are required only for the v1 O* rows (O2, O6, O7, O8), and the device lab
includes the Iskendi embed in iPhone Safari, Android Chrome and the Telegram in-app browser.
