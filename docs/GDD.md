# KOMETA — Game Design Document v0.2

Derived from 20 reference screenshots (two short videos of a browser runner, mobile and desktop) plus design
proposals. v0.2 adds the Moscow × GTA VI-inspired direction (pending agreement, see ART_DIRECTION.md),
host embedding (EMBEDDING.md) and the scenario catalogue (SCENARIOS.md). Tags: **[REF]** observed in the reference · **[PROPOSED]** our design · **[OPEN]** needs an owner
decision (collected in §22 and in DECISIONS.md). All numbers are starting values in `packages/content/tuning.default.json`.

---

## 0. Pitch and pillars

**Pitch.** A retro-futurist Soviet-style electric roadster tears through a golden-hour, neon-wet, Moscow-inspired
city. Dodge traffic, hop across car roofs, surf on trolleybuses and truck trailers, fire the cold-gas thrusters
to fly, and chain flips into huge streaks — then fill the LIFTOFF meter and become unstoppable while the rocket
in Cosmos Park lifts off over the skyline.

**Pillars**
1. **Always moving, always choosing.** Every second offers a readable choice: lane, jump, fly, slam or boost.
2. **The air is a second road.** Roofs, trailers and thruster flight form an upper layer; mastery means living up there.
3. **Style pays.** Flips, hops, clears and clean landings feed streaks; streaks are where big scores come from.

Targets: run length 60–240 s · from tapping Play to first input ≤ 5 s · retry to control ≤ 2 s.

---

## 1. Reference analysis [REF]

| Img | Distance | What the frame shows | Takeaway |
|---|---|---|---|
| 15 | menu | Title; pilot `PLAYER_0731 #2776` (handle + 4-digit tag); Sign in with Google; "Updating account…"; all-time best distance; PLAY; Achievements; Upgrade and Shop taped "Under construction"; Ranking; Settings; Controls; external purchase link; collapsible Global Top 100 with All-time / Weekly | Guest-first identity, optional sign-in, leaderboard on the menu, meta-progression planned but not shipped |
| 14, 20 | 0 m | Car descends a tall curved launch ramp from a steel truss gantry; big 3-2-1; a story toast sets the premise; desktop shows a controls card | A 3-second spectacle that doubles as onboarding |
| 13 | 16 m | Score 16 at 16 m; chase cam; five-lane bridge; palms; rocket tower on the horizon; AIR 581 L | Base score ≈ 1 pt/m; AIR tank ≈ 600 L |
| 12 | 293 m | BOOST +10; AIR 197 L; translucent round button under left thumb | Flight/boost drain AIR fast |
| 11 | 962 m | Barrel roll +20, STUNT LANDING +20, ROCKET MODE, ×2 streak, achievement toast; the background rocket is launching | Meter-triggered mode synced to a background set piece |
| 10, 9 | 1 076–1 165 m | ROCKET MODE INVINCIBLE + seconds left; SMASH ×12 +150; AIR shows ∞ | Invincible = smash traffic, infinite AIR |
| 8 | 1 337 m | Front flip +360, CLEAR +300, ×6 streak, "Triple Hop" achievement | Clearing cars, chained roof hops |
| 7, 16 | 1 604–1 621 m | Gold ring and star token pickups in lanes | Collectibles; the star feeds the next frame |
| 6 | 1 733 m | STARMAN INVINCIBLE 6.3 s, rainbow bar | Second invincible mode from a pickup |
| 5 | 3 890 m | Car riding a long vehicle's roof; Front flip +460; BOOST +220; ×23 streak, pot +16 580; red dusk sky, mountains | Roof surfing; biome/time-of-day shifts with distance |
| 4 | 5 195 m | SEMI CLEARED +3 300; Front flip +1 200; ×11 pot +16 140; "Truck Hop" | Semis are high-value obstacles |
| 3 | 6 168 m | LUDICROUS INVINCIBLE, pink grade, fireworks; SMASH ×1 +100; orange barrels | Third, escalated mode; construction hazards |
| 2 | 6 692 m | Night; near top-down camera; mobile ITEM (red eye icon) and BOOST buttons; AIR 597 L | Late-run camera/biome shift; one consumable item slot |
| 1 | end | Narrative end line; score 112 126; 6 699 m; 1:49; "Saving your score…"; Retry / Ranking / Menu / Share | Story-flavoured ending, async submit, share |
| 17–19 | desktop | Browser on a laptop; bottom key-hint bar: jump / hold to fly / press again in air to flip / slam / hold to boost / item | Desktop control scheme |

**Derived numbers → starting tunables**
- Average speed: 6 699 m in 109 s ≈ 61 m/s (≈ 220 km/h) → speed curve 35 → 95 m/s.
- Base score 1 pt/m. Final 112 k over 6.7 km ≈ 17 pts/m, so ≈ 94 % of a skilled score came from style.
  Our target: 70–90 % from style for skilled players, 30–50 % for new players.
- AIR ≈ 600 L. Drop 581 → 197 L over ≈ 280 m (≈ 4.5 s) ⇒ heavy fly + boost ≈ 85 L/s.
- Invincible modes ≈ 5–7 s.
- Lanes: five visible lanes on the bridge and in the top-down frame.

**Not visible in the reference** (designed here): crash and fail rules, tutorial, item effects, purpose of
rings, settings contents, pause menu, audio, upgrades/shop, missions, difficulty curve, revive, achievement
list, and how a run ends (crash vs destination).

---

## 2. Theme, premise, renames [PROPOSED — pending Design Agreement]

The reference is Tesla/SpaceX-themed. KOMETA is set in **Kometograd**, a fictional Moscow-inspired city seen
through a GTA VI–trailer mood: golden hour, humid haze, wet glossy streets, neon, Soviet monumentalism.
Full direction, palette, world archetypes and IP guardrails: **ART_DIRECTION.md**.

| Reference | KOMETA |
|---|---|
| Tesla Roadster | **Kometa R** — original roadster; concept A/B/C chosen in D0-2 (ART_DIRECTION §8) |
| Steel launch gantry intro | **Ski-jump hill** overlooking the city |
| Rocket tower on the horizon | **Cosmos Park rocket** on a pedestal that launches on LIFTOFF |
| Rocket Mode | **LIFTOFF** — meter-triggered invincibility, "Poekhali!" callout |
| Starman Invincible | **COSMONAUT** — star-token invincibility |
| Ludicrous Invincible | **OVERDRIVE** — meter refills during another mode → extension + ×1.5 points |
| Premise toast | Owner's choice [OPEN]. Standalone suggestion: *"Babushka's pies are cooling — reach the dacha before the neighbours do."* **Iskendi edition (v1, Q9 answered):** *"Your dürüm is getting cold — race it home."* |
| External "buy the car" link | Removed. Optional sponsor/brand slot [OPEN] |
| Achievement names | New set (§16) |

---

## 3. Session flow

```
Menu ──► (first run only) Tutorial ──► Intro: launch ramp + 3-2-1 ──► Run
  ▲                                                                   │
  │                                         crash / destination ◄─────┘
  └──── Menu ◄── Results (async save) ──► Retry (short 1.5 s ramp) ──► Run
                         └──► Ranking · Share
```

---

## 4. Controls

| Action | Keyboard | Touch (portrait) | Gamepad |
|---|---|---|---|
| Lane left / right | ← → or A D | swipe left / right | D-pad, left stick |
| Jump (tap) | ↑, W or Space | swipe up | A |
| Fly (hold) | hold Jump | keep finger down after swipe up | hold A |
| Front flip (airborne) | press Jump again | swipe up again | A |
| Barrel roll (airborne) | ← → while airborne (also moves lane) | swipe left/right while airborne | D-pad |
| Slam | ↓ or S | swipe down | B |
| Boost (hold) | Shift | hold BOOST button | RT |
| Item | E or 2 | ITEM button | Y |
| Pause | Esc or P | pause button | Start |

**Input feel:** swipe = ≥ 24 px within ≤ 180 ms on the dominant axis; jump buffer 120 ms; coyote time 90 ms
after leaving a roof/platform; one queued lane change; hold-to-fly begins after 150 ms; optional "toggle fly"
for accessibility. Buttons are mirrored in left-handed mode.

---

## 5. Movement model

**5.1 Lanes.** 5 lanes × 3.6 m. Lane change 0.16 s, ease-out, 8° body roll, slight yaw toward travel direction.

**5.2 Forward speed.** `v(d) = vMin + (vMax − vMin) · (1 − e^(−d / dScale))`, vMin 35, vMax 95 m/s,
dScale 4 000 m (implemented with a lookup table in the sim). Boost ×1.25 while held; LIFTOFF ×1.15;
scrape −20 % for 1 s; sloppy landing −15 % for 0.8 s.

**5.3 Jump.** Apex 4.2 m at 0.45 s; falling gravity ×1.6 for a snappy arc. Clears sedans (1.5 m) and vans
(2.4 m); semis (4.0 m) need fly, a hop chain, or a ramp-like car-carrier.

**5.4 Fly.** Holding Jump past 150 ms engages thrusters: vertical speed eases to a −1 m/s glide, ceiling 9 m,
AIR cost 60 L/s. Release = fall. AIR at 0: thrusters sputter, flight ends.

**5.5 Slam.** Instant −30 m/s vertical. Cancels flight. Slam landing on road: SLAM event + shockwave that
scatters cones/barrels within 4 m. Slam onto a car roof: hop with extra height (4.5 m).

**5.6 Flips and rolls.** Jump again while airborne = front flip (360° in 0.55 s; may chain if airtime allows).
Lane change while airborne = barrel roll toward that lane (360° in 0.45 s). Rotations are committed once
started, so landing mid-rotation grades poorly.

**5.7 Landing grades** (angle from upright at touchdown):
≤ 12° **PERFECT LANDING** · ≤ 35° **STUNT LANDING** · ≤ 75° **SLOPPY** (streak pot banks at 50 %, speed
penalty, wobble) · > 75° **CRASH**. During invincible modes the car auto-rights and any landing counts as stunt.

**5.8 Roofs and platforms.** Landing on a car, taxi or van roof triggers an automatic bounce (3 m) = **HOP**.
Consecutive hops without touching the road chain; 3 in a row = Hat-trick. Buses, semi trailers and
car-carriers are rideable **platforms**: you drive on top until the end, then drop (coyote time applies).
Passing over an entire semi or bus while airborne = **SEMI CLEARED**.

**5.9 Collisions** (grounded or below roof height):
- Hitting the back of a vehicle = **CRASH**.
- Side contact during a lane change = **SCRAPE**: lane change reverts, speed penalty, −40 L AIR, streak breaks.
  A second scrape within 4 s = CRASH (Subway-Surfers-style stumble rule).
- Cones and barrels: knocked away, −5 % speed, +10 "bowling" points. Concrete barriers = CRASH.
- During invincible modes every contact is a **SMASH**.
- Shield item converts one CRASH into a SMASH.

---

## 6. Resources

| Resource | Rules |
|---|---|
| **AIR** (cold-gas tank, litres) | Capacity 600 L, starts full. Regen 30 L/s when grounded and not boosting. Fly 60 L/s, boost 40 L/s (stack). AIR canister +200 L. ∞ during modes. Bar flashes below 15 %. |
| **LIFTOFF meter** | 0–1 000. Fills from style events only (column "Meter" in §9). Full → LIFTOFF (auto by default; manual option [OPEN]). |
| **Rings** | Currency for v1.1 upgrades/shop; in v1 they count toward achievements and the results screen. |

---

## 7. Traffic and hazards

| Type | Size L×H (m) | Speed (m/s) | Behaviour | Top surface | From |
|---|---|---|---|---|---|
| Sedan | 4.5 × 1.5 | 18–28 | constant | hop | 0 m |
| Retro compact (Soviet-inspired body) | 3.9 × 1.45 | 18–26 | constant | hop | 0 m |
| Taxi | 4.6 × 1.6 | 20–28 | may change lanes; blinker telegraph 0.8 s | hop | 1 500 m |
| Van | 5.2 × 2.4 | 18–24 | constant | hop (high) | 0 m |
| Bus | 12 × 3.2 | 15 | slow | platform | 800 m |
| Semi (cab + trailer) | 16.5 × 4.0 | 16 | slow | platform (trailer) | 500 m |
| Car-carrier | 18 × 4.2 | 16 | slow, ramp-like rear deck | platform | 3 000 m |
| Cone / barrel cluster | 1 × 1 | 0 | static, construction zones | — | 1 000 m |
| Concrete barrier | 4 × 1.1 | 0 | static lane closure with arrow signs | — | 2 000 m |
| Marshrutka minibus | 6.0 × 2.6 | 18–24 | may stop-and-go (brake lights telegraph 0.8 s) | hop (high) | 1 000 m |
| Trolleybus | 12 × 3.4 | 14 | slow; overhead wires are cosmetic only | platform | 800 m (night biome favoured) |
| Street-sweeper | 7 × 3.0 | 10 | very slow; water spray VFX reduces visibility in its lane | platform | 2 500 m |
| Road-works truck with arrow board | 8 × 3.2 | 0–8 | heads a construction zone; arrow shows the closed lane | platform | 1 500 m |

Traffic only travels forward. Relative speed = player speed − traffic speed.

---

## 8. Pickups and items

- **Gold ring** — lines of 5–8 in lanes and arcs in the air (to reward flight).
- **Star token** — starts COSMONAUT. First after 1 000 m, then at least one per 1 500 m.
- **AIR canister** — +200 L.
- **Item capsule** — fills the single ITEM slot (ignored if the slot is occupied).

**Items** [PROPOSED; the reference shows only a red eye icon — OPEN]
| Item | Effect |
|---|---|
| RADAR (eye icon) | 6 s: highlights traffic in the next 300 m and lane-change intentions; 1 s of 0.85× slow-motion on activation |
| MAGNET | 8 s: pulls rings and canisters within 2 lanes |
| SHIELD | absorbs one crash (becomes a SMASH) |
| EMP | removes the 3 nearest vehicles ahead (counted as smashes at 0.5× points) |

---

## 9. Scoring and streaks

| Event | Trigger | Points | Meter | Streak |
|---|---|---|---|---|
| Distance | per metre | 1 | 0 | — |
| BOOST | per 0.25 s held | 10 | 1 | doesn't break or extend |
| NEAR MISS | pass within 0.6 m laterally | 50 | 10 | +1 |
| CLEAR | pass over a car or van while airborne | 300 | 60 | +1 |
| SEMI CLEARED | pass over a whole semi/bus while airborne | 3 000 | 200 | +1 |
| HOP | roof bounce | 150 | 40 | +1 |
| ROOF RIDE | per 10 m on a platform | 20 | 5 | keeps alive |
| FRONT FLIP | per 360° (+20 % per extra flip in the same jump) | 360 | 80 | +1 |
| BARREL ROLL | per 360° | 120 | 40 | +1 |
| STUNT LANDING | ≤ 35° | 20 | 10 | +1 |
| PERFECT LANDING | ≤ 12° | 120 | 30 | +1 |
| SLAM | slam landing | 50 | 10 | +1 |
| SMASH | collision while invincible | 100 (+5 per chain, cap 200) | 0 | +1 |
| RING | pickup | 10 | 2 | — |

**Streak rules** [REF shows ×N, "STREAK N ACTIVE", a seconds countdown and a growing pot; formula is ours]
- Each streak event refreshes a 2.5 s window (HUD shows the countdown).
- Multiplier `m = 1 + 0.25 × (n − 1)`, capped at ×8, where n = events in the current streak.
- Pot = Σ(points × m at the moment of each event). The pot banks into the score when the window expires.
- CRASH loses the pot. SLOPPY landing banks 50 % and resets the streak.
- Fireworks over the road at n = 10, 20, 30…

---

## 10. Invincible modes

| Mode | Trigger | Duration | Effects | Presentation |
|---|---|---|---|---|
| LIFTOFF | meter full | 5 s | invincible, SMASH, AIR ∞, speed ×1.15 | warm orange grade, rocket launches on the horizon, light camera shake, "Poekhali!" |
| COSMONAUT | star token | 6.5 s | as LIFTOFF + ring magnet | rainbow mode bar, star trail behind the car |
| OVERDRIVE | meter fills during another mode | +4 s, points ×1.5 | as current mode | pink grade, fireworks |

All modes end with a 1 s grace period (car blinks, collisions still forgiven).

---

## 11. Difficulty and spawn director

- Traffic is generated in **rows**; row spacing shrinks from 18 m to 11 m as difficulty D goes 0 → 1 over ~8 km.
- Rows come from hand-authored **patterns** (`packages/content/patterns/*.json`, 100–300 m each) mixed with procedural filler.
- D controls density, lane-changer share, semi/bus frequency, construction zones, and how often the solution
  requires the air layer.
- **Pacing waves** of 30–45 s: build-up → peak (dense, semis, construction) → breather (ring arcs, open lanes,
  star/canister chance).
- **Fairness** (hard rule): a solver verifies that at least one survivable path exists through the next 3 rows
  using current speed, lane-change time, jump/fly and current AIR; otherwise the least valuable blocker is
  removed. Never more than 4 of 5 lanes blocked at ground height unless a roof/platform path exists.
- **Seeds:** every run has a seed. The weekly leaderboard uses one shared weekly seed so everyone drives the same road.

---

## 12. World

The world is a fictional Moscow-inspired city (Kometograd). Biome list, archetypes, landmark rule and
lighting targets live in **ART_DIRECTION.md §4–§7**; gameplay-relevant facts are summarised here.

| Distance | Biome | Gameplay notes |
|---|---|---|
| intro | Ski-jump hill | 3-2-1 countdown synced to the descent; input unlocks in buffered mode at "1" |
| 0–2.5 km | Embankment Gold | widest sight lines; teaches roofs and hops; Cosmos Park rocket launches on LIFTOFF |
| 2.5–5 km | Ring Road Dusk | tunnels (short light change, no hazards inside the first 50 m of a tunnel), billboards, denser semis |
| 5–8 km | Spalny Neon Night | rain gloss, trolleybuses, construction zones; optional top-down "drone cam" finale [REF / OPEN] |
| 8 km + | loop with variants | weather and palette swaps |

Chunks are 200 m long; props are instanced; sky dome + sun + fog colour keyed per biome and blended over 300 m.

---

## 13. Camera

Chase rig: 6.5 m behind, 2.8 m up, looks 12 m ahead, spring-damped. FOV 62° → 74° with speed, +6° kick on
boost. 4° roll on lane change. Airborne: pull back 1.5 m, raise 1 m. Platform ride: raise 1.2 m.
Mode shake 0.15 (disabled under Reduced Motion). Intro and results use authored spline shots.

---

## 14. HUD

**Portrait mobile (primary)**
```
┌─────────────────────────────────────┐
│ [❚❚] [♪]              1 1 2 , 1 2 6 │  score — odometer drum
│ ████████████░░░░░░░░  LIFTOFF  4.9s │  meter / mode bar
│ 6 692 m             ×11  streak 1.8s│
│                          +16 140    │  pot
│                 Front flip +1 200   │  event feed (≤ 3 lines)
│                  Semi cleared +3 000│
│                                     │
│              ( 3D view )            │
│                                     │
│ (ITEM)                              │
│ (BOOST)       Achievement: Hat-trick│  toast
│ AIR ▮▮▮▮▮▮▮▮▮▯▯▯             597 L │
└─────────────────────────────────────┘
```
**Desktop / landscape:** same elements; AIR bar bottom-centre; optional key-hint bar below it.

Element rules: score uses tabular figures and rolls like a mechanical odometer (the one signature UI moment);
event feed shows the newest at the bottom, fades in 0.9 s; AIR bar has 12 segments plus litres; ITEM and
BOOST are 72 px circles in the left thumb zone, 35 % opacity idle and 80 % pressed; mirrored in left-handed mode;
safe-area insets respected; nothing interactive in the top 44 px on iOS.

---

## 15. Screens

1. **Main menu:** title, pilot name (tap to edit), optional sign-in, best distance and score, PLAY (primary),
   Achievements, Garage (v1: view the car; v1.1: unlocks), Ranking, Settings, Controls, collapsible Top 100
   (All-time | Weekly), Credits.
2. **Pause:** Resume, Restart, Settings, Quit to menu.
3. **Settings:** music, SFX, haptics, graphics (Auto / Low / Medium / High), reduced motion, colour-blind-safe
   mode bars, left-handed buttons, key hints, language (EN / RU), auto-LIFTOFF, toggle-fly.
4. **Results** (v1 per ADR-020: score + Retry, no Ranking; a unique promo code is displayed — DECISIONS Q16): end line by cause, score, distance, time, NEW BEST markers, max streak, collapsible trick
   breakdown, Retry (primary), Ranking, Menu, Share. Submit states: "Saving…" → "Saved · #rank" → offline
   "Will upload when you're online".
   End lines (with the suggested premise): crash — *"The pies will have to wait."*; destination (Route mode,
   v1.1) — *"Made it to the dacha! The neighbours ate the pies."*
5. **Achievements** grid · **Ranking** (tabs, your row pinned) · **Controls** (illustrated per device) ·
   **Credits** (generated from `assets/LICENSES.json`).
6. **Tutorial** (first run, skippable): empty road, four gated prompts — change lanes, jump a car, hold to
   fly through rings, flip and land. Ghost-hand animations; time runs at 0.6× until the correct input.

---

## 16. Achievements v1 [PROPOSED]

| Name | Condition |
|---|---|
| Contact! | Trigger LIFTOFF for the first time |
| Warm-up Lap | 10 smashes in one run |
| Hat-trick | 3 hops in a row |
| First Combo | Streak of 5 |
| Cosmonaut | Collect a star token |
| Trailer Surfer | Ride semi trailers for 200 m in one run |
| Clean Sheet | 10 perfect landings in one run |
| Overdrive | Trigger OVERDRIVE |
| Tank Discipline | Reach 3 km without AIR dropping below 50 % |
| Bowling Night | Knock over 30 cones in one run |
| Double Rotation | Two front flips in one jump |
| Corkscrew | Barrel roll and front flip in the same jump |
| Lane Dancer | 20 near misses in one run |
| Sky Road | Stay airborne or on roofs for 10 s straight |
| Long Haul | 10 km in one run |
| Big Pot | Bank a pot of 20 000+ |
| Six Figures | Score 100 000+ |
| Weekly Pilot | Finish in the weekly top 100 |
| Night Shift | Reach the night city |
| Ring Collector | 1 000 rings lifetime |

---

## 17. Meta and online

- **Identity:** guest by default with a generated name `PILOT_####` and a 4-digit tag; editable (3–16 chars,
  EN/RU profanity filter). Optional sign-in to sync devices — providers [OPEN].
- **Leaderboards:** all-time and weekly (reset Monday 00:00 UTC, shared weekly seed). Top 100 plus your rank and
  neighbours. Scores accepted only after server-side replay validation.
- **Share:** Web Share API with a generated 1080×1920 card (score, distance, car, rank); fallback copy-link.
- **Saves:** IndexedDB, versioned; cloud copy when signed in. Failed submits are queued and retried.

---

## 18. Audio

Music: synthwave with a light Soviet estrada flavour; three adaptive stems — base, intensity (speed), mode layer.
SFX: motor whine (pitch by speed), lane whoosh, jump, thruster loop, flip whoosh, landing (perfect = chime),
hop, scrape, crash, smash, ring, star, canister, meter full, mode start/end, countdown, achievement, UI.
Haptics (mobile, toggle): light on lane change, medium on landing, heavy on crash.

---

## 19. Look and feel

Superseded by **ART_DIRECTION.md** (palette, grading, materials, wet-road technique, post-processing,
vehicle concepts and the Design Agreement checklist). UI typography stays: Unbounded (display) and Golos Text
(UI), both Latin + Cyrillic, OFL; tabular figures; the odometer score remains the single signature UI moment.

---

## 20. Accessibility

Reduced motion (no shake, no FOV kick, softer flashes) · colour-blind-safe mode bars (pattern + label, never
colour alone) · UI text 100 / 125 % · remappable keys · toggle-fly · haptics off · subtitles for voice callouts ·
no flashing above 3 Hz.

---

## 21. Out of scope for v1

Upgrades and shop, extra car bodies and paints, daily missions, Route mode with a destination (all v1.1);
ghost races (v1.2); multiplayer; ads/IAP (decide later).

---

## 22. Open questions for the owner

1. How does a run end — crash only (endless), or also a Route mode with a destination like the reference's
   "made it home" ending? Default: endless in v1, Route mode in v1.1.
2. What does the ITEM do? Default: RADAR + MAGNET + SHIELD + EMP.
3. Final title, premise text and hero car name.
4. Sign-in providers (Google / Telegram / Yandex ID / none) and backend region for the target audience.
5. Mobile orientation: portrait only, or landscape too? Default: both, portrait first.
6. LIFTOFF trigger: automatic or manual? Default: automatic, manual in settings.
7. Distribution: own site (PWA) only, or also Telegram Mini App / Yandex Games / CrazyGames?
8. Monetisation: none, cosmetics, or rewarded revive?
9. ~~Scope~~ — answered: Iskendi "play while you wait" edition first; standalone later.
10. ~~Real rewards~~ — answered: later (hooks only in v1).
11. Vehicle concept: A "Pobeda R", B "Samodelka" (recommended) or C "Chaika GT" (ART_DIRECTION §8).
12. City: fictional "Kometograd" with Moscow archetypes (recommended) or recognisable real landmarks?
13. Hosting region/provider and expected audience (Russia, global, both)?
