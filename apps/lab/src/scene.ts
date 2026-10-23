import * as THREE from 'three';
import { GRADING, PALETTE, type Biome } from './palette';

/** Renderer tuned like the game will be: AgX tone mapping, sRGB output, soft shadows, capped pixel ratio. */
export function createRenderer(canvas: HTMLCanvasElement, width: number, height: number): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

/** Vertical gradient sky dome: top colour → horizon colour, with a warm glow toward the sun. */
function skyDome(biome: Biome, sunDir: THREE.Vector3): THREE.Mesh {
  const g = GRADING[biome];
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(g.skyTop) },
      horizon: { value: new THREE.Color(g.horizon) },
      sunColor: { value: new THREE.Color(g.sun) },
      sunDir: { value: sunDir.clone().normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 sunColor; uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(h, 0.55));
        float sun = pow(max(dot(normalize(vDir), sunDir), 0.0), 24.0);
        col += sunColor * sun * 0.9;
        if (vDir.y < 0.0) col = horizon * 0.6;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), material);
}

export type LabScene = {
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  sunDir: THREE.Vector3;
};

/**
 * Lighting per ART_DIRECTION §4/§7: one low sun + hemisphere fill tinted toward the biome's shadow colour,
 * gradient sky, distance fog toward the fog colour, and an environment map for glossy paint and wet asphalt.
 */
export function createLabScene(renderer: THREE.WebGLRenderer, biome: Biome): LabScene {
  const g = GRADING[biome];
  const scene = new THREE.Scene();
  // Sun low and behind-left of a chase camera that looks down +Z (camera left = +X).
  const sunDir = new THREE.Vector3(0.55, biome === 'spalny' ? 0.05 : 0.2, -0.8).normalize();
  const sky = skyDome(biome, sunDir);
  scene.add(sky);

  const fogColor = new THREE.Color(g.horizon).lerp(new THREE.Color(g.fog), g.fogMix);
  scene.fog = new THREE.Fog(fogColor, 40, 320);

  // Weak fill and a strong low sun keep the car's form readable against the warm haze (pillar 1).
  const hemi = new THREE.HemisphereLight(
    new THREE.Color(g.skyTop).lerp(new THREE.Color(g.horizon), 0.4),
    g.shadow,
    0.5,
  );
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(g.sun, biome === 'spalny' ? 0.6 : 3.8);
  sun.position.copy(sunDir).multiplyScalar(60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.camera.far = 150;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  // Environment from the sky alone, so paint and the wet road reflect the sunset gradient.
  const envScene = new THREE.Scene();
  envScene.add(skyDome(biome, sunDir));
  const pmrem = new THREE.PMREMGenerator(renderer);
  // far must exceed the dome radius (900 m) or the environment renders black.
  scene.environment = pmrem.fromScene(envScene, 0.02, 0.1, 1000).texture;
  scene.environmentIntensity = 1.2;
  pmrem.dispose();

  return { scene, sun, sunDir };
}

/** Five-lane wet road (3.6 m lanes) with dashed markings, over a dark verge. */
export function createRoad(lengthM: number, lanes = 5, laneWidthM = 3.6, verge: 'both' | 'left' = 'both'): THREE.Group {
  const group = new THREE.Group();
  const width = lanes * laneWidthM;

  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 2, lengthM),
    new THREE.MeshStandardMaterial({ color: PALETTE.wetAsphalt, roughness: 0.22, metalness: 0.0 }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.receiveShadow = true;
  group.add(asphalt);

  // 'left' leaves the right side (−X, camera right) free for water or a drop.
  const vergeWidth = verge === 'both' ? 400 : 200;
  const vergeMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(vergeWidth, lengthM),
    new THREE.MeshStandardMaterial({ color: '#23202b', roughness: 0.9 }),
  );
  vergeMesh.rotation.x = -Math.PI / 2;
  vergeMesh.position.set(verge === 'both' ? 0 : width / 2 + vergeWidth / 2 - 1, -0.02, 0);
  vergeMesh.receiveShadow = true;
  group.add(vergeMesh);

  const paint = new THREE.MeshStandardMaterial({ color: PALETTE.enamelCream, roughness: 0.5 });
  const dash = new THREE.PlaneGeometry(0.15, 3);
  const dashes = Math.floor(lengthM / 9);
  const marks = new THREE.InstancedMesh(dash, paint, dashes * (lanes - 1) + 2 * Math.ceil(lengthM / 3));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  let i = 0;
  for (let lane = 1; lane < lanes; lane++) {
    const x = -width / 2 + lane * laneWidthM;
    for (let d = 0; d < dashes; d++) {
      m.compose(new THREE.Vector3(x, 0.005, -lengthM / 2 + d * 9 + 1.5), q, new THREE.Vector3(1, 1, 1));
      marks.setMatrixAt(i++, m);
    }
  }
  // Solid edge lines, built from touching segments so one instanced mesh draws everything.
  for (const x of [-width / 2 + 0.2, width / 2 - 0.2]) {
    for (let d = 0; d < Math.ceil(lengthM / 3); d++) {
      m.compose(new THREE.Vector3(x, 0.005, -lengthM / 2 + d * 3 + 1.5), q, new THREE.Vector3(1, 1, 1));
      marks.setMatrixAt(i++, m);
    }
  }
  marks.count = i;
  marks.receiveShadow = true;
  group.add(marks);
  return group;
}
