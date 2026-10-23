import * as THREE from 'three';
import { buildCar, measure, type Concept, type Livery } from './car';
import type { Biome } from './palette';
import { createLabScene, createRenderer, createRoad } from './scene';

export type View = 'chase' | 'rear34' | 'livery' | 'side' | 'top' | 'front34';

export const VIEWS: Record<
  View,
  { label: string; pos: [number, number, number]; look: [number, number, number]; fov: number }
> = {
  // Gameplay chase cam from tuning (presentation.camera): 6.5 m behind, 2.8 m up, looking 12 m ahead.
  chase: { label: 'chase cam', pos: [0, 2.8, -6.5], look: [0, 1.0, 12], fov: 62 },
  rear34: { label: 'rear ¾', pos: [3.4, 1.5, -5.2], look: [0, 0.55, 0], fov: 40 },
  // Higher rear ¾ so livery paint-overs show the roof too.
  livery: { label: 'livery (high rear ¾)', pos: [3.6, 3.0, -5.0], look: [0, 0.5, 0], fov: 40 },
  side: { label: 'side', pos: [8.5, 0.9, 0], look: [0, 0.55, 0], fov: 32 },
  top: { label: 'top', pos: [0, 11, 0.001], look: [0, 0, 0], fov: 34 },
  front34: { label: 'front ¾', pos: [3.6, 1.3, 5.2], look: [0, 0.55, 0], fov: 40 },
};

export type StillOptions = {
  concept: Concept;
  livery: Livery;
  view: View;
  biome: Biome;
  width: number;
  height: number;
};

/** Renders one frame of a blockout and returns its measurements. */
export function renderStill(canvas: HTMLCanvasElement, o: StillOptions): ReturnType<typeof measure> {
  canvas.style.width = `${o.width}px`;
  canvas.style.height = `${o.height}px`;
  const renderer = createRenderer(canvas, o.width, o.height);
  const { scene } = createLabScene(renderer, o.biome);
  scene.add(createRoad(400));
  const car = buildCar(o.concept, o.livery);
  scene.add(car);
  const v = VIEWS[o.view];
  // Portrait frames need a wider vertical field of view to show the same road.
  const aspect = o.width / o.height;
  const fov = aspect < 1 ? v.fov * 1.25 : v.fov;
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1200);
  camera.position.set(...v.pos);
  camera.lookAt(new THREE.Vector3(...v.look));
  renderer.render(scene, camera);
  return measure(car);
}
