/**
 * Farm tractors at work: each one harvests its own plot. It drives the rows in
 * a serpentine (row, U-turn round the headland, next row back), then swings
 * round the edge and starts again — each lap from the other corner, so it
 * never just shuttles back and forth. Pure data + timing (tested).
 */
import type { Plot } from "./layout";

/** Plots (by index in getLayout().plots) that have a tractor harvesting them. */
export const TRACTOR_PLOTS = [1, 4, 7] as const;
/** Width the cutter header takes per pass (m) — also the row spacing. */
export const HEADER_W = 2.3;
/** Cruise speed (m/s). */
export const TRACTOR_SPEED = 2.6;
/** Seconds a harvested strip stays cut before it starts growing back, and how long regrowth takes. */
export const REGROW = { after: 45, takes: 12 };

export type Pose = { x: number; z: number; yaw: number; cutting: boolean };
export type Lap = { xs: number[]; zs: number[]; cut: boolean[]; s: number[]; length: number };

function addArc(L: { xs: number[]; zs: number[]; cut: boolean[] }, cx: number, cz: number, r: number, a0: number, a1: number) {
  const n = 10;
  for (let i = 1; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    L.xs.push(cx + Math.cos(a) * r);
    L.zs.push(cz + Math.sin(a) * r);
    L.cut.push(false);
  }
}

/**
 * One lap over the plot. `variant` 0..3 flips which corner it starts from
 * (left/right × near/far), so consecutive laps take different routes.
 */
export function tractorLap(p: Plot, variant: number): Lap {
  const flipX = variant & 1 ? -1 : 1;
  const flipZ = variant & 2 ? -1 : 1;
  const rows = Math.max(2, Math.floor(p.d / HEADER_W));
  const pad = (p.d - (rows - 1) * HEADER_W) / 2;
  const halfX = p.w / 2 + 0.6;
  const L = { xs: [] as number[], zs: [] as number[], cut: [] as boolean[] };
  const X = (lx: number) => p.x + lx * flipX;
  const Z = (lz: number) => p.z + lz * flipZ;
  for (let r = 0; r < rows; r++) {
    const lz = -p.d / 2 + pad + r * HEADER_W;
    const dir = r % 2 ? -1 : 1;
    // the row itself, sampled every metre
    const steps = Math.ceil((halfX * 2) / 1);
    for (let i = 0; i <= steps; i++) {
      const lx = -halfX * dir + ((halfX * 2 * i) / steps) * dir;
      L.xs.push(X(lx));
      L.zs.push(Z(lz));
      L.cut.push(Math.abs(lx) < p.w / 2 + 0.2);
    }
    // U-turn round the headland onto the next row
    if (r < rows - 1) {
      const cx = X(halfX * dir);
      const cz = Z(lz + HEADER_W / 2);
      const base = Math.atan2(Z(lz) - cz, X(halfX * dir) - cx);
      const end = Math.atan2(Z(lz + HEADER_W) - cz, X(halfX * dir) - cx);
      // turn outward (away from the plot)
      let a1 = end;
      const outward = Math.cos(base + Math.PI / 2) * (X(halfX * dir + dir) - cx) > 0 ? 1 : -1;
      while ((a1 - base) * outward <= 0) a1 += Math.PI * 2 * outward;
      if (Math.abs(a1 - base) > Math.PI * 1.01) a1 = base + Math.PI * outward;
      addArc(L, cx, cz, HEADER_W / 2, base, a1);
    }
  }
  const s = [0];
  for (let i = 1; i < L.xs.length; i++) s.push(s[i - 1] + Math.hypot(L.xs[i] - L.xs[i - 1], L.zs[i] - L.zs[i - 1]));
  return { ...L, s, length: s[s.length - 1] };
}

/** Append a headland transit (round the outside of the plot, never through the crop) to (tx, tz). */
function transit(p: Plot, L: Lap, tx: number, tz: number) {
  const ex = L.xs[L.xs.length - 1];
  const ez = L.zs[L.zs.length - 1];
  const sideX = p.w / 2 + 2.2;
  const ringZ = p.d / 2 + 1.8;
  const sx = Math.sign(ex - p.x) || 1;
  const tsx = Math.sign(tx - p.x) || 1;
  const pts: [number, number][] = [[p.x + sx * sideX, ez]];
  if (tsx !== sx) {
    const rz = p.z + (Math.sign(tz - p.z + (ez - p.z)) || 1) * ringZ;
    pts.push([p.x + sx * sideX, rz], [p.x + tsx * sideX, rz]);
  }
  pts.push([p.x + tsx * sideX, tz], [tx, tz]);
  for (const [x, z] of pts) {
    const px = L.xs[L.xs.length - 1];
    const pz = L.zs[L.zs.length - 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x - px, z - pz) / 1.2));
    for (let k = 1; k <= n; k++) {
      L.xs.push(px + ((x - px) * k) / n);
      L.zs.push(pz + ((z - pz) * k) / n);
      L.cut.push(false);
    }
  }
  L.s = [0];
  for (let i = 1; i < L.xs.length; i++) L.s.push(L.s[i - 1] + Math.hypot(L.xs[i] - L.xs[i - 1], L.zs[i] - L.zs[i - 1]));
  L.length = L.s[L.s.length - 1];
}

const lapCache = new WeakMap<Plot, Lap[]>();
/** The repeating cycle: four laps from different corners, joined by headland transits. */
export function tractorLaps(p: Plot) {
  let l = lapCache.get(p);
  if (!l) {
    l = [0, 3, 1, 2].map((v) => tractorLap(p, v));
    l.forEach((lap, i) => {
      const next = l![(i + 1) % l!.length];
      transit(p, lap, next.xs[0], next.zs[0]);
    });
    lapCache.set(p, l);
  }
  return l;
}

/** Where the tractor is at time `t` (s): position, heading (yaw, +z = 0) and whether the header is cutting. */
export function tractorPose(p: Plot, t: number, phase = 0): Pose {
  const all = tractorLaps(p);
  const total = all.reduce((a, l) => a + l.length, 0);
  let d = (((t + phase * 37) * TRACTOR_SPEED) % total + total) % total;
  let lap = all[0];
  for (const l of all) {
    if (d <= l.length) {
      lap = l;
      break;
    }
    d -= l.length;
  }
  let i = 1;
  while (i < lap.s.length - 1 && lap.s[i] < d) i++;
  const k = (d - lap.s[i - 1]) / Math.max(1e-6, lap.s[i] - lap.s[i - 1]);
  const x = lap.xs[i - 1] + (lap.xs[i] - lap.xs[i - 1]) * k;
  const z = lap.zs[i - 1] + (lap.zs[i] - lap.zs[i - 1]) * k;
  // look a little ahead for a smooth heading through the turns
  const j = Math.min(lap.xs.length - 1, i + 1);
  const yaw = Math.atan2(lap.xs[j] - lap.xs[i - 1], lap.zs[j] - lap.zs[i - 1]);
  return { x, z, yaw, cutting: lap.cut[i - 1] && lap.cut[i] };
}

/** Crop height factor (0.15 stubble → 1 full) given seconds since it was last cut (Infinity = never). */
export function cropGrowth(since: number) {
  if (since < REGROW.after) return 0.15;
  const k = Math.min(1, (since - REGROW.after) / REGROW.takes);
  return 0.15 + 0.85 * k * k * (3 - 2 * k);
}
