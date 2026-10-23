import { Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { setTrickPose } from './renderer-pose';

const closeVector = (actual: Vector3, expected: number[]) => {
  actual.toArray().forEach((n, i) => expect(n).toBeCloseTo(expected[i] ?? NaN, 10));
};

describe('signed trick pose', () => {
  it.each([-1, 1])('rolls the roof toward lane direction %i', (direction) => {
    const car = new Group();
    setTrickPose(car, 0, 0, 0, 0, direction / 4);
    closeVector(new Vector3(0, 1, 0).applyQuaternion(car.quaternion), [direction, 0, 0]);
    closeVector(new Vector3(0, 0, -1).applyQuaternion(car.quaternion), [0, 0, -1]);
  });

  it('composes pitch after local roll: quarter turns keep roof right and nose down', () => {
    const car = new Group();
    setTrickPose(car, 0, 0, 0, 0.25, 0.25);
    closeVector(new Vector3(0, 1, 0).applyQuaternion(car.quaternion), [1, 0, 0]);
    closeVector(new Vector3(0, 0, -1).applyQuaternion(car.quaternion), [0, -1, 0]);
    closeVector(new Vector3(1, 0, 0).applyQuaternion(car.quaternion), [0, 0, 1]);
  });

  it.each([
    [0, 0],
    [0.25, 0],
    [0, -0.25],
    [0.37, -0.21],
    [2.8, -3.6],
  ])('keeps world COM fixed for pitch %f / roll %f without losing x compensation', (pitch, roll) => {
    const car = new Group();
    setTrickPose(car, 7, 4, -95, pitch, roll);
    closeVector(car.localToWorld(new Vector3(0, 0.55, 0)), [7, 4.55, -95]);
  });

  it('returns upright after whole signed turns and on a fresh run', () => {
    const car = new Group();
    for (const roll of [-2, -1, 1, 2, 0]) {
      setTrickPose(car, 1, 2, 3, 1, roll);
      closeVector(car.position, [1, 2, 3]);
      closeVector(new Vector3(0, 1, 0).applyQuaternion(car.quaternion), [0, 1, 0]);
    }
  });
});
