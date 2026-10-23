# KOMETA — Prompt library

Prompts for starting each phase and for specialist jobs. Each has a **Claude Code** version (repo access,
subagents) and a **ChatGPT** version (Codex with repo access, or plain chat with attached files).

## How to use with each tool

- **Claude Code:** run from the repo root. `CLAUDE.md` loads automatically and imports `AGENTS.md`;
  subagents in `.claude/agents/` are available. One phase task (or a small group) per session.
- **OpenAI Codex (cloud or CLI):** reads `AGENTS.md` automatically. Paste the ChatGPT variant and name the task card.
- **Plain ChatGPT:** no repo access. Attach `AGENTS.md`, the task card and the doc sections the prompt lists.
  Ask for complete files, not diffs; apply them yourself; paste test output back for the next step.

---

## Universal ChatGPT wrapper (prepend to any ChatGPT variant)

```
You are acting as the <ROLE> on Project KOMETA, a 3D web highway runner. I've attached AGENTS.md (binding
rules), <DOCS>, and task card <ID>. Follow AGENTS.md exactly, especially §6 invariants and §8 Definition of Done.

Output, in this order:
1. A plan of at most 8 bullets.
2. Every new or changed file in full, each in its own code block whose first line is a comment with its path.
3. Commands to verify, with the output you expect.
4. The completed handoff note for the task card.

If you're unsure about a library API, say so and name the doc page to check instead of guessing.
Don't invent product decisions: use the defaults in DECISIONS.md and list any new open question.
```

---

## Phase A — Architecture and scenario sign-off

**Claude Code**
```
You are the Orchestrator. Read every doc in docs/ plus AGENTS.md. Goal: Phase A (ROADMAP).
1. Cross-check all docs for contradictions (numbers, names, endpoints, budgets, IDs) and list them.
2. For each open question in DECISIONS.md, restate the impact of each answer on architecture, security,
   load and schedule in two lines, then ask me — one question at a time.
3. With security-engineer: re-run the threat register against my answers (embedded? rewards?).
4. With qa-engineer: walk SCENARIOS.md; propose missing scenarios; give every row a test reference.
5. With sim-engineer: A-06 benchmark spike in a scratch folder (not production code).
6. Produce docs v1.0 and a one-page "Architecture v1.0" summary for my signature.
```

## Phase D0 — Design Agreement

**Vehicle blockouts (Claude with the Blender connector, or bpy scripts)**
```
Act as tech-artist with art-director reviewing. Read ART_DIRECTION.md §1–§8 and ASSETS.md §5.
Build three grey blockouts at true scale — A "Pobeda R", B "Samodelka", C "Chaika GT" — primitives and simple
bevels only, separate wheel objects, exact node names, thruster empties, front facing +Z after export.
Light them with a warm low sun from behind-left and a teal hemisphere fill (Embankment Gold).
Render each from: chase camera (6.5 m behind, 2.8 m up), side, rear ¾, top — 1024² each — plus one sheet with
all three side profiles at the same scale. Save to assets/source/concepts/ and report triangle counts.
No badges, text, grilles or features copied from real cars. Stop for my choice.
```

**Art-direction board (Figma)**
```
Act as art-director. Create a Figma board with sections: Palette (ART_DIRECTION §4 swatches + per-biome
gradients), World archetypes (silhouette sketches for each biome), Traffic sub-palette, Wet-road technique
(reference frames you create, no copyrighted stills), HUD tone (odometer score, mode bar, AIR bar).
Name sections by topic. Don't use GTA/Rockstar imagery, logos or fonts.
```

**Style-test chunk**
```
Act as render-engineer. Build D0-3: 200 m of Embankment Gold with the wet-road technique, bloom, fog, 30
instanced traffic cars and the chosen car blockout. Measure on the Mid profile with perf:smoke and attach
p50/p95 frame time, draw calls and triangles, plus four screenshots. This is a throwaway spike branch.
```

---

## P0 — Bootstrap

**Claude Code**
```
You are the Orchestrator for Project KOMETA. Read CLAUDE.md, docs/ROADMAP.md (Phase 0), docs/ARCHITECTURE.md
§2 and §13, and docs/DECISIONS.md.

Goal: complete P0-01 … P0-06.
1. Write task cards docs/tasks/P0-0X.md from the template in AGENTS.md §9.
2. Execute in order. Use the latest stable versions available today, pin them exactly, and record them in
   DECISIONS.md → Pinned versions.
3. Implement the dependency-cruiser boundaries from ARCHITECTURE §2 and prove them with failing fixtures.
4. Delegate P0-03 to sim-engineer, P0-04 to tech-artist, P0-02 to release-engineer; do the rest yourself.
5. Run the DoD checklist and paste command output into each handoff note.
Ask me only if an open question in DECISIONS.md blocks you; otherwise use its default.
```
**ChatGPT** — wrapper with ROLE = Orchestrator, DOCS = ROADMAP Phase 0, ARCHITECTURE §2 and §13, DECISIONS.
Ask for one task card per conversation, starting with P0-01.

---

## P1 — Grey-box vertical slice

**Claude Code**
```
Orchestrator: start Phase 1 (docs/ROADMAP.md). Read GDD §4–5 and §13, ARCHITECTURE §3–4, §6–9.
1. Write task cards P1-01 … P1-07. Freeze in packages/shared: SimSnapshot (read-only view), SimEvent union,
   Action enum, Replay schema — before any parallel work.
2. sim-engineer: P1-01 → P1-02 → P1-03 (tests first; LUT math; swept collisions).
3. In parallel once contracts are frozen: render-engineer P1-04 (boxes only), ui-engineer P1-05.
4. qa-engineer: P1-06 replay tooling and three goldens recorded from scripted inputs.
5. Integrate. Then run game-design-critic for P1-07 with a 60 s scripted replay and the tuning file.
6. Report against the exit gate: determinism across engines and the first-time-player check.
```
**ChatGPT** — wrapper with ROLE = Sim engineer, DOCS = GDD §4–5, ARCHITECTURE §4, `packages/content/tuning.default.json`,
task card P1-01. Repeat per card, swapping the role.

---

## P2 — Mechanics complete

**Claude Code**
```
Orchestrator: start Phase 2. Read GDD §5–11 and §14, ARCHITECTURE §4–5, tuning.default.json.
Order: P2-01 → P2-02 → P2-03 → P2-04 → P2-05 (sim-engineer, sequential, each with tests and goldens).
P2-06 (director + fairness solver) by sim-engineer after P2-01; qa-engineer adds the 10 000-seed property test.
P2-07 (HUD) by ui-engineer in parallel once SimEvent and snapshot fields for streak/meter/modes are frozen.
P2-08 patterns by sim-engineer; then game-design-critic runs P2-10 and proposes tuning deltas as a JSON patch.
Apply accepted deltas only via tuning JSON. Bump SIM_VERSION where outcomes change.
```

---

## P3 — Art, audio, feel

**Claude Code**
```
Orchestrator: start Phase 3. Read GDD §12–13 and §18–19, ASSETS.md (all), ARCHITECTURE §6 and §12.
1. tech-artist: P3-01 hero car blockout first (see "Hero car in Blender" below). Stop for my review with
   four screenshots before detailing.
2. tech-artist: P3-02 traffic (Kenney Car Kit restyle + 4 original bodies) and P3-03 environment kits,
   each with ledger entries and license proof files.
3. render-engineer: P3-04 → P3-07. Keep the sim untouched; golden replays must stay green.
4. audio-designer: P3-08.
5. perf-auditor: P3-09 on Low/Mid/High profiles; render-engineer fixes the top items.
6. license-auditor: scan new assets and strings. game-design-critic: P3-10.
```

### Hero car in Blender (Claude with a Blender connector, or any agent writing bpy)
```
Build the "Kometa R" blockout in Blender exactly per docs/ASSETS.md §5.
- Units metres; +Y up in glTF terms; front faces +Z after export; origin on the ground between the axles.
- Dimensions: L 4.40, W 1.95, H 1.15, wheelbase 2.65, track 1.68.
- Primitives only at this stage: fastback body volume, teardrop cabin, four wheels (separate objects named
  Wheel_FL/FR/RL/RR with hub-centred origins), light bars, thruster empties, Cam_Focus, Collider_Hint.
- Use the exact node names from §5. No badges, text or real-car features.
- Render four 1024² views (front ¾, side, rear ¾, top) with a neutral grey material and save them to
  assets/source/hero/review/. Report triangle count and node list.
Then stop and wait for approval before mid-poly shaping.
```

---

## P4 — Screens and onboarding

**Claude Code**
```
Orchestrator: start Phase 4. Read GDD §3, §14–16, §19–20 and the frontend tokens in GDD §19.
ui-engineer: P4-01, P4-02, P4-03, P4-05. sim-engineer + ui-engineer: P4-04 (achievement checks in sim, UI in web).
qa-engineer: P4-06 baselines and axe scan. Take Playwright screenshots of every screen at both viewports
and attach them. The score odometer is the single signature UI moment — keep everything else restrained.
```

---

## P5 — Online

> v1 (ADR-019): only P5-09 (host embedding) runs now. The prompt below is for when ranking returns.

**Claude Code**
```
Orchestrator: start Phase 5. Read ARCHITECTURE §11 and GDD §17. Freeze the API contract in packages/shared/api
(zod) first. backend-engineer: P5-01 → P5-04. ui-engineer: P5-05 against the frozen contract with a mock
server. qa-engineer: P5-06 plus the tamper suite (edited score, edited inputs, wrong simVersion, duplicate
submission, impossible timing). Nothing reaches a leaderboard without a matching re-simulation.
```

---

## P7 — Release

**Claude Code**
```
Orchestrator: start Phase 7. release-engineer: P7-01, P7-04. qa-engineer: P7-02 device matrix and soak test.
license-auditor: P7-03. perf-auditor: final budget report. Produce docs/RELEASE_CHECKLIST.md with every item
checked and evidence linked.
```

---

## Specialist prompts

### Screenshot → spec (reuse when you have new reference material)
```
You are a senior game designer. Analyse the attached screenshots of a reference game frame by frame.
For each frame: what is on screen (HUD, world, effects, text), what mechanic it implies, any numbers you can
read, and confidence (high/medium/low). Then: derive tunable numbers (speed, durations, scores), list
mechanics that are implied but not shown, and list open questions. Output as a table + bullet lists that can
be pasted into docs/GDD.md §1. Don't copy the reference's text or names into our design.
```

### Game-feel critique
```
Act as game-design-critic. Inputs: <replay file or video>, packages/content/tuning.default.json, GDD pillars (§0).
Score 1–5 with evidence: readability at speed, lane-change snappiness, jump/fly arc, landing clarity,
streak motivation, reward pacing (time between notable events), difficulty ramp, frustration spikes
(deaths that felt unfair), and juice (camera, VFX, audio feedback per event).
For each issue propose a concrete tuning delta (key, old → new, expected effect) or a task card.
Write the result to docs/reviews/feel-<date>.md. Don't edit code.
```

### Spawn fairness investigation
```
Act as sim-engineer. A player reports an unavoidable crash at <distance> on seed <seed> (replay attached).
1. Reproduce with replay:verify. 2. Dump the 3 rows before the crash as ASCII. 3. Run the solver on them and
explain why it judged them solvable. 4. Fix the solver or the pattern, add a regression test with this seed,
and confirm the 10 000-seed property test still passes.
```

### Performance audit
```
Act as perf-auditor. Run pnpm perf:smoke on the Low, Mid and High profiles. Report p50/p95/p99 frame time,
draw calls, triangles, texture memory, JS heap, GC pauses, bundle sizes, against ARCHITECTURE §12.
Rank the top 5 costs with evidence and a proposed fix each. Write docs/reviews/perf-<date>.md.
```

### Bug triage → fix
```
Act as qa-engineer first: reproduce <bug>, write a failing test or golden replay, file docs/tasks/BUG-<n>.md.
Then hand off to the owning specialist to fix. Never fix and report in the same change.
```

### Code review before merge
```
Use code-reviewer on the current diff. Check AGENTS.md §6 invariants first, then correctness, tests that
actually assert behaviour, naming and units, allocation in hot paths, and docs updates. Output blocking
issues, non-blocking suggestions, and a verdict.
```

### Security review
```
Act as security-engineer. Review <diff or feature> against SECURITY.md. For each threat ID it touches,
state: mitigation present (file:line), test present (test name), gaps. Check AGENTS.md invariants 11–13.
Run Semgrep and the tamper/fuzz suites relevant to the change. Output blocking findings, non-blocking
findings and a verdict to docs/reviews/security-<date>.md.
```

### Load test
```
Act as qa-engineer with release-engineer. Implement k6 scripts for INFRASTRUCTURE §2 L3 (viral spike),
L4 (weekly reset burst) and L5 (abuse). Run on staging, collect SLO metrics, queue depth, validation wait,
CPU per run, error rates and CDN egress projection. Report pass/fail per SLO and the first bottleneck.
```

### Night batch for Codex
```
Act as Orchestrator. Select up to 3 cards from the current phase that are independent, have frozen
contracts and non-overlapping write paths. Write docs/tasks/batch-<date>.md listing, per card: goal, scope
paths, doc sections to read, acceptance criteria and verification commands. Then give me the exact text to
paste into Codex for each card.
```

### Scenario → test mapping
```
Act as qa-engineer. For every row in SCENARIOS.md without an implemented test, propose the test (layer,
file, name, fixture) and write it if the feature exists; otherwise mark "planned in <task ID>".
```
