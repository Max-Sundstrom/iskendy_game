# KOMETA — Scenario catalogue v0.1

Every scenario has an ID, the expected behaviour, and the test that proves it. QA keeps the "Test" column in
sync with real test names. New scenarios are added here before code is written. Prefixes:
**J** journeys · **G** gameplay edge cases · **P** platform/device · **N** network/online · **A** abuse ·
**O** operations · **H** host embedding · **R** rewards (only if Q10 = yes) · **D** data/privacy.

## J — Player journeys

| ID | Scenario | Expected behaviour | Test |
|---|---|---|---|
| J1 | First launch on a phone from a shared link | Lite assets load ≤ 5 s on 4G; menu → tutorial offered; guest created lazily (only when online features are first needed) | E2E `first-launch` |
| J2 | First run, skips tutorial | Run starts after intro ramp; controls card shown during countdown | E2E |
| J3 | Returning player | Settings, bests, achievements restored from IndexedDB; weekly board refreshed | E2E |
| J4 | Desktop keyboard player | Key hints visible; all menus keyboard-navigable | E2E + axe |
| J5 | Gamepad player | Menus and play work without touching keyboard/mouse | manual + unit |
| J6 | Plays offline (airplane mode) | Game fully playable; online panels say "Offline"; submissions queued | E2E offline |
| J7 | Signs in after playing as guest | Guest progress merges into the account; conflicts resolved "best wins" | API + E2E |
| J8 | Uses two devices | Account sync; bests are max of both; settings per device | API |
| J9 | Shares a result | Web Share sheet with image card; fallback copy-link; deep link opens the game | E2E |
| J10 | Opens a friend's shared link | Lands on menu with "Beat 112 126" banner; no auto-start | E2E |
| J11 | Changes language mid-session | UI switches instantly; no reload; RU plurals correct | unit + visual |
| J12 | Accessibility settings on | Reduced motion removes shake/FOV kick; colour-blind mode bars; toggle-fly works | E2E + visual |
| J13 | Plays the weekly road | Same layout for everyone; weekly board shows rank; resets Monday 00:00 UTC (server time) | API + sim |

## G — Gameplay edge cases

| ID | Scenario | Expected behaviour | Test |
|---|---|---|---|
| G1 | Lane input at the edge lane | Ignored, small bump feedback | sim unit |
| G2 | Two lane inputs within the change window | Second is queued once; third dropped | sim unit |
| G3 | Jump pressed 100 ms before landing | Buffered; jumps on touchdown | sim unit |
| G4 | Leaves a trailer and jumps 80 ms later | Coyote time allows the jump | sim unit |
| G5 | AIR hits 0 mid-flight | Thrusters sputter, flight ends, car falls; no NaN | sim + property |
| G6 | Lands mid-flip exactly at 35.0° | STUNT (inclusive bound); 35.01° SLOPPY | sim boundary |
| G7 | Crashes while a streak pot is open | Pot lost; results show it as "lost" | sim |
| G8 | LIFTOFF fills during COSMONAUT | OVERDRIVE: +4 s and ×1.5; no double-stacking beyond one extension per mode | sim |
| G9 | Mode ends while overlapping a vehicle | 1 s grace; car phases out; no instant crash | sim |
| G10 | Slam onto a bus roof | Lands on platform; SLAM + ride; no crash | sim |
| G11 | Barrel roll into a lane occupied by a car at roof height | Lands on roof → HOP | sim |
| G12 | Lane-changing taxi moves into the player | Telegraph ≥ 0.8 s; contact = scrape rules | sim |
| G13 | Traffic spawns overlapping each other | Impossible by construction; property test asserts no overlap | property |
| G14 | Unwinnable row generated | Solver removes a blocker; property test over 10 000 seeds | property |
| G15 | 50 km run | Origin shifts keep precision; no jitter; score/distance correct | sim soak |
| G16 | Pause/resume 100 times in a run | State identical to a run without pauses (except pause log); replay validates | sim + API |
| G17 | Item picked while slot full | Ignored, small feedback; ring value granted instead | sim |
| G18 | Two achievements unlock on the same tick | Both recorded; toasts queued | sim + UI |
| G19 | Score overflows display width | Odometer adds digits; layout holds to 9 digits | visual |

## P — Platform and device

| ID | Scenario | Expected behaviour | Test |
|---|---|---|---|
| P1 | Tab hidden / app switched | Auto-pause; audio suspended; resume with 3-2-1 | E2E |
| P2 | Incoming phone call / audio interruption | Pause; AudioContext resumes on next gesture | manual iOS/Android |
| P3 | **WebGL context lost** (backgrounded on mobile) | Pause; on restore, rebuild GPU resources and continue; if restore fails, offer "reload, progress saved" | E2E (forced loss via extension) |
| P4 | Orientation change mid-run | Pause, relayout HUD, resume on tap | E2E |
| P5 | iOS Low Power Mode (30 fps rAF) | Fixed-step sim unaffected; renderer drops to 30 smoothly | manual |
| P6 | 120 Hz display | Interpolation smooth; sim still 60 Hz | manual |
| P7 | Low memory device | Low tier, smaller atlas, fewer chunk props; no crash in 30-run soak | soak |
| P8 | Mobile Safari dynamic toolbar resizes viewport | Uses `dvh`; HUD never under toolbar | visual |
| P9 | Edge swipe (iOS back) / Android back button | Pause menu, never leaves the page mid-run | E2E Android, manual iOS |
| P10 | Private browsing / storage quota exceeded | Game works; warns that progress won't persist; online account still syncs | E2E |
| P11 | **Third-party iframe storage partitioned** (Safari/Firefox in embedded mode) | Treat local storage as ephemeral; rely on server profile via host token or Storage Access API prompt | E2E WebKit |
| P12 | Device clock wrong | Weekly boundaries and tickets use server time | API |
| P13 | Shader compile hitch on first effect | Precompile all materials during intro ramp (`renderer.compile`) | perf smoke |
| P14 | WebGL2 unavailable | Friendly message (standalone) / entry point hidden (embedded) | E2E with flag |
| P15 | Slow 3G | Lite set; progress bar; can start after core set | E2E throttled |
| P16 | Fonts fail to load | System fallback stack; layout holds | visual |

## N — Network and online

| ID | Scenario | Expected behaviour | Test |
|---|---|---|---|
| N1 | Submit fails (timeout/5xx) | Queued, exponential backoff, retried on next launch; user sees "Will upload when online" | E2E |
| N2 | Validation pending > 1 min | Rank shown as provisional; updates in background | API + E2E |
| N3 | Replay rejected | Owner sees "Couldn't verify this run" with a reason category; no public entry | API + E2E |
| N4 | **Deploy during a session** (version skew) | Old client's simVersion still validated; SW prompts reload on menu, never mid-run | API + E2E |
| N5 | Weekly rotation while a weekly run is in progress | Run counts for the week its ticket was issued in | API |
| N6 | API down entirely | Online UI hidden; game playable; no error spam | E2E |
| N7 | CDN asset 404/partial outage | Retry with backoff; fall back to Lite pack; clear error if core fails | E2E |
| N8 | Duplicate submission (double tap / retry) | Idempotent by runId | API |

## A — Abuse (mapped to SECURITY.md threats)

| ID | Scenario | Expected behaviour | Test |
|---|---|---|---|
| A1 | Forged score (T1) | Rejected after re-simulation | tamper suite |
| A2 | Edited inputs (T2) | Hash mismatch → rejected | tamper suite |
| A3 | Seed shopping (T3) | Impossible: no ticket → no submission; ticket seed unknown in advance | API |
| A4 | TAS-like replay (T4) | Flagged; hidden from public boards until reviewed | heuristic tests |
| A5 | Slowed clock (T5) | Flagged when unpaused wall time ≫ ticks | API |
| A6 | Zip bomb / 10M-tick replay (T10) | Rejected before decompression/simulation | fuzz + API |
| A7 | Offensive or impersonating name (T8) | Rejected or masked; reportable | unit + E2E |
| A8 | Botnet guest creation (T7) | Rate limits → captcha on anomaly | k6 |
| A9 | Spoofed postMessage (T14) | Ignored (origin mismatch or schema fail) | unit |
| A10 | Mass asset downloading (T21) | CDN rate limit; egress alert | alert test |

## O — Operations

| ID | Scenario | Expected behaviour | Test/runbook |
|---|---|---|---|
| O1 | SIM_VERSION bump | Old validators retained until old clients age out (≥ 30 days); boards may reset per season if rules change materially | runbook |
| O2 | Rollback a bad client deploy | Re-point index to previous hashed build; SW picks it up | runbook + drill |
| O3 | Rollback a bad API deploy | Canary auto-rollback on error spike | drill |
| O4 | Cheat wave on weekly board | Freeze board, re-validate with tightened heuristics, purge, notify | runbook |
| O5 | Restore from backup | RPO ≤ 15 min, RTO ≤ 2 h | quarterly drill |
| O6 | Leaked secret | Rotate, audit, post-mortem within 48 h | runbook |
| O7 | Cost spike | Alert at 50/80/100 %; cache rules; block abusers | alert test |
| O8 | Hide the game inside the host instantly | Feature flag kill switch (no host deploy) | E2E flag test |

## H — Host embedding (Iskendi order tracking or a portal; see EMBEDDING.md)

| ID | Scenario | Expected behaviour | Test |
|---|---|---|---|
| H1 | Tracking page loads | No game code/assets loaded; page metrics unchanged | Lighthouse diff |
| H2 | Taps "Play while you wait" | Iframe created; Lite set loads; order chip visible in HUD | E2E |
| H3 | **Order becomes ready mid-run** | Host posts `order.ready`; game pauses immediately, full-screen "Your order #N is ready" with Pick-up CTA; run can be resumed later or ended and submitted | E2E with mock host |
| H4 | Order cancelled or delayed | Chip updates; no interruption unless ready | E2E |
| H5 | Player closes the game | Host regains full page; run saved for resume (replay + snapshot) | E2E |
| H6 | Game crashes inside the iframe | Host unaffected; entry point shows "Game unavailable" | E2E fault injection |
| H7 | Host and game deployed independently | Versioned message protocol; unknown messages ignored | contract tests |
| H8 | Player comes back after pickup (new order or no order) | Game works standalone; order chip hidden | E2E |
| H9 | Host theme/locale | Init message passes locale; game follows it | E2E |

## R — Rewards (deferred: Q10 = later; keep rows as the spec for when rewards ship)

| ID | Scenario | Expected behaviour | Test |
|---|---|---|---|
| R1 | Player earns a reward-eligible achievement | Issued server-side after validation; delivered via host account (e.g., promo code) | API |
| R2 | Same person, many guest accounts | Cap per verified identity (phone/loyalty id), not per account | API |
| R3 | Reward issued, run later rejected | Revoke if unused; audit log | API |
| R4 | Reward service down | Pending state; retried; never issued twice (idempotency key) | API |

## D — Data and privacy

| ID | Scenario | Expected behaviour | Test |
|---|---|---|---|
| D1 | Guest plays, never signs in | No personal data stored server-side beyond random ids and coarse telemetry | review |
| D2 | Account deletion request | Profile, identities and replays deleted within 30 days; boards anonymised | API |
| D3 | Analytics consent declined | No analytics events sent; game unaffected | E2E |
| D4 | Data export request | JSON export of profile, runs, achievements | API |
