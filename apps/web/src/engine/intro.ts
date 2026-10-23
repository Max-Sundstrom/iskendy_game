import art from '@kometa/content/art.json';
import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';

// Launch intro (owner request 2026-10-23, ADR-026/027): the reference's C-shaped launch ramp on a steel truss tower. The
// car drives in along the road, climbs the inside of the C, runs along the underside of the top arm upside down,
// leaves the lip with the thrusters firing, turns 1½ times in the air and lands on the road as the run starts.
// Presentation before tick 0 only: the sim starts at touchdown, so replays and determinism are untouched.

const RAMP_WIDTH_M = 6;
/** The C: an ellipse half (semi-axes A across, B up) plus a straight top arm ending at the launch lip. */
const A = 7.5;
const B = 12;
const ARM_M = 10;
const RAMP_MPS = 30;
const G = 9.81;
const COM_M = 0.55; // centre of mass above the contact point; the car turns about it in the air

// Three coordinates: the run heads to −z and touches down at the origin, so the lip sits where a ballistic arc from
// height 2B lands there, and the C stands behind it.
export const FLIGHT_S = Math.sqrt((4 * B) / G);
const LIP_Z = RAMP_MPS * FLIGHT_S;
const ZC = LIP_Z + ARM_M; // the C's centre line
const APPROACH_S = 1.2;
const RAMP_LEN = Math.PI * Math.sqrt((A * A + B * B) / 2) + ARM_M;
const CLIMB_S = RAMP_LEN / RAMP_MPS;

export const INTRO_S = APPROACH_S + CLIMB_S + FLIGHT_S;
/** Retry starts mid-flight (GDD §3: a short 1.5 s intro). */
export const RETRY_START_S = INTRO_S - 1.5;

export type IntroPose = {
  /** Contact point (the car's origin) in three coordinates. */
  position: Vector3;
  /** Orientation of the whole car: its −z is the travel direction, +y its roof. */
  quaternion: Quaternion;
  speed: number;
  phase: 'approach' | 'ramp' | 'flight';
};

/** Countdown digit shown at intro time t (3, 2, 1), or 0 once the run has started. */
export function countdownDigit(t: number): number {
  if (t >= INTRO_S) return 0;
  return 3 - Math.min(2, Math.floor((t / INTRO_S) * 3));
}

export type Intro = {
  group: Group;
  /** Car pose at intro time t; touches down at the origin, upright, at INTRO_S. */
  pose(t: number, out: IntroPose): IntroPose;
};

/** A point on the ramp at arc length s from the bottom of the C: contact point, travel direction, roof normal. */
function rampFrame(s: number, p: Vector3, fwd: Vector3, up: Vector3): void {
  const half = RAMP_LEN - ARM_M;
  if (s <= half) {
    // Ellipse from the bottom (−90°) round the back to the top (+90°); arc length → angle numerically.
    const phi = -Math.PI / 2 + Math.PI * ellipseAngleAt(s / half);
    p.set(0, B + B * Math.sin(phi), ZC + A * Math.cos(phi));
    fwd.set(0, B * Math.cos(phi), -A * Math.sin(phi)).normalize();
  } else {
    p.set(0, 2 * B, ZC - (s - half));
    fwd.set(0, 0, -1);
  }
  // The roof points to the inside of the C: the travel direction turned a quarter toward the centre.
  up.set(0, fwd.z, -fwd.y);
}

// Arc-length parameterisation of the half ellipse, tabulated once.
const TABLE: number[] = (() => {
  const n = 256;
  const acc = [0];
  let prev = new Vector3(0, 0, ZC);
  for (let i = 1; i <= n; i++) {
    const phi = -Math.PI / 2 + (Math.PI * i) / n;
    const q = new Vector3(0, B + B * Math.sin(phi), ZC + A * Math.cos(phi));
    acc.push((acc[i - 1] ?? 0) + q.distanceTo(prev));
    prev = q;
  }
  const total = acc[n] ?? 1;
  return acc.map((v) => v / total);
})();

function ellipseAngleAt(u: number): number {
  const n = TABLE.length - 1;
  let lo = 0;
  let hi = n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((TABLE[mid] ?? 0) < u) lo = mid;
    else hi = mid;
  }
  const a = TABLE[lo] ?? 0;
  const b = TABLE[hi] ?? 1;
  return (lo + (b > a ? (u - a) / (b - a) : 0)) / n;
}

/** Ramp body: the running surface (inner face), a back face and side faces, from samples along the C. */
function rampGeometry(samples: { p: Vector3; up: Vector3 }[], thick: number): BufferGeometry {
  const pos: number[] = [];
  const hw = RAMP_WIDTH_M / 2;
  const quad = (a: number[], b: number[], c: number[], d: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i + 1 < samples.length; i++) {
    const s0 = samples[i];
    const s1 = samples[i + 1];
    if (!s0 || !s1) continue;
    const inner = (s: { p: Vector3 }, x: number) => [x, s.p.y, s.p.z];
    const outer = (s: { p: Vector3; up: Vector3 }, x: number) => [x, s.p.y - s.up.y * thick, s.p.z - s.up.z * thick];
    quad(inner(s0, -hw), inner(s1, -hw), inner(s1, hw), inner(s0, hw)); // running surface
    quad(outer(s0, hw), outer(s1, hw), outer(s1, -hw), outer(s0, -hw)); // back
    quad(inner(s0, hw), inner(s1, hw), outer(s1, hw), outer(s0, hw)); // sides
    quad(outer(s0, -hw), outer(s1, -hw), inner(s1, -hw), inner(s0, -hw));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function createIntro(startMps: number): Intro {
  const group = new Group();
  const steel = new MeshStandardMaterial({ color: '#8d9099', roughness: 0.4, metalness: 0.85 });
  const deck = new MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.6, side: 2 });
  const led = new MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff1a1a', emissiveIntensity: 2.4 });
  const paint = new MeshStandardMaterial({ color: art.palette.enamelCream, roughness: 0.5 });

  // Samples from just before the bottom of the C (a short flat run-in) to the lip.
  const samples: { p: Vector3; up: Vector3 }[] = [];
  const fwd = new Vector3();
  for (let s = -6; s <= RAMP_LEN + 1e-6; s += 0.5) {
    const p = new Vector3();
    const up = new Vector3();
    if (s < 0) {
      p.set(0, 0, ZC + s);
      up.set(0, 1, 0);
    } else rampFrame(s, p, fwd, up);
    samples.push({ p, up });
  }
  const ramp = new Mesh(rampGeometry(samples, 0.6), deck);
  ramp.receiveShadow = true;
  ramp.castShadow = true;
  group.add(ramp);

  // LED edges and two lane lines along the running surface, as instanced short segments.
  const strips: { m: Matrix4; mat: 'led' | 'paint' }[] = [];
  const q = new Quaternion();
  const zAxis = new Vector3(0, 0, 1);
  const yAxis = new Vector3(0, 1, 0);
  const d = new Vector3();
  const basis = new Matrix4();
  for (let i = 0; i + 1 < samples.length; i++) {
    const s0 = samples[i];
    const s1 = samples[i + 1];
    if (!s0 || !s1) continue;
    d.subVectors(s1.p, s0.p);
    const len = d.length();
    d.normalize();
    const up = s0.up;
    basis.makeBasis(new Vector3().crossVectors(up, d), up, d);
    q.setFromRotationMatrix(basis);
    for (const [x, w, mat] of [
      [-RAMP_WIDTH_M / 2 + 0.08, 0.12, 'led'],
      [RAMP_WIDTH_M / 2 - 0.08, 0.12, 'led'],
      [-0.9, 0.1, 'paint'],
      [0.9, 0.1, 'paint'],
    ] as const) {
      const c = new Vector3(x, 0, 0)
        .add(s0.p)
        .addScaledVector(d, len / 2)
        .addScaledVector(up, 0.02);
      strips.push({ m: new Matrix4().compose(c, q.clone(), new Vector3(w, 0.03, len + 0.02)), mat });
    }
  }
  for (const kind of ['led', 'paint'] as const) {
    const list = strips.filter((s) => s.mat === kind);
    const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), kind === 'led' ? led : paint, list.length);
    list.forEach((s, i) => mesh.setMatrixAt(i, s.m));
    group.add(mesh);
  }

  // Truss: a tower behind the C, a girder over the top arm and struts from the C's back to the tower.
  const beams: Matrix4[] = [];
  const dir = new Vector3();
  const beam = (a: Vector3, b: Vector3, thick: number) => {
    dir.subVectors(b, a).normalize();
    q.setFromUnitVectors(yAxis, dir);
    beams.push(
      new Matrix4().compose(
        a.clone().add(b).multiplyScalar(0.5),
        q.clone(),
        new Vector3(thick, a.distanceTo(b), thick),
      ),
    );
  };
  const top = 2 * B + 3;
  const z0 = ZC + A + 1.2;
  const z1 = z0 + 3.5;
  for (const x of [-4, 4]) for (const z of [z0, z1]) beam(new Vector3(x, 0, z), new Vector3(x, top, z), 0.35);
  for (let y = 0; y < top - 0.1; y += 3) {
    for (const [xa, za, xb, zb] of [
      [-4, z0, 4, z0],
      [-4, z1, 4, z1],
      [-4, z0, -4, z1],
      [4, z0, 4, z1],
    ] as const) {
      beam(new Vector3(xa, y, za), new Vector3(xb, Math.min(top, y + 3), zb), 0.12);
      beam(new Vector3(xa, Math.min(top, y + 3), za), new Vector3(xb, Math.min(top, y + 3), zb), 0.16);
    }
  }
  // Girder over the arm, from the tower to just past the lip.
  for (const x of [-3.6, 3.6]) {
    beam(new Vector3(x, 2 * B + 0.6, z1), new Vector3(x, 2 * B + 0.6, LIP_Z - 0.5), 0.3);
    beam(new Vector3(x, top, z1), new Vector3(x, top, LIP_Z + 1), 0.3);
    for (let z = LIP_Z; z < z1; z += 2.5) {
      beam(new Vector3(x, 2 * B + 0.6, z), new Vector3(x, top, z + 2.5), 0.12);
      beam(new Vector3(x, 2 * B + 0.6, z), new Vector3(x, top, z), 0.14);
    }
  }
  // Struts from the back of the C to the tower.
  for (let k = 1; k < 8; k++) {
    const phi = -Math.PI / 2 + (Math.PI * k) / 8;
    const y = B + B * Math.sin(phi);
    const z = ZC + A * Math.cos(phi) + 0.6;
    for (const x of [-2.5, 2.5]) beam(new Vector3(x, y, z), new Vector3(x * 1.6, y, z0), 0.2);
  }
  const truss = new InstancedMesh(new BoxGeometry(1, 1, 1), steel, beams.length);
  beams.forEach((b, i) => truss.setMatrixAt(i, b));
  truss.castShadow = true;
  group.add(truss);
  // Warning lights on the tower top.
  for (const [x, z] of [
    [-4, z0],
    [4, z0],
    [-4, z1],
    [4, z1],
  ] as const) {
    const lamp = new Mesh(new BoxGeometry(0.4, 0.4, 0.4), led);
    lamp.position.set(x, top + 0.3, z);
    group.add(lamp);
  }

  const p = new Vector3();
  const up = new Vector3();
  const right = new Vector3();
  const back = new Vector3();
  const m = new Matrix4();
  const upright = new Quaternion();
  const spin = new Quaternion();
  const comStart = new Vector3(0, 2 * B - COM_M, LIP_Z);
  const comEnd = new Vector3(0, COM_M, 0);
  const vy0 = (comEnd.y - comStart.y + 0.5 * G * FLIGHT_S * FLIGHT_S) / FLIGHT_S;
  void startMps;

  /** Sets the car's orientation from its travel direction and roof normal. */
  const orient = (out: IntroPose, f: Vector3, u: Vector3) => {
    right.crossVectors(f, u);
    back.copy(f).negate();
    m.makeBasis(right, u, back);
    out.quaternion.setFromRotationMatrix(m);
  };

  return {
    group,
    pose(t, out) {
      if (t < APPROACH_S) {
        // Rolling in along the road toward the C (+z), speeding up to ramp speed.
        const v0 = 10;
        const acc = (RAMP_MPS - v0) / APPROACH_S;
        const sAlong = v0 * t + 0.5 * acc * t * t;
        const total = v0 * APPROACH_S + 0.5 * acc * APPROACH_S * APPROACH_S;
        out.position.set(0, 0, ZC - total + sAlong);
        orient(out, fwd.set(0, 0, 1), up.set(0, 1, 0));
        out.speed = v0 + acc * t;
        out.phase = 'approach';
      } else if (t < APPROACH_S + CLIMB_S) {
        rampFrame((t - APPROACH_S) * RAMP_MPS, p, fwd, up);
        out.position.copy(p);
        orient(out, fwd, up);
        out.speed = RAMP_MPS;
        out.phase = 'ramp';
      } else {
        // Ballistic flight of the centre of mass. The car left the lip upside down and still facing the run, so it
        // rolls 1½ times about its length to land upright, easing in to touch down level.
        const tau = Math.min(FLIGHT_S, t - APPROACH_S - CLIMB_S);
        const u = tau / FLIGHT_S;
        const com = p.set(0, comStart.y + vy0 * tau - 0.5 * G * tau * tau, comStart.z + (comEnd.z - comStart.z) * u);
        const eased = u * u * (3 - 2 * u);
        upright.identity();
        spin.setFromAxisAngle(zAxis, Math.PI * (1 - 3 * eased)); // π (inverted) → −2π (upright after 1½ rolls)
        out.quaternion.copy(upright).multiply(spin);
        up.set(0, 1, 0).applyQuaternion(out.quaternion);
        out.position.copy(com).addScaledVector(up, -COM_M);
        out.speed = RAMP_MPS;
        out.phase = 'flight';
      }
      return out;
    },
  };
}
