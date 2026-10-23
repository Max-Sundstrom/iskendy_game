import { Box3, Mesh, MeshPhysicalMaterial, Object3D, Raycaster, Vector3, type Material } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCar } from '../car';

afterEach(() => vi.unstubAllGlobals());

function car() {
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => null }) });
  return createCar();
}

describe('Kometa hero presentation contract', () => {
  it('fits the hero triangle/material budgets and keeps its original dimensions', () => {
    const rig = car();
    const materials = new Set<Material>();
    let triangles = 0;
    rig.group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        materials.add(material);
    });
    expect(triangles).toBeLessThanOrEqual(15000);
    expect(materials.size).toBeLessThanOrEqual(3);
    expect(materials.has(rig.nozzleGlow)).toBe(true);
    const bounds = new Box3().setFromObject(rig.group);
    const size = bounds.getSize(new Vector3());
    expect(size.x).toBeLessThanOrEqual(2.05);
    expect(size.y).toBeLessThanOrEqual(1.2);
    expect(size.z).toBeLessThanOrEqual(4.6);
    expect(bounds.min.y).toBeCloseTo(0, 5);
  });

  it('keeps the satin rear cap in front of the paint cap in the actual chase direction', () => {
    const rig = car();
    rig.group.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(0, 0.44, 5), new Vector3(0, 0, -1));
    const hits = ray.intersectObject(rig.body, true);
    expect(hits[0]?.point.z).toBeGreaterThan(2.21);
    expect(hits.some((hit) => Math.abs(hit.point.z - 2.2) < 0.001)).toBe(true);
  });

  it('retains complete finish and atlas inputs when opaque parts are merged', () => {
    const rig = car();
    let finishedMeshes = 0;
    rig.group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const material = object.material;
      if (!(material instanceof MeshPhysicalMaterial) || !material.vertexColors) return;
      finishedMeshes++;
      const count = object.geometry.getAttribute('position').count;
      for (const name of ['uv', 'color', 'finish', 'lamp']) {
        const attribute = object.geometry.getAttribute(name);
        expect(attribute).toBeDefined();
        expect(attribute.count).toBe(count);
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
      }
      expect(material.map?.image).toMatchObject({ width: 256, height: 256 });
    });
    expect(finishedMeshes).toBeGreaterThan(0);
  });

  it('keeps spinning wheels separate from the leaning body and retains thruster anchors', () => {
    const rig = car();
    expect(rig.wheels).toHaveLength(4);
    for (const wheel of rig.wheels) {
      expect(wheel.userData['spin']).toBeInstanceOf(Object3D);
      expect(wheel.parent).toBe(rig.body.parent);
      expect(Math.abs(wheel.position.x)).toBe(0.86);
      expect(Math.abs(wheel.position.z)).toBe(1.325);
      expect(wheel.position.y).toBe(0.34);
    }
    expect(rig.nozzles.rear).toHaveLength(4);
    expect(rig.nozzles.lift).toHaveLength(4);
    for (const nozzle of rig.nozzles.rear) expect(nozzle.position.z).toBe(-2.25);
    for (const nozzle of rig.nozzles.lift) expect(nozzle.position.y).toBe(0.2);
    expect(rig.nozzles.left.position.toArray()).toEqual([0.965, 0.36, 0.95]);
    expect(rig.nozzles.right.position.toArray()).toEqual([-0.965, 0.36, 0.95]);
    expect(rig.shadow.parent).toBeNull();
  });
});
