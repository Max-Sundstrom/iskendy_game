import { DEFAULT_TUNING } from '@kometa/sim';
import type { SimTuning } from '@kometa/shared';
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

// Chase camera (GDD §13, tuning presentation.camera): behind and above, looking ahead; FOV widens with speed.

const CAM = DEFAULT_TUNING.presentation.camera;

export type ChaseCamera = {
  camera: PerspectiveCamera;
  update(x: number, y: number, z: number, speed: number, boosting: boolean, dt: number, reducedMotion?: boolean): void;
  reset(x: number, y: number, z: number): void;
  reduceMotion(): void;
  resize(aspect: number): void;
};

/**
 * Vertical FOV for the aspect: tuning values are for landscape; on portrait screens the horizontal field is kept at
 * what a 4:3 screen would see, so the road keeps its width instead of the car filling the screen.
 */
export function fovForAspect(fovDeg: number, aspect: number): number {
  if (aspect >= 1) return fovDeg;
  const ref = 4 / 3;
  const half = MathUtils.degToRad(fovDeg) / 2;
  const hHalf = Math.atan(Math.tan(half) * ref);
  return Math.min(100, MathUtils.radToDeg(2 * Math.atan(Math.tan(hHalf) / aspect)));
}

export function createChaseCamera(tuning: SimTuning): ChaseCamera {
  const camera = new PerspectiveCamera(CAM.fovMinDeg, 1, 0.1, 1200);
  const look = new Vector3();
  let aspect = 1;
  let followX = 0;
  let fov = CAM.fovMinDeg;
  let airLift = 0;
  const place = (y: number, z: number) => {
    camera.fov = fovForAspect(fov, aspect);
    camera.position.set(
      followX,
      CAM.heightM + y * 0.6 + CAM.airRaiseM * airLift,
      -z + CAM.distanceM + CAM.airPullbackM * airLift,
    );
    look.set(followX, 1.0 + y * 0.5, -z - CAM.lookAheadM);
    camera.lookAt(look);
    camera.updateProjectionMatrix();
  };
  return {
    camera,
    resize(a) {
      aspect = a;
      camera.aspect = a;
      camera.fov = fovForAspect(fov, aspect);
      camera.updateProjectionMatrix();
    },
    reduceMotion() {
      fov = CAM.fovMinDeg;
      camera.fov = fovForAspect(fov, aspect);
      camera.updateProjectionMatrix();
    },
    reset(x, y, z) {
      followX = x * 0.85;
      fov = CAM.fovMinDeg;
      airLift = 0;
      place(y, z);
    },
    update(x, y, z, speed, boosting, dt, reducedMotion = false) {
      const k = 1 - Math.exp(-dt * 8); // presentation-only smoothing
      followX += (x * 0.85 - followX) * k;
      const t = MathUtils.clamp((speed - tuning.speed.minMps) / (tuning.speed.maxMps - tuning.speed.minMps), 0, 1);
      const target = CAM.fovMinDeg + (CAM.fovMaxDeg - CAM.fovMinDeg) * t + (boosting ? CAM.boostFovKickDeg : 0);
      fov = reducedMotion ? CAM.fovMinDeg : fov + (target - fov) * k;
      airLift += ((y > 0.5 ? 1 : 0) - airLift) * k;
      place(y, z);
    },
  };
}
