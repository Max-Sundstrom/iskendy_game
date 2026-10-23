import {
  AgXToneMapping,
  MathUtils,
  PCFShadowMap,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { DEFAULT_TUNING, SimStatus } from '@kometa/sim';
import { lerp, type Session } from '../game/session';
import { createChaseCamera, fovForAspect } from './camera';
import { createCar } from './car';
import { createHorizon } from './horizon';
import { createIntro, INTRO_S, type IntroPose } from './intro';
import { createRoad } from './road';
import { createWorld } from './scene';
import { createThrusters } from './thrusters';
import { createTrafficView } from './traffic';
import { createVapour } from './vapour';

// Renderer: reads sim snapshots, interpolates between the last two steps, never touches sim state. Before tick 0 it
// plays the launch intro (presentation only).

export type GameRenderer = {
  render(session: Session, alpha: number, frameS: number): void;
  /** Intro frame at intro time t (0 … INTRO_S); the session is still at tick 0. */
  renderIntro(session: Session, t: number, frameS: number): void;
  /** Call when a new session starts (retry), so effects don't carry over. */
  reset(): void;
  resize(): void;
  readonly info: WebGLRenderer['info'];
};

/**
 * Low = the lowest dynamic-resolution step from the tuning, no shadows, no MSAA: the floor of the quality tiers
 * (full tiers and dynamic resolution arrive in P3-06). E2E uses it because CI renders without a GPU.
 */
export type Quality = 'high' | 'low';

const LANE_ROLL = MathUtils.degToRad(DEFAULT_TUNING.presentation.car.laneBodyRollDeg);
const WHEEL_R = 0.34;

export function createGameRenderer(
  canvas: HTMLCanvasElement,
  session: Session,
  quality: Quality = 'high',
): GameRenderer {
  const low = quality === 'low';
  const renderer = new WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
  const steps = DEFAULT_TUNING.presentation.quality.pixelRatioSteps;
  renderer.setPixelRatio(low ? (steps[steps.length - 1] ?? 0.7) : Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = AgXToneMapping; // chosen in the Design Agreement (ADR-023)
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = PCFShadowMap; // PCFSoft was removed in three r186

  const tuning = session.tuning;
  const { scene, sun } = createWorld(renderer);
  const road = createRoad(tuning);
  const traffic = createTrafficView(tuning);
  const rig = createCar();
  const vapour = createVapour();
  const thrusters = createThrusters(rig, vapour);
  const horizon = createHorizon();
  const intro = createIntro(tuning.speed.minMps);
  scene.add(road.group, traffic.group, rig.group, rig.shadow, vapour.points, horizon.group, intro.group);
  sun.target = rig.group;
  const chase = createChaseCamera(tuning);
  const introCam = new PerspectiveCamera(50, 1, 0.1, 1200);
  let aspect = 1;

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    aspect = w / h;
    chase.resize(aspect);
    introCam.aspect = aspect;
  };
  resize();

  const buffer = new Vector2();
  const pose: IntroPose = { x: 0, y: 0, z: 0, pitch: 0, speed: 0 };
  const look = new Vector3();
  const side = new Vector3();
  let lastX = 0;
  let lastZ = 0;
  let lastY = 0;
  let spin = 0;
  let launched = false;

  /** Pixels per metre at 1 m from the camera, for the vapour's point sizes. */
  const pointScale = (fovDeg: number) => {
    renderer.getDrawingBufferSize(buffer);
    return buffer.y / (2 * Math.tan(MathUtils.degToRad(fovDeg) / 2));
  };
  const placeCar = (x: number, y: number, threeZ: number, speed: number, dt: number, groundY = 0) => {
    rig.group.position.set(x, y, threeZ);
    const h = Math.max(0, y - groundY);
    rig.shadow.position.set(x, groundY + 0.03, threeZ);
    rig.shadow.scale.setScalar(1 + h * 0.08);
    (rig.shadow.material as { opacity: number }).opacity = Math.max(0.15, 1 - h * 0.09);
    sun.position.set(x - 33, y + 12, threeZ + 48);
    spin += (speed * dt) / WHEEL_R;
    for (const w of rig.wheels) {
      const g = w.userData['spin'] as { rotation: { x: number } } | undefined;
      if (g) g.rotation.x = spin;
    }
  };

  return {
    info: renderer.info,
    resize,
    reset() {
      launched = false;
      thrusters.reset();
    },
    renderIntro(s, t, frameS) {
      intro.pose(t, pose);
      const simZ = -pose.z;
      placeCar(pose.x, pose.y, pose.z, pose.speed, frameS, pose.y);
      rig.body.rotation.set(pose.pitch, 0, 0);
      road.update(simZ, 0);
      traffic.update(s.state.traffic, s.prev.trafficZ, 1);
      chase.update(pose.x, pose.y, simZ, pose.speed, false, frameS);
      // Side shot that travels with the car down the gantry (cf. reference img 14), then eases into the chase camera
      // for the last 0.9 s.
      const car = rig.group.position;
      side.set(car.x + 17, car.y + 4.5, car.z - 1);
      look.set(car.x, car.y + 0.5, car.z - 2);
      introCam.position.copy(side);
      introCam.lookAt(look);
      const blend = MathUtils.smoothstep(t, INTRO_S - 0.9, INTRO_S);
      introCam.position.lerp(chase.camera.position, blend);
      introCam.quaternion.slerp(chase.camera.quaternion, blend);
      introCam.fov = MathUtils.lerp(fovForAspect(50, aspect), chase.camera.fov, blend);
      introCam.updateProjectionMatrix();
      thrusters.update({
        dt: frameS,
        vx: 0,
        vy: 0,
        vz: -pose.speed,
        boosting: false,
        flying: false,
        airborne: false,
        lane: s.state.player.lane,
        crashed: false,
      });
      if (t > INTRO_S - 0.15 && !launched) {
        launched = true;
        thrusters.launch();
      }
      vapour.update(frameS, pointScale(introCam.fov));
      horizon.update(introCam.position.z);
      lastX = pose.x;
      lastY = pose.y;
      lastZ = pose.z;
      renderer.render(scene, introCam);
    },
    render(s, alpha, frameS) {
      const p = s.state.player;
      const x = lerp(s.prev.x, p.x, alpha);
      const y = lerp(s.prev.y, p.y, alpha);
      const z = lerp(s.prev.z, p.z, alpha);
      if (Math.abs(-z - lastZ) > 100) {
        vapour.shift(-z - lastZ); // floating-origin shift: carry the vapour with the world
        lastZ = -z;
      }
      const dt = Math.max(frameS, 1e-3);
      const vx = (x - lastX) / dt;
      const vy = (y - lastY) / dt;
      placeCar(x, y, -z, p.speedMps, frameS);
      // Lean outward and nose into the lane change; pitch with vertical speed in the air.
      const laneSpeed = tuning.lanes.widthM / Math.max(0.05, tuning.lanes.changeDurationS);
      const k = MathUtils.clamp(vx / laneSpeed, -1, 1);
      const pitch = p.airborne ? MathUtils.clamp(-p.vy * 0.012, -0.25, 0.2) : 0;
      rig.body.rotation.set(pitch, -k * 0.07, -k * LANE_ROLL);
      road.update(z, p.distanceM);
      traffic.update(s.state.traffic, s.prev.trafficZ, alpha);
      chase.update(x, y, z, p.speedMps, p.boosting, frameS);
      thrusters.update({
        dt: frameS,
        vx,
        vy: p.airborne ? vy : 0,
        vz: -p.speedMps,
        boosting: p.boosting,
        flying: p.flying,
        airborne: p.airborne,
        lane: p.lane,
        crashed: s.state.status === SimStatus.crashed,
      });
      vapour.update(frameS, pointScale(chase.camera.fov));
      horizon.update(chase.camera.position.z);
      lastX = x;
      lastY = y;
      lastZ = -z;
      renderer.render(scene, chase.camera);
    },
  };
}
