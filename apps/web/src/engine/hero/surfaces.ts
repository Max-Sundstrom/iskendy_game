import {
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  LinearFilter,
  MeshPhysicalMaterial,
  SRGBColorSpace,
  type BufferGeometry,
} from 'three';

/** One opaque material; part finishes live on vertices instead of becoming separate draw calls. */
export type Finish = { color: string; roughness: number; metalness?: number; emission?: string; roof?: boolean };

const WHITE_UV = 0.99;
const TILE_SIZE = 80;
const ATLAS_SIZE = 256;

/** The existing diamond-and-dot placeholder, repeated three times; no new owner ornament is introduced. */
function roofAtlas(ink: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.save();
        ctx.translate(4 + col * TILE_SIZE, 4 + row * TILE_SIZE);
        ctx.scale(TILE_SIZE / 128, TILE_SIZE / 128);
        ctx.fillStyle = '#F6E7C8';
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(64, 8);
        ctx.lineTo(120, 64);
        ctx.lineTo(64, 120);
        ctx.lineTo(8, 64);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(64, 64, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // Keep the isolated white swatch free of roof ink at a distance.
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  return texture;
}

/** Finishes retain enamel, rubber, metal and lamps while sharing the roof's small colour atlas. */
export function heroSurface(ink: string): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    vertexColors: true,
    map: roofAtlas(ink),
    roughness: 1,
    metalness: 1,
    clearcoat: 0.8,
    clearcoatRoughness: 0.16,
  });
  material.name = 'Kometa enamel and fittings';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec2 finish;\nattribute vec3 lamp;\nvarying vec2 vFinish;\nvarying vec3 vLamp;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFinish = finish;\nvLamp = lamp;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFinish;\nvarying vec3 vLamp;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= vFinish.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= vFinish.y;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vLamp;')
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\nmaterial.clearcoat *= 1.0 - smoothstep(0.5, 0.8, vFinish.x);',
      );
  };
  return material;
}

/** Adds a finish to a part and maps ordinary parts to the atlas's white swatch. */
export function finishGeometry(geometry: BufferGeometry, finish: Finish): BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const n = g.getAttribute('position').count;
  const color = new Color(finish.color);
  const emission = new Color(finish.emission ?? '#000000');
  const colors = new Float32Array(n * 3);
  const lamps = new Float32Array(n * 3);
  const finishes = new Float32Array(n * 2);
  const uv = new Float32Array(n * 2);
  const sourceUv = g.getAttribute('uv');
  for (let i = 0; i < n; i++) {
    colors.set([color.r, color.g, color.b], i * 3);
    lamps.set([emission.r, emission.g, emission.b], i * 3);
    finishes.set([finish.roughness, finish.metalness ?? 0], i * 2);
    uv[i * 2] = finish.roof && sourceUv ? (4 + sourceUv.getX(i) * 240) / ATLAS_SIZE : WHITE_UV;
    uv[i * 2 + 1] = finish.roof && sourceUv ? 1 - (4 + sourceUv.getY(i) * 240) / ATLAS_SIZE : WHITE_UV;
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  g.setAttribute('lamp', new Float32BufferAttribute(lamps, 3));
  g.setAttribute('finish', new Float32BufferAttribute(finishes, 2));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}
