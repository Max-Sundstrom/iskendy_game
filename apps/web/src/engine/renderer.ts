import {
  AgXToneMapping,
  MathUtils,
  PCFShadowMap,
  PerspectiveCamera,
  Quaternion,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { DEFAULT_TUNING, SimStatus } from '@kometa/sim';
import { lerp, type Session } from '../game/session';
import type { CrashFrame } from '../game/crash-sequence';
import { crashFlipTurns, createCrashView } from './crash';
import { createChaseCamera, fovForAspect } from './camera';
import { createCar } from './car';
import { createHorizon } from './horizon';
import { createIntro, FLIGHT_S, INTRO_S, type IntroPose } from './intro';
import { createRoad } from './road';
import { createWorld } from './scene';
import { createThrusters } from './thrusters';
import { createTrafficView } from './traffic';
import { createVapour } from './vapour';
import { setTrickPose } from './renderer-pose';

// Renderer: reads sim snapshots, interpolates between the last two steps, never touches sim state. Before tick 0 it
// plays the launch intro (presentation only).

export type GameRenderer = {
  render(session: Session, alpha: number, frameS: number): void;
  /** Intro frame at intro time t (0 … INTRO_S); the session is still at tick 0. */
  renderIntro(session: Session, t: number, frameS: number): void;
  beginCrash(session: Session): void;
  renderCrash(frame: CrashFrame): void;
  /** Call when a new session starts (retry), so effects don't carry over. */
  reset(session: Session): void;
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

/** Height of the surface under the car: a ridden platform's top, else the road. */
function groundUnder(s: Session): number {
  const p = s.state.player;
  if (p.rideSlot >= 0) return s.tuning.vehicles[s.state.traffic.type[p.rideSlot] ?? 0]?.heightM ?? 0;
  return 0;
}

export function createGameRenderer(
  canvas: HTMLCanvasElement,
  session: Session,
  quality: Quality = 'high',
  reducedMotion: () => boolean = () => false,
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
  const crash = createCrashView(rig, chase.camera, thrusters, vapour, DEFAULT_TUNING.presentation.crash);
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
  const pose: IntroPose = { position: new Vector3(), quaternion: new Quaternion(), speed: 0, phase: 'approach' };
  const look = new Vector3();
  const side = new Vector3();
  let lastX = 0;
  let lastZ = 0;
  let lastY = 0;
  let spin = 0;
  let launched = false;
  let firstIntroFrame = true;

  /** Pixels per metre at 1 m from the camera, for the vapour's point sizes. */
  const pointScale = (fovDeg: number) => {
    renderer.getDrawingBufferSize(buffer);
    return buffer.y / (2 * Math.tan(MathUtils.degToRad(fovDeg) / 2));
  };
  /** Moves the car (the whole rig, wheels included) and its contact shadow on the surface at groundY. */
  const placeCar = (x: number, y: number, threeZ: number, speed: number, dt: number, groundY = 0, shadow = true) => {
    rig.group.position.set(x, y, threeZ);
    const h = Math.max(0, y - groundY);
    rig.shadow.position.set(x, groundY + 0.03, threeZ);
    rig.shadow.scale.setScalar(1 + h * 0.08);
    (rig.shadow.material as { opacity: number }).opacity = shadow ? Math.max(0.15, 1 - h * 0.09) : 0;
    sun.position.set(x - 33, y + 12, threeZ + 48);
    spin += (speed * dt) / WHEEL_R;
    for (const w of rig.wheels) {
      const g = w.userData['spin'] as { rotation: { x: number } } | undefined;
      if (g) g.rotation.x = spin;
    }
  };

  const renderRun = (s: Session, alpha: number, frameS: number) => {
    const p = s.state.player;
    const crashed = s.state.status === SimStatus.crashed;
    const x = lerp(s.prev.x, p.x, alpha);
    const y = lerp(s.prev.y, p.y, alpha);
    const z = lerp(s.prev.z, p.z, alpha);
    if (Math.abs(-z - lastZ) > 100) {
      vapour.shift(-z - lastZ); // floating-origin shift: carry the vapour with the world
      lastZ = -z;
    }
    const dt = Math.max(frameS, 1e-3);
    // The terminal pose is placed at dt=0. Its lean comes from the actual final tick, not a fictitious 1 ms frame.
    const vx = crashed ? (p.x - s.prev.x) * tuning.tickRateHz : (x - lastX) / dt;
    const vy = crashed ? (p.y - s.prev.y) * tuning.tickRateHz : (y - lastY) / dt;
    // Session aligns snapshots on safe touchdown. Signed angles retain complete/queued turns during flight;
    // terminal crashes use the current tick exactly, including both axes of a failed landing.
    const f = crashed ? crashFlipTurns(s) : lerp(s.prev.flip, p.flipTurns, alpha);
    const r = crashed ? p.rollTurns : lerp(s.prev.roll, p.rollTurns, alpha);
    placeCar(x, y, -z, p.speedMps, crashed ? 0 : frameS, groundUnder(s));
    setTrickPose(rig.group, x, y, -z, f, r);
    // Lean outward and nose into the lane change; pitch with vertical speed in the air.
    const laneSpeed = tuning.lanes.widthM / Math.max(0.05, tuning.lanes.changeDurationS);
    const k = MathUtils.clamp(vx / laneSpeed, -1, 1);
    const pitch = p.airborne ? MathUtils.clamp(-p.vy * 0.012, -0.25, 0.2) : 0;
    rig.body.rotation.set(pitch, -k * 0.07, -k * LANE_ROLL);
    road.update(z, p.distanceM);
    traffic.update(s.state.traffic, s.prev.trafficZ, alpha);
    chase.update(x, y, z, p.speedMps, p.boosting, frameS, reducedMotion());
    thrusters.update({
      dt: frameS,
      vx,
      vy: p.airborne ? vy : 0,
      vz: -p.speedMps,
      boosting: p.boosting,
      flying: p.flying,
      airborne: p.airborne,
      lane: p.lane,
      crashed,
    });
    vapour.update(frameS, pointScale(chase.camera.fov));
    horizon.update(chase.camera.position.z);
    lastX = x;
    lastY = y;
    lastZ = -z;
    renderer.render(scene, chase.camera);
  };

  return {
    render: renderRun,
    info: renderer.info,
    resize,
    beginCrash(s) {
      renderRun(s, 1, 0);
      crash.begin();
    },
    renderCrash(frame) {
      if (frame.reducedMotion) chase.reduceMotion();
      crash.update(frame);
      vapour.update(frame.deltaS, pointScale(chase.camera.fov));
      renderer.render(scene, chase.camera);
    },
    reset(s) {
      crash.reset();
      launched = false;
      firstIntroFrame = true;
      spin = 0;
      lastX = s.state.player.x;
      lastY = s.state.player.y;
      lastZ = -s.state.player.z;
      rig.group.quaternion.identity();
      rig.body.rotation.set(0, 0, 0);
      placeCar(lastX, lastY, lastZ, 0, 0);
      chase.reset(lastX, lastY, -lastZ);
      thrusters.reset();
      vapour.reset();
    },
    renderIntro(s, t, frameS) {
      intro.pose(t, pose);
      const { position: c, quaternion } = pose;
      const vx = firstIntroFrame ? 0 : (c.x - lastX) / Math.max(frameS, 1e-3);
      const vy = firstIntroFrame ? 0 : (c.y - lastY) / Math.max(frameS, 1e-3);
      const vz = firstIntroFrame ? 0 : (c.z - lastZ) / Math.max(frameS, 1e-3);
      firstIntroFrame = false;
      placeCar(c.x, c.y, c.z, pose.speed, frameS, 0, pose.phase !== 'ramp');
      rig.group.quaternion.copy(quaternion);
      rig.body.rotation.set(0, 0, 0);
      road.update(Math.min(-c.z, 0), 0);
      traffic.update(s.state.traffic, s.prev.trafficZ, 1);
      chase.update(c.x, Math.max(0, c.y), -c.z, pose.speed, false, frameS, reducedMotion());
      // A wide side shot of the C and its tower that pans with the car (cf. the reference photos), easing into the
      // chase camera for the last 0.9 s of the flight.
      const fly = MathUtils.clamp((t - (INTRO_S - FLIGHT_S)) / FLIGHT_S, 0, 1);
      side.set(32 - 12 * fly, 11 - 4 * fly, MathUtils.lerp(70, c.z + 14, fly));
      look.set(0, 12, 72).lerp(c, 0.3 + 0.6 * fly);
      introCam.position.copy(side);
      introCam.lookAt(look);
      const blend = MathUtils.smoothstep(t, INTRO_S - 0.9, INTRO_S);
      introCam.position.lerp(chase.camera.position, blend);
      introCam.quaternion.slerp(chase.camera.quaternion, blend);
      introCam.fov = MathUtils.lerp(fovForAspect(46, aspect), chase.camera.fov, blend);
      introCam.updateProjectionMatrix();
      thrusters.update({
        dt: frameS,
        vx,
        vy,
        vz,
        boosting: pose.phase !== 'approach', // main thrusters push it up the C and off the lip
        flying: pose.phase === 'flight', // lift and attitude nozzles hold and turn it in the air
        airborne: pose.phase === 'flight',
        lane: s.state.player.lane,
        crashed: false,
      });
      if (t > INTRO_S - 0.15 && !launched) {
        launched = true;
        thrusters.launch();
      }
      vapour.update(frameS, pointScale(introCam.fov));
      horizon.update(introCam.position.z);
      lastX = c.x;
      lastY = c.y;
      lastZ = c.z;
      renderer.render(scene, introCam);
    },
  };
}
