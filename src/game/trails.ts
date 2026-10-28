/**
 * Whispering Woods extras: footpaths that wind through the forest, a treehouse
 * you can climb up to, a campsite and a boulder garden for climbing. Pure data
 * (positions + colliders), built lazily from the world geometry.
 */
import { getWorld } from "./world";
import { boxCollider, type Collider } from "./scatter";

/** Forest footpaths (control points, walked in order). */
export const FOREST_TRAILS: [number, number][][] = [
  [
    [-118, 14],
    [-128, 12],
    [-138, 6],
    [-141, -6],
    [-138, -18],
    [-128, -26],
    [-116, -24],
    [-109, -14],
  ],
  [
    [-116, 22],
    [-106, 18],
    [-94, 12],
    [-86, -2],
    [-90, -16],
    [-99, -23],
  ],
];
export const TRAIL_HALF = 1.1;

export const TREEHOUSE = { x: -134, z: -2 };
export const CAMPSITE = { x: -129, z: 20 };
/** Campsite tent (campsite-local centre, yaw) and size: ridge along local z, door at +z. */
export const CAMP_TENT = { x: -3.6, z: -2.2, rot: 1.02, len: 4.2, halfW: 1.7, h: 2.5 };
/** Log seats round the fire (angles). */
export const CAMP_SEATS = [0.6, 2.2, 3.9];
/** Boulder gardens to climb (centre + spread). */
export const BOULDER_GARDENS = [
  { x: -146, z: -20, r: 6 },
  { x: 116, z: -26, r: 6 },
];

type Sampled = { xs: number[]; zs: number[] };

export type Treehouse = {
  tree: { x: number; z: number; y: number };
  deck: { x: number; z: number; r: number; top: number };
  hut: { x: number; z: number; top: number };
  door: { x: number; z: number; y: number; yaw: number };
  /** spiral treads winding up round the trunk: centre, angle (x = cos a, z = sin a), tread top, ground */
  steps: { x: number; z: number; top: number; base: number; a: number }[];
  /** the spiral: centred on the trunk, treads span inner..outer radius, a landing joins the deck */
  spiral: { inner: number; outer: number; mid: number; dA: number; landing: { x: number; z: number; a: number } };
  /** deck railing: angles (around the deck centre) left open for the stairs */
  deckGap: { a: number; half: number };
};

type Forest = { trails: Sampled[]; treehouse: Treehouse; colliders: Collider[] };

let cached: Forest | null = null;

function sample(points: [number, number][], step: number): Sampled {
  const xs: number[] = [];
  const zs: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 0; k < n; k++) {
      // smooth corners with a little Catmull-Rom easing between neighbours
      const t = k / n;
      const [px, pz] = points[Math.max(0, i - 1)];
      const [qx, qz] = points[Math.min(points.length - 1, i + 2)];
      const t2 = t * t;
      const t3 = t2 * t;
      const cr = (p0: number, p1: number, p2: number, p3: number) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
      xs.push(cr(px, ax, bx, qx));
      zs.push(cr(pz, az, bz, qz));
    }
  }
  const last = points[points.length - 1];
  xs.push(last[0]);
  zs.push(last[1]);
  return { xs, zs };
}

export function getForest(): Forest {
  if (cached) return cached;
  const w = getWorld();
  const trails = FOREST_TRAILS.map((t) => sample(t, 0.8));

  // treehouse: a big tree, a raised deck on stilts beside it, a hut on the deck and stairs up
  const T = TREEHOUSE;
  const tree = { x: T.x, z: T.z, y: w.gridHeight(T.x, T.z) };
  const D = { x: T.x + 3.1, z: T.z };
  const g = w.gridHeight(D.x, D.z);
  const top = g + 4.6;
  const deck = { x: D.x, z: D.z, r: 2.7, top };
  const hut = { x: D.x + 0.5, z: D.z + 0.4, top: top + 2.5 };
  const door = { x: hut.x, z: hut.z - 1.45 - 0.55, y: top, yaw: Math.PI };
  // spiral staircase round the trunk. The deck sits on the +x side of the tree,
  // so the spiral winds through the other ~220° (never under the deck) and a
  // short landing at deck height joins the top tread to the deck edge.
  const SP = { inner: 1.6, outer: 3.6, mid: 2.6, dA: 0.28 };
  const A0 = 1.1;
  const at = (a: number, r: number) => ({ x: tree.x + Math.cos(a) * r, z: tree.z + Math.sin(a) * r });
  // even risers that land the bottom tread a comfortable step above the ground
  const foot = at(A0 + 14 * SP.dA, SP.mid);
  const RISE = (top - w.gridHeight(foot.x, foot.z)) / 14.6;
  const landing = { ...at(A0, SP.mid), a: A0 };
  const steps: Treehouse["steps"] = [];
  for (let k = 1; k < 30; k++) {
    const a = A0 + k * SP.dA;
    const c = at(a, SP.mid);
    const base = w.gridHeight(c.x, c.z);
    const st = top - k * RISE;
    if (st <= base + 0.1) break;
    steps.push({ ...c, top: st, base, a });
  }
  const deckGap = { a: Math.atan2(landing.z - D.z, landing.x - D.x), half: 0.42 };
  const colliders: Collider[] = [];
  colliders.push({ x: tree.x, z: tree.z, r: 1.15 });
  colliders.push({ x: deck.x, z: deck.z, r: deck.r, h: top - g, top });
  colliders.push({ x: hut.x, z: hut.z, r: 1.45, h: hut.top - g, top: hut.top });
  const RAIL = 1.05;
  const tread = (a: number, topY: number, wide = 1) => {
    const c = at(a, SP.mid);
    colliders.push(boxCollider(c.x, c.z, SP.outer - SP.inner, SP.mid * SP.dA * 1.15 * wide, -a, { h: topY - w.gridHeight(c.x, c.z), top: topY }));
  };
  // landing at deck height, then each tread
  tread(A0 - 0.06, top, 1.6);
  for (const s of steps) tread(s.a, s.top);
  // solid railings on both sides of every tread (and the landing) — they stop you stepping off
  const rails = [{ a: A0, top }, ...steps];
  rails.forEach((s, i) => {
    // leave the bottom two treads open on the outside: that's the way in
    for (const r of [SP.inner - 0.05, SP.outer + 0.05]) {
      if (r > SP.mid && i >= rails.length - 2) continue;
      const c = at(s.a, r);
      colliders.push(boxCollider(c.x, c.z, 0.16, r * SP.dA * 1.2, -s.a, { h: s.top + RAIL - w.gridHeight(c.x, c.z), top: s.top + RAIL }));
    }
  });
  // deck railing all round (solid), open at the stairs and where the trunk meets the deck
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a - deckGap.a), Math.cos(a - deckGap.a))) < deckGap.half) continue;
    const x = D.x + Math.cos(a) * (deck.r - 0.08);
    const z = D.z + Math.sin(a) * (deck.r - 0.08);
    if (Math.hypot(x - tree.x, z - tree.z) < 1.6) continue;
    colliders.push(boxCollider(x, z, 0.16, (Math.PI * 2 * deck.r) / 28 + 0.05, -a, { h: top + RAIL - w.gridHeight(x, z), top: top + RAIL }));
  }

  // campsite: tent, fire, log seats
  const C = CAMPSITE;
  // tent: the two sloping sides and the back wall are solid; the door end is open so you can walk in
  {
    const Tt = CAMP_TENT;
    const tx = C.x + Tt.x;
    const tz = C.z + Tt.z;
    // local x axis = (cos r, −sin r) for boxCollider; the group rotation-y = rot maps local x → (cos, −sin)
    const ax = { x: Math.cos(Tt.rot), z: -Math.sin(Tt.rot) };
    const az = { x: Math.sin(Tt.rot), z: Math.cos(Tt.rot) };
    for (const s of [-1, 1]) colliders.push(boxCollider(tx + ax.x * s * (Tt.halfW - 0.25), tz + ax.z * s * (Tt.halfW - 0.25), 0.3, Tt.len, Tt.rot));
    colliders.push(boxCollider(tx - az.x * Tt.len / 2, tz - az.z * Tt.len / 2, Tt.halfW * 2, 0.3, Tt.rot));
  }
  colliders.push({ x: C.x, z: C.z, r: 0.85 });
  for (const a of CAMP_SEATS) colliders.push(boxCollider(C.x + Math.cos(a) * 2.4, C.z + Math.sin(a) * 2.4, 1.6, 0.56, -a + Math.PI / 2, { h: 0.53 }));

  cached = { trails, treehouse: { tree, deck, hut, door, steps, spiral: { ...SP, landing }, deckGap }, colliders };
  return cached;
}

/** Distance to the nearest forest footpath (brute force — trails are short). */
export function trailDist(x: number, z: number) {
  let best = Infinity;
  for (const t of getForest().trails) {
    for (let i = 0; i < t.xs.length; i += 2) {
      const d = (t.xs[i] - x) ** 2 + (t.zs[i] - z) ** 2;
      if (d < best) best = d;
    }
  }
  return Math.sqrt(best);
}

/** Keep trees and bushes away from the treehouse and campsite clearings. */
export function inForestClearing(x: number, z: number, pad: number) {
  return Math.hypot(x - TREEHOUSE.x - 1.5, z - TREEHOUSE.z + 2) < 8 + pad || Math.hypot(x - CAMPSITE.x + 1, z - CAMPSITE.z) < 6.5 + pad;
}
