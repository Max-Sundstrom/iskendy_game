import { CONCEPTS, LIVERIES, type Concept, type Livery } from './car';
import { GRADING, type Biome } from './palette';
import { renderStill, VIEWS, type View } from './still';

// Renders one blockout from one camera: car.html?concept=B&livery=factory&view=chase&biome=embankment

const params = new URLSearchParams(location.search);
const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  const value = params.get(key) as T | null;
  return value && allowed.includes(value) ? value : fallback;
};
const concept = pick<Concept>('concept', ['A', 'B', 'C'], 'B');
const livery = pick<Livery>('livery', ['factory', 'taxi', 'neon', 'courier'], 'factory');
const view = pick<View>('view', Object.keys(VIEWS) as View[], 'chase');
const biome = pick<Biome>('biome', ['embankment', 'ringroad', 'spalny'], 'embankment');
const width = Number(params.get('w') ?? 1280);
const height = Number(params.get('h') ?? 800);

const canvas = document.querySelector<HTMLCanvasElement>('#view');
const caption = document.querySelector<HTMLElement>('#caption');
if (canvas && caption) {
  const { size, triangles } = renderStill(canvas, { concept, livery, view, biome, width, height });
  caption.textContent = `${CONCEPTS[concept]} · ${LIVERIES[livery]} · ${VIEWS[view].label} · ${GRADING[biome].name} — ${size.z.toFixed(2)} × ${size.x.toFixed(2)} × ${size.y.toFixed(2)} m · ${triangles} tris`;
  document.body.dataset['ready'] = 'true';
}
