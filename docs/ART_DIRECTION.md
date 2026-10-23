# KOMETA — Art Direction v1.0 · Design Agreement signed 2026-10-23 (ADR-023)

Status: **accepted** — Design Agreement signed by the owner on 2026-10-23 (ADR-023). Changes go through a new ADR.
Supersedes the palette in GDD v0.1 §19.

---

## 1. Direction in one line

A Moscow-inspired fictional city seen through a GTA VI–trailer lens: endless golden hour, humid haze, wet glossy
streets, neon, saturated sunset gradients — Soviet monumentalism meets Vice-City glam.
Internal codename for the look: **"Moscow Vice"** (never shown to players).

---

## 2. What we take from the GTA VI look — and what we don't

**Take (mood and technique, which nobody owns):**
- saturated warm-to-magenta sunset gradients against teal water and shadows (complementary split-toning);
- humid atmospheric haze, bloom and strong aerial perspective;
- wet, reflective streets; glossy paint with crisp specular highlights;
- neon and LED signage at dusk and night;
- dense "living city" backdrop details (signs, kiosks, traffic, crowds);
- vertical social-media framing for shareable moments (fits our portrait-first phones).

**Don't take (trade dress and copyrighted expression):**
- the GTA wordmark, Rockstar logos, their typefaces, UI layouts or HUD icons;
- the painted loading-screen / key-art illustration style, its compositions, or character likenesses;
- place names (Vice City, Leonida…), music, radio station names;
- the word "GTA" in store pages, ads or social copy ("inspired by" claims invite trouble and platform takedowns).

---

## 3. Pillars

1. **Readable first.** The gameplay layer (road, traffic, pickups, hazards) always has more value contrast and
   saturation than the backdrop. The backdrop is hazed and colour-shifted toward the sky.
2. **Golden hour forever.** ~70 % of a typical run happens in low, warm sun.
3. **Recognisable by silhouette, never a replica.** Moscow archetypes, not copies of specific landmarks.
4. **Gloss and neon carry the glam.** Reflections and emissives do the heavy lifting; geometry stays low-poly.
5. **Wit, not politics.** Small Moscow in-jokes (roadworks barrels everywhere, poplar fluff in June, kiosk neon).
   No state symbols, flags, political slogans, government buildings or religious buildings.

---

## 4. Palette

| Token | Hex | Role |
|---|---|---|
| Sodium Tangerine | `#FF8A3D` | key light, LIFTOFF, primary accent |
| Hot Rose | `#FF4F9A` | sky band, neon, OVERDRIVE |
| Lagoon Teal | `#19C2B0` | river, shadow split-tone, AIR bar |
| Sunflower | `#FFD23F` | rings, highlights, taxi paint |
| Brick Red | `#B8392F` | old-city brick, danger accents |
| Dusk Plum | `#3B1752` | upper sky, UI panels |
| Haze Lilac | `#CDB2F0` | distance fog, far silhouettes |
| Wet Asphalt | `#1A1C26` | road, UI ink |
| Enamel Cream | `#F3E9D2` | hero car base paint, text on dark |

Rules
- Backdrop saturation ≤ 60 % of the equivalent foreground colour; fog always tints toward Haze Lilac or the biome horizon.
- Traffic paint comes from a 12-colour "city traffic" sub-palette (taxi yellow, executive black, white, silver,
  cherry, bottle green, teal, sky blue, beige, orange works-truck, plum, grey). The hero car is always the
  highest-value object in frame.
- Colour is never the only carrier of meaning (mode bars get patterns + labels; hazards get shape language).
- **v1 ships inside Iskendi (Q9 answered):** the brand orange `#DB5D00` sits next to Sodium
  Tangerine and works as-is. Brand elements live on billboards, pickups, a courier livery and the embed's
  entry/exit screens — not in the sky palette.

### Per-biome grading (targets for the D0-3 style test)

| Biome | Sky top → horizon | Sun / key | Fog | Shadow tint | LUT |
|---|---|---|---|---|---|
| Embankment Gold | Dusk Plum → Sodium Tangerine | warm, low, behind-left of camera | Haze Lilac 35 % | Lagoon Teal | `lut_embankment` |
| Ring Road Dusk | Dusk Plum → Hot Rose | low, frontal (silhouettes) | Hot Rose 25 % | deep plum | `lut_ringroad` |
| Spalny Neon Night | near-black plum → Dusk Plum | sodium street lamps + neon | Wet Asphalt 40 % | teal-blue | `lut_spalny` |

---

## 5. World — a Moscow-inspired fictional city

Working city name: **Kometograd** (placeholder; fictional on purpose, the way GTA fictionalises Miami).

| Distance | Biome | Archetypes and set pieces |
|---|---|---|
| intro | **Ski-jump hill** | the run starts with the car rolling down a ski-jump-style ramp on a wooded hill overlooking the city — replaces the steel gantry from v0.1 |
| 0–2.5 km | **Embankment Gold** | riverside multi-lane embankment; a stepped "wedding-cake" high-rise archetype on the far bank; steel arch bridge; river barges; linden trees; "Cosmos Park" with a rocket on a pedestal that **launches when LIFTOFF triggers** |
| 2.5–5 km | **Ring Road Dusk** | elevated ring road; glass business-tower cluster reflecting the pink sky; tunnels (light change, echo audio); giant LED billboards (sponsor/brand slots); overhead gantry signs with fictional place names |
| 5–8 km | **Spalny Neon Night** | panel-block districts with window mosaics; kiosks with neon; sodium lamps; light rain and puddle reflections; trolleybus wires overhead |
| 8 km + | loop with variants | weather and palette swaps |

Live-ops variants: after-rain gloss (default), poplar fluff (June particles), first snow with New Year garlands (winter).

**Landmark rule.** Use archetypes (stepped spire tower, TV-needle tower, glass cluster, constructivist
facade) assembled from our own modular kit — not faithful replicas of named buildings or monuments. Several
famous Moscow buildings and monuments were created by architects and sculptors who died recently enough that
their works can still be under copyright, and Russia's freedom-of-panorama rules have exceptions for
commercial use. Recognisable silhouettes far in the background are lower risk than hero-framed replicas;
if you want an exact landmark, get a lawyer's view first.

---

## 6. Traffic and props (Moscow flavour)

Traffic: yellow taxi with checker strip (fictional company), marshrutka minibus, trolleybus (rideable
platform), city bus (platform), road-works truck with an arrow board, cement mixer, tow truck, executive
black sedan, street-sweeper (water-spray VFX), original Soviet-inspired retro bodies, delivery van (Iskendi
courier livery if embedded — rideable roof).

Props: orange barrels and plastic barriers, stacks of paving slabs, kiosks, billboards, bus stops, lamp
posts, linden and poplar trees, overhead trolleybus wires, puddles, road-marking arrows.

---

## 7. Lighting, materials, post-processing

- **Lights:** one sun + hemisphere fill; gradient sky dome; distance fog; emissive neon with bloom.
- **Materials:** one shared palette atlas. Hero paint: clear-coat look on High tier (MeshPhysicalMaterial
  clearcoat), cheap specular-matcap fake on Low/Medium.
- **Wet road (the signature effect, mobile-safe):** low roughness + environment map + vertical light-streak
  decals under every lamp and neon sign (fake anamorphic reflections) + puddle decals. No screen-space
  reflections and no planar reflections — too expensive on phones.
- **Post:** filmic tone mapping (AgX vs ACES decided in D0-3), bloom on emissives, subtle grain, vignette,
  per-biome LUT. Mode grades: tangerine (LIFTOFF), rainbow trail (COSMONAUT), rose (OVERDRIVE).
- **Photosensitivity:** no flicker above 3 Hz; Reduced Motion halves bloom pulses and removes shake.

---

## 8. Vehicle concepts — choose one in D0-2

The chase camera shows the **rear ~70 % of the time**, the side during barrel rolls and the roof during flips.
So the **rear light signature and the top-view shape** carry the car's identity far more than the front.

| | A · "Pobeda R" | B · "Samodelka" (recommended) | C · "Chaika GT" |
|---|---|---|---|
| Soviet DNA | 1940s rounded fastback, pontoon fenders | 1980s Soviet do-it-yourself supercar spirit (enthusiast-built wedge sports cars) | 1960s chrome luxury, long hood, small fins |
| Modern cue | light visor, targa glass, hypercar stance | knife-edge wedge, low nose, full-width light bar (pop-up headlamp nod), targa glass | wide short-deck roadster, slim LED blades |
| Rear signature | rounded tail, thin full-width light bar | wide flat tail, **four round lamps behind a smoked strip** | twin fins with vertical lamps |
| Read from chase cam | medium (rounded rear blurs at speed) | excellent (flat wide tail, unmistakable lamps) | good |
| Fit with "Moscow Vice" | retro charm, less glam | strongest: 80s glam + modern EV-hypercar stance | glam, but reads "limousine" |
| Gameplay fit | fine | best (flat roof/tail make flips and rolls readable) | weaker: 5 m length crowds lanes and roofs |
| Low-poly risk | higher (compound curves) | low (planar surfaces) | medium (chrome, fins) |

**Chosen 2026-10-23 (ADR-019): B "Samodelka"**, carrying two A-details — the soft pontoon line along the doors and two-tone
enamel — so it stays unmistakably Soviet-retro rather than generic 80s.

Fixed for any concept: length 4.2–4.6 m; no badges or real names (a fictional "KOMETA" script is fine);
visible thruster nozzles; default Enamel Cream; rear signature legible at 30 m on a phone.

**Liveries (atlas swaps):** Factory Cream (cream + plum roof) · City Taxi (sunflower + checker strip) ·
Neon Night (black + rose pinstripe) · **Iskendi Courier** (`#DB5D00` + ornament-tile roof) — default livery for v1.

---

## 9. Design Agreement — sign-off checklist (end of Phase D0)

| # | Item | Evidence | Status |
|---|---|---|---|
| 1 | Palette and per-biome grading | Figma art-direction board (D0-1) | ☐ |
| 2 | World archetype list and landmark rule | board + ART_DIRECTION §5 | ☐ |
| 3 | Vehicle concept, proportions, rear signature | three Blender blockouts rendered from chase cam, side, rear ¾ and top (D0-2) | ☐ |
| 4 | Liveries | paint-overs on the chosen blockout | ☐ |
| 5 | Look holds up on a phone | style-test chunk: p95 ≤ 16.7 ms on the Mid device (D0-3) | ☐ |
| 6 | HUD style frames | Figma frames at 390×844 and 1440×900 (D0-4) | ☐ |
| 7 | IP guardrails acknowledged | this document §2 and §5 | ☐ |

Evidence for every row (2026-10-23): `docs/reviews/art-D0/` and its README; the boxes are ticked by the owner.

Signed by the owner: Максим («Давай подтверждаю продолжай») · date: 2026-10-23 · item 5 measured in P1-04 (ADR-023)
