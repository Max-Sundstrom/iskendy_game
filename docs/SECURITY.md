# KOMETA — Security, anti-cheat and compliance v1.0

Scope: web client, game-service API, replay validators, data stores, CDN, CI/CD, the asset pipeline, the AI
agents that build the game, and integration with any host product (Iskendi order tracking, web portals).
Method: STRIDE per component, then mitigations, then tests. Reviewed at every phase exit by `security-engineer`.

**Principle:** the browser is hostile territory. Anything with value — leaderboard rank, rewards, unlocks,
achievements that sync — is decided on the server. The client may be modified freely; it can only hurt itself.

**v1 threat review (A-03, done in A-07 on 2026-10-23).** v1 is a static client on its own origin, embedded by the
Iskendi front-end; no game server, accounts, personal data or rewards (ADR-019, ADR-020). In scope for v1:
T12, T13, T14, T15, T16, T17, T18, T21, T23, plus the host-availability asset (invariant 12). Deferred with the
online layer: T1–T11, T19, T22 (they return with the server). T20: the v1 promo code is client-generated and
display-only, so it is **not** a reward; anyone can produce such a string, and nothing may honour it until a
server issues and checks codes. New v1 point: the promo code is never put into URLs, analytics or logs by the
game, and it is sent to the host only in `game.runEnded`.

---

## 1. Assets worth protecting

| Asset | Why it matters |
|---|---|
| Leaderboard integrity | the competitive core; cheated boards kill retention |
| Rewards / promo codes (if enabled, Q10) | direct money; attracts organised abuse |
| Player identity and personal data (OAuth email/phone, if any) | legal exposure (152-FZ, GDPR) |
| Host product availability (Iskendi order tracking) | a game incident must never stop people getting their food |
| Infrastructure budget | CDN egress and compute can be drained ("denial of wallet") |
| Source, CI secrets, signing keys, deploy credentials | supply-chain takeover |
| Brand and IP | asset licensing and trademark claims |

---

## 2. Trust boundaries

```
[ Player device: browser, game client ]  ← untrusted
        │ HTTPS (CDN/WAF)
[ CDN: static assets ]      [ game-service API ] ── [ Valkey: rate limits, leaderboards cache ]
                                   │                         │
                            [ validator workers ] ── [ PostgreSQL ]
[ Host page (Iskendi / portal) ] ──postMessage──► [ game iframe on its own origin ]
[ CI/CD + AI agents ] ──(PRs only)──► [ repo ] ──(human-approved deploy)──► [ prod ]
```

---

## 3. Threat register (STRIDE) and mitigations

| ID | Threat | Mitigations | Test |
|---|---|---|---|
| T1 | Forged score (POST arbitrary numbers) | Server re-simulates every leaderboard-eligible replay; claimed score is never trusted | tamper suite |
| T2 | Edited replay inputs or state | Re-simulation + final hash; replay carries no authority | tamper suite |
| T3 | **Seed shopping** — simulate many seeds offline, play only easy ones | **Run tickets:** `POST /v1/runs/start` returns `{runId, seed, issuedAt, expiresAt, mac}`; seed unknown before start; one submission per ticket; ticket TTL = max run length + buffer; tickets per player rate-limited | API tests |
| T4 | **Tool-assisted / bot play** (perfect inputs computed offline; weekly seed is known all week) | Cannot be fully prevented on the web — make it costly and detectable: input-timing heuristics (frame-perfect streaks, zero variance, reactions before an obstacle enters draw distance), wall-clock check, sudden-improvement detection vs the player's history, **manual review queue for weekly top 100** with an in-game replay viewer, public "watch replay" + report button, prize eligibility only for signed-in accounts | heuristic unit tests on synthetic TAS replays |
| T5 | Slow-motion / speed hacks (throttled clock to gain reaction time) | Sim is tick-based; server compares unpaused wall time vs ticks (flag if > 1.3× slower); pause count and total pause time recorded in the replay and capped | API tests |
| T6 | Client memory editing, god mode, modified JS | Irrelevant to the server (T1–T2); local-only effects accepted | — |
| T7 | Multi-accounting and leaderboard spam | Guest creation rate-limited per IP/subnet; invisible captcha only on anomalies; one board entry per account; prize boards require sign-in | rate-limit tests |
| T8 | Abusive or impersonating names, stored XSS via names | zod length/charset; Unicode NFKC normalisation; confusables check; RU/EN profanity list; reserved names (admin, moderator, brand names); rendered as text only; report + moderation tool | unit + E2E |
| T9 | API flooding / DDoS | CDN + WAF in front of everything; per-IP and per-player token buckets in Valkey; request body caps; validation queue back-pressure (HTTP 429 + `Retry-After`); circuit breakers | k6 |
| T10 | **Malicious replay payloads** (zip bomb, huge tick counts, prototype pollution, ReDoS) | Size cap before decompression (≤ 64 KB compressed, ≤ 256 KB decompressed); tick cap (≤ 30 min of ticks); safe JSON parsing (reject `__proto__`/`constructor` keys); no regex on untrusted strings except vetted linear ones; validators run in isolated workers with CPU-time, memory and wall-time limits | fuzzing (fast-check + structure-aware fuzzer) |
| T11 | Session theft, CSRF, OAuth flaws | Same-site mode: httpOnly + Secure + SameSite=Lax cookies. Embedded/portal mode (third-party context): short-lived bearer tokens kept in memory + refresh token rotation. OAuth: PKCE + state + nonce, exact redirect URI allowlist. Revocation on logout | auth tests |
| T12 | XSS in the client | Strict CSP with no inline script (hashes/nonces only), `script-src 'self'` + `'wasm-unsafe-eval'` for meshopt/KTX2 decoders, Trusted Types, no `dangerouslySetInnerHTML`, no third-party scripts in the game origin | header tests, ZAP |
| T13 | Clickjacking / hostile embedding | `frame-ancestors` allowlist (own domains, Iskendi host, approved portals) | header tests |
| T14 | **Malicious host messages** (postMessage spoofing) | Exact `event.origin` allowlist; zod schema per message; host messages carry no secrets and grant no value (order status is cosmetic unless backed by a server-verified token) | unit tests |
| T15 | Supply-chain attack via npm | Lockfile committed; exact versions; new versions only after a 14-day minimum release age (Renovate); `pnpm` build scripts allowlist; OSV-Scanner + `pnpm audit` in CI; SBOM (CycloneDX) per release; avoid tiny single-maintainer packages | CI |
| T16 | Secrets leaked into repo, bundle or prompts | gitleaks pre-commit and in CI; secrets only in the CI/hosting secret store; bundle scan for key patterns; secrets never pasted into AI prompts | CI |
| T17 | CI/CD compromise | Branch protection, required reviews, required checks; OIDC short-lived deploy credentials; production deploys need a human approval; pinned GitHub Actions by commit SHA | repo settings audit |
| T18 | **AI-agent risks**: prompt injection from third-party text (asset READMEs, web pages, issues, PR comments), over-privileged agents, "test edited to pass" | Agents treat fetched content as data; agents have no production credentials; network access limited to package registries and docs; human approval for new dependencies, migrations, infra and deploys; agent-written code passes the same gates; reviewers check that tests weren't weakened (assertion diffs flagged) | review checklist |
| T19 | Personal-data breach or unlawful processing | Data minimisation (guests store no PII); encryption in transit and at rest; IP addresses kept ≤ 30 days in logs; deletion endpoint; see §6 | DPIA checklist |
| T20 | Reward fraud (deferred — rewards come later; the v1 promo code of ADR-020 is client-generated and has no value) | Rewards issued only by the server after validated runs; per-person/day caps tied to a verified identity (phone/loyalty id via the host); fraud dashboard; legal review of the promotion mechanics | scenario tests R* |
| T21 | Denial of wallet (scripted mass asset downloads) | Long-lived CDN caching, CDN rate limits, egress alerts and budget caps, no uncached large origins | alerting test |
| T22 | Admin/moderation takeover | Separate admin app; SSO + hardware-key 2FA; IP allowlist; full audit log; least-privilege DB roles | access review |
| T23 | Asset/IP claims | License ledger with proof; takedown runbook; brand-name scans | license audit |

---

## 4. Web security baseline (configured in P0-07)

- HTTPS only; HSTS with preload once stable.
- Headers: `Content-Security-Policy` (strict, report-to), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (deny camera, mic, geolocation…;
  allow gamepad, fullscreen, screen-wake-lock, vibrate where needed), `Cross-Origin-Opener-Policy: same-origin`
  on the standalone site (not on the embed if it breaks hosts), `frame-ancestors` allowlist.
- CORS: explicit origin allowlist; no wildcard with credentials.
- Separate origins: game client (`play.` subdomain or own domain), API (`api.`), admin (`admin.`, VPN/allowlist).
  Never serve the game from the host product's origin. v1 has only the client origin (`play.iskendy.ru`, ADR-021).
- Error responses carry no stack traces; request ids for support.

---

## 5. Anti-cheat architecture summary

1. **Run ticket** issued at start (T3).
2. Client records inputs per tick + pause ranges → replay.
3. Submit only when the run could change something (personal best, board entry, achievement sync).
4. Cheap pre-checks: version, tuning hash, ticket validity, sizes, wall-clock plausibility (T5, T10).
5. Queue → validator re-simulates with the matching `@kometa/sim` version → hash/score/distance must match.
6. Heuristics score (T4) → `clean` / `flagged` / `rejected`. Flagged runs show as "pending review" to their
   owner only; weekly top 100 always passes human review before prizes.
7. Replays of top runs are public (viewer), so the community acts as a second line of review.

Accepted residual risk: a determined TAS author can produce a plausible-looking run. Prize eligibility rules
(signed-in, reviewed, capped) contain the damage.

---

## 6. Privacy and compliance (confirm with a lawyer before launch)

- **v1:** no personal data, no cookies and no analytics on the game origin; local storage holds only settings,
  bests, achievements and local runs. The host's privacy notice covers the host page.
- **Russia, 152-FZ:** if you collect personal data of Russian citizens (e.g. phone/email via sign-in), the
  primary database must be located in Russia, you act as a personal-data operator (registration with
  Roskomnadzor), and you need a privacy policy and consent text. Guest-only play without PII keeps this minimal.
- **EU/UK GDPR** if you target those players: lawful basis, consent for analytics, data subject rights.
- **Age labelling (Russia, 436-FZ):** online content needs an age mark (likely 6+ or 12+ for cartoon crashes).
- **Promotions with prizes** (if Q10): skill-based contests and prize draws have their own rules in Russia
  (stimulating events / lotteries); get the mechanics reviewed before launch.
- Analytics: privacy-first, consent where required, no third-party trackers on the game origin by default.
- Retention: replays of non-top runs deleted after 30 days; logs with IPs after 30 days; account deletion on request.

---

## 7. Security testing (see TEST_STRATEGY.md §4)

SAST (Semgrep + CodeQL) on every PR · dependency and secret scanning on every PR · fuzzing of replay parser,
API schemas and postMessage handlers nightly · tamper and auth suites in CI · OWASP ZAP baseline against
staging every release · header checks in E2E · OWASP ASVS Level 1 checklist (Level 2 for auth/rewards) before
launch · threat-model review at each phase exit · an external pen test before enabling real-money rewards.

---

## 8. Incident response

Severity levels, on-call (the owner), and runbooks in `docs/runbooks/`: leaderboard cheat wave (freeze board,
re-validate, purge), API abuse (tighten rate limits, enable captcha), secret leak (rotate, audit, post-mortem),
CDN cost spike (cache rules, block offenders), validator outage (queue persists; provisional ranks),
host-integration incident (kill switch hides the game entry point in the host without a host deploy).
