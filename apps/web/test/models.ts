import { DEFAULT_TUNING } from '@kometa/sim';
import {
  AgXToneMapping,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  WebGLRenderer,
  Color,
} from 'three';
import { createCar } from '../src/engine/car';
import { vehicleGeometry } from '../src/engine/models';
import { vehicleMaterial } from '../src/engine/models/parts';
import { createRoad } from '../src/engine/road';
import { createWorld } from '../src/engine/scene';

// ?model=hero|<traffic id>&view=rear|side|front|top gives an unobstructed inspection view.
// Without model, retain the complete fleet on the road for scale and palette review.
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
  const params = new URLSearchParams(location.search);
  const { scene, sun } = createWorld(renderer);
  if (params.get('studio') === '1') {
    // Long trucks need a side camera beyond the road barrier; a plain floor keeps that inspection unobstructed.
    const floor = new Mesh(new PlaneGeometry(300, 300), new MeshStandardMaterial({ color: '#3b404a', roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    scene.add(floor);
  } else {
    const road = createRoad(tuning);
    road.update(0, 0);
    scene.add(road.group);
  }
  const material = vehicleMaterial();
  const colors = ['#8E1F2C', '#E9E6DF', '#1F4B3A', '#6FA8D6', '#16171C', '#C9B48E'];
  const selected = params.get('model');
  const selectedType = tuning.vehicles.find((vehicle) => vehicle.id === selected);
  const focused = selected === 'hero' || selectedType !== undefined;
  let z = 8;
  tuning.vehicles.forEach((v, i) => {
    if (focused && selected !== v.id) return;
    const mesh = new InstancedMesh(vehicleGeometry(tuning, i), material, 1);
    const lane = i % 5;
    mesh.setMatrixAt(0, new Matrix4().makeTranslation(focused ? 0 : (lane - 2) * 3.6, 0, focused ? v.lengthM / 2 : -z));
    mesh.setColorAt(0, new Color(colors[i % colors.length]));
    mesh.castShadow = true;
    scene.add(mesh);
    if (lane === 4) z += 20;
  });
  const car = createCar();
  car.group.position.set(0, 0, 0);
  car.shadow.position.set(0, 0.03, 0);
  if (!focused || selected === 'hero') scene.add(car.group, car.shadow);
  sun.position.set(-33, 12, 48);
  const view = params.get('view') ?? 'rear';
  const cam = new PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 1500);
  if (focused) {
    const scale = Math.max(1, (selectedType?.lengthM ?? 4.4) / 4.4);
    const portrait = canvas.clientHeight > canvas.clientWidth ? 1.6 : 1;
    if (view === 'side') cam.position.set(7.2, 1.6, 0);
    else if (view === 'front') cam.position.set(-4.2, 2.6, -6.4);
    else if (view === 'top') cam.position.set(0, 8.5, 0.01);
    else cam.position.set(4.2, 2.7, 6.4);
    cam.position.multiplyScalar(scale * portrait);
    cam.lookAt(0, (selectedType?.heightM ?? 1.15) * 0.5, 0);
  } else {
    if (view === 'side') cam.position.set(14, 3.5, -22);
    else if (view === 'front') cam.position.set(4, 3, -70);
    else cam.position.set(3, 4.5, 9);
    cam.lookAt(0, 1, view === 'side' ? -24 : -26);
  }
  renderer.render(scene, cam);
  document.body.dataset['drawCalls'] = String(renderer.info.render.calls);
  document.body.dataset['triangles'] = String(renderer.info.render.triangles);
  document.body.dataset['ready'] = '1';
}
