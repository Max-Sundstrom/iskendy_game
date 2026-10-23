# D0 evidence — Design Agreement (2026-10-23)

Captured from the design lab (`apps/lab`, `pnpm lab`, `pnpm lab:capture`) in headless Chromium with SwiftShader.
Owner review page: https://claude.ai/artifact/DGeLES4RDmQeYi5pNEsNhC (private; includes the live style test).

| File | Checklist item (ART_DIRECTION §9) |
|---|---|
| `D0-1-board.jpg` | 1 palette and grading, 2 archetypes, 7 guardrails |
| `D0-2-{A,B,C}-{chase,rear34,side,top,front34}.jpg` | 3 vehicle concepts, proportions, rear signature |
| `D0-2-B-livery-*.jpg` | 4 liveries |
| `D0-2-B-chase-{ringroad,spalny}.jpg` | grading of the other two biomes |
| `D0-3-style-{chase,night}.jpg` | 5 style-test chunk; **p95 must be measured on a real Mid phone** |
| `D0-4-{hud,results}-{390x844,1440x900}.jpg` | 6 HUD and results style frames |

## Findings
- Rear signature: B reads best from the chase camera, as ART_DIRECTION §8 predicted; A's thin bar blurs, C's fin lamps
  are narrow.
- Contrast: cream text on Iskendi orange is 3.1:1. Use Wet Asphalt text on that orange; all other HUD pairs pass AA
  (5.5–14.1:1).
- Tone mapping: AgX keeps the sunset and neon from clipping. ACES is not needed (closes the D0-3 question in §7).
- Bright saturated red emissives go pink under AgX; tail lamps use a moderate emissive (0.75).
- Wet-road light streaks read at dusk and night; at golden hour the sky reflection carries the look.
- Style test: 113 draw calls and 14k triangles, inside the 150-call budget. Frame time from SwiftShader is not
  representative.
- Portrait chase framing makes the car large; tune per aspect in P1-04.
- three.js imported as a namespace bundles about 147 kB gzip in the lab; the game imports named symbols to tree-shake.

## Deviations
- Blockouts were built in three.js, not Blender: there is no Blender in the cloud workspace. The final hero model
  (P3-01) is built in Blender to these proportions and the ASSETS §5 node names, which the blockout already uses.
- HUD frames were built in HTML/CSS, not Figma: the HUD will be HTML/CSS anyway, and Figma edits need the owner's
  explicit request.
