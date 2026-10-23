import art from '@kometa/content/art.json';
import {
  BoxGeometry,
  BufferGeometry,
  CubicBezierCurve3,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';

// Launch intro (GDD §1 img 14/20, §3; owner request 2026-10-23, ADR-026): the car waits on the deck of a steel truss
// gantry, drops down a curved ramp during the 3-2-1 countdown and meets the road at the run's start speed. Pure
// presentation before tick 0: the sim starts when the car touches the road, so replays and determinism are unaffected.

export const INTRO_S = 3.6;
/** Retry skips the wait at the top (GDD §3: short 1.5 s ramp). */
export const RETRY_START_S = INTRO_S - 1.5;
const DESCENT_START_S = 0.3;
const RAMP_WIDTH_M = 6;

// Three coordinates: the run starts at z = 0 and heads to −z, so the gantry stands behind the start (+z).
// The drop starts level, steepens, and flattens out at the road, so the car never changes pitch abruptly.
const PATH = new CubicBezierCurve3(
  new Vector3(0, 22, 70),
  new Vector3(0, 22, 40),
  new Vector3(0, 0, 42),
  new Vector3(0, 0, 0),
);
const DECK_START = new Vector3(0, 22, 92);

export type IntroPose = { x: number; y: number; z: number; pitch: number; speed: number };

/** Countdown digit shown at intro time t (3, 2, 1), or 0 once the run has started. */
export function countdownDigit(t: number): number {
  if (t >= INTRO_S) return 0;
  return 3 - Math.min(2, Math.floor((t / INTRO_S) * 3));
}

export type Intro = {
  group: Group;
  /** Car pose at intro time t; arrives at the origin at INTRO_S moving at `startMps`. */
  pose(t: number, out: IntroPose): IntroPose;
};

/** Ramp deck: a strip along the path with raised kerbs, built from path samples. */
function deckGeometry(samples: Vector3[]): BufferGeometry {
  const pos: number[] = [];
  const hw = RAMP_WIDTH_M / 2;
  for (let i = 0; i + 1 < samples.length; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    if (!a || !b) continue;
    pos.push(-hw, a.y, a.z, hw, a.y, a.z, hw, b.y, b.z, -hw, a.y, a.z, hw, b.y, b.z, -hw, b.y, b.z);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function createIntro(startMps: number): Intro {
  const group = new Group();
  const steel = new MeshStandardMaterial({ color: '#6a3f33', roughness: 0.55, metalness: 0.6 });
  const deckMat = new MeshStandardMaterial({ color: '#2a2a33', roughness: 0.45, side: DoubleSide });
  const kerbMat = new MeshStandardMaterial({
    color: art.palette.enamelCream,
    emissive: '#fff1d6',
    emissiveIntensity: 0.25,
  });

  const samples = [DECK_START.clone(), ...PATH.getSpacedPoints(48)];
  const deck = new Mesh(deckGeometry(samples), deckMat);
  deck.position.y = 0.02;
  deck.receiveShadow = true;
  group.add(deck);

  // Kerbs, cross-ties under the deck and support columns down to the ground, all instanced.
  const beams: Matrix4[] = [];
  const kerbs: Matrix4[] = [];
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const fwd = new Vector3(0, 0, 1);
  const dir = new Vector3();
  const beam = (a: Vector3, b: Vector3, thick: number) => {
    dir.subVectors(b, a).normalize();
    q.setFromUnitVectors(up, dir);
    beams.push(
      new Matrix4().compose(
        a.clone().add(b).multiplyScalar(0.5),
        q.clone(),
        new Vector3(thick, a.distanceTo(b), thick),
      ),
    );
  };
  for (let i = 0; i + 1 < samples.length; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    if (!a || !b) continue;
    dir.subVectors(b, a).normalize();
    q.setFromUnitVectors(fwd, dir);
    for (const sx of [-1, 1]) {
      const centre = new Vector3((sx * RAMP_WIDTH_M) / 2, (a.y + b.y) / 2 + 0.19, (a.z + b.z) / 2);
      kerbs.push(new Matrix4().compose(centre, q.clone(), new Vector3(0.3, 0.35, a.distanceTo(b) + 0.06)));
    }
    if (i % 3 === 0)
      beam(
        new Vector3(-RAMP_WIDTH_M / 2 - 0.3, a.y - 0.3, a.z),
        new Vector3(RAMP_WIDTH_M / 2 + 0.3, a.y - 0.3, a.z),
        0.3,
      );
    if (i % 4 === 0 && a.y > 1.5)
      for (const sx of [-1, 1])
        beam(
          new Vector3((sx * RAMP_WIDTH_M) / 2 + sx * 0.4, 0, a.z),
          new Vector3((sx * RAMP_WIDTH_M) / 2 + sx * 0.4, a.y - 0.3, a.z),
          0.35,
        );
  }
  const kerbMesh = new InstancedMesh(new BoxGeometry(1, 1, 1), kerbMat, kerbs.length);
  kerbs.forEach((k, i) => kerbMesh.setMatrixAt(i, k));
  group.add(kerbMesh);
  // The gantry tower: four legs, a lattice of diagonals and a top frame over the start deck (cf. reference img 14).
  const top = 28;
  const legs = [
    [-5, 66],
    [5, 66],
    [-5, 92],
    [5, 92],
  ] as const;
  for (const [x, z] of legs) beam(new Vector3(x, 0, z), new Vector3(x, top, z), 0.6);
  for (let y = 0; y < top; y += 5) {
    for (const [x0, z0, x1, z1] of [
      [-5, 66, 5, 66],
      [-5, 92, 5, 92],
      [-5, 66, -5, 92],
      [5, 66, 5, 92],
    ] as const) {
      beam(new Vector3(x0, y, z0), new Vector3(x1, y + 5, z1), 0.25);
      beam(new Vector3(x1, y, z1), new Vector3(x0, y + 5, z0), 0.25);
      beam(new Vector3(x0, y + 5, z0), new Vector3(x1, y + 5, z1), 0.3);
    }
  }
  // A crane-like arm over the ramp carrying the start lights.
  beam(new Vector3(-5, top, 66), new Vector3(-5, top, 34), 0.5);
  beam(new Vector3(5, top, 66), new Vector3(5, top, 34), 0.5);
  beam(new Vector3(-5, top, 34), new Vector3(5, top, 34), 0.5);
  beam(new Vector3(-5, 0, 34), new Vector3(-5, top, 34), 0.5);
  beam(new Vector3(5, 0, 34), new Vector3(5, top, 34), 0.5);
  const truss = new InstancedMesh(new BoxGeometry(1, 1, 1), steel, beams.length);
  beams.forEach((b, i) => truss.setMatrixAt(i, b));
  truss.castShadow = true;
  group.add(truss);

  // Arc length table for constant-acceleration motion along the path.
  PATH.arcLengthDivisions = 400;
  const total = PATH.getLength();
  const T = INTRO_S - DESCENT_START_S;
  const v0 = Math.max(4, (2 * total) / T - startMps);
  const accel = (startMps - v0) / T;
  const p = new Vector3();
  const tan = new Vector3();

  return {
    group,
    pose(t, out) {
      if (t < DESCENT_START_S) {
        // Waiting at the start of the drop.
        PATH.getPointAt(0, p);
        PATH.getTangentAt(0, tan);
        out.speed = 0;
      } else {
        const tau = Math.min(T, t - DESCENT_START_S);
        const d = Math.min(total, v0 * tau + 0.5 * accel * tau * tau);
        PATH.getPointAt(d / total, p);
        PATH.getTangentAt(d / total, tan);
        out.speed = v0 + accel * tau;
      }
      out.x = p.x;
      out.y = p.y;
      out.z = p.z;
      out.pitch = Math.atan2(-tan.y, -tan.z); // nose-down angle while dropping toward −z
      return out;
    },
  };
}
