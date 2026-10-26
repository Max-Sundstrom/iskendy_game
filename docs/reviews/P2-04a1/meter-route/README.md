# Default-input meter route — preparation for LIFTOFF

Measured on unchanged P2-03b `8e19074c484a8bb17d65e6d64b3b79d6233efd8f`, default tuning hash
`9e91b7802bf1b6b1`. This is Node `Action/step` evidence, not browser/controller, mode or device acceptance.
No tuning, state, traffic or score event was injected. The new clock primitive is not used by this route.

Seed **1** first reaches meter **1000** at state tick **525** (after input tick 524), still running and
flying, AIR **219 L**, final hash **9b81eab9**. The exact [prefix replay](route.replay.json) contains
47 held-mask transitions and independently round-trips through recorder, parser and replay validation.
[Independent results](independent-results.json) verify the physical-event meter ledger on every tick:
5 flips × 80 + 12 rolls × 40 + 4 PERFECT landings × 30 + one genuine CLEAR × 60 = 1060 nominal gain,
capped at 1000. The four completed landings were safe; no crash, scrape, edge bump or AIR exhaustion occurred.

## Fixed schedule

Start each flight at input tick B = 0, 122, 244, 366, 488. First direction D alternates Left/Right/Left/Right/Left.
The opposite direction is O. Jump=4, Left=1, Right=2; all unlisted action bits stay clear.

| Input tick | New held mask |
| --- | --- |
| B | Jump |
| B + 1 | 0 |
| B + 3 | Jump, held for flight |
| B + 16 / B + 17 | Jump + D / Jump |
| B + 27 / B + 28 | Jump + O / Jump |
| B + 50 / B + 51 | Jump + D / Jump |
| B + 101 | 0 |

The first four PERFECT landings occur at state ticks 122/244/366/488. CLEAR occurs at 467; meter reaches
980 after the fourth landing, and the fifth completed flip at 525 fills the remaining 20. Twelve completed
barrels each consume exactly 27 ticks; the prefix ends during another roll with an opposite roll queued.

The separate [fixed continuation](safe-landing.replay.json), checked by the route author, reaches a fifth
PERFECT landing at tick **610**, running and grounded, AIR **155 L**, hash **bbb30d89**. AIR use is 381 L
through first fill and 445 L through the fifth landing, with no regeneration. This continuation was measured
WITHOUT mode activation; it cannot establish future LIFTOFF outcomes after tick 525. Independent ledger QA
above covers the first-fill prefix, not the fifth landing.

Existing replay verification on the measured source, or this unwired-clock branch with identical live sim:

```sh
pnpm replay:verify docs/reviews/P2-04a1/meter-route/route.replay.json
pnpm replay:verify docs/reviews/P2-04a1/meter-route/safe-landing.replay.json
```

The bounded search's first candidate (seed 1, hold release 101) succeeded. An initial scratch harness passed
the outer tuning document instead of `.sim` and threw before its first step; correcting that caller did not
change game code. A different verifier then checked the saved prefix from a fresh state and an independent
meter ledger. Raw search/continuation/verifier scripts and event logs remain in the cloud scratch checkpoint.

Browser translation is still pending: real keyboard press/release ticks and multi-pointer touch gestures
must reproduce the recorded masks. Source inspection shows that the touch adapter supports a held up-swipe
plus separate lane swipes, but no browser or physical-device execution of this route has been claimed.
Once mode state is wired and hashed, expected hashes and later outcomes require fresh, justified verification.
