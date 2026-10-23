import { Euler, Vector3, type Object3D } from 'three';

const COM_M = 0.55;
const orientation = new Euler();
const rotatedCom = new Vector3();

/** Compose Qx(-pitch) * Qz(-roll), keeping the model's centre of mass on its interpolated sim trajectory. */
export function setTrickPose(
  group: Object3D,
  x: number,
  y: number,
  z: number,
  pitchTurns: number,
  rollTurns: number,
): void {
  // Three's XYZ Euler composition is Qx * Qy * Qz; yaw is zero. The CarRig already faces world -z.
  group.quaternion.setFromEuler(orientation.set(-2 * Math.PI * pitchTurns, 0, -2 * Math.PI * rollTurns, 'XYZ'));
  rotatedCom.set(0, COM_M, 0).applyQuaternion(group.quaternion);
  group.position.set(x - rotatedCom.x, y + COM_M - rotatedCom.y, z - rotatedCom.z);
}
