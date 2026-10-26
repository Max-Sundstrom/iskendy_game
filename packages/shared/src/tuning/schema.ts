import { z } from 'zod';

// The game origin's CSP forbids eval (SECURITY T12). Without this, zod probes `new Function` on first parse,
// which the browser reports as a CSP and Trusted Types violation even though zod catches the error.
z.config({ jitless: true });

// Shape of packages/content/tuning*.json (invariant 3). Objects are strict so a misspelt key fails loudly
// instead of silently falling back to nothing.

const pos = () => z.number().positive();
const nonNeg = () => z.number().nonnegative();
const posInt = () => z.number().int().positive();
const nonNegInt = () => z.number().int().nonnegative();
const ratio = () => z.number().min(0).max(1);
const durationS = () => z.number().positive();
const fromM = () => z.number().nonnegative();

const lanes = z.strictObject({
  count: z.number().int().min(3).max(9),
  widthM: pos(),
  changeDurationS: durationS(),
  queuedInputs: nonNegInt(),
});

const player = z.strictObject({ lengthM: pos(), widthM: pos(), heightM: pos() });

const vehicle = z
  .strictObject({
    id: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
    lengthM: pos(),
    widthM: pos(),
    heightM: pos(),
    minMps: nonNeg(),
    maxMps: nonNeg(),
    behaviour: z.enum(['constant', 'slow', 'laneChanger', 'stopGo', 'static']),
    top: z.enum(['hop', 'platform', 'none']),
    fromM: fromM(),
    weight: pos(),
  })
  .refine((v) => v.minMps <= v.maxMps, { message: 'minMps must not exceed maxMps', path: ['minMps'] });

const traffic = z.strictObject({ followGapM: pos(), spawnClearanceM: nonNeg() });

const speed = z
  .strictObject({
    minMps: pos(),
    maxMps: pos(),
    distanceScaleM: pos(),
    boostMultiplier: z.number().min(1),
    liftoffMultiplier: z.number().min(1),
    scrapePenalty: ratio(),
    scrapePenaltyDurationS: durationS(),
    sloppyPenalty: ratio(),
    sloppyPenaltyDurationS: durationS(),
    conePenalty: ratio(),
  })
  .refine((s) => s.minMps <= s.maxMps, { message: 'minMps must not exceed maxMps', path: ['minMps'] });

const jump = z.strictObject({
  apexHeightM: pos(),
  timeToApexS: durationS(),
  fallGravityMultiplier: z.number().min(1),
  bufferS: nonNeg(),
  coyoteS: nonNeg(),
});

const fly = z.strictObject({
  holdThresholdS: nonNeg(),
  glideVyMps: z.number().nonpositive(),
  /** Time constant with which vertical speed eases toward glideVyMps while thrusting. */
  glideEaseS: durationS(),
  maxAltitudeM: pos(),
  airCostLps: pos(),
});

const slam = z.strictObject({ vyMps: z.number().negative(), shockwaveRadiusM: pos() });

const tricks = z.strictObject({
  frontFlipDurationS: durationS(),
  barrelRollDurationS: durationS(),
  barrelRollQueuedInputs: z.union([z.literal(0), z.literal(1)]),
});

const landing = z
  .strictObject({
    perfectMaxDeg: pos(),
    stuntMaxDeg: pos(),
    sloppyMaxDeg: z.number().positive().max(180),
    orientationMode: z.enum(['uprightForward', 'upVector']),
  })
  .refine((l) => l.perfectMaxDeg < l.stuntMaxDeg && l.stuntMaxDeg < l.sloppyMaxDeg, {
    message: 'grades must be ordered: perfectMaxDeg < stuntMaxDeg < sloppyMaxDeg',
    path: ['stuntMaxDeg'],
  });

const roofs = z.strictObject({
  hopHeightM: pos(),
  slamHopHeightM: pos(),
  landingToleranceM: nonNeg(),
  hatTrickCount: posInt(),
});

const collision = z.strictObject({
  nearMissLateralM: pos(),
  secondScrapeWindowS: durationS(),
  scrapeAirLossL: nonNeg(),
});

const air = z
  .strictObject({
    capacityL: pos(),
    startL: nonNeg(),
    regenLps: nonNeg(),
    boostCostLps: nonNeg(),
    canisterL: pos(),
    lowWarningRatio: ratio(),
  })
  .refine((a) => a.startL <= a.capacityL, { message: 'startL must not exceed capacityL', path: ['startL'] });

const meter = z.strictObject({ capacity: pos(), autoTrigger: z.boolean() });

const modes = z.strictObject({
  liftoff: z.strictObject({ durationS: durationS() }),
  cosmonaut: z.strictObject({ durationS: durationS(), magnetLanes: nonNegInt() }),
  overdrive: z.strictObject({ extensionS: durationS(), pointsMultiplier: z.number().min(1) }),
  graceS: nonNeg(),
});

const streak = z.strictObject({
  windowS: durationS(),
  multiplierStep: pos(),
  multiplierCap: z.number().min(1),
  sloppyBankRatio: ratio(),
  scrapeBankRatio: ratio(),
  fireworksEvery: posInt(),
});

const score = z.strictObject({
  perMeter: nonNeg(),
  boostPerQuarterSecond: nonNeg(),
  nearMiss: nonNeg(),
  clear: nonNeg(),
  semiCleared: nonNeg(),
  hop: nonNeg(),
  roofRidePer10m: nonNeg(),
  frontFlip: nonNeg(),
  extraFlipBonus: nonNeg(),
  barrelRoll: nonNeg(),
  stuntLanding: nonNeg(),
  perfectLanding: nonNeg(),
  slam: nonNeg(),
  smashBase: nonNeg(),
  smashChainStep: nonNeg(),
  smashCap: nonNeg(),
  ring: nonNeg(),
  coneBowling: nonNeg(),
});

const scoring = z.strictObject({
  boostIntervalS: durationS(),
  roofRideIntervalM: pos(),
  boostTarget: z.enum(['total', 'activePot']),
  roofRideTarget: z.enum(['total', 'activePot']),
  roofRideDistanceBasis: z.enum(['world', 'relative']),
});

const meterGain = z.strictObject({
  boostPerQuarterSecond: nonNeg(),
  nearMiss: nonNeg(),
  clear: nonNeg(),
  semiCleared: nonNeg(),
  hop: nonNeg(),
  roofRidePer10m: nonNeg(),
  frontFlip: nonNeg(),
  barrelRoll: nonNeg(),
  stuntLanding: nonNeg(),
  perfectLanding: nonNeg(),
  slam: nonNeg(),
  ring: nonNeg(),
});

const pickups = z
  .strictObject({
    ringLineMin: posInt(),
    ringLineMax: posInt(),
    starFirstAfterM: fromM(),
    starGuaranteeEveryM: pos(),
    itemCapsuleEveryM: pos(),
  })
  .refine((p) => p.ringLineMin <= p.ringLineMax, {
    message: 'ringLineMin must not exceed ringLineMax',
    path: ['ringLineMin'],
  });

const items = z.strictObject({
  radar: z.strictObject({
    durationS: durationS(),
    lookaheadM: pos(),
    slowmoFactor: z.number().positive().max(1),
    slowmoS: nonNeg(),
  }),
  magnet: z.strictObject({ durationS: durationS(), lanes: nonNegInt() }),
  shield: z.strictObject({ charges: posInt() }),
  emp: z.strictObject({ targets: posInt(), pointsFactor: ratio() }),
});

const director = z
  .strictObject({
    rowSpacingStartM: pos(),
    rowSpacingEndM: pos(),
    difficultyRampM: pos(),
    waveLengthMinS: durationS(),
    waveLengthMaxS: durationS(),
    maxBlockedGroundLanes: posInt(),
    solverLookaheadRows: posInt(),
    solverMaxRetries: nonNegInt(),
    laneChangerFromM: fromM(),
    busFromM: fromM(),
    semiFromM: fromM(),
    carCarrierFromM: fromM(),
    conesFromM: fromM(),
    barriersFromM: fromM(),
    laneChangeTelegraphS: durationS(),
    firstRowM: pos(),
    spawnAheadM: pos(),
    despawnBehindM: pos(),
    marshrutkaFromM: fromM(),
    trolleybusFromM: fromM(),
    sweeperFromM: fromM(),
    worksTruckFromM: fromM(),
  })
  .refine((d) => d.rowSpacingEndM <= d.rowSpacingStartM, {
    message: 'rows may only get denser: rowSpacingEndM must not exceed rowSpacingStartM',
    path: ['rowSpacingEndM'],
  })
  .refine((d) => d.waveLengthMinS <= d.waveLengthMaxS, {
    message: 'waveLengthMinS must not exceed waveLengthMaxS',
    path: ['waveLengthMinS'],
  });

/** Everything that changes sim outcomes; hashed into every replay (`tuningHash`). */
export const SimTuningSchema = z
  .strictObject({
    tickRateHz: z.literal(60),
    lanes,
    player,
    speed,
    jump,
    fly,
    slam,
    tricks,
    landing,
    roofs,
    collision,
    air,
    meter,
    modes,
    streak,
    score,
    scoring,
    meterGain,
    pickups,
    items,
    director,
    world: z.strictObject({ originShiftM: pos() }),
    traffic,
    // Vehicle data lives in the tuning so it is validated and covered by tuningHash (invariant 3).
    vehicles: z
      .array(vehicle)
      .min(1)
      .max(32)
      .refine((vs) => new Set(vs.map((v) => v.id)).size === vs.length, { message: 'vehicle ids must be unique' }),
  })
  // A survivable path needs at least one free ground lane (invariant 6).
  .refine((s) => s.director.maxBlockedGroundLanes < s.lanes.count, {
    message: 'maxBlockedGroundLanes must leave at least one lane free',
    path: ['director', 'maxBlockedGroundLanes'],
  })
  // Traffic must be slower than the slowest player speed (even under a scrape penalty), so nothing hits from behind.
  .refine((s) => s.vehicles.every((v) => v.maxMps <= s.speed.minMps * (1 - s.speed.scrapePenalty)), {
    message: 'every vehicle must be slower than minMps × (1 − scrapePenalty)',
    path: ['vehicles'],
  });

const biome = z.strictObject({ id: z.string().regex(/^[a-z][a-z0-9_]*$/), fromM: fromM() });

/** Renderer, camera, input and HUD numbers; not part of the hash. */
export const PresentationTuningSchema = z.strictObject({
  world: z
    .strictObject({
      chunkLengthM: pos(),
      biomeBlendM: nonNeg(),
      loopFromM: pos(),
      biomes: z.array(biome).min(1),
    })
    .refine((w) => w.biomes[0]?.fromM === 0, { message: 'the first biome must start at 0 m', path: ['biomes', 0] })
    .refine((w) => w.biomes.every((b, i, all) => i === 0 || (all[i - 1]?.fromM ?? 0) < b.fromM), {
      message: 'biomes must be sorted by strictly increasing fromM',
      path: ['biomes'],
    }),
  camera: z
    .strictObject({
      distanceM: pos(),
      heightM: pos(),
      lookAheadM: pos(),
      fovMinDeg: z.number().min(30).max(120),
      fovMaxDeg: z.number().min(30).max(120),
      boostFovKickDeg: nonNeg(),
      laneRollDeg: nonNeg(),
      airPullbackM: nonNeg(),
      airRaiseM: nonNeg(),
      platformRaiseM: nonNeg(),
      modeShake: nonNeg(),
    })
    .refine((c) => c.fovMinDeg <= c.fovMaxDeg, { message: 'fovMinDeg must not exceed fovMaxDeg', path: ['fovMinDeg'] }),
  car: z.strictObject({ laneBodyRollDeg: nonNeg() }),
  crash: z
    .strictObject({
      durationS: durationS(),
      settleDurationS: durationS(),
      bodyDropM: nonNeg(),
      bodyPitchDeg: z.number().min(0).max(15),
      cameraPullbackM: nonNeg(),
      cloudCountPerNozzle: nonNegInt(),
      cloudLifeS: durationS(),
      cloudSpeedMps: nonNeg(),
      cloudSpreadMps: nonNeg(),
      cloudSizeM: pos(),
      cloudGrowM: nonNeg(),
      cloudAlpha: ratio(),
    })
    .refine((c) => c.settleDurationS <= c.durationS, {
      message: 'settleDurationS must fit in the crash presentation',
      path: ['settleDurationS'],
    }),
  input: z.strictObject({ swipeMinPx: pos(), swipeMaxMs: pos() }),
  hud: z.strictObject({
    eventFeedLines: posInt(),
    eventFadeS: nonNeg(),
    toastS: durationS(),
    airSegments: posInt(),
    buttonSizePx: z.number().min(44),
  }),
  quality: z.strictObject({
    p95DowngradeMs: pos(),
    downgradeWindowS: durationS(),
    upgradeHeadroomS: durationS(),
    pixelRatioSteps: z.array(z.number().positive().max(1)).min(1),
  }),
});

/** Limits for the deferred replay validator (ADR-019); kept so the format stays capped. */
export const ServerTuningSchema = z.strictObject({
  replay: z.strictObject({
    maxTicks: posInt(),
    maxCompressedBytes: posInt(),
    maxDecompressedBytes: posInt(),
    maxPauses: nonNegInt(),
    maxPauseTotalS: nonNeg(),
  }),
});

export const TuningSchema = z.strictObject({
  schemaVersion: z.literal(1),
  simVersion: posInt(),
  sim: SimTuningSchema,
  presentation: PresentationTuningSchema,
  server: ServerTuningSchema,
});

export type Tuning = Readonly<z.infer<typeof TuningSchema>>;
export type SimTuning = Readonly<z.infer<typeof SimTuningSchema>>;
