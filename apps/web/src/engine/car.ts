import art from '@kometa/content/art.json';
import type { SimTuning } from '@kometa/shared';
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';

// Grey-box hero for P1: boxes at the agreed proportions (ASSETS §5) in the v1 Iskendi Courier livery. The final
// Blender model replaces it in P3-01. The front faces three −z (sim +z).

export function createCar(tuning: SimTuning): Group {
  const { lengthM: L, widthM: W, heightM: H } = tuning.player;
  const car = new Group();
  car.name = 'KometaR';
  const paint = new MeshPhysicalMaterial({
    color: art.palette.iskendiOrange,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const body = new Mesh(new BoxGeometry(W, H * 0.55, L), paint);
  body.position.y = 0.2 + (H * 0.55) / 2;
  const cabin = new Mesh(
    new BoxGeometry(W * 0.72, H * 0.38, L * 0.42),
    new MeshPhysicalMaterial({ color: '#141824', roughness: 0.05, clearcoat: 1 }),
  );
  cabin.position.set(0, 0.2 + H * 0.55 + (H * 0.38) / 2, 0.15);
  // Rear signature: four round lamps behind a smoked strip (ART_DIRECTION §8), at the +z end.
  const strip = new Mesh(
    new BoxGeometry(W * 0.94, 0.16, 0.02),
    new MeshStandardMaterial({ color: '#0b0b0f', roughness: 0.15 }),
  );
  strip.position.set(0, 0.62, L / 2 + 0.011);
  const lampMat = new MeshStandardMaterial({ color: '#7a0008', emissive: '#ff1010', emissiveIntensity: 0.75 });
  const lamps = [-0.72, -0.33, 0.33, 0.72].map((x) => {
    const lamp = new Mesh(new CylinderGeometry(0.058, 0.058, 0.02, 16), lampMat);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(x, 0.62, L / 2 + 0.025);
    return lamp;
  });
  const tyre = new MeshStandardMaterial({ color: '#141416', roughness: 0.85 });
  const wheels = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => {
      const w = new Mesh(new CylinderGeometry(0.34, 0.34, 0.27, 20), tyre);
      w.rotation.z = Math.PI / 2;
      w.position.set((sx * 1.68) / 2, 0.34, (sz * 2.65) / 2);
      return w;
    }),
  );
  car.add(body, cabin, strip, ...lamps, ...wheels);
  car.traverse((o) => {
    if (o instanceof Mesh) o.castShadow = true;
  });
  return car;
}
