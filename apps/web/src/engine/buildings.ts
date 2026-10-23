import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// City blocks along the embankment (ART_DIRECTION §5): a stepped Stalinist-era block with a spire, a modern glass slab
// and a nine-storey panel block. Generic types, no replicas of real buildings (AGENTS §12). Window UVs are scaled to
// metres so windows keep their size on any part; cornices, parapets and roofs map to the plain band of the facade.

const WINDOW_TILE_W = 18; // metres of facade one texture repeat covers
const WINDOW_TILE_H = 36;
const PLAIN_V = 0.97; // the plain stone band at the top of the facade texture

export type BuildingKind = { geometry: BufferGeometry; depthM: number; widthM: number };

/** Box from (x, y0, z) with size w × h × d; side faces get metre-scaled window UVs unless `plain`. */
function part(w: number, h: number, d: number, x: number, y0: number, z: number, plain = false): BufferGeometry {
  const g = new BoxGeometry(w, h, d).translate(x, y0 + h / 2, z);
  const uv = g.getAttribute('uv');
  // BoxGeometry faces, 4 vertices each: +x, −x, +y, −y, +z, −z.
  const faceSize: [number, number][] = [
    [d, h],
    [d, h],
    [0, 0],
    [0, 0],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const [fw, fh] = faceSize[f] ?? [0, 0];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (plain || fw === 0) uv.setXY(i, 0.02 * uv.getX(i), PLAIN_V);
      else uv.setXY(i, (uv.getX(i) * fw) / WINDOW_TILE_W, (uv.getY(i) * fh) / WINDOW_TILE_H);
    }
  }
  return g;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error('building parts have mismatched attributes');
  return g;
}

/** Stepped block: three setbacks with cornices and a spire, the classic Moscow high-rise silhouette type. */
function stepped(): BuildingKind {
  const spire = new ConeGeometry(1.4, 16, 8).translate(0, 54, 0);
  const suv = spire.getAttribute('uv');
  for (let i = 0; i < suv.count; i++) suv.setXY(i, 0, PLAIN_V);
  return {
    widthM: 30,
    depthM: 22,
    geometry: merge([
      part(30, 22, 22, 0, 0, 0),
      part(31.5, 1.2, 23.5, 0, 22, 0, true),
      part(21, 12, 15, 0, 23.2, 0),
      part(22.2, 1, 16.2, 0, 35.2, 0, true),
      part(12, 9, 10, 0, 36.2, 0),
      part(13, 0.8, 11, 0, 45.2, 0, true),
      spire,
    ]),
  };
}

/** Modern slab with a crown frame and rooftop plant rooms. */
function slab(): BuildingKind {
  return {
    widthM: 26,
    depthM: 16,
    geometry: merge([
      part(26, 58, 16, 0, 0, 0),
      part(27, 2.5, 17, 0, 58, 0, true),
      part(8, 4, 6, -6, 60.5, 2, true),
      part(5, 3, 5, 7, 60.5, -3, true),
    ]),
  };
}

/** Nine-storey panel block with a parapet and entrance canopies. */
function panel(): BuildingKind {
  return {
    widthM: 14,
    depthM: 40,
    geometry: merge([
      part(14, 27, 40, 0, 0, 0),
      part(14.6, 1, 40.6, 0, 27, 0, true),
      part(3, 0.4, 3, -8.5, 3, -10, true),
      part(3, 0.4, 3, -8.5, 3, 10, true),
    ]),
  };
}

export function buildingKinds(): BuildingKind[] {
  return [stepped(), slab(), panel()];
}

/** Facade: lit and dark windows in a grid with a plain stone band on top; the emissive copy lights only windows. */
export function facadeMaterial(): MeshStandardMaterial {
  const w = 64;
  const h = 128;
  const make = (glow: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = glow ? '#000' : '#8d7d76';
      ctx.fillRect(0, 0, w, h);
      for (let y = 10; y < h; y += 8)
        for (let x = 3; x < w; x += 8) {
          const lit = (x * 7 + y * 13) % 5 < 2;
          ctx.fillStyle = glow ? (lit ? '#ffcf8a' : '#000') : lit ? '#f7d9a8' : '#1d1f27';
          ctx.fillRect(x, y, 4, 5);
        }
      if (!glow) {
        // Pilasters between window columns give the facade relief at a distance.
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        for (let x = 0; x < w; x += 16) ctx.fillRect(x, 8, 2, h - 8);
      }
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.wrapS = tex.wrapT = RepeatWrapping;
    return tex;
  };
  return new MeshStandardMaterial({
    map: make(false),
    emissiveMap: make(true),
    emissive: '#ffffff',
    emissiveIntensity: 0.6,
    roughness: 0.75,
  });
}
