import type { Tuning } from '@kometa/shared';
import { Euler, MathUtils, Vector3, type PerspectiveCamera } from 'three';
import type { CrashFrame } from '../game/crash-sequence';
import type { Session } from '../game/session';
import type { CarRig } from './car';
import type { Thrusters } from './thrusters';
import type { Vapour } from './vapour';

export type CrashView = { begin(): void; update(frame: CrashFrame): void; reset(): void };

/** Landing resets the sim's flip angle; preserve its preceding tick's real orientation for the frozen impact. */
export function crashFlipTurns(session: Session): number {
  for (const event of session.frameEvents) {
    if (event.kind === 'crash' && event.cause === 'landing') return session.prev.flip;
  }
  return session.state.player.flipTurns;
}

/** A local settling response around the terminal pose, without guessing a contact point from the crash cause. */
export function createCrashView(
  rig: CarRig,
  camera: PerspectiveCamera,
  thrusters: Thrusters,
  vapour: Vapour,
  tuning: Tuning['presentation']['crash'],
): CrashView {
  const bodyPosition = new Vector3();
  const bodyRotation = new Euler();
  const cameraPosition = new Vector3();
  const backwards = new Vector3();
  let active = false;
  let started = false;
  let reduced = false;
  const restore = () => {
    rig.body.position.copy(bodyPosition);
    rig.body.rotation.copy(bodyRotation);
    camera.position.copy(cameraPosition);
  };
  return {
    begin() {
      if (active) return;
      active = true;
      bodyPosition.copy(rig.body.position);
      bodyRotation.copy(rig.body.rotation);
      cameraPosition.copy(camera.position);
      backwards.set(0, 0, 1).applyQuaternion(camera.quaternion);
      // Remove the previous continuous exhaust immediately; only this impact's short cloud can remain.
      vapour.reset();
    },
    update(frame) {
      if (!active) return;
      restore();
      if (frame.reducedMotion) {
        if (!reduced) vapour.reset();
        reduced = true;
        started = true;
      }
      if (reduced) return;
      if (!started) {
        started = true;
        thrusters.crash(tuning);
      }
      const t = Math.min(1, frame.elapsedS / tuning.settleDurationS);
      // One compression and settle, no repeated shake or flash. Zero at either end of the interval.
      const amount = 4 * t * (1 - t);
      rig.body.position.y -= tuning.bodyDropM * amount;
      rig.body.rotation.x -= MathUtils.degToRad(tuning.bodyPitchDeg) * amount;
      camera.position.addScaledVector(backwards, tuning.cameraPullbackM * amount);
    },
    reset() {
      if (active) restore();
      active = started = reduced = false;
    },
  };
}
