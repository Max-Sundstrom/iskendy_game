import { BufferAttribute, BufferGeometry, Color, NormalBlending, Points, ShaderMaterial } from 'three';

// Cold-gas vapour (GDD §5.4, ART_DIRECTION §8): white plumes from the car's nozzles. One pooled Points object, one
// draw call; particles live in a ring buffer of preallocated arrays, so emitting never allocates (invariant 5).
// Presentation only: it reads sim snapshots and never feeds back into the sim, so Math.random is fine here.

const POOL = 1200;
const DRAG_PER_S = 2.6; // gas slows to the still air around it
const BUOYANCY = 1.2; // m/s², warm-ish vapour drifts up a little

export type Burst = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Random velocity added in each axis, m/s. */
  spread: number;
  lifeS: number;
  sizeM: number;
  growM: number;
  alpha: number;
  /**
   * Spreads the burst over the last `smearS` seconds of nozzle travel: each particle starts where it would be had it
   * left the nozzle at its share of the frame, moving at (vx, vy, vz) − carry. Keeps jets continuous at low frame rates.
   */
  smearS?: number;
  carryX?: number;
  carryY?: number;
  carryZ?: number;
};

export type Vapour = {
  points: Points;
  emit(b: Burst, count: number): void;
  update(dt: number, pixelsPerUnitAtOneMetre: number): void;
  /** Moves every particle along three z, for the sim's floating-origin shift. */
  shift(dz: number): void;
  reset(): void;
};

export function createVapour(): Vapour {
  const pos = new Float32Array(POOL * 3);
  const vel = new Float32Array(POOL * 3);
  const age = new Float32Array(POOL).fill(1);
  const life = new Float32Array(POOL).fill(1);
  const size0 = new Float32Array(POOL);
  const grow = new Float32Array(POOL);
  const alpha0 = new Float32Array(POOL);
  const size = new Float32Array(POOL);
  const alpha = new Float32Array(POOL);
  let next = 0;

  const geometry = new BufferGeometry();
  const posAttr = new BufferAttribute(pos, 3);
  const sizeAttr = new BufferAttribute(size, 1);
  const alphaAttr = new BufferAttribute(alpha, 1);
  geometry.setAttribute('position', posAttr);
  geometry.setAttribute('aSize', sizeAttr);
  geometry.setAttribute('aAlpha', alphaAttr);

  const uScale = { value: 400 };
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    uniforms: { uScale, uColor: { value: new Color('#f4f1ec') } },
    vertexShader: /* glsl */ `
      attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aAlpha > 0.0 ? aSize * uScale / max(0.1, -mv.z) : 0.0;
        vAlpha = aAlpha;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, r) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 2;

  return {
    points,
    reset() {
      next = 0;
      pos.fill(0);
      vel.fill(0);
      age.fill(1);
      life.fill(1);
      size.fill(0);
      alpha.fill(0);
      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
    },
    emit(b, count) {
      const smear = b.smearS ?? 0;
      for (let k = 0; k < count; k++) {
        const i = next;
        next = (next + 1) % POOL;
        const j = i * 3;
        const vx = b.vx + (Math.random() - 0.5) * 2 * b.spread;
        const vy = b.vy + (Math.random() - 0.5) * 2 * b.spread;
        const vz = b.vz + (Math.random() - 0.5) * 2 * b.spread;
        const pre = smear * ((k + Math.random()) / count);
        pos[j] = b.x + (vx - (b.carryX ?? 0)) * pre;
        pos[j + 1] = b.y + (vy - (b.carryY ?? 0)) * pre;
        pos[j + 2] = b.z + (vz - (b.carryZ ?? 0)) * pre;
        vel[j] = vx;
        vel[j + 1] = vy;
        vel[j + 2] = vz;
        age[i] = 0;
        life[i] = b.lifeS * (0.75 + Math.random() * 0.5);
        size0[i] = b.sizeM * (0.8 + Math.random() * 0.4);
        grow[i] = b.growM;
        alpha0[i] = b.alpha;
      }
    },
    update(dt, scale) {
      uScale.value = scale;
      const drag = Math.exp(-DRAG_PER_S * dt);
      for (let i = 0; i < POOL; i++) {
        const a = (age[i] ?? 1) + dt;
        age[i] = a;
        const l = life[i] ?? 1;
        if (a >= l) {
          alpha[i] = 0;
          continue;
        }
        const j = i * 3;
        let vx = (vel[j] ?? 0) * drag;
        let vy = (vel[j + 1] ?? 0) * drag + BUOYANCY * dt;
        const vz = (vel[j + 2] ?? 0) * drag;
        let y = (pos[j + 1] ?? 0) + vy * dt;
        if (y < 0.05) {
          // Gas hitting the road fans out sideways instead of going through it.
          y = 0.05;
          vx += (Math.random() - 0.5) * Math.abs(vy) * 1.5;
          vy = Math.abs(vy) * 0.15;
        }
        pos[j] = (pos[j] ?? 0) + vx * dt;
        pos[j + 1] = y;
        pos[j + 2] = (pos[j + 2] ?? 0) + vz * dt;
        vel[j] = vx;
        vel[j + 1] = vy;
        vel[j + 2] = vz;
        const t = a / l;
        size[i] = (size0[i] ?? 0) + (grow[i] ?? 0) * Math.sqrt(t);
        alpha[i] = (alpha0[i] ?? 0) * (1 - t) * (1 - t) * Math.min(1, a * 25);
      }
      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
    },
    shift(dz) {
      for (let i = 0; i < POOL; i++) pos[i * 3 + 2] = (pos[i * 3 + 2] ?? 0) + dz;
    },
  };
}
