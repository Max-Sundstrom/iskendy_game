import { DEFAULT_TUNING } from '@kometa/sim';
import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { vehicleGeometry } from '.';
import { loft } from './loft';

const tuning = DEFAULT_TUNING.sim;

describe('vehicle models', () => {
  it.each(tuning.vehicles.map((v, i) => [v.id, i] as const))(
    '%s fits its collision box and the 3k-triangle budget',
    (_, i) => {
      const v = tuning.vehicles[i];
      if (!v) throw new Error('missing type');
      const g = vehicleGeometry(tuning, i);
      const triangles = g.getAttribute('position').count / 3;
      expect(triangles).toBeLessThanOrEqual(3000); // ARCHITECTURE §12: traffic vehicle ≤ 3k
      for (const name of ['color', 'paint', 'glow', 'normal']) expect(g.getAttribute(name)).toBeDefined();
      const box = new Box3().setFromBufferAttribute(g.getAttribute('position') as never);
      const size = box.getSize(new Vector3());
      // The rear sits at z = 0 and the body runs toward −z (sim +z); the model stays close to the sim's box.
      expect(box.max.z).toBeLessThanOrEqual(0.15);
      expect(size.z).toBeGreaterThan(v.lengthM * 0.85);
      expect(size.z).toBeLessThan(v.lengthM + 0.3);
      expect(size.x).toBeLessThan(v.widthM + 0.3);
      expect(box.max.y).toBeLessThan(v.heightM + 1.4); // roof signs and trolley poles may stand above the roof
      expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
    },
  );
});

describe('loft', () => {
  it('builds a closed surface whose normals point outward', () => {
    const g = loft([
      { z: -1, ys: 0, wb: 1, ysh: 0.5, wsh: 1, yt: 1, wt: 0.8 },
      { z: 1, ys: 0, wb: 1, ysh: 0.5, wsh: 1, yt: 1, wt: 0.8 },
    ]);
    const pos = g.getAttribute('position');
    const nrm = g.getAttribute('normal');
    const centre = new Vector3(0, 0.5, 0);
    let outward = 0;
    for (let i = 0; i < pos.count; i++) {
      const p = new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(centre);
      const n = new Vector3(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      if (p.dot(n) > 0) outward++;
    }
    expect(outward / pos.count).toBeGreaterThan(0.95);
  });
});
