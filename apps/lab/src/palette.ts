/** "Moscow Vice" palette, ART_DIRECTION §4 — the lab's single source until the Design Agreement moves it to content. */
export const PALETTE = {
  sodiumTangerine: '#FF8A3D',
  hotRose: '#FF4F9A',
  lagoonTeal: '#19C2B0',
  sunflower: '#FFD23F',
  brickRed: '#B8392F',
  duskPlum: '#3B1752',
  hazeLilac: '#CDB2F0',
  wetAsphalt: '#1A1C26',
  enamelCream: '#F3E9D2',
} as const;

export const PALETTE_ROLES: Record<keyof typeof PALETTE, string> = {
  sodiumTangerine: 'key light, LIFTOFF, primary accent',
  hotRose: 'sky band, neon, OVERDRIVE',
  lagoonTeal: 'river, shadow split-tone, AIR bar',
  sunflower: 'rings, highlights, taxi paint',
  brickRed: 'old-city brick, danger accents',
  duskPlum: 'upper sky, UI panels',
  hazeLilac: 'distance fog, far silhouettes',
  wetAsphalt: 'road, UI ink',
  enamelCream: 'hero car base paint, text on dark',
};

/** 12-colour city traffic sub-palette (ART_DIRECTION §4); exact shades proposed here for D0-1. */
export const TRAFFIC = {
  taxiYellow: '#F2C230',
  executiveBlack: '#16171C',
  white: '#E9E6DF',
  silver: '#A9ADB4',
  cherry: '#8E1F2C',
  bottleGreen: '#1F4B3A',
  teal: '#1E7F7A',
  skyBlue: '#6FA8D6',
  beige: '#C9B48E',
  worksOrange: '#E86A1C',
  plum: '#5A2A62',
  grey: '#5E6168',
} as const;

/** Iskendi brand orange for the v1 courier livery (ART_DIRECTION §4, §8). */
export const ISKENDI_ORANGE = '#DB5D00';

export type Biome = 'embankment' | 'ringroad' | 'spalny';

/** Per-biome grading targets (ART_DIRECTION §4). */
export const GRADING: Record<
  Biome,
  { name: string; skyTop: string; horizon: string; sun: string; fog: string; fogMix: number; shadow: string }
> = {
  embankment: {
    name: 'Embankment Gold',
    skyTop: PALETTE.duskPlum,
    horizon: PALETTE.sodiumTangerine,
    sun: '#FFB07A',
    fog: PALETTE.hazeLilac,
    fogMix: 0.35,
    shadow: PALETTE.lagoonTeal,
  },
  ringroad: {
    name: 'Ring Road Dusk',
    skyTop: PALETTE.duskPlum,
    horizon: PALETTE.hotRose,
    sun: '#FF9A8A',
    fog: PALETTE.hotRose,
    fogMix: 0.25,
    shadow: '#2A0F3A',
  },
  spalny: {
    name: 'Spalny Neon Night',
    skyTop: '#120818',
    horizon: PALETTE.duskPlum,
    sun: '#FFB45A',
    fog: PALETTE.wetAsphalt,
    fogMix: 0.4,
    shadow: '#123A4A',
  },
};
