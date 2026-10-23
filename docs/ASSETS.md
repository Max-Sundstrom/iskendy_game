# KOMETA — Assets, licensing and the hero car

## 1. Licensing rules (enforced by `pnpm assets:check`)

| License | Allowed? | Conditions |
|---|---|---|
| CC0 / public domain | ✅ | Credit optional (we credit anyway) |
| CC-BY 3.0 / 4.0 | ✅ | Credit author, title, source link and license in Credits; note modifications |
| Paid "Royalty Free" (CGTrader, TurboSquid standard, etc.) | ⚠️ allowed | Must permit use in games. CGTrader's RF terms require reasonable measures to stop end users extracting the model, so ship only quantised, meshopt-compressed GLBs, never source files |
| Site-specific free licenses (e.g. 3D CAD Browser) | ⚠️ case by case | Read the site terms; keep proof; check the uploader plausibly owns the work |
| Editorial-only | ❌ | Not for commercial products |
| CC-BY-NC, CC-BY-ND (when modified), "personal use" | ❌ | |
| Unknown / missing license, ripped game models, GTA/BeamNG mods | ❌ | |

**Licenses cover the mesh, not the brand.** Even a CC0 model of a real car can carry trademark and trade-dress
problems: names (Lada, Priora, Volga, GAZ, Pobeda, Moskvich, Tesla, Roadster), badges, grilles and ornaments
that identify a manufacturer. KOMETA rules: no real names anywhere players can see, no badges or ornaments,
and real cars may inspire silhouettes only — every shipped body must be clearly original. This isn't legal
advice; if the game will be monetised, a short consultation with an IP lawyer is cheap insurance.

**Proof:** for every third-party file, save a screenshot or PDF of the license page at download time to
`assets/source/_licenses/<id>.png|pdf` and record it in the ledger.

---

## 2. Research results (checked 23 Oct 2026 — re-verify on the page at download time)

### Recommended

| Asset | Source | License | Use in KOMETA | Verdict |
|---|---|---|---|---|
| Kenney **Car Kit** — 40+ vehicles (cars, trucks, vans, police, ambulance, firetruck) in OBJ/FBX/glTF | https://kenney-assets.itch.io/car-kit · mirror https://opengameart.org/content/car-kit | CC0 | Base geometry for modern traffic; restyle to our palette atlas | ✅ best fit — low-poly, consistent, game-ready |
| Kenney **City Kit (Roads)** | itch.io (Kenney Assets) | CC0 (Kenney standard — confirm in the pack's License.txt) | Road pieces, signage, barriers for grey-box and city biome | ✅ |
| **ZAZ Tavria** low-poly | https://sketchfab.com/3d-models/zaz-tavria-84616620ca984f908daab7a3aab1bb29 | CC-BY | Late-Soviet hatch flavour in traffic (debadge, rename) | ✅ with credit |
| **Panelka** — post-Soviet panel building, game-ready | https://sketchfab.com/3d-models/panelka-8878634b8c1a4691b2513437b1afc049 | CC-BY | Night-city biome backdrop (instanced, LOD) | ✅ with credit |
| **LowPoly old Car** | https://sketchfab.com/3d-models/lowpoly-old-car-dcdbebf75afb418f911b2b0e13a9d393 | CC-BY | Generic retro traffic filler | ✅ with credit |
| **Low poly cabriolet car** (uncoloured) | https://sketchfab.com/3d-models/low-poly-cabrioletcar-25f212fc4bc04bac8a4318d553b04089 | CC-BY | Traffic variety after palette UV pass | ✅ with credit |

### Usable with caution (paid or heavy)

| Asset | Source | License | Notes | Verdict |
|---|---|---|---|---|
| GAZ-M20 Pobeda | CGTrader, $80 | Royalty Free | High-poly visualisation model; good as a **modelling reference** or for heavy retopology; brand issues remain | ⚠️ reference |
| GAZ-21 Volga | CGTrader, $80 and $159 listings | Royalty Free | Same as above | ⚠️ reference |
| Moskvich 412 coupe | CGTrader | Royalty Free | Price not checked | ⚠️ reference |
| Lada Priora 2172 (2009, estate) | 3D CAD Browser (free account) | Site terms: free use in own/commercial projects; no redistribution of the files | ~221k polygons, no UVs/textures; the site does not verify uploader ownership; it's the estate, not the sedan | ⚠️ not recommended |

### Rejected

| Asset | Why |
|---|---|
| Free3D "Lowpoly Gas M20, Pobeda" (7.1k polys) | Marked **Editorial Only** |
| Free3D "AZLK 412 Moskvitch" | Marked **Editorial Only** |
| Lada/Moskvich/Volga mods on libertycity.net, gta5-mods.com, BeamNG | Ripped or derivative game assets; no valid license chain |
| Sketchfab downloadable Soviet cars with unverified license (e.g. "Moskvich 2141 (Triangulated)", "Vaz 2111", "Old Soviet Car — PSX Style") | License not confirmed during research — use only if the page shows CC0 or CC-BY at download time |

**Blueprints** (getoutlines.com, the-blueprints.com) are fine as private modelling references for
proportions; don't ship them or trace them 1:1.

### Conclusion
A good, commercially clean, low-poly **Moskvich / Priora / Volga / Pobeda** that is both game-ready and safely
licensed was **not found**. The free ones are editorial-only or of unknown origin; the clean ones are paid
high-poly visualisation models that would need full retopology anyway and still carry brand risk. So:
- **Hero car:** build an original model in Blender (spec below). It's also the only way to get the node
  structure the game needs (separate wheels, thruster sockets, flip pivot, LODs).
- **Traffic:** Kenney Car Kit (CC0) restyled + 4 original Soviet-inspired bodies built in Blender with the
  same pipeline + selected CC-BY models above.
- **Environment:** Kenney kits + Panelka (CC-BY) + custom props for the biomes in ART_DIRECTION §5–§6 (ski-jump hill,
  Cosmos Park rocket, arch bridge, ring-road tunnels, kiosks). The v0.1 launch gantry and palms are dropped.

---

## 3. Other asset sources to consider (verify per item)

- Poly Haven — HDRIs and textures (CC0) for look-dev and sky references.
- Kenney audio packs (UI, impacts) — CC0; Freesound with the CC0 filter only.
- Fonts: Unbounded and Golos Text from Google Fonts (OFL; Latin + Cyrillic). Self-host WOFF2 subsets.
- Music: commission or license explicitly for games; never "royalty-free YouTube music" without written terms.

---

## 4. License ledger — `assets/LICENSES.json`

```json
{
  "schemaVersion": 1,
  "assets": [
    {
      "id": "traffic.sedan.kenney",
      "files": ["assets/build/traffic/sedan.glb"],
      "title": "Car Kit — sedan",
      "author": "Kenney (kenney.nl)",
      "sourceUrl": "https://kenney-assets.itch.io/car-kit",
      "license": "CC0-1.0",
      "attributionText": "Car Kit by Kenney (kenney.nl), CC0",
      "modified": true,
      "modifications": "Re-UV'd to palette atlas, decimated LOD1",
      "downloadedAt": "2026-10-23",
      "licenseProof": "assets/source/_licenses/kenney-car-kit.png",
      "brandCheck": "no badges/names"
    }
  ]
}
```

The validator fails CI when: a file in `assets/build` has no entry; `license` is outside the allow-list;
`licenseProof` is missing; or a CC-BY asset lacks `attributionText`. The Credits screen is generated from this file.

---

## 5. Hero car spec — "Kometa R" (original design)

> **Pending D0-2.** The concept below (A, rounded fastback) is one of three options in ART_DIRECTION §8;
> B "Samodelka" (1980s Soviet DIY-supercar wedge) is recommended. Dimensions envelope, node hierarchy,
> budgets, shading rules and the Blender workflow below apply to whichever concept is chosen.

**Concept:** what if a 1940s Soviet fastback grew up into a 2020s electric hypercar? Old-world curves on a
modern low, wide stance — the same "sleek, low, glass-roofed roadster" attitude as modern EV hypercars, without
copying any of them.

**Shape language**
- Silhouette: long, continuously sloping fastback tail (period cue) on a low wedge; teardrop cabin set back;
  removable-look glass targa roof; no B-pillar.
- Front: no grille; slim full-width light "visor" (modern cue); rounded front fenders with a soft pontoon line
  running down the sides (period cue); one thin brass beltline strip.
- Rear: full-width light bar; two cold-gas nozzles under the rear valance, two in rear fender vents; small side
  nozzles behind the front wheels (used by barrel-roll VFX).
- Wheels: 21" aero discs with a five-slot motif, slightly oversized for toy-like readability.
- Paint: Enamel Cream body, Kosmos Indigo roof, Brass trim. Liveries are atlas swaps.
- Nothing real: no badges, no ornaments, no readable plates (plates may show a "KOMETA" glyph mark).

**Dimensions:** length 4.40 m · width 1.95 m · height 1.15 m · wheelbase 2.65 m · track 1.68 m.

**Node hierarchy (exact names — the engine binds by name)**
```
KometaR                     root: origin on the ground, centred between axles; front faces +Z; +Y up; metres
├─ Body                     mesh, M_Paint (atlas)
├─ Glass                    mesh, M_Glass
├─ LightBar_F, LightBar_R   meshes, M_Emissive
├─ Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR   meshes; origin at hub centre; spin axis X
├─ Thr_Rear_L, Thr_Rear_R, Thr_Fender_L, Thr_Fender_R, Thr_Side_L, Thr_Side_R
│                           empties; local +Z = exhaust direction
├─ Cam_Focus                empty ≈ 0.9 m above roof centre
└─ Collider_Hint            empty with custom props sizeX/sizeY/sizeZ (not exported as a mesh)
```

**Budgets:** LOD0 ≤ 12k triangles (hard cap 15k) · LOD1 ≤ 5k · LOD2 ≤ 1.5k · ≤ 3 materials · palette atlas
256×256 shared with traffic · optional 512² AO bake for LOD0 only.

**Shading:** smooth shading with weighted normals; bevels as geometry only on silhouette edges; emissive
strength driven at runtime.

**Blender workflow**
1. Reference board: period fastback photos and blueprints for proportions; modern EV hypercars for stance.
   Don't trace any single real car.
2. Blockout with primitives at the exact dimensions → owner review (screenshots: front ¾, side, rear ¾, top).
3. Mid-poly shaping → retopology/decimation to budget → weighted normals.
4. UVs into palette-atlas cells (flat colours), separate glass and emissive.
5. Name nodes per the hierarchy; apply transforms; export via `tools/blender/export_vehicle.py`.
6. Pipeline: `gltf-transform` → dedup, prune, weld, meshopt, KTX2 → `assets/build/hero/kometa_r.glb`.
7. `pnpm assets:check` → budgets and naming pass.

**`tools/blender/export_vehicle.py` must:** verify the node names; apply transforms; count triangles per LOD
and fail over budget; generate LOD1/LOD2 with Decimate (collapse) when missing; strip cameras, lights and unused
materials; export `.glb` (+Y up); write a JSON report next to the file.

---

## 6. Original Soviet-inspired and Moscow-flavour traffic (same pipeline)

| Content id | Inspiration (mood only) | Budget |
|---|---|---|
| `fastback_round` | 1940s rounded fastback sedan | ≤ 2.5k tris |
| `sedan_fins` | late-1950s chrome sedan with small fins | ≤ 2.5k |
| `hatch_box` | 1980s boxy hatchback | ≤ 2k |
| `sedan_wedge` | 2000s budget wedge sedan | ≤ 2k |
| `taxi_checker` | city taxi with checker strip (fictional company) | ≤ 2.5k |
| `marshrutka` | high-roof minibus | ≤ 3k |
| `trolleybus` | city trolleybus, poles down/up variants | ≤ 3k |
| `sweeper` | street-sweeper truck with spray nozzles | ≤ 3k |
| `works_truck` | road-works truck with arrow board | ≤ 3k |

**Environment kit (custom, modular):** embankment segments, steel arch bridge, stepped spire tower archetype,
glass tower cluster, TV-needle archetype (far backdrop only), panel blocks (Panelka CC-BY + variants), kiosks,
bus stops, lamp posts, trolley wires, billboards (brand slots), ski-jump intro ramp, Cosmos Park rocket.
All archetypes are original; no faithful replicas of named landmarks (ART_DIRECTION §5).

All share the palette atlas, use generic proportions, carry no badges or real names, and get unique
silhouettes so they read at 50 m.

---

## 7. Pipeline commands (to be implemented in P0-04)

```
pnpm assets:build      # blender exports (if .blend changed) → gltf-transform → assets/build
pnpm assets:check      # budgets, node naming, ledger validation, brand-name scan of file names and strings
```
gltf-transform steps: `dedup → prune → weld → resample → meshopt (geometry) → ktx2 (etc1s for colour, uastc
for normal maps if any)`. Keep originals in `assets/source/` only.
