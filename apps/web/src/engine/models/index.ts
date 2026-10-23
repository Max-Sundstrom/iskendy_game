import type { SimTuning } from '@kometa/shared';
import type { BufferGeometry } from 'three';
import { compact, marshrutka, sedan, taxi, van, type Size } from './cars';
import { barrier, bus, carCarrier, cones, semi, sweeper, trolleybus, worksTruck } from './heavy';
import { assemble, type Part } from './parts';

// One merged geometry per vehicle type in the tuning, keyed by the type's id (GDD §7).

const BUILDERS: Record<string, (s: Size) => Part[]> = {
  sedan: (s) => sedan(s),
  compact,
  taxi,
  van: (s) => van(s),
  bus,
  semi,
  carCarrier,
  cones,
  barrier,
  marshrutka,
  trolleybus,
  sweeper,
  worksTruck,
};

/** Geometry for vehicle type `index`; unknown ids fall back to the sedan shape at the type's size. */
export function vehicleGeometry(tuning: SimTuning, index: number): BufferGeometry {
  const v = tuning.vehicles[index];
  if (!v) throw new Error(`no vehicle type ${index}`);
  const size = { L: v.lengthM, W: v.widthM, H: v.heightM };
  const build = BUILDERS[v.id] ?? BUILDERS['sedan'];
  return assemble(build ? build(size) : [], v.lengthM);
}
