import { AgXToneMapping, PCFShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
import { DEFAULT_TUNING } from '@kometa/sim';
import { lerp, type Session } from '../game/session';
import { createChaseCamera } from './camera';
import { createCar } from './car';
import { createRoad } from './road';
import { createWorld } from './scene';
import { createTrafficView } from './traffic';

// Grey-box renderer (P1-04): reads sim snapshots, interpolates between the last two steps, never touches sim state.

export type GameRenderer = {
  render(session: Session, alpha: number, frameS: number): void;
  resize(): void;
  readonly info: WebGLRenderer['info'];
};

/**
 * Low = the lowest dynamic-resolution step from the tuning, no shadows, no MSAA: the floor of the quality tiers
 * (full tiers and dynamic resolution arrive in P3-06). E2E uses it because CI renders without a GPU.
 */
export type Quality = 'high' | 'low';

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
  const car = createCar(tuning);
  scene.add(road.group, traffic.mesh, car);
  sun.target = car;
  const chase = createChaseCamera(tuning);

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    chase.resize(w / h);
  };
  resize();

  return {
    info: renderer.info,
    resize,
    render(s, alpha, frameS) {
      const p = s.state.player;
      const x = lerp(s.prev.x, p.x, alpha);
      const y = lerp(s.prev.y, p.y, alpha);
      const z = lerp(s.prev.z, p.z, alpha);
      car.position.set(x, y, -z);
      sun.position.set(x - 33, 12, -z + 48);
      road.update(z);
      traffic.update(s.state.traffic, s.prev.trafficZ, alpha);
      chase.update(x, y, z, p.speedMps, p.boosting, frameS);
      renderer.render(scene, chase.camera);
    },
  };
}
