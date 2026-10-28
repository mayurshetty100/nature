/**
 * Seaside data: the timber seawalk along the southern beach (with a round
 * lookout deck and gazebo out over the water) and the icebergs where penguins
 * live. Pure data, built lazily; renderers and colliders read the same numbers.
 */
import { getWorld, rng, ROAD_HALF } from "./world";

export type WalkPoint = { x: number; z: number; y: number; nx: number; nz: number };
export type Seawalk = {
  points: WalkPoint[];
  halfWidth: number;
  /** lookout deck at the end of a short spur */
  lookout: { x: number; z: number; y: number; r: number; spur: WalkPoint[] };
};

export const WALK_HALF = 1.35;
export const WALK_RAIL = 1.0;

let walkCache: Seawalk | null = null;

/** Waterline radius along a ray from the island centre. */
function shoreRadius(a: number) {
  const w = getWorld();
  for (let r = 100; r < 260; r += 0.25) if (w.gridHeight(Math.cos(a) * r, Math.sin(a) * r) < 0.2) return r;
  return 200;
}

const deckHeight = (g: number) => Math.max(g + 0.42, 0.82);

export function getSeawalk(): Seawalk {
  if (walkCache) return walkCache;
  const w = getWorld();
  const A0 = -0.62;
  const A1 = -0.12;
  const raw: { a: number; r: number }[] = [];
  for (let a = A0; a <= A1; a += 0.004) raw.push({ a, r: shoreRadius(a) + 1.2 });
  // smooth the radius so the boardwalk curves gracefully
  const sm = raw.map((p, i) => {
    let s = 0;
    let n = 0;
    for (let k = -6; k <= 6; k++) {
      const q = raw[Math.min(raw.length - 1, Math.max(0, i + k))];
      s += q.r;
      n++;
    }
    return { a: p.a, r: s / n };
  });
  // resample every ~1 m
  const pts: { x: number; z: number }[] = [];
  let last: { x: number; z: number } | null = null;
  for (const p of sm) {
    const x = Math.cos(p.a) * p.r;
    const z = Math.sin(p.a) * p.r;
    if (!last || Math.hypot(x - last.x, z - last.z) >= 1) {
      // never across the main road / harbor pier
      if (w.nearestRoad(x, z, ROAD_HALF + 4).dist < ROAD_HALF + 3) continue;
      pts.push({ x, z });
      last = { x, z };
    }
  }
  const points: WalkPoint[] = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b.x - a.x;
    const tz = b.z - a.z;
    const l = Math.hypot(tx, tz) || 1;
    // normal pointing out to sea (away from the island centre)
    let nx = -tz / l;
    let nz = tx / l;
    if (nx * p.x + nz * p.z < 0) {
      nx = -nx;
      nz = -nz;
    }
    return { x: p.x, z: p.z, y: deckHeight(w.gridHeight(p.x, p.z)), nx, nz };
  });
  // gentle height smoothing so there are no steps
  for (let pass = 0; pass < 3; pass++)
    for (let i = 1; i < points.length - 1; i++) points[i].y = (points[i - 1].y + points[i].y * 2 + points[i + 1].y) / 4;

  const mid = points[Math.floor(points.length * 0.45)];
  const spur: WalkPoint[] = [];
  for (let k = 1; k <= 8; k++) spur.push({ x: mid.x + mid.nx * (WALK_HALF + k), z: mid.z + mid.nz * (WALK_HALF + k), y: mid.y, nx: mid.nx, nz: mid.nz });
  const end = spur[spur.length - 1];
  const r = 4.6;
  walkCache = {
    points,
    halfWidth: WALK_HALF,
    lookout: { x: end.x + mid.nx * (r - 0.5), z: end.z + mid.nz * (r - 0.5), y: mid.y, r, spur },
  };
  return walkCache;
}

export type LookoutChair = { x: number; z: number; /** facing out to sea */ yaw: number };
export type LookoutVase = { x: number; z: number; size: number; bloom: number };

let decorCache: { chairs: LookoutChair[]; vases: LookoutVase[] } | null = null;

/**
 * Lookout dressing: a ring of timber chairs round the gazebo facing the view,
 * with flower vases between them and along the rail (never in the spur opening).
 */
export function lookoutDecor() {
  if (decorCache) return decorCache;
  const L = getSeawalk().lookout;
  const end = L.spur[L.spur.length - 1];
  const spurA = Math.atan2(end.z - L.z, end.x - L.x);
  const chairs: LookoutChair[] = [];
  const vases: LookoutVase[] = [];
  const n = 6;
  const gap = 1.0;
  for (let k = 0; k < n; k++) {
    const a = spurA + gap + (k * (Math.PI * 2 - gap * 2)) / (n - 1);
    const rr = L.r - 1.35;
    chairs.push({ x: L.x + Math.cos(a) * rr, z: L.z + Math.sin(a) * rr, yaw: Math.atan2(Math.cos(a), Math.sin(a)) });
  }
  for (let k = 0; k < 12; k++) {
    const a = spurA + 0.55 + (k * (Math.PI * 2 - 1.1)) / 11;
    const rr = L.r - 0.45;
    vases.push({ x: L.x + Math.cos(a) * rr, z: L.z + Math.sin(a) * rr, size: k % 3 === 1 ? 1.25 : 1, bloom: k });
  }
  decorCache = { chairs, vases };
  return decorCache;
}

/** Distance from (x, z) to the seawalk centre line (or lookout), for keeping props off it. */
export function seawalkDist(x: number, z: number) {
  const s = getSeawalk();
  let d = Infinity;
  for (const p of s.points) d = Math.min(d, Math.hypot(p.x - x, p.z - z));
  for (const p of s.lookout.spur) d = Math.min(d, Math.hypot(p.x - x, p.z - z));
  d = Math.min(d, Math.max(0, Math.hypot(s.lookout.x - x, s.lookout.z - z) - s.lookout.r));
  return d;
}

export type Iceberg = { x: number; z: number; r: number; top: number; seed: number };

/** Icebergs drifting off the south-east coast — penguin country. */
export const ICEBERGS: Iceberg[] = [
  { x: 212, z: -118, r: 7.5, top: 1.7, seed: 1 },
  { x: 236, z: -96, r: 5.5, top: 1.5, seed: 2 },
  { x: 198, z: -146, r: 6.2, top: 1.9, seed: 3 },
  { x: 228, z: -136, r: 3.6, top: 1.2, seed: 4 },
];

export type IcePeak = { x: number; z: number; r: number; h: number; /** cone centre height */ y: number };

const peakCache = new Map<number, IcePeak[]>();
/** The jagged ice peaks on top of an iceberg (renderer, colliders and penguins share them). */
export function icebergPeaks(b: Iceberg): IcePeak[] {
  const hit = peakCache.get(b.seed);
  if (hit) return hit;
  const r = rng(b.seed * 97);
  const out: IcePeak[] = [];
  for (let k = 0; k < 3; k++) {
    const a = r() * Math.PI * 2;
    const pr = b.r * (0.22 + r() * 0.14);
    const h = 2.2 + r() * 2.6;
    out.push({ x: b.x + Math.cos(a) * b.r * 0.62, z: b.z + Math.sin(a) * b.r * 0.62, r: pr, h, y: b.top + 1.0 });
  }
  peakCache.set(b.seed, out);
  return out;
}

/** How far a penguin standing on an iceberg's top keeps from the peaks and the rim. */
export function penguinSpot(b: Iceberg, x: number, z: number, clearance = 0.45) {
  let px = x;
  let pz = z;
  for (let pass = 0; pass < 2; pass++)
    for (const p of icebergPeaks(b)) {
      const dx = px - p.x;
      const dz = pz - p.z;
      const d = Math.hypot(dx, dz) || 1e-3;
      // radius of the cone's footprint at the iceberg top
      const foot = p.r * Math.min(1, (p.y + p.h / 2 - b.top) / p.h) + clearance;
      if (d < foot) {
        px = p.x + (dx / d) * foot;
        pz = p.z + (dz / d) * foot;
      }
    }
  // stay on the flat top
  const dx = px - b.x;
  const dz = pz - b.z;
  const d = Math.hypot(dx, dz);
  const lim = b.r * 0.8;
  if (d > lim) {
    px = b.x + (dx / d) * lim;
    pz = b.z + (dz / d) * lim;
  }
  return { x: px, z: pz };
}

/** The beach-side rail has an opening every ~18 m and at both ends so you can step on and off. */
export function beachRailOpen(i: number, n: number) {
  return i < 3 || i > n - 4 || i % 18 < 4;
}

/** No sea-side rail where the spur to the lookout leaves the walk. */
export function spurGap(p: { x: number; z: number }) {
  const sp = getSeawalk().lookout.spur[0];
  return Math.hypot(p.x - sp.x, p.z - sp.z) < WALK_HALF + 1.6;
}

/**
 * Solid parts of the seaside: deck support discs you walk on, rails along both
 * edges (with openings on the beach side so you can step on and off) and the
 * icebergs' flat tops. `top` is absolute height.
 */
export function coastColliders() {
  const out: { x: number; z: number; r: number; h: number; top: number }[] = [];
  const s = getSeawalk();
  const n = s.points.length;
  s.points.forEach((p, i) => {
    out.push({ x: p.x, z: p.z, r: WALK_HALF + 0.05, h: 1, top: p.y });
    // rails: sea side always, beach side with an opening every ~18 m and at both ends
    const opening = beachRailOpen(i, n);
    for (const side of opening ? [1] : [1, -1]) {
      if (side === 1 && spurGap(p)) continue;
      out.push({ x: p.x + p.nx * (WALK_HALF + 0.05) * side, z: p.z + p.nz * (WALK_HALF + 0.05) * side, r: 0.14, h: 1, top: p.y + WALK_RAIL });
    }
  });
  for (const p of s.lookout.spur) out.push({ x: p.x, z: p.z, r: 1.25, h: 1, top: p.y });
  const L = s.lookout;
  for (let gx = -L.r + 0.8; gx <= L.r - 0.8; gx += 1.3)
    for (let gz = -L.r + 0.8; gz <= L.r - 0.8; gz += 1.3) if (Math.hypot(gx, gz) < L.r - 0.6) out.push({ x: L.x + gx, z: L.z + gz, r: 1.0, h: 1, top: L.y });
  // lookout railing (open toward the spur)
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    const x = L.x + Math.cos(a) * (L.r - 0.1);
    const z = L.z + Math.sin(a) * (L.r - 0.1);
    if (Math.hypot(x - L.spur[L.spur.length - 1].x, z - L.spur[L.spur.length - 1].z) < 2) continue;
    out.push({ x, z, r: 0.14, h: 1, top: L.y + WALK_RAIL });
  }
  // flower vases on the lookout are solid
  for (const v of lookoutDecor().vases) out.push({ x: v.x, z: v.z, r: 0.28 * v.size, h: 1, top: L.y + 0.75 * v.size });
  for (const b of ICEBERGS) {
    // the ice peaks are solid (climbable only with a big jump)
    for (const p of icebergPeaks(b)) out.push({ x: p.x, z: p.z, r: p.r * 0.75, h: 1, top: p.y + p.h / 2 });
    for (let gx = -b.r; gx <= b.r; gx += 1.4)
      for (let gz = -b.r; gz <= b.r; gz += 1.4) if (Math.hypot(gx, gz) < b.r * 0.82) out.push({ x: b.x + gx, z: b.z + gz, r: 1.0, h: 1, top: b.top });
  }
  return out;
}
