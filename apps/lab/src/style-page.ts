import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import * as THREE from 'three';
import { buildCar } from './car';
import { PALETTE, TRAFFIC, type Biome } from './palette';
import { createLabScene, createRenderer, createRoad } from './scene';

// D0-3 style-test chunk (ROADMAP D0-3, ART_DIRECTION §4–§7): 200 m of Embankment Gold with wet road, bloom, fog,
// 30 traffic cars and the chosen car, plus a frame-time readout. style.html?dpr=1.5&post=0&capture=1

const params = new URLSearchParams(location.search);
// Hash tokens work where a host strips query strings: #night, #dusk, #nopost, #dpr1.
const tokens = new Set(location.hash.slice(1).split(/[,&]/));
const capture = params.has('capture');
const usePost = params.get('post') !== '0' && !tokens.has('nopost');
const dprCap = tokens.has('dpr1') ? 1 : Number(params.get('dpr') ?? 2);
const biomeParam = params.get('biome') ?? (tokens.has('night') ? 'spalny' : tokens.has('dusk') ? 'ringroad' : '');
const biome: Biome = biomeParam === 'spalny' ? 'spalny' : biomeParam === 'ringroad' ? 'ringroad' : 'embankment';

const CHUNK_M = 200;
const LANE_M = 3.6;
const ROAD_HALF = (5 * LANE_M) / 2;
const SPEED_MPS = 42;

const canvas = document.querySelector<HTMLCanvasElement>('#view');
const stats = document.querySelector<HTMLElement>('#stats');
if (!canvas || !stats) throw new Error('style.html is missing #view or #stats');

const width = capture ? 1280 : window.innerWidth;
const height = capture ? 800 : window.innerHeight;
const renderer = createRenderer(canvas, width, height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
if (usePost) renderer.toneMapping = THREE.NoToneMapping; // the composer applies AgX after bloom
const { scene, sun } = createLabScene(renderer, biome);
// Golden-hour haze, but keep the first 80 m crisp (pillar 1: the gameplay layer reads first).
if (scene.fog instanceof THREE.Fog) {
  scene.fog.near = 80;
  scene.fog.far = 520;
}
// The composer renders several passes per frame; count the scene pass ourselves.
renderer.info.autoReset = false;

const camera = new THREE.PerspectiveCamera(width < height ? 72 : 62, width / height, 0.1, 1200);
camera.position.set(0, 2.8, -6.5);
camera.lookAt(0, 1.0, 12);

// Everything that scrolls lives in `world`; two chunks leapfrog so the road never ends (floating-origin style).
const world = new THREE.Group();
scene.add(world);

const glowTexture = (() => {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 128);
  }
  return new THREE.CanvasTexture(c);
})();

function buildChunk(): THREE.Group {
  const chunk = new THREE.Group();
  const road = createRoad(CHUNK_M, 5, LANE_M, 'left');
  road.position.z = CHUNK_M / 2;
  chunk.add(road);

  // River on the right (camera right = -X) with the far bank hazed by fog.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(260, CHUNK_M),
    new THREE.MeshStandardMaterial({ color: PALETTE.lagoonTeal, roughness: 0.08, metalness: 0.1 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-ROAD_HALF - 1.4 - 130, -0.6, CHUNK_M / 2);
  chunk.add(water);
  const parapet = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.9, CHUNK_M),
    new THREE.MeshStandardMaterial({ color: '#8f8577', roughness: 0.8 }),
  );
  parapet.position.set(-ROAD_HALF - 1.2, 0.45, CHUNK_M / 2);
  chunk.add(parapet);

  // Lamps every 25 m on both sides: instanced posts and heads, plus a light-streak decal on the wet road
  // under each head — the fake anamorphic reflection of ART_DIRECTION §7 (no SSR, no planar reflections).
  const count = CHUNK_M / 25;
  const posts = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.08, 0.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: '#2a2b33' }),
    count * 2,
  );
  const heads = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.9, 0.18, 0.35),
    new THREE.MeshStandardMaterial({ color: '#ffcf9a', emissive: '#ffb066', emissiveIntensity: 3 }),
    count * 2,
  );
  const streaks = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.9, 14),
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      color: '#ff9b4a',
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    count * 2,
  );
  const m = new THREE.Matrix4();
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const one = new THREE.Vector3(1, 1, 1);
  let i = 0;
  for (let k = 0; k < count; k++) {
    for (const side of [-1, 1]) {
      const x = side * (ROAD_HALF + 0.6);
      const z = k * 25 + 6;
      posts.setMatrixAt(i, m.compose(new THREE.Vector3(x, 4, z), new THREE.Quaternion(), one));
      heads.setMatrixAt(i, m.compose(new THREE.Vector3(x - side * 0.7, 8, z), new THREE.Quaternion(), one));
      streaks.setMatrixAt(i, m.compose(new THREE.Vector3(x - side * 1.6, 0.012, z + 5), flat, one));
      i++;
    }
  }
  chunk.add(posts, heads, streaks);

  // Lindens on the city side (left = +X).
  const trees = 24;
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.15, 0.2, 2.4, 5),
    new THREE.MeshStandardMaterial({ color: '#3b2a22' }),
    trees,
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1.8, 0),
    new THREE.MeshStandardMaterial({ color: '#4f6b3a', roughness: 0.9, flatShading: true }),
    trees,
  );
  for (let t = 0; t < trees; t++) {
    const x = ROAD_HALF + 4 + (t % 2) * 3;
    const z = t * (CHUNK_M / trees) + 3;
    trunks.setMatrixAt(t, m.compose(new THREE.Vector3(x, 1.2, z), new THREE.Quaternion(), one));
    crowns.setMatrixAt(
      t,
      m.compose(new THREE.Vector3(x, 3.4, z), new THREE.Quaternion(), new THREE.Vector3(1, 1.15, 1)),
    );
  }
  trunks.castShadow = crowns.castShadow = true;
  chunk.add(trunks, crowns);
  return chunk;
}

const chunks = [buildChunk(), buildChunk()];
chunks.forEach((c, k) => {
  c.position.z = k * CHUNK_M - 20;
  world.add(c);
});

// Backdrop that doesn't scroll: far bank "wedding-cake" tower archetype, arch bridge, Cosmos Park rocket.
const haze = new THREE.MeshStandardMaterial({ color: PALETTE.hazeLilac, roughness: 1 });
const tower = new THREE.Group();
[
  [22, 40],
  [16, 30],
  [11, 24],
  [7, 18],
  [4, 14],
].reduce((y, [w = 0, h = 0]) => {
  const tier = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), haze);
  tier.position.y = y + h / 2;
  tower.add(tier);
  return y + h;
}, 0);
const spire = new THREE.Mesh(new THREE.ConeGeometry(1.2, 22, 6), haze);
spire.position.y = 137;
tower.add(spire);
tower.scale.set(1.3, 0.7, 1.3);
tower.position.set(-210, -0.6, 330);
scene.add(tower);
const bridge = new THREE.Mesh(
  new THREE.TorusGeometry(70, 1.6, 6, 40, Math.PI),
  new THREE.MeshStandardMaterial({ color: '#7b6f86', roughness: 0.6 }),
);
bridge.position.set(-120, -0.6, 420);
bridge.rotation.y = Math.PI / 2;
scene.add(bridge);
const rocket = new THREE.Group();
const white = new THREE.MeshStandardMaterial({ color: PALETTE.enamelCream, roughness: 0.4 });
const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 26, 12), white);
body.position.y = 21;
const nose = new THREE.Mesh(new THREE.ConeGeometry(1.6, 6, 12), white);
nose.position.y = 37;
const pedestal = new THREE.Mesh(
  new THREE.BoxGeometry(8, 8, 8),
  new THREE.MeshStandardMaterial({ color: PALETTE.brickRed, roughness: 0.8 }),
);
pedestal.position.y = 4;
rocket.add(body, nose, pedestal);
rocket.position.set(60, 0, 260);
scene.add(rocket);

// 30 traffic cars from the city sub-palette, slower than the player, scrolling with the world.
type Traffic = { lane: number; z: number; speed: number };
const traffic: Traffic[] = [];
const trafficBodies = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1.8, 0.75, 4.3),
  new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1 }),
  30,
);
const trafficCabins = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1.5, 0.55, 2.0),
  new THREE.MeshStandardMaterial({ color: '#15161c', roughness: 0.1 }),
  30,
);
const trafficLamps = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1.5, 0.12, 0.05),
  new THREE.MeshStandardMaterial({ color: '#7a0008', emissive: '#ff1010', emissiveIntensity: 1.2 }),
  30,
);
trafficBodies.castShadow = trafficCabins.castShadow = true;
const colors = Object.values(TRAFFIC);
for (let k = 0; k < 30; k++) {
  traffic.push({ lane: (k * 3) % 5, z: 18 + k * 13 + (k % 3) * 4, speed: 18 + (k % 4) * 3 });
  trafficBodies.setColorAt(k, new THREE.Color(colors[k % colors.length] ?? '#888888'));
}
scene.add(trafficBodies, trafficCabins, trafficLamps);

const hero = buildCar('B', 'courier');
scene.add(hero);
sun.target = hero;

let composer: EffectComposer | undefined;
if (usePost) {
  composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  const grain = new NoiseEffect({ premultiply: true });
  grain.blendMode.opacity.value = 0.12; // subtle film grain, ART_DIRECTION §7
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new EffectPass(
      camera,
      new BloomEffect({ mipmapBlur: true, intensity: 1.1, luminanceThreshold: 0.75, luminanceSmoothing: 0.2 }),
      new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
      new VignetteEffect({ darkness: 0.45, offset: 0.3 }),
      grain,
    ),
  );
}

const frameTimes: number[] = [];
const matrix = new THREE.Matrix4();
const one = new THREE.Vector3(1, 1, 1);
const noRot = new THREE.Quaternion();
let frames = 0;
let last = performance.now();
let scroll = 0;

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
}

function frame(now: number) {
  renderer.info.reset();
  const dt = capture ? 1 / 60 : Math.min((now - last) / 1000, 0.1);
  frameTimes.push(now - last);
  if (frameTimes.length > 300) frameTimes.shift();
  last = now;
  frames++;

  scroll += SPEED_MPS * dt;
  for (const c of chunks) {
    c.position.z -= SPEED_MPS * dt;
    if (c.position.z < -CHUNK_M - 20) c.position.z += 2 * CHUNK_M;
  }
  traffic.forEach((t, k) => {
    t.z -= (SPEED_MPS - t.speed) * dt;
    if (t.z < -20) t.z += 400;
    const x = ROAD_HALF - LANE_M / 2 - t.lane * LANE_M;
    trafficBodies.setMatrixAt(k, matrix.compose(new THREE.Vector3(x, 0.62, t.z), noRot, one));
    trafficCabins.setMatrixAt(k, matrix.compose(new THREE.Vector3(x, 1.25, t.z - 0.3), noRot, one));
    trafficLamps.setMatrixAt(k, matrix.compose(new THREE.Vector3(x, 0.75, t.z - 2.18), noRot, one));
  });
  trafficBodies.instanceMatrix.needsUpdate =
    trafficCabins.instanceMatrix.needsUpdate =
    trafficLamps.instanceMatrix.needsUpdate =
      true;
  hero.position.x = Math.sin(scroll / 60) * LANE_M; // gentle lane weave so reflections move

  if (composer) composer.render(dt);
  else renderer.render(scene, camera);

  if (frames % 15 === 0 && stats) {
    const sorted = [...frameTimes].sort((a, b) => a - b);
    const info = renderer.info.render;
    stats.textContent = `p50 ${percentile(sorted, 0.5).toFixed(1)} ms · p95 ${percentile(sorted, 0.95).toFixed(1)} ms · ${info.calls} draws · ${(info.triangles / 1000).toFixed(0)}k tris · dpr ${renderer.getPixelRatio()} · post ${usePost ? 'on' : 'off'}`;
  }
  if (capture && frames === 90) {
    document.body.dataset['ready'] = 'true';
    return;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
