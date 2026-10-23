# KOMETA — Technical Architecture v0.2

Companion to `docs/GDD.md`. Invariants live in AGENTS.md §6; this document explains how to satisfy them.
Related: SECURITY.md (threats, anti-cheat), INFRASTRUCTURE.md (topology, load, ops), EMBEDDING.md (host
integration), SCENARIOS.md (behaviour catalogue), TEST_STRATEGY.md, AGENT_SYSTEM.md.

---

## 1. Overview

```
 keyboard / touch / gamepad
            │
      InputMapper ──► ActionQueue (tick-stamped)
                              │
   content/tuning ──► ┌───────▼──────────────── @kometa/sim (fixed 60 Hz) ─────────────┐
                      │ SimState + step(actions) + seeded RNG + event buffer           │──► replay log
                      └───────┬───────────────────────────────┬────────────────────────┘
                     snapshots (prev, curr)              events (per step)
                              │                               │
            Renderer (three.js, interpolated)      HUD binder · React UI · Audio · Haptics
                                                              │
                                                    API client ──► server (re-simulates replay)
```

---

## 2. Packages and dependency rules

```
@kometa/shared  ◄── @kometa/sim ◄── apps/web
      ▲                 ▲
      └── apps/server ──┘        (server imports sim to validate replays)
@kometa/content is data only; read by sim, web, server.
```

dependency-cruiser rules (CI-enforced):
- `packages/sim/**` may import only `packages/shared/**`, `packages/content/**` (data) and itself.
- `packages/sim/**` must not reference `three`, `react`, `zustand`, `howler`, `lib.dom` types, `Date`, `performance`.
- `apps/web/src/ui/**` must not import `apps/web/src/engine/**` internals (talk via the store/bridge).
- A fixture file that violates each rule lives in `tests/fixtures/boundaries/` and CI asserts it fails.

---

## 3. Game loop

- `requestAnimationFrame` drives the client. Real dt is clamped to 100 ms and accumulated.
- The sim steps at exactly 1/60 s. Max 5 steps per frame; beyond that the game slows down instead of spiralling.
- Rendering interpolates between the previous and current snapshot with `alpha = accumulator / step`.
- Pause stops stepping. `visibilitychange` → auto-pause. Resume shows a 3-2-1 overlay (input buffered).
- Snapshots are preallocated structs; traffic is struct-of-arrays (typed arrays) so copying is cheap.

---

## 4. Simulation design (`packages/sim`)

### 4.1 Coordinates and units
Lane space: `x` lateral metres (lane centre = `(lane − (laneCount−1)/2) × laneWidth`), `y` up, `z` forward
distance since last origin shift. Metres, seconds, litres. Angles stored in **turns** (1 turn = 360°) to keep
flip logic linear and trig-free.

### 4.2 State (sketch)
```ts
export type SimState = {
  simVersion: number; tick: number; seed: number; status: 'intro' | 'running' | 'crashed' | 'finished';
  player: {
    lane: number; laneTarget: number; laneT: number; x: number; y: number; z: number; vy: number;
    speedMps: number; pitchTurns: number; rollTurns: number; airborne: boolean; flying: boolean;
    platformId: number; coyoteS: number; airLiters: number; scrapeTimerS: number; penaltyS: number;
    mode: 'none' | 'liftoff' | 'cosmonaut' | 'overdrive'; modeS: number; graceS: number; item: ItemId | null;
  };
  traffic: TrafficSoA;      // fixed capacity, typed arrays: type, lane, z, speed, laneChangeT, flags
  pickups: PickupSoA;
  score: { total: number; streakN: number; streakS: number; pot: number; meter: number; smashChain: number };
  director: DirectorState;  // difficulty, wave phase, pattern cursor, row cursor
  rng: { director: RngState; pickups: RngState };
  stats: RunStats;          // counters for results + achievements
  events: SimEventBuffer;   // cleared at the start of every step
};
```

### 4.3 Step order
`input → timers/modes → lateral → vertical (jump/fly/slam/gravity) → forward (speed curve, boost) →
platforms & roofs → collisions (swept) → pickups → tricks & landing grades → scoring & streak → meter & mode
triggers → director (despawn/spawn, fairness) → achievements → stats → origin shift`.

### 4.4 Determinism rules
- PRNG: `sfc32` seeded via `splitmix32`; separate streams for director and pickups. Cosmetic randomness
  (particles, debris) lives in the renderer with its own unseeded RNG — it never affects the sim.
- Math: only `+ − × ÷`, `Math.floor/ceil/round/abs/min/max/sqrt`. The speed curve and any easing use LUTs
  generated at build time into `sim/tables.ts` (checked in, hash-tested).
- No iteration order assumptions beyond arrays. No floating accumulations across origin shifts without re-basing.
- State hash: FNV-1a over quantised key fields every 60 ticks and at the end.
- **Cross-engine test:** the same golden replay must produce identical hashes in Node, Chromium, WebKit and
  Firefox (Playwright runs a headless page that loads the sim bundle).

### 4.5 Collisions
AABB in lane space with per-vehicle boxes from `packages/content/vehicles.json`. Forward motion at 95 m/s is ~1.6 m per
step, so collisions are **swept on z** (segment vs box) to prevent tunnelling. Roof/platform tests use the top
face with a 0.25 m landing tolerance. Lateral contact during lane change = scrape; rear contact = crash.

### 4.6 Events
Discriminated union in `@kometa/shared/events.ts`, e.g.
`{ t: 'score', kind: 'flip', points, mult }`, `{ t: 'landing', grade }`, `{ t: 'crash', cause }`,
`{ t: 'mode', mode, on }`, `{ t: 'pickup', kind }`, `{ t: 'achievement', id }`, `{ t: 'originShift', dz }`.
Presentation subscribes; the sim never knows who listens.

### 4.7 Replays
```json
{ "schemaVersion": 1, "simVersion": 1, "seed": 123, "tuningHash": "…", "mode": "endless|weekly",
  "inputs": [[tick, actionBits], …], "claimedScore": 112126, "claimedDistanceM": 6699, "finalHash": "…" }
```
Inputs are stored only on change (run-length); typical size 2–10 KB. Client keeps the last 20 runs for
debugging and the best run for ghosts (v1.2).

---

## 5. Spawn director and fairness solver

- **Row generator:** at each row position chooses a pattern row (from the active pattern) or procedural filler
  weighted by difficulty `D(d)` and wave phase.
- **Solver:** builds a tiny graph over the next 3 rows: nodes = (lane, band ∈ {ground, roof, air}); edges =
  lane change (time cost from current speed), jump, fly (AIR cost), hop, platform ride. BFS with a time budget.
  If no path reaches row 3, remove the blocker with the lowest "pattern value" and retry (max 3 times; then
  clear a lane). Cost: ≤ 5 × 3 × 3 nodes per row — negligible.
- **Property test:** 10 000 random seeds × 10 km at simulated optimal input; assert zero unsolvable rows and
  that density, semi frequency and wave lengths stay inside configured ranges.
- **Patterns:** JSON with rows of lane tokens (`.` empty, `S` sedan, `V` van, `B` bus, `T` semi, `C` cones,
  `X` barrier, `R` ring line, `*` star, `A` air canister) plus metadata (minD, maxD, tags). Validated by zod;
  a CLI previews them as ASCII.

---

## 6. Renderer (`apps/web/src/engine`)

- three.js `WebGLRenderer`, sRGB output, one tone-mapping operator chosen in P3 and frozen (ADR).
- Lights: one directional "sun" + hemisphere fill. Shadows: hero car only (1024² map, tight frustum) on
  Medium/High; blob shadow decal on Low. Traffic uses baked contact shadows in the atlas.
- **World root** (floating origin) → **chunks** (200 m, pooled, biome-specific prefabs) → instanced props.
- **TrafficRenderer:** one `InstancedMesh` per vehicle type × LOD, shared palette material; per-instance colour
  via instance attributes; blinkers via a small emissive instance attribute.
- **Hero car:** glTF with wheel spin, suspension bob (renderer-only spring), flip/roll orientation from sim
  turns, thruster nodes driving particle emitters, emissive light bar intensity by speed/mode.
- **VFX:** instanced GPU quads for exhaust, dust, sparks, debris, fireworks; screen-space speed lines; per-mode
  colour grade (LUT) blended over 0.3 s.
- **Post:** High — bloom, vignette, mild chromatic aberration during modes, LUT grade. Medium — half-res bloom,
  LUT. Low — LUT only via a cheap full-screen pass or none.
- **Quality tiers + dynamic resolution:** initial tier from renderer capabilities, `deviceMemory`, and a 2 s
  warm-up benchmark during the intro ramp. During play, if p95 frame time > 20 ms over 3 s: lower pixel ratio
  (1.0 → 0.85 → 0.7) then the tier. Raise again after 10 s of headroom.
- **Loading:** GLTFLoader + MeshoptDecoder + KTX2Loader. Core set (hero, traffic, biome 1, UI fonts) preloaded
  before PLAY is enabled; biomes 2–3 stream in during the first run.
- **Disposal:** chunk unload disposes unique geometries/materials/textures; shared ones are ref-counted.

---

## 7. Camera rig

Spring-damper on position and look target (critically damped by default). Inputs: player snapshot, speed,
airborne/platform flags, mode, boost. Authored spline shots for the intro ramp and the results screen.
Reduced Motion: shake and FOV kick off, roll halved.

---

## 8. UI layer (`apps/web/src/ui`)

- React 19 + Zustand. Screens are a small explicit state machine (`menu → tutorial → intro → run → results`,
  plus overlays). No router library needed.
- **HUD binder:** subscribes to the latest sim snapshot each frame and writes `textContent` / CSS variables on
  refs. Per-field throttles (score odometer animates on its own clock). React components mount the DOM; they
  don't re-render per frame.
- CSS: custom properties for the GDD §19 tokens; `env(safe-area-inset-*)`; `touch-action: none` on the play
  surface; `user-select: none`; `overscroll-behavior: none`.
- Fonts: self-hosted WOFF2 subsets (Latin + Cyrillic), `font-display: swap`, preloaded on the menu.

---

## 9. Input (`apps/web/src/input`)

- Device adapters → `InputMapper` → actions `{ laneLeft, laneRight, jumpDown, jumpUp, slam, boostDown,
  boostUp, item, pause }` with timestamps → quantised to the next sim tick.
- Swipe recogniser: start point, dominant axis, ≥ 24 px within ≤ 180 ms; a swipe-up that stays down becomes
  "hold" (fly). Multi-touch: BOOST/ITEM buttons are separate pointer captures, so swipes still work while boosting.
- Gamepad: polled in rAF via the Gamepad API.
- Key remapping persisted in settings; defaults from GDD §4.

---

## 10. Audio (`apps/web/src/audio`)

howler.js sprites for SFX; music stems started together and cross-faded via Web Audio gain nodes; engine
pitch from speed. Event → sound map in `audio/cues.ts`. Unlock on the first user gesture (PLAY). Buses:
music / SFX / UI with ducking on big events. Haptics via `navigator.vibrate` where supported (Android),
silently skipped elsewhere.

---

## 11. Persistence, networking, backend

**Client storage:** IndexedDB (`idb-keyval`): profile, settings, bests, achievements, last runs, submit queue.
Every record has `schemaVersion`; migrations in `platform/storage/migrations.ts`.

**API** (Fastify, JSON, zod schemas shared with the client)

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/session/guest` | create a guest; returns token and generated name |
| POST | `/v1/auth/:provider` | link an OAuth identity (adapters chosen in DECISIONS) |
| GET | `/v1/me` | profile, bests |
| PATCH | `/v1/me` | rename (length, normalisation, profanity, confusables) |
| DELETE | `/v1/me` | account deletion request |
| GET | `/v1/weekly` | current week id and seed (server time) |
| POST | `/v1/runs/start` | **run ticket**: `{runId, seed, mode, issuedAt, expiresAt, mac}` — seed unknown before this call |
| POST | `/v1/runs/:runId/submit` | replay → `{status: accepted|pending|flagged|rejected, rank?, provisional?}`; idempotent per runId |
| GET | `/v1/runs/:runId/replay` | public replay of top runs (viewer, community review) |
| GET | `/v1/leaderboards/:period` | `period = alltime|weekly`; `limit`, `around=me` |
| GET | `/v1/health` | liveness |

**Run tickets** stop seed shopping: endless-mode seeds come from the server at run start; weekly-mode
tickets carry the shared weekly seed. One submission per ticket; TTL = max run length + buffer.

**Submit only when it matters:** the client submits personal bests, board-eligible runs and achievement syncs;
other runs stay local. This cuts validation load ~4× (INFRASTRUCTURE §2).

**Validation pipeline:** cheap pre-checks (supported simVersion, known tuningHash, ticket valid and unused,
compressed ≤ 64 KB / decompressed ≤ 256 KB, ticks ≤ 30 min, input rate, wall-clock vs ticks) → priority queue
(pg-boss; top-100 candidates first) → isolated worker with CPU/memory/time limits re-simulates with the
matching `@kometa/sim` version → accept if final hash, score and distance match → cheat heuristics score
(SECURITY §5) → `accepted` or `flagged` (hidden until human review) → upsert Valkey sorted sets + Postgres.
Rejections are logged with reason codes. Rate limits per IP and per player (Valkey token buckets).

**Database:** `players`, `identities`, `run_tickets`, `runs` (compressed replay blob, status, reason, heuristics
score), `lb_alltime` (best per player), `lb_weekly` (week_id, player, best), `achievements` (optional cloud
copy), `moderation_actions`, `audit_log`. **Valkey:** leaderboard sorted sets, rate-limit buckets, short caches.

**Hosting, scaling, caching, observability:** see INFRASTRUCTURE.md. **Security headers, auth, anti-cheat:** see SECURITY.md.

---

## 12. Performance budgets

Reference devices: **Low** — 2019–2020 mid Android (3–4 GB RAM); **Mid** — iPhone 11 / Pixel 6a class;
**High** — recent iPhone or desktop.

| Metric | Budget |
|---|---|
| Frame time | Mid: p95 ≤ 16.7 ms · Low (Low tier): p95 ≤ 33 ms |
| Draw calls | ≤ 150 |
| Visible triangles | ≤ 300k (Mid) |
| Hero car | LOD0 ≤ 15k tris (target 12k), ≤ 3 materials |
| Traffic vehicle | LOD0 ≤ 3k tris, LOD1 ≤ 800 |
| GPU texture memory | ≤ 64 MB |
| Initial JS | ≤ 400 KB gzip (three.js tree-shaken, UI code-split by screen) |
| First playable payload | ≤ 8 MB |
| Time to interactive on 4G | ≤ 5 s |
| GC | no pause > 8 ms during a run |
| Tab memory | ≤ 300 MB on Mid |

`pnpm perf:smoke` reports frame-time percentiles, draw calls and triangles from `renderer.info`, JS heap, and
bundle sizes; CI stores the report as an artifact and fails on > 10 % regression versus main.

---

## 13. Testing architecture

- **Sim:** Vitest unit tests per system; fast-check properties (AIR within [0, capacity]; score never decreases;
  no NaN/Infinity in state; fairness; determinism under random input streams); golden replays in
  `tests/replays/*.json` assert final hashes; cross-engine replay check via Playwright.
- **Web:** Playwright E2E (menu → run → results → retry), visual snapshots of every screen and the HUD at
  1440×900 and 390×844, keyboard-only navigation, touch-gesture simulation, axe accessibility scan, bundle-size check.
- **Server:** integration tests against a disposable Postgres; replay acceptance and tamper cases (edited score,
  edited inputs, wrong simVersion, replayed submission, impossible timing); k6 load test for `/v1/runs`.
- **Manual device lab** checklist per release (ROADMAP P7-02).

---

## 14. Telemetry (opt-in where required)

Events: `run_start`, `run_end` (cause, distance, score, style share), crash heat (biome, lane, obstacle type,
speed), tutorial step completion, quality tier and fps buckets, load timings. No personal data; random install id.

---

## 15. Platform targets

Primary: web PWA. Optional adapters behind `platform/portal.ts` — Telegram Mini App (viewport, haptics, share),
Yandex Games / CrazyGames / Poki SDKs (lifecycle, ads hooks if monetised). Read each portal's current technical
requirements before integrating; keep adapters thin so the core never depends on a portal.

---

## 16. Run modes and host embedding

The same client runs standalone, embedded in a host page (e.g. the Iskendi order-tracking front-end) via a
sandboxed iframe on its own origin, as a Telegram Mini App, or inside a portal. A thin `platform/host.ts`
adapter implements the versioned postMessage protocol from EMBEDDING.md; the core never knows which host it
is in. Embedded mode adds: lazy creation on tap, Lite asset set (≤ 3 MB), sound off by default, order chip in
the HUD, `order.ready` interrupt → pause + pick-up screen, and run resume (replay + snapshot saved locally
and, if signed in, on the server).

---

## 17. Synthetic players

`tools/bots` runs headless bots (Novice, Average, Expert, Chaos) against `@kometa/sim` for balance
dashboards, fairness checks and crash-finding (TEST_STRATEGY §3). Bots use the public Action interface only —
the same path as human input — so they also exercise the replay format.
