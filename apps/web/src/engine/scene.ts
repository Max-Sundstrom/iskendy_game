import art from '@kometa/content/art.json';
import {
  BackSide,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type WebGLRenderer,
} from 'three';

// Embankment Gold lighting from the Design Agreement (ART_DIRECTION §4, §7; content/art.json).
const GRADE = art.grading.embankment_gold;

function skyDome(sunDir: Vector3): Mesh {
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new Color(GRADE.skyTop) },
      horizon: { value: new Color(GRADE.horizon) },
      sunColor: { value: new Color(GRADE.sun) },
      sunDir: { value: sunDir.clone().normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 sunColor; uniform vec3 sunDir; varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(h, 0.55));
        col += sunColor * pow(max(dot(normalize(vDir), sunDir), 0.0), 24.0) * 0.9;
        if (vDir.y < 0.0) col = horizon * 0.6;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return new Mesh(new SphereGeometry(900, 32, 16), material);
}

export type World = { scene: Scene; sun: DirectionalLight };

/** Sky, fog, low sun behind-left of the chase camera, hemisphere fill and a sky environment map. */
export function createWorld(renderer: WebGLRenderer): World {
  const scene = new Scene();
  // Three's camera looks down −Z; the sun sits behind (+Z) and to the left (−X) of it, low over the horizon.
  const sunDir = new Vector3(-0.55, 0.2, 0.8).normalize();
  const sky = skyDome(sunDir);
  scene.add(sky);
  scene.fog = new Fog(new Color(GRADE.horizon).lerp(new Color(GRADE.fog), GRADE.fogMix), 80, 520);
  scene.add(new HemisphereLight(new Color(GRADE.skyTop).lerp(new Color(GRADE.horizon), 0.4), GRADE.shadow, 0.5));
  const sun = new DirectionalLight(GRADE.sun, 3.8);
  sun.position.copy(sunDir).multiplyScalar(60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  for (const k of ['left', 'bottom'] as const) sun.shadow.camera[k] = -14;
  for (const k of ['right', 'top'] as const) sun.shadow.camera[k] = 14;
  sun.shadow.camera.far = 150;
  scene.add(sun, sun.target);

  const env = new Scene();
  env.add(skyDome(sunDir));
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.02, 0.1, 1000).texture; // far must exceed the dome radius
  scene.environmentIntensity = 1.2;
  pmrem.dispose();
  return { scene, sun };
}
