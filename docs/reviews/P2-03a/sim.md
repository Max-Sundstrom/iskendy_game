# P2-03a simulation verification

Current-trigger scoring follows the frozen task contract. This is a slice of P2-03: NEAR MISS, SMASH, RING
and cone bowling still need gameplay producers. Meter activation and full streak/meter HUD remain later cards.
No UI, physics, dependencies, server, owner-deferred tuning proposal or model changed in this implementation.

`scoreTick` reads only the original numeric event prefix after collisions, before director/origin shift. It
mutates credits in producer order, then appends aggregated presentation events. Only adjacent road SLAM/grade
is normalized; HOP then SLAM and traffic-slot order remain intact. It resolves CRASH before SCRAPE before
SLOPPY before timeout once at the end. Timer counters are integer ticks; points retain fractions.

The 1024-event allocation is structural capacity. Conservative bound: each of64 traffic slots produces at
most8 raw+milestone outputs (including hypothetical CLEAR plus roof grade/HOP/SLAM); non-traffic input,
vertical/ride and completion work contributes at most20. Add20 aggregated credit buckets, one settlement
and one final origin shift: at most554. Milestones remain bounded even at fireworksEvery=1, without
reordering state additions. Tests preserve63 actual CLEAR events before a later-slot crash and additionally
exercise64 raw CLEARs with one milestone per credit. Shared scratch is cleared synchronously and interleaved
sessions compare score, hashes and decoded events to detect leakage.

All seven ledger/counter fields participate in the state hash. [Outcome evidence](sim-outcomes.json) records
its real pre-commit dirty checkpoint and exact source hashes. All three golden input logs, ticks, distances,
causes and final displayed scores are unchanged. Busy-inputs earns120+150+180 in pot and loses450 at its
existing landing crash. Both10k fixture pins change due scoring state, with25 runs as before. Independent
full physical-state/source-event comparison is a separate QA gate; this author report does not replace it.

## Checks

- Node24.19.0 / pnpm12.11.2 existing frozen install; no dependency or lockfile changes.
- Initial focused40 tests passed; requested roundoff regression added before full verification.
- First full suite:276/278 passed. Two old tests assumed no appended score events or land as the final buffer
  entry. Root explicitly reviewed the correction: orientation now asserts all seven exact event objects,
  including three credit amounts; vertical locates land by kind and keeps the slam flag requirement.
- After those reviewed changes: typecheck, lint/boundaries, **278/278 unit**, **131/131 sim**, production build
  and size passed. JS gzip **212.4KB /400KB**. Vite keeps its informational minified-chunk warning.
- Generated golden JSON was initially compact; format check flagged only those three files. Prettier normalized
  their representation without changing values. Final format check is recorded in the task handoff.
- New actual-input two-SLAM replay ends on natural seed28 tick258, banks exactly112.5, and validates its hash,
  full fractional score state, floored claimed score and fresh Retry state.
- Browser/HUD/retry verification, exact-head cross-engine CI, physical-phone testing and publication are not
  claimed here. They are separate gates owned by QA/root. No merge or deployment was performed.

Q24–Q26 document proposed passive-credit policies/flags and settlement interpretation without owner sign-off.
SIM_VERSION remains1 under the pre-release ADR-024; every changed golden/hash has a written rationale.
