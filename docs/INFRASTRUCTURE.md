# KOMETA — Infrastructure, load and operations v1.0 RC

Goal: survive a viral spike without a large bill, and never degrade a host product (Iskendi order tracking)
that embeds the game.

---

## 0. v1 deployment (ADR-019; hosting proposal ADR-021, A-04)

v1 has no game service: the client is static files. Proposed topology (needs the owner's approval — it is an
infrastructure change):

```
 guest phone ──HTTPS──► shared Caddy on the Iskendi server (Russia; config in the iskendy_analytic repo)
                          ├─ iskendy host  → Iskendi container (FastAPI + guest front-end)   — unchanged
                          └─ play.iskendy.ru → iskendy-game container (static files only, no app server)
```

- **Origin:** `play.iskendy.ru` (front-end Q-33): a different origin from the host, same server, TLS by Caddy.
- **Container:** a minimal static web server image that serves the release archive with the cache headers of
  §4 and the game CSP (`frame-ancestors` = the Iskendi host origin). No secrets, no database, no writes.
- **Delivery:** CI builds `kometa-web-X.Y.Z.tar.gz` + SHA-256 as a GitHub Release; the server pulls a pinned
  version. Rollback = pin the previous version (O2).
- **Kill switch:** replace the build with the `disabled` page, which answers with `game.error { code: 'disabled' }`
  (EMBEDDING §2); the host's own flag is the slower path.
- **Egress (L1):** ≈ 3 MB per first play, cached for returning guests. At an assumed 200 orders/day × 30 %
  opt-in ≈ 180 MB/day ≈ 5–6 GB/month; even 1 000 orders/day ≈ 27 GB/month — well inside a VPS traffic
  allowance, so no CDN in v1. Replace the assumption with real order numbers after launch.
- **When this stops being enough:** a public standalone build (L2 ≈ 0.9 TB/month, L3 ≈ 3 TB in 48 h) needs a
  Russian CDN in front of the same files before launch; the online layer (§1) needs its own hosting decision.

Everything from §1 on describes the full online design and the standalone/viral profiles; it is deferred
until ranking or a public build returns.

## 1. Topology

```
                         ┌──────────── CDN + WAF ─────────────┐
 players ──HTTPS──►      │ static: client JS, GLB, KTX2, audio │  (immutable, content-hashed, long cache)
                         │ edge-cached GET leaderboards (60 s)  │
                         └───────────────┬─────────────────────┘
                                         │ /v1/*
                              ┌──────────▼──────────┐
                              │ game-service API    │  stateless Node/Fastify, N replicas, autoscale on CPU/RPS
                              └──┬───────────┬──────┘
                       rate limits│           │enqueue
                     leaderboards ▼           ▼
                            ┌─────────┐  ┌──────────────┐
                            │ Valkey  │  │ job queue    │ (pg-boss in Postgres)
                            └─────────┘  └──────┬───────┘
                                                ▼
                                   ┌───────────────────────┐
                                   │ validator workers     │  same @kometa/sim versions, CPU-bound, autoscale on queue depth
                                   └──────────┬────────────┘
                                              ▼
                                       ┌────────────┐
                                       │ PostgreSQL │  source of truth; PITR backups
                                       └────────────┘
 Host product (Iskendi tracking front + FastAPI) ── separate deploy, separate DB, separate domain.
 It only embeds the game iframe; it never calls game-service, and game-service never calls it (unless rewards, Q10).
```

Valkey (open-source Redis fork) holds sorted sets for all-time and weekly ranks (O(log n) rank lookups and
"around me" queries) plus token-bucket rate limits. Postgres stays the source of truth; Valkey can be rebuilt from it.

---

## 2. Load scenarios

| ID | Scenario | Assumptions (tune with real data) |
|---|---|---|
| L1 | **In-store only** (embedded in Iskendi tracking) — **v1 profile, the only one in scope** | orders/day × 30 % opt-in × 3 runs; tiny — static files on the existing server are enough (§0) |
| L2 | Organic web | 5 000 DAU, 4 runs each, 2 sessions/day |
| L3 | **Viral spike** | 500 000 sessions in 48 h; peak hour = 15 % of the day; 4 runs/session. The reference reel had ~58.5k likes and ~36.5k shares — this is a realistic upper planning case, not fantasy |
| L4 | Weekly reset burst | everyone fetches the new weekly seed/board within minutes of Monday 00:00 UTC |
| L5 | Abuse | 1 000 req/s of junk submissions from a botnet |

### Capacity math for L3

- **CDN egress:** first-visit payload ≈ 3 MB (Lite first-playable, §5) + ≈ 5 MB streamed during play for those
  who keep playing. 500k sessions × ~6 MB average ≈ **3 TB in 48 h**. Static files are the dominant cost —
  egress pricing, not compute, decides the provider. Set budget alerts.
- **Runs:** 500k × 4 = 2M runs / 48 h. Only runs that could change something are submitted (personal best,
  board entry, achievement sync) ≈ 25 % → **500k submissions**. Peak hour ≈ 37.5k → **~10/s average, ~50/s bursts**.
- **Validation CPU:** budget **≤ 100 ms CPU per 2-minute run** (7 200 ticks ≈ 14 µs/tick, measured in P1).
  50/s × 0.1 s = **5 cores** at burst. Queue absorbs spikes; top-100 candidates get priority, the rest may lag
  minutes ("pending verification" rank shown).
- **API:** guest creation ≤ 10/s, run tickets ≈ 4× sessions rate ≈ 50/s peak, leaderboard reads edge-cached
  (origin ≈ 1 req/min per board variant). 2–3 small API replicas with headroom.
- **Database:** ≈ 6 KB per stored replay → ≈ 3 GB per viral 48 h before retention cleanup; writes ≈ 50/s.
  A single managed Postgres with a replica is plenty.
- **L5 abuse:** rejected at the edge (WAF rules, per-IP buckets) and by size/ticket pre-checks before any CPU-heavy work.

---

## 3. Scaling and resilience rules

- API and workers are stateless containers; scale API on CPU/RPS, workers on queue depth.
- Back-pressure: if queue wait > 2 min, accept submissions but mark ranks provisional; never drop data silently.
- Degradation ladder: validators down → provisional ranks; Valkey down → leaderboards from Postgres (slower,
  cached longer); Postgres down → client keeps the submit queue locally and retries; API down → game stays
  fully playable offline (PWA), online features hidden.
- Feature flags (JSON on the CDN, short TTL) gate online features, events and the host-embed entry point
  (kill switch without a deploy).

---

## 4. Caching

| Resource | Cache |
|---|---|
| hashed JS/CSS/GLB/KTX2/audio | `public, max-age=31536000, immutable` |
| `index.html`, `sw.js`, `flags.json` | `no-cache` (revalidate), short TTL |
| `GET /v1/leaderboards/*?limit=100` | edge 60 s + `stale-while-revalidate=300` |
| `GET /v1/weekly` | edge until week end, purged at rotation |
| personal endpoints (`/v1/me`, `around=me`) | private, no edge cache |
| Service worker | precache core set; runtime cache for biome packs; versioned, prompts reload on update |

---

## 5. Front-end load budgets (including the embedded case)

| Mode | Code (gz) | Assets to first play | Notes |
|---|---|---|---|
| Standalone | ≤ 400 KB | ≤ 8 MB (≤ 3 MB on Save-Data/2G-3G) | biomes 2–3 stream during play |
| **Embedded (host page)** | host pays **0 KB** until the player taps "Play while you wait" | Lite set ≤ 3 MB | iframe created on tap; no preloading on cellular; optional idle preload on Wi-Fi only |

Embedding must not move the host page's Core Web Vitals: the entry point is a static button; no game scripts,
fonts or WebGL context exist before the tap. Device gate: if WebGL2 or memory is insufficient, the entry point
is hidden rather than offering a broken game.

---

## 6. Observability and SLOs

- **Errors:** Sentry-compatible reporting (self-hosted GlitchTip is an option) for client and server; source
  maps uploaded privately. **v1 (Q18):** no reporting service; fatal errors reach the host as `game.error`,
  and Caddy access logs on the server show 4xx/5xx for the game origin.
- **Metrics/traces:** OpenTelemetry → Prometheus/Grafana (or the host cloud's equivalent). Key metrics: RPS,
  p95 latency, 4xx/5xx, queue depth and wait, validation CPU per run, rejection reasons, CDN egress/day,
  client fps buckets, WebGL context losses, load-time percentiles.
- **SLOs:** API availability 99.5 % monthly; `POST /v1/runs` accept p95 < 300 ms; validation wait p95 < 60 s
  for top-100 candidates; client crash-free sessions ≥ 99.5 %.
- **Alerts:** SLO burn rate, queue wait > 2 min, rejection-rate spike (cheat wave or a bad deploy), egress
  above daily budget, error spike after deploy (auto-rollback candidate).

---

## 7. Environments and delivery

`dev` (local) → `preview` (per-PR static deploy + ephemeral API) → `staging` (prod-like, seeded data, ZAP
and k6 run here) → `prod`. Blue/green or canary for API; static client is atomic (hashed files + index swap).
Database migrations are forward-only, run before code that needs them, and tested on a staging snapshot.

---

## 8. Hosting choices (decide with Q4/Q13)

**Decided:** Russia (Q13, ADR-019). **Proposed for v1:** static container on the Iskendi server behind the shared
Caddy (§0, ADR-021). The options below apply when the standalone build or the online layer arrives.

Pick the region nearest the target audience and compare **egress pricing** first.
- Mostly Russian audience: Russian cloud/hosting with a local CDN and DDoS protection; this also covers
  152-FZ data localisation if you store personal data.
- Global audience: a global CDN with WAF and a managed Postgres in the main market.
- Hybrid: static assets on a global CDN, personal data in-region, API near the data.
Keep everything in Docker + infrastructure-as-code (OpenTofu/Terraform or the provider's equivalent) so moving is cheap.

---

## 9. Backups and disaster recovery

v1 stores nothing on the server: the release archives on GitHub are the backup, and recovery is a re-pull of a
pinned version. The rest of this section applies to the online layer.
Postgres point-in-time recovery (7–14 days) + nightly logical dumps to separate storage; Valkey rebuildable;
assets reproducible from the repo. **RPO ≤ 15 min, RTO ≤ 2 h.** A restore drill before launch (P7-08) and
quarterly after.

---

## 10. Cost guardrails

Budget alerts at 50/80/100 % per month; CDN egress dashboard; autoscaling max replicas capped; replay
retention job; log sampling for high-volume info logs; monthly cost review in PROGRESS.md.
