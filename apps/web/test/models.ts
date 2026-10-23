import { DEFAULT_TUNING } from '@kometa/sim';
import { AgXToneMapping, InstancedMesh, Matrix4, PerspectiveCamera, SRGBColorSpace, WebGLRenderer, Color } from 'three';
import { createCar } from '../src/engine/car';
import { vehicleGeometry } from '../src/engine/models';
import { vehicleMaterial } from '../src/engine/models/parts';
import { createRoad } from '../src/engine/road';
import { createWorld } from '../src/engine/scene';

// ?view=rear|side|front — the hero car and all traffic types parked across the lanes, for screenshots.
const canvas = document.querySelector<HTMLCanvasElement>('#c');
if (canvas) {
  const tuning = DEFAULT_TUNING.sim;
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  const { scene, sun } = createWorld(renderer);
  const road = createRoad(tuning);
  road.update(0, 0);
  scene.add(road.group);
  const material = vehicleMaterial();
  const colors = ['#8E1F2C', '#E9E6DF', '#1F4B3A', '#6FA8D6', '#16171C', '#C9B48E'];
  let z = 8;
  tuning.vehicles.forEach((v, i) => {
    const mesh = new InstancedMesh(vehicleGeometry(tuning, i), material, 1);
    const lane = i % 5;
    mesh.setMatrixAt(0, new Matrix4().makeTranslation((lane - 2) * 3.6, 0, -z));
    mesh.setColorAt(0, new Color(colors[i % colors.length]));
    mesh.castShadow = true;
    scene.add(mesh);
    if (lane === 4) z += 20;
  });
  const car = createCar();
  car.group.position.set(0, 0, 0);
  car.shadow.position.set(0, 0.03, 0);
  scene.add(car.group, car.shadow);
  sun.position.set(-33, 12, 48);
  const view = new URLSearchParams(location.search).get('view') ?? 'rear';
  const cam = new PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 1500);
  if (view === 'side') cam.position.set(14, 3.5, -22);
  else if (view === 'front') cam.position.set(4, 3, -70);
  else cam.position.set(3, 4.5, 9);
  cam.lookAt(0, 1, view === 'side' ? -24 : -26);
  renderer.render(scene, cam);
  document.body.dataset['ready'] = '1';
}
