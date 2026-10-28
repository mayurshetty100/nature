import { getWorld } from "./world";
import { STOP_BY_ID } from "./stops";
import { boxColliders } from "./layout";
import { boxCollider, type Collider } from "./scatter";

/** City of Giants skyline around its plaza: x, z, width, height, facade texture. */
export const CITY_GIANTS: [number, number, number, number, number][] = [
  [0, -1, 5.4, 34, 0],
  [-7, 3.5, 4.4, 24, 1],
  [6.5, -3, 4.6, 28, 2],
  [-3, -7.5, 4, 19, 1],
  [5.5, 6, 4, 16, 0],
  [-7.5, -4.5, 3.6, 14, 2],
];

/**
 * Which face of skyscraper i holds its lobby door: the face looking toward the
 * plaza centre (the first tower looks toward the road stop). Axis-aligned unit vector.
 */
export function giantDoorDir(i: number): [number, number] {
  const c = STOP_BY_ID.city;
  const [x, z] = CITY_GIANTS[i];
  const tx = i === 0 ? c.x - (c.lx + x) : -x;
  const tz = i === 0 ? c.z - (c.lz + z) : -z;
  return Math.abs(tx) > Math.abs(tz) ? [Math.sign(tx) || 1, 0] : [0, Math.sign(tz) || 1];
}

/** The castle courtyard's outer step (local size; top above the group floor). */
export const ACADEMY_STEP = { w: 22.6, d: 18.6, top: 0.4 };

/** Solid footprints of the landmarks: walls block, floors and platforms can be stood on. */
export function landmarkColliders() {
  const out: Collider[] = [];
  const w = getWorld();
  // gate posts
  {
    const g = STOP_BY_ID.gate;
    const { index } = w.nearestRoad(g.x, g.z, 20);
    const j = Math.min(w.road.count - 1, index + 3);
    const k = Math.max(0, index - 3);
    const tx = w.road.xs[j] - w.road.xs[k];
    const tz = w.road.zs[j] - w.road.zs[k];
    const l = Math.hypot(tx, tz) || 1;
    const nx = tz / l;
    const nz = -tx / l;
    for (const s of [-1, 1]) out.push({ x: w.road.xs[index] + nx * 3.4 * s, z: w.road.zs[index] + nz * 3.4 * s, r: 1.1 });
  }
  // academy: a raised stone courtyard you walk up onto (one step, then the floor),
  // solid curtain walls, corner towers, the main hall and the clock tower
  {
    const a = STOP_BY_ID.academy;
    const yaw = Math.atan2(a.x - a.lx, a.z - a.lz);
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    const local = (x: number, z: number) => ({ x: a.lx + x * c + z * sn, z: a.lz - x * sn + z * c });
    const base = w.gridHeight(a.lx, a.lz) - 0.2; // the group's floor level
    const box = (x: number, z: number, wd: number, d: number, top: number) => {
      const p = local(x, z);
      return boxCollider(p.x, p.z, wd, d, yaw, { h: 1, top: base + top });
    };
    out.push(box(0, 0, ACADEMY_STEP.w, ACADEMY_STEP.d, ACADEMY_STEP.top));
    out.push(box(0, 0, 21, 17, 0.8));
    for (const wl of [
      [0, -7, 18, 1.2],
      [-9, 0, 1.2, 14],
      [9, 0, 1.2, 14],
      [-6, 7, 6, 1.2],
      [6, 7, 6, 1.2],
    ])
      out.push(box(wl[0], wl[1], wl[2], wl[3], 4.0));
    for (const [x, z] of [
      [-9, -7],
      [9, -7],
      [-9, 7],
      [9, 7],
    ])
      out.push({ ...local(x, z), r: 1.8, h: 1, top: base + 6.8 });
    out.push(box(0, -2, 12, 6, 6.4));
    out.push(box(0, 1, 3, 3, 13.5));
  }
  // every landmark has a height, so you can land on top when you fly or jump high enough
  const c = STOP_BY_ID.city;
  for (const [x, z, wd, ht] of CITY_GIANTS) out.push(boxCollider(c.lx + x, c.lz + z, wd, wd, 0, { h: ht }));
  const f = STOP_BY_ID.forest;
  out.push({ x: f.lx, z: f.lz, r: 4.2, h: 3.7 });
  const s = STOP_BY_ID.skills;
  out.push({ x: s.lx, z: s.lz, r: 2, h: 3 });
  const p = STOP_BY_ID.peak;
  out.push({ x: p.lx, z: p.lz, r: 2.6, h: 1.6 });
  const v = STOP_BY_ID.cove;
  out.push({ x: v.lx, z: v.lz, r: 2.8, h: 16 });
  // keeper's cottage beside the lighthouse
  out.push(...boxColliders(v.lx - 5.2, v.lz - 2.5, 4.2, 3.6, 0.5).map((b) => ({ ...b, h: 3.6 })));
  return out;
}
