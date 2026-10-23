import { GRADING, ISKENDI_ORANGE, PALETTE, PALETTE_ROLES, TRAFFIC, type Biome } from './palette';

const el = (tag: string, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};

function swatch(name: string, hex: string, role?: string): HTMLElement {
  const s = el('div', 'swatch');
  const chip = el('div', 'chip');
  chip.style.background = hex;
  const meta = el('div', 'meta');
  meta.append(el('b', undefined, name), el('span', undefined, hex.toUpperCase()));
  if (role) meta.append(el('div', 'note', role));
  s.append(chip, meta);
  return s;
}

const words = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

const palette = document.getElementById('palette');
for (const [key, hex] of Object.entries(PALETTE)) {
  palette?.append(swatch(words(key), hex, PALETTE_ROLES[key as keyof typeof PALETTE]));
}

const traffic = document.getElementById('traffic');
for (const [key, hex] of Object.entries(TRAFFIC)) traffic?.append(swatch(words(key), hex));

const liveries = document.getElementById('liveries');
for (const [name, hex] of [
  ['Factory Cream', `linear-gradient(${PALETTE.duskPlum} 0 30%, ${PALETTE.enamelCream} 30%)`],
  [
    'City Taxi',
    `repeating-linear-gradient(90deg, #111 0 10px, #eee 10px 20px) 0 60% / 100% 12px no-repeat, ${PALETTE.sunflower}`,
  ],
  ['Neon Night', `linear-gradient(transparent 58%, ${PALETTE.hotRose} 58% 62%, transparent 62%), #15161d`],
  ['Iskendi Courier (v1)', `linear-gradient(#f6e7c8 0 30%, ${ISKENDI_ORANGE} 30%)`],
] as const) {
  const s = swatch(name, '#000000');
  const chip = s.querySelector<HTMLElement>('.chip');
  if (chip) chip.style.background = hex;
  s.querySelector('span')?.remove();
  liveries?.append(s);
}

const biomes = document.getElementById('biomes');
const ARCHETYPES: Record<Biome, string> = {
  embankment: 'river embankment · stepped “wedding-cake” tower · arch bridge · barges · lindens · Cosmos Park rocket',
  ringroad: 'elevated ring road · glass towers in pink sky · tunnels · LED billboards · gantry signs',
  spalny: 'panel blocks with window mosaics · neon kiosks · sodium lamps · rain gloss · trolleybus wires',
};
for (const [key, g] of Object.entries(GRADING) as [Biome, (typeof GRADING)[Biome]][]) {
  const card = el('div', 'biome');
  const sky = el('div', 'sky');
  sky.style.background = `linear-gradient(${g.skyTop}, ${g.horizon})`;
  const sun = el('div', 'sun');
  sun.style.background = g.sun;
  sun.style.boxShadow = `0 0 60px 30px ${g.sun}88`;
  sky.append(sun);
  const road = el('div', 'road');
  road.style.background = `linear-gradient(${g.horizon}55, #1a1c26 70%)`;
  const meta = el('div', 'meta');
  meta.append(el('b', undefined, g.name));
  for (const [label, hex] of [
    ['fog', g.fog],
    ['shadow', g.shadow],
    ['sun', g.sun],
  ] as const) {
    const item = el('span');
    const dot = el('span', 'dot');
    dot.style.background = hex;
    item.append(dot, document.createTextNode(`${label} ${hex}`));
    meta.append(item);
  }
  meta.append(el('div', 'note', ARCHETYPES[key]));
  card.append(sky, road, meta);
  biomes?.append(card);
}

const archetypes = document.getElementById('archetypes');
for (const line of [
  'Intro — ski-jump hill over the city (replaces the v0.1 steel gantry)',
  '0–2.5 km Embankment Gold — riverside, Cosmos Park rocket launches on LIFTOFF',
  '2.5–5 km Ring Road Dusk — tunnels, billboards (sponsor/brand slots)',
  '5–8 km Spalny Neon Night — panel blocks, kiosks, rain',
  '8 km+ — loop with weather/palette variants; live-ops: poplar fluff, first snow',
]) {
  archetypes?.append(el('li', undefined, line));
}

// WCAG 2.2 contrast for the text pairs the HUD and menus will use.
function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const contrast = document.getElementById('contrast');
for (const [fg, bg, label] of [
  [PALETTE.enamelCream, PALETTE.wetAsphalt, 'Cream on Wet Asphalt (HUD text)'],
  [PALETTE.enamelCream, PALETTE.duskPlum, 'Cream on Dusk Plum (panels)'],
  [PALETTE.sunflower, PALETTE.wetAsphalt, 'Sunflower on Asphalt (score pops)'],
  [PALETTE.lagoonTeal, PALETTE.wetAsphalt, 'Teal on Asphalt (AIR)'],
  [PALETTE.sodiumTangerine, PALETTE.wetAsphalt, 'Tangerine on Asphalt (LIFTOFF)'],
  [PALETTE.hotRose, PALETTE.wetAsphalt, 'Rose on Asphalt (OVERDRIVE)'],
  [PALETTE.wetAsphalt, PALETTE.sodiumTangerine, 'Asphalt on Tangerine (primary button)'],
  [PALETTE.enamelCream, ISKENDI_ORANGE, 'Cream on Iskendi orange'],
] as const) {
  const r = ratio(fg, bg);
  const row = el('tr');
  const sample = el('td');
  sample.textContent = 'Aa Яя';
  sample.style.cssText = `color:${fg};background:${bg};padding:4px 10px;font-weight:600`;
  row.append(
    sample,
    el('td', undefined, label),
    el('td', r >= 4.5 ? 'pass' : 'fail', `${r.toFixed(1)}:1 ${r >= 4.5 ? 'AA' : r >= 3 ? 'AA large only' : 'fail'}`),
  );
  contrast?.append(row);
}

document.fonts.ready.then(() => {
  document.body.dataset['ready'] = 'true';
});
