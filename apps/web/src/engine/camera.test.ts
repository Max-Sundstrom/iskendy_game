import { DEFAULT_TUNING } from '@kometa/sim';
import { describe, expect, it } from 'vitest';
import { createChaseCamera, fovForAspect } from './camera';

describe('chase camera crash/retry and reduced motion', () => {
  it('removes a boost FOV after freezing without moving or smoothing the terminal camera', () => {
    const chase = createChaseCamera(DEFAULT_TUNING.sim);
    chase.resize(1440 / 900);
    chase.update(6, 3, 100, DEFAULT_TUNING.sim.speed.maxMps, true, 1);
    const position = chase.camera.position.toArray();
    const rotation = chase.camera.quaternion.toArray();
    expect(chase.camera.fov).toBeGreaterThan(DEFAULT_TUNING.presentation.camera.fovMinDeg);
    chase.reduceMotion();
    expect(chase.camera.fov).toBe(DEFAULT_TUNING.presentation.camera.fovMinDeg);
    expect(chase.camera.position.toArray()).toEqual(position);
    expect(chase.camera.quaternion.toArray()).toEqual(rotation);
    chase.resize(390 / 844);
    expect(chase.camera.fov).toBe(fovForAspect(DEFAULT_TUNING.presentation.camera.fovMinDeg, 390 / 844));
    expect(chase.camera.position.toArray()).toEqual(position);
    expect(chase.camera.quaternion.toArray()).toEqual(rotation);
  });

  it('adapts a frozen boosted FOV to a new aspect and back without running a frame', () => {
    const chase = createChaseCamera(DEFAULT_TUNING.sim);
    chase.resize(1440 / 900);
    chase.update(2, 3, 100, DEFAULT_TUNING.sim.speed.maxMps, true, 1);
    const boostedFov = chase.camera.fov;
    const position = chase.camera.position.toArray();
    const rotation = chase.camera.quaternion.toArray();
    chase.resize(390 / 844);
    expect(chase.camera.fov).toBe(fovForAspect(boostedFov, 390 / 844));
    chase.resize(1440 / 900);
    expect(chase.camera.fov).toBe(boostedFov);
    expect(chase.camera.position.toArray()).toEqual(position);
    expect(chase.camera.quaternion.toArray()).toEqual(rotation);
  });

  it.each([1440 / 900, 390 / 844])('resets position, rotation, FOV and smoothing at aspect %s', (aspect) => {
    const tuning = DEFAULT_TUNING.sim;
    const reused = createChaseCamera(tuning);
    const fresh = createChaseCamera(tuning);
    reused.resize(aspect);
    fresh.resize(aspect);
    reused.reset(0, 0, 0);
    for (let i = 0; i < 10; i++) reused.update(6, 5, 100 + i, tuning.speed.maxMps, true, 0.1);

    reused.reset(-3, 0, 12);
    fresh.reset(-3, 0, 12);
    const expectSamePose = () => {
      expect(reused.camera.position.toArray()).toEqual(fresh.camera.position.toArray());
      expect(reused.camera.quaternion.toArray()).toEqual(fresh.camera.quaternion.toArray());
      expect(reused.camera.fov).toBe(fresh.camera.fov);
      expect(reused.camera.projectionMatrix.toArray()).toEqual(fresh.camera.projectionMatrix.toArray());
    };
    expectSamePose();
    // Equality after the next update also proves the hidden smoothing accumulators were reset.
    reused.update(-2, 0, 13, tuning.speed.minMps, false, 1 / 60);
    fresh.update(-2, 0, 13, tuning.speed.minMps, false, 1 / 60);
    expectSamePose();
  });

  it.each([1440 / 900, 390 / 844])(
    'keeps the adapted minimum FOV during reduced-motion boost at aspect %s',
    (aspect) => {
      const tuning = DEFAULT_TUNING.sim;
      const camera = createChaseCamera(tuning);
      camera.resize(aspect);
      camera.reset(0, 0, 0);
      camera.update(0, 0, 10, tuning.speed.maxMps, true, 1);
      const minimumFov = fovForAspect(DEFAULT_TUNING.presentation.camera.fovMinDeg, aspect);
      if (aspect >= 1) expect(camera.camera.fov).toBeGreaterThan(minimumFov);

      // A newly enabled preference removes an existing kick immediately, including a zero-time frame.
      camera.update(0, 0, 10, tuning.speed.maxMps, true, 0, true);
      expect(camera.camera.fov).toBe(minimumFov);
      for (let i = 0; i < 5; i++) {
        camera.update(i, 2, 20 + i, tuning.speed.maxMps, true, 0.1, true);
        expect(camera.camera.fov).toBe(minimumFov);
      }
    },
  );
});
