import { Action, DEFAULT_TUNING, SimStatus, stateHash } from '@kometa/sim';
import { Group, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { advance, createSession } from '../game/session';
import type { CarRig } from './car';
import { crashFlipTurns, createCrashView } from './crash';
import { createVapour } from './vapour';

const tuning = DEFAULT_TUNING.presentation.crash;
const setup = () => {
  const rig: CarRig = {
    group: new Group(),
    body: new Group(),
    wheels: [],
    nozzles: { rear: [], lift: [], left: new Object3D(), right: new Object3D() },
    nozzleGlow: new MeshStandardMaterial(),
    shadow: new Mesh(),
  };
  rig.body.position.set(1, 2, 3);
  rig.body.rotation.set(0.2, 0.3, 0.4);
  const camera = new PerspectiveCamera();
  camera.position.set(4, 5, 6);
  const thrusters = { update: vi.fn(), launch: vi.fn(), reset: vi.fn(), crash: vi.fn() };
  const vapour = createVapour();
  const reset = vi.spyOn(vapour, 'reset');
  const view = createCrashView(rig, camera, thrusters, vapour, tuning);
  return { rig, camera, thrusters, reset, view };
};

describe('crash presentation', () => {
  it('tips the actual local +z nose down relative to the rear through the model transform', () => {
    const { rig, view } = setup();
    const model = new Group();
    model.rotation.y = Math.PI; // frozen CarRig contract: model front +z becomes world forward -z
    rig.group.add(model);
    model.add(rig.body);
    rig.body.rotation.set(0, 0, 0);
    rig.group.updateMatrixWorld(true);
    const noseBefore = new Vector3(0, 0, 2).applyMatrix4(rig.body.matrixWorld);
    const rearBefore = new Vector3(0, 0, -2).applyMatrix4(rig.body.matrixWorld);
    expect(noseBefore.z).toBeLessThan(rearBefore.z);
    view.begin();
    view.update({ elapsedS: tuning.settleDurationS / 2, deltaS: tuning.settleDurationS / 2, reducedMotion: false });
    rig.group.updateMatrixWorld(true);
    const noseAfter = new Vector3(0, 0, 2).applyMatrix4(rig.body.matrixWorld);
    const rearAfter = new Vector3(0, 0, -2).applyMatrix4(rig.body.matrixWorld);
    expect(noseAfter.y).toBeLessThan(noseBefore.y);
    expect(rearAfter.y).toBeGreaterThan(rearBefore.y);
    expect(noseAfter.y - rearAfter.y).toBeLessThan(noseBefore.y - rearBefore.y);
  });

  it('settles once around the captured pose without accumulating offsets on repeated frames', () => {
    const { rig, camera, thrusters, reset, view } = setup();
    view.begin();
    view.begin();
    expect(reset).toHaveBeenCalledTimes(1);
    const peak = { elapsedS: tuning.settleDurationS / 2, deltaS: 0.125, reducedMotion: false };
    view.update(peak);
    expect(rig.body.position.y).toBeCloseTo(2 - tuning.bodyDropM);
    expect(rig.body.rotation.x).toBeCloseTo(0.2 + (tuning.bodyPitchDeg * Math.PI) / 180);
    expect(camera.position.z).toBeCloseTo(6 + tuning.cameraPullbackM);
    view.update({ ...peak, deltaS: 0 });
    expect(rig.body.position.y).toBeCloseTo(2 - tuning.bodyDropM);
    expect(rig.body.rotation.x).toBeCloseTo(0.2 + (tuning.bodyPitchDeg * Math.PI) / 180);
    expect(camera.position.z).toBeCloseTo(6 + tuning.cameraPullbackM);
    expect(thrusters.crash).toHaveBeenCalledExactlyOnceWith(tuning);
    view.update({ ...peak, elapsedS: tuning.durationS });
    expect(rig.body.position.toArray()).toEqual([1, 2, 3]);
    expect(rig.body.rotation.toArray()).toEqual([0.2, 0.3, 0.4, 'XYZ']);
    expect(camera.position.toArray()).toEqual([4, 5, 6]);
  });

  it('reduced motion keeps the exact pose, clears particles and never replays impact when switched off', () => {
    const { rig, camera, thrusters, view } = setup();
    view.begin();
    view.update({ elapsedS: 0, deltaS: 0, reducedMotion: true });
    view.update({ elapsedS: 0.125, deltaS: 0.125, reducedMotion: false });
    expect(thrusters.crash).not.toHaveBeenCalled();
    expect(rig.body.position.toArray()).toEqual([1, 2, 3]);
    expect(rig.body.rotation.toArray()).toEqual([0.2, 0.3, 0.4, 'XYZ']);
    expect(camera.position.toArray()).toEqual([4, 5, 6]);
    view.reset();
    view.begin();
    view.update({ elapsedS: 0.125, deltaS: 0.125, reducedMotion: false });
    expect(thrusters.crash).toHaveBeenCalledTimes(1);
    view.update({ elapsedS: 0.15, deltaS: 0.025, reducedMotion: true });
    expect(rig.body.position.toArray()).toEqual([1, 2, 3]);
    expect(rig.body.rotation.toArray()).toEqual([0.2, 0.3, 0.4, 'XYZ']);
    expect(camera.position.toArray()).toEqual([4, 5, 6]);
  });

  it('reset restores the original pose and permits another single impact', () => {
    const { rig, camera, thrusters, view } = setup();
    for (let run = 0; run < 3; run++) {
      view.begin();
      view.update({ elapsedS: 0.125, deltaS: 0.125, reducedMotion: false });
      view.reset();
      expect(rig.body.position.toArray()).toEqual([1, 2, 3]);
      expect(rig.body.rotation.toArray()).toEqual([0.2, 0.3, 0.4, 'XYZ']);
      expect(camera.position.toArray()).toEqual([4, 5, 6]);
    }
    expect(thrusters.crash).toHaveBeenCalledTimes(3);
  });

  it('preserves the last actual orientation of a bad landing without changing its deterministic state', () => {
    const s = createSession(5);
    while (s.state.status === SimStatus.running && s.state.tick < 100) {
      advance(s, 1, s.state.tick === 15 || s.state.tick === 45 ? Action.jump : 0);
    }
    expect(s.frameEvents).toContainEqual({ kind: 'crash', cause: 'landing' });
    expect(s.state.tick).toBe(64);
    // P2-02b deliberately preserves the final integrated landing pose instead of resetting it to zero.
    // The previous P3-00C tick fallback would now discard an actual tick of rotation.
    expect(s.state.player.flipTurns).toBeGreaterThan(s.prev.flip);
    const hash = stateHash(s.state);
    expect(crashFlipTurns(s)).toBe(s.state.player.flipTurns);
    expect(crashFlipTurns(s)).toBeGreaterThan(0.5);
    expect(stateHash(s.state)).toBe(hash);
  });

  it('uses the terminal orientation for rear collisions', () => {
    const s = createSession(28);
    advance(s, 300, 0);
    expect(s.frameEvents).toContainEqual({ kind: 'crash', cause: 'rear' });
    expect(crashFlipTurns(s)).toBe(s.state.player.flipTurns);
  });
});
