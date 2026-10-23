<!-- One task card per PR (AGENTS.md §10). This description is the handoff note. -->

## Task
Card: `docs/tasks/<ID>.md` · Phase: <n> · Scenarios: <IDs from docs/SCENARIOS.md>

## What changed and why

## How it was verified
<!-- Paste command output. Render/UI: perf:smoke report and screenshots at 1440×900 and 390×844. -->
- [ ] `pnpm typecheck && pnpm lint && pnpm test`
- [ ] Sim changes: `pnpm test:sim` incl. golden replays
- [ ] `pnpm test:e2e` (when UI or flows changed)

## Definition of Done (AGENTS.md §8)
- [ ] Acceptance criteria of the card are met and demonstrated
- [ ] No new tunable literals; new numbers are in tuning JSON + schema
- [ ] Docs updated if behaviour or contracts changed (GDD, ARCHITECTURE, DECISIONS)
- [ ] Invariants of AGENTS.md §6 hold; no test weakened or deleted to pass

## Tuning and versions
Tuning keys added: <none> · `SIM_VERSION` bumped: <no / yes — reason in DECISIONS.md>

## Known gaps and follow-ups

## Reviewers
<!-- Author never verifies its own acceptance criteria (AGENT_SYSTEM.md §2). -->
code-reviewer · qa-engineer · <security / perf / license / art when the card lists them>
