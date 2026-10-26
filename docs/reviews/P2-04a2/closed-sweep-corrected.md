# P2-04a2 — independent corrected closed-sweep differential

**PASS:** the original unchanged exact-rational matrix now matches both protected-contact
geometry APIs in all 7,873 cases / 15,746 comparisons. The 11 arithmetic-boundary
disagreements from the first freeze are resolved without changing oracle expectations.

## Frozen inputs and execution

- Frozen HEAD: `b1d80d1a2e8e0a73389df1ac5fdba201b8cc218a`; production changes were uncommitted.
- `packages/sim/src/mode-contact-sweep.ts` Git blob before and after:
  `70fc9d11de12e20f107f7569dd5279cb43c7559b`.
- Frozen test blob before and after: `853d347ab849c02d95252fe52e0090ce2ceb17ea`.
- Runtime: Node `v24.19.0`. Command:
  `node /workspace/scratch/P2-04a2/closed-sweep-differential.mjs`; exit 0.
- Exactly one corrective differential was executed: the second completed implementation
  comparison overall. No retry loop or additional production run followed.
- SHA-256 checks confirm that the oracle, cases and differential runner remained unchanged.

## Independent method and coverage

The adapter supplies the numeric relative coordinates and AABB bounds defined by the API.
The oracle converts those finite binary64 values into exact BigInt fractions, enumerates
endpoint/face-crossing times and checks all six inequalities at a common time. It uses
neither production slab/exact-limb logic nor a tolerance. Final overlap is checked separately
from swept contact, so a crossed-and-exited object cannot become an endpoint cleanup hit.

| Group                                                            |     Cases | Sweep mismatches | Endpoint mismatches |
| ---------------------------------------------------------------- | --------: | ---------------: | ------------------: |
| Prepared boundary, singleton, disjoint-window and symmetry cases |     2,880 |                0 |                   0 |
| Prepared paths using all 13 default vehicle dimensions           |       650 |                0 |                   0 |
| Default exact faces and adjacent binary64 coordinates            |       234 |                0 |                   0 |
| Default maximum travel per tick, roof touching                   |        13 |                0 |                   0 |
| Fixed-seed bounded dyadic paths                                  |     4,096 |                0 |                   0 |
| **Total**                                                        | **7,873** |            **0** |               **0** |

The prepared cases include all six axis permutations, eight sign combinations and both
time directions. Generalized-box embedding changed none of their expected boolean answers.

## Preserved first-run evidence

The first source blob was `dccd376bdd134073352dbf28f9b8b1de74e7a6a5`; its 10 false positives
and 1 false negative remain documented in [the original witnesses](sweep-first-failures.json).
Before the corrective run, the complete original JSON was copied byte-for-byte to
`/workspace/scratch/P2-04a2/closed-sweep-first-differential-result.json`, SHA-256
`3a7f2f9e4918be657d901a8b07b27f13f761eed9be41dfcd4c7b1eaee4db677b`.

The scratch directory also retains the corrected full result, captured corrective stdout,
the frozen-input snapshot and integrity manifest. The first stdout was reconstructed from
its complete structured result and is explicitly named `closed-sweep-first-stdout-reconstructed.log`.
Machine-readable corrected counts and fingerprints: [closed-sweep-corrected.json](closed-sweep-corrected.json).

## Limits

This is geometry-only acceptance of the stated finite-input matrix. Some synthetic paths
exceed ordinary per-tick movement; this is not a demonstrated gameplay route or a device
performance result. No sim step, browser, full suite, golden regeneration, determinism fixture
change or production edit was performed by this review. The newly specified RangeError for
nonfinite derived geometry was not added to the unchanged original matrix and is not
independently validated by this result. Broader integration and release checks remain separate.
