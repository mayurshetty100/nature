/**
 * Chill spots: rooftop sun loungers and the seaside benches. Walk up, press the
 * action button, and the explorer leans back with a juice and sips while the
 * camera opens up the view. Pure data, built lazily.
 */
import { getRoofs, towerToWorld } from "./roofs";
import { getLayout } from "./layout";
import { getSeawalk, lookoutDecor } from "./coast";
import { getSwing } from "./swing";

export type ChillSpot = {
  kind: "lounger" | "bench" | "swing";
  /** where the explorer sits (feet / seat base) */
  x: number;
  y: number;
  z: number;
  /** facing the view */
  yaw: number;
  /** where you step back up */
  standX: number;
  standZ: number;
};

/**
 * Sun-lounger shape (lounger-local: u along its length, +u = foot end).
 * The explorer's hips sit in the crease, the back lies on the raised backrest
 * and the legs stretch flat along the seat — the renderer and the pose share it.
 */
export const LOUNGER = {
  /** crease between seat and backrest (u) */
  crease: -0.05,
  /** seat cushion top height */
  seat: 0.36,
  /** backrest angle up from flat (rad) */
  back: 0.5,
  /** backrest length from the crease */
  backLen: 1.0,
  /** seat length from the crease to the foot end */
  seatLen: 1.0,
  width: 0.72,
};

/** How often a sip comes round while chilling (s), and how long the sip lasts. */
export const SIP = { every: 5.5, lasts: 1.6 };

/** 0 → 1 → 0 arm raise for a sip, `t` seconds after sitting down. */
export function sipWeight(t: number) {
  if (t < 1.2) return 0;
  const k = ((t - 1.2) % SIP.every) / SIP.lasts;
  if (k >= 1) return 0;
  return Math.sin(k * Math.PI);
}

let cache: ChillSpot[] | null = null;

export function getChillSpots(): ChillSpot[] {
  if (cache) return cache;
  const out: ChillSpot[] = [];
  const { towers } = getLayout();
  for (const r of getRoofs()) {
    const t = towers[r.tower];
    const o = towerToWorld(t, 0, 0);
    const ax = towerToWorld(t, 1, 0);
    // loungers face local +x (the backrest is at -x), toward the roof edge and the view
    const yaw = Math.atan2(ax.x - o.x, ax.z - o.z);
    for (const pr of r.props) {
      if (pr.kind !== "lounger") continue;
      const p = towerToWorld(t, pr.lx + LOUNGER.crease, pr.lz);
      const s = towerToWorld(t, pr.lx - 0.2, pr.lz + (pr.lz < 0 ? -0.95 : 0.95));
      out.push({ kind: "lounger", x: p.x, y: r.y, z: p.z, yaw, standX: s.x, standZ: s.z });
    }
  }
  // seaside benches (same rule as the renderer: every 24th walk point from the 12th)
  const sw = getSeawalk();
  sw.points.forEach((p, i) => {
    if (i % 24 !== 12) return;
    out.push({ kind: "bench", x: p.x - p.nx * 0.5, y: p.y, z: p.z - p.nz * 0.5, yaw: Math.atan2(p.nx, p.nz), standX: p.x + p.nx * 0.4, standZ: p.z + p.nz * 0.4 });
  });
  // the chairs round the lookout gazebo
  const L = sw.lookout;
  for (const c of lookoutDecor().chairs) {
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    out.push({ kind: "bench", x: c.x, y: L.y, z: c.z, yaw: c.yaw, standX: c.x + fx * 0.75, standZ: c.z + fz * 0.75 });
  }
  // the rope swing by the treehouse (seat ~0.45 above the explorer's feet when sitting)
  const sw2 = getSwing();
  out.push({ kind: "swing", x: sw2.px, y: sw2.seatY - 0.45, z: sw2.pz, yaw: sw2.yaw, standX: sw2.px + 0.9, standZ: sw2.pz });
  cache = out;
  return out;
}

/** The chill spot within reach of someone standing at (x, y, z). */
export function nearestChill(x: number, y: number, z: number, reach = 1.5): ChillSpot | null {
  let best: ChillSpot | null = null;
  let bd = reach;
  for (const s of getChillSpots()) {
    if (Math.abs(y - s.y) > 0.9) continue;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}
