/**
 * Hand-planned and road-following placements for the built-up parts of the
 * world: farm plots, the pasture, village houses, city blocks and beach palms.
 * Pure data, built lazily once from the world geometry.
 */
import { STOPS, STOP_BY_ID, type StopId } from "./stops";
import { beachWeight, getWorld, islandDist, rng, RIVER_HALF, ROAD_HALF } from "./world";
import { ZONE_BY_ID } from "./zones";
import { seawalkDist } from "./coast";

export type CropKind = "wheat" | "corn" | "leafs" | "pumpkin" | "dirt";
/** Axis-aligned field plot (centre + size), planted in rows along x. */
export type Plot = { x: number; z: number; w: number; d: number; crop: CropKind };

export type Building = {
  model: string;
  x: number;
  z: number;
  /** yaw so the building's front (+Z) faces the street */
  rot: number;
  scale: number;
  /** collider radius */
  r: number;
};

export type Tower = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  rot: number;
  palette: number;
  /** the street lies along local +x * side */
  side: number;
  /** 0 apartment block · 1 glass tower · 2 shop/café with awning */
  kind: 0 | 1 | 2;
};

export type Palm = { x: number; z: number; h: number; lean: number; rot: number };

type Layout = {
  plots: Plot[];
  paddock: { x: number; z: number; w: number; d: number };
  barn: { x: number; z: number; rot: number };
  village: Building[];
  plaza: { x: number; z: number; r: number };
  towers: Tower[];
  palms: Palm[];
};

let cached: Layout | null = null;

function plotGrid(cx: number, cz: number, cols: number, rows: number, w: number, d: number, gap: number, crops: CropKind[]): Plot[] {
  const out: Plot[] = [];
  const tw = cols * w + (cols - 1) * gap;
  const td = rows * d + (rows - 1) * gap;
  let k = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      out.push({ x: cx - tw / 2 + w / 2 + c * (w + gap), z: cz - td / 2 + d / 2 + r * (d + gap), w, d, crop: crops[k++ % crops.length] });
    }
  return out;
}

export function getLayout(): Layout {
  if (cached) return cached;
  const w = getWorld();
  const rand = rng(4242);

  // Golden Fields: a patchwork of planted plots
  const plots = [
    ...plotGrid(-6, 56, 3, 2, 13, 10, 3.5, ["wheat", "corn", "leafs", "pumpkin", "wheat", "dirt"]),
    ...plotGrid(14, -18, 2, 2, 10, 8, 3, ["corn", "wheat", "leafs", "wheat"]),
  ];
  const pz = ZONE_BY_ID.pasture;
  const paddock = { x: pz.x - 2, z: pz.z, w: 20, d: 14 };
  const barn = { x: pz.x + 14, z: pz.z - 2, rot: -Math.PI / 2 };

  // Maple Village: houses face the street, a ring of houses around the plaza
  const skills = STOP_BY_ID.skills;
  const plaza = { x: skills.lx, z: skills.lz, r: 9 };
  const village: Building[] = [];
  const houseModels = ["House_1", "House_2", "House_3", "Inn", "House_2", "House_1", "House_3", "House_2"];
  const sizes: Record<string, { s: number; r: number }> = {
    House_1: { s: 2.6, r: 3.6 },
    House_2: { s: 2.5, r: 4 },
    House_3: { s: 3.2, r: 3.8 },
    House_4: { s: 3.2, r: 3.6 },
    Inn: { s: 2.2, r: 5 },
    Mill: { s: 2.2, r: 4.6 },
    Bell_Tower: { s: 2.8, r: 3.4 },
    Stable: { s: 2.4, r: 4.2 },
  };
  const free = (x: number, z: number, r: number) => {
    if (w.nearestRoad(x, z, r + ROAD_HALF + 3).dist < r + ROAD_HALF + 1.5) return false;
    if (w.nearestRiver(x, z, r + RIVER_HALF + 3).dist < r + RIVER_HALF + 1.5) return false;
    if (islandDist(x, z) > 0.86) return false;
    if (STOPS.some((s) => Math.hypot(s.lx - x, s.lz - z) < s.clear + r - 2)) return false;
    return !village.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + r + 1.5);
  };
  const addBuilding = (model: string, x: number, z: number, faceX: number, faceZ: number) => {
    const sz = sizes[model];
    if (!free(x, z, sz.r)) return false;
    village.push({ model, x, z, rot: Math.atan2(faceX - x, faceZ - z), scale: sz.s, r: sz.r });
    return true;
  };
  // around the plaza
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + 0.3;
    const rr = plaza.r + 7.5;
    addBuilding(k === 4 ? "Bell_Tower" : houseModels[k % houseModels.length], plaza.x + Math.cos(a) * rr, plaza.z + Math.sin(a) * rr, plaza.x, plaza.z);
  }
  // along the village street (both sides)
  {
    let n = 0;
    for (let i = 0; i < w.road.count; i += 22) {
      const rg = w.roadRegion[i];
      if (rg !== 3 && !(rg === 2 && w.road.cum[i] > 225)) continue;
      const j = Math.min(w.road.count - 1, i + 2);
      const tx = w.road.xs[j] - w.road.xs[i];
      const tz = w.road.zs[j] - w.road.zs[i];
      const l = Math.hypot(tx, tz) || 1;
      for (const side of [-1, 1]) {
        const off = ROAD_HALF + 8;
        const x = w.road.xs[i] + (-tz / l) * off * side;
        const z = w.road.zs[i] + (tx / l) * off * side;
        addBuilding(houseModels[(n++ + 3) % houseModels.length], x, z, w.road.xs[i], w.road.zs[i]);
      }
    }
  }
  // windmill-side farmhouse + mill near the fields
  addBuilding("House_3", -28, 40, -20, 30);
  addBuilding("Mill", 28, 0, 20, 12);

  // City of Giants: blocks lining the avenue, taller toward the centre
  const towers: Tower[] = [];
  const city = STOP_BY_ID.city;
  const cityFree = (x: number, z: number, half: number) => {
    if (w.nearestRoad(x, z, half + ROAD_HALF + 6).dist < half + ROAD_HALF + 3) return false;
    if (cityLoopDist(x, z) < half * 1.2 + CITY_ROAD_HALF + 2.6) return false;
    if (Math.hypot(x - city.lx, z - city.lz) < city.clear + half) return false;
    if (Math.hypot(x - city.x, z - city.z) < 6 + half) return false;
    // leave open countryside between the village and the city
    if (x < 82) return false;
    if (islandDist(x, z) > 0.84 || w.gridHeight(x, z) < 1.4) return false;
    return !towers.some((t) => Math.abs(t.x - x) < (t.w + half * 2) / 2 + 2 && Math.abs(t.z - z) < (t.d + half * 2) / 2 + 2);
  };
  for (let i = 0; i < w.road.count; i += 14) {
    if (w.roadRegion[i] !== 4) continue;
    const j = Math.min(w.road.count - 1, i + 2);
    const tx = w.road.xs[j] - w.road.xs[i];
    const tz = w.road.zs[j] - w.road.zs[i];
    const l = Math.hypot(tx, tz) || 1;
    const rot = Math.atan2(tx, tz);
    for (const side of [-1, 1]) {
      for (const row of [0, 1]) {
        const bw = 7 + rand() * 3;
        const bd = 7 + rand() * 3;
        const half = Math.max(bw, bd) / 2;
        const off = ROAD_HALF + 4.5 + half + row * 13;
        const x = w.road.xs[i] + (-tz / l) * off * side;
        const z = w.road.zs[i] + (tx / l) * off * side;
        if (!cityFree(x, z, half)) continue;
        const centre = 1 - Math.min(1, Math.hypot(x - 108, z - 28) / 40);
        const kind: Tower["kind"] = row === 0 && rand() < 0.3 ? 2 : centre > 0.4 && rand() < 0.55 ? 1 : 0;
        const h = kind === 2 ? 5 + rand() * 2 : 9 + centre * 20 + rand() * 7 + row * 4;
        towers.push({ x, z, w: bw, d: bd, h, rot, palette: Math.floor(rand() * 6), kind, side });
      }
    }
  }
  // back streets: fill the rest of the city block grid
  {
    const cz = ZONE_BY_ID.city;
    for (let gx = cz.x - cz.r - 6; gx <= cz.x + cz.r + 6; gx += 11) {
      for (let gz = cz.z - cz.r - 6; gz <= cz.z + cz.r + 6; gz += 11) {
        const x = gx + (rand() - 0.5) * 2;
        const z = gz + (rand() - 0.5) * 2;
        if (Math.hypot(x - cz.x, z - cz.z) > cz.r + 6) continue;
        const bw = 7 + rand() * 2.5;
        const bd = 7 + rand() * 2.5;
        const half = Math.max(bw, bd) / 2;
        if (!cityFree(x, z, half)) continue;
        const near = w.nearestRoad(x, z, 80);
        const i = Math.max(0, near.index);
        const j = Math.min(w.road.count - 1, i + 2);
        const rot = Math.atan2(w.road.xs[j] - w.road.xs[i], w.road.zs[j] - w.road.zs[i]);
        const lx = Math.cos(rot);
        const lz = -Math.sin(rot);
        const side = (w.road.xs[i] - x) * lx + (w.road.zs[i] - z) * lz > 0 ? 1 : -1;
        const centre = 1 - Math.min(1, Math.hypot(x - 108, z - 28) / 40);
        const kind: Tower["kind"] = centre > 0.4 && rand() < 0.55 ? 1 : 0;
        towers.push({ x, z, w: bw, d: bd, h: 10 + centre * 22 + rand() * 8, rot, palette: Math.floor(rand() * 6), kind, side });
      }
    }
  }

  // Sunset Harbor: palms along the sand
  const palms: Palm[] = [];
  for (let n = 0; n < 900 && palms.length < 34; n++) {
    const x = 120 + rand() * 60;
    const z = -60 + rand() * 120;
    if (beachWeight(x, z) < 0.6) continue;
    const h = w.gridHeight(x, z);
    if (h < 0.9 || h > 3.2) continue;
    if (w.nearestRoad(x, z, 8).dist < ROAD_HALF + 2.5) continue;
    if (cityLoopDist(x, z) < CITY_ROAD_HALF + 3) continue;
    if (STOPS.some((s) => Math.hypot(s.lx - x, s.lz - z) < s.clear + 1)) continue;
    if (palms.some((p) => Math.hypot(p.x - x, p.z - z) < 6)) continue;
    if (seawalkDist(x, z) < 3.5) continue;
    if (towers.some((t) => Math.hypot(t.x - x, t.z - z) < Math.max(t.w, t.d) / 2 + 3)) continue;
    palms.push({ x, z, h: 6 + rand() * 3, lean: 0.12 + rand() * 0.22, rot: rand() * Math.PI * 2 });
  }

  cached = { plots, paddock, barn, village, plaza, towers, palms };
  return cached;
}

/**
 * Village building shells measured from the models (model units, before
 * scale): x/z extents of the walls, overall height, the eave height where the
 * roof starts, and which local axis the roof ridge runs along.
 */
export const BUILDING_SHELL: Record<string, { x0: number; x1: number; z0: number; z1: number; h: number; eave: number; ridge: "x" | "z" }> = {
  House_1: { x0: -1.07, x1: 1.07, z0: -1.34, z1: 1.32, h: 3.39, eave: 1.75, ridge: "z" },
  House_2: { x0: -1.11, x1: 1.1, z0: -2.07, z1: 1.35, h: 3.25, eave: 1.7, ridge: "z" },
  House_3: { x0: -0.98, x1: 0.96, z0: -1.06, z1: 1.07, h: 2.09, eave: 1.15, ridge: "x" },
  House_4: { x0: -0.97, x1: 0.97, z0: -1.06, z1: 1.07, h: 1.07, eave: 0.62, ridge: "x" },
  Inn: { x0: -2.02, x1: 2.01, z0: -2.01, z1: 2.01, h: 3.49, eave: 1.9, ridge: "x" },
  Mill: { x0: -1.69, x1: 1.7, z0: -1.34, z1: 1.39, h: 4.8, eave: 2.4, ridge: "x" },
  Bell_Tower: { x0: -0.97, x1: 0.97, z0: -1.13, z1: 1.1, h: 4.76, eave: 3.4, ridge: "x" },
  Stable: { x0: -3.66, x1: 1.04, z0: -1.28, z1: 2.05, h: 2.47, eave: 1.3, ridge: "x" },
};

/** World footprint of a scaled, rotated village building shell (centre, size, roof). */
export function shellFootprint(model: string, x: number, z: number, scale: number, rot: number) {
  const sh = BUILDING_SHELL[model];
  if (!sh) return null;
  const cx = ((sh.x0 + sh.x1) / 2) * scale;
  const cz = ((sh.z0 + sh.z1) / 2) * scale;
  // model offset rotated like the instance (three.js Y rotation)
  const wx = x + cx * Math.cos(rot) + cz * Math.sin(rot);
  const wz = z - cx * Math.sin(rot) + cz * Math.cos(rot);
  return { x: wx, z: wz, w: (sh.x1 - sh.x0) * scale, d: (sh.z1 - sh.z0) * scale, rot, h: sh.h * scale, eave: sh.eave * scale, ridge: sh.ridge };
}

/** One oriented box footprint (see `Collider` in scatter.ts; r = bounding radius). */
export function boxColliders(x: number, z: number, w: number, d: number, rot: number) {
  return [{ x, z, r: Math.hypot(w, d) / 2, hw: w / 2, hd: d / 2, rot }];
}

/** The city ring road: a rounded rectangle traffic drives round and round. */
export const CITY_LOOP = { x: 108, z: 34, rx: 26, rz: 20 };
/** Half width of the ring road's asphalt (two lanes). */
export const CITY_ROAD_HALF = 3.6;
/** Lane centre offset from the ring road's centre line. */
export const CITY_LANE = 1.75;

export type Loop = { xs: Float32Array; zs: Float32Array; cum: Float32Array; length: number; count: number };
let loopCache: Loop | null = null;

/** Ring road centre line, evenly spaced (~0.5 apart), closed (last sample joins the first). */
export function getCityLoop(): Loop {
  if (loopCache) return loopCache;
  const L = CITY_LOOP;
  const dense: [number, number][] = [];
  const P = 4;
  for (let i = 0; i < 2000; i++) {
    const a = (i / 2000) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    dense.push([L.x + L.rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / P), L.z + L.rz * Math.sign(s) * Math.pow(Math.abs(s), 2 / P)]);
  }
  let total = 0;
  const dcum = [0];
  for (let i = 1; i <= dense.length; i++) {
    const [ax, az] = dense[i - 1];
    const [bx, bz] = dense[i % dense.length];
    total += Math.hypot(bx - ax, bz - az);
    dcum.push(total);
  }
  const count = Math.round(total / 0.5);
  const xs = new Float32Array(count);
  const zs = new Float32Array(count);
  const cum = new Float32Array(count);
  let j = 0;
  for (let k = 0; k < count; k++) {
    const target = (k / count) * total;
    while (dcum[j + 1] < target) j++;
    const t = (target - dcum[j]) / Math.max(1e-6, dcum[j + 1] - dcum[j]);
    const [ax, az] = dense[j];
    const [bx, bz] = dense[(j + 1) % dense.length];
    xs[k] = ax + (bx - ax) * t;
    zs[k] = az + (bz - az) * t;
    cum[k] = target;
  }
  loopCache = { xs, zs, cum, length: total, count };
  return loopCache;
}

/** Distance from a point to the ring road's centre line. */
export function cityLoopDist(x: number, z: number) {
  const L = CITY_LOOP;
  // quick reject far from the ring
  if (Math.abs(x - L.x) > L.rx + 30 || Math.abs(z - L.z) > L.rz + 30) return Infinity;
  const lp = getCityLoop();
  let best = Infinity;
  for (let i = 0; i < lp.count; i += 2) {
    const d = (lp.xs[i] - x) ** 2 + (lp.zs[i] - z) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/** Position + heading on the ring at arc length `s` (wraps), offset sideways by `lane`. */
export function loopPose(s: number, lane: number) {
  const lp = getCityLoop();
  const u = (((s % lp.length) + lp.length) % lp.length) / 0.5;
  const i = Math.floor(u) % lp.count;
  const j = (i + 1) % lp.count;
  const t = u - Math.floor(u);
  const tx = lp.xs[j] - lp.xs[i];
  const tz = lp.zs[j] - lp.zs[i];
  const l = Math.hypot(tx, tz) || 1;
  const nx = -tz / l;
  const nz = tx / l;
  return {
    x: lp.xs[i] + tx * t + nx * lane,
    z: lp.zs[i] + tz * t + nz * lane,
    yaw: Math.atan2(tx, tz),
  };
}

/** True when (x, z) is at least `pad` beyond the edge of both the main road and the city ring road. */
export function clearOfRoads(x: number, z: number, pad: number) {
  const w = getWorld();
  if (w.nearestRoad(x, z, ROAD_HALF + pad + 2).dist < ROAD_HALF + pad) return false;
  return cityLoopDist(x, z) >= CITY_ROAD_HALF + pad;
}

/** True when (x, z) is inside (or within `pad` of) a city block footprint. */
export function inTower(x: number, z: number, pad: number) {
  for (const t of getLayout().towers) {
    const dx = x - t.x;
    const dz = z - t.z;
    const c = Math.cos(t.rot);
    const s = Math.sin(t.rot);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) < t.w / 2 + pad && Math.abs(lz) < t.d / 2 + pad) return true;
  }
  return false;
}

export type Lamp = { x: number; y: number; z: number };
let lampCache: Lamp[] | null = null;

/**
 * Lantern posts: alternating sides along the main road (both sides in the city) and
 * round the outer sidewalk of the ring road. Every post stands clear of every road.
 */
export function getLamps(): Lamp[] {
  if (lampCache) return lampCache;
  const w = getWorld();
  const r = w.road;
  const out: Lamp[] = [];
  const tryAdd = (x: number, z: number) => {
    if (!clearOfRoads(x, z, 0.45)) return;
    if (inTower(x, z, 0.6)) return;
    if (getLayout().village.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + 0.8)) return;
    if (out.some((l) => (l.x - x) ** 2 + (l.z - z) ** 2 < 36)) return;
    out.push({ x, y: w.gridHeight(x, z), z });
  };
  let side = 1;
  for (let i = 20; i < r.count; i += 44) {
    if (w.deck[i] > 0.01 || w.pier[i]) continue;
    const j = Math.min(r.count - 1, i + 1);
    const k = Math.max(0, j - 1);
    const tx = r.xs[j] - r.xs[k];
    const tz = r.zs[j] - r.zs[k];
    const l = Math.hypot(tx, tz) || 1;
    const nx = -tz / l;
    const nz = tx / l;
    if (w.roadRegion[i] === 4) {
      for (const sd of [-1, 1]) tryAdd(r.xs[i] + nx * (ROAD_HALF + 1.4) * sd, r.zs[i] + nz * (ROAD_HALF + 1.4) * sd);
      continue;
    }
    tryAdd(r.xs[i] + nx * (ROAD_HALF + 0.9) * side, r.zs[i] + nz * (ROAD_HALF + 0.9) * side);
    side *= -1;
  }
  // ring road: outer sidewalk, every ~22 m
  const lp = getCityLoop();
  const step = Math.round(22 / 0.5);
  for (let i = 0; i < lp.count; i += step) {
    const j = (i + 1) % lp.count;
    const tx = lp.xs[j] - lp.xs[i];
    const tz = lp.zs[j] - lp.zs[i];
    const l = Math.hypot(tx, tz) || 1;
    let nx = -tz / l;
    let nz = tx / l;
    // point the normal away from the ring's centre
    if (nx * (lp.xs[i] - CITY_LOOP.x) + nz * (lp.zs[i] - CITY_LOOP.z) < 0) {
      nx = -nx;
      nz = -nz;
    }
    tryAdd(lp.xs[i] + nx * (CITY_ROAD_HALF + 1.05), lp.zs[i] + nz * (CITY_ROAD_HALF + 1.05));
  }
  lampCache = out;
  return out;
}

export type HotspotSign = { id: StopId; label: string; x: number; y: number; z: number; yaw: number };
let signCache: HotspotSign[] | null = null;

/**
 * A leafy name board beside the road at every hotspot (the gate has its arch).
 * Each board stands clear of every road, city block, house and lamp post.
 */
export function getHotspotSigns(): HotspotSign[] {
  if (signCache) return signCache;
  const w = getWorld();
  const r = w.road;
  const out: HotspotSign[] = [];
  for (const s of STOPS) {
    if (s.id === "gate") continue;
    const { index } = w.nearestRoad(s.x, s.z, 30);
    if (index < 0) continue;
    const i = Math.max(0, index - 10);
    const j = Math.min(r.count - 1, i + 2);
    const tx = r.xs[j] - r.xs[i];
    const tz = r.zs[j] - r.zs[i];
    const l = Math.hypot(tx, tz) || 1;
    const nx = -tz / l;
    const nz = tx / l;
    let placed = false;
    for (const off of [ROAD_HALF + 1.6, ROAD_HALF + 2.6, ROAD_HALF + 3.8]) {
      for (const sd of [1, -1]) {
        const x = r.xs[i] + nx * off * sd;
        const z = r.zs[i] + nz * off * sd;
        if (!clearOfRoads(x, z, 0.6) || inTower(x, z, 0.8)) continue;
        if (getLayout().village.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + 1)) continue;
        if (getLamps().some((lp) => (lp.x - x) ** 2 + (lp.z - z) ** 2 < 2.5 ** 2)) continue;
        // face the road (front of the board looks back along the arriving traveller's path)
        out.push({ id: s.id, label: s.name, x, y: w.gridHeight(x, z), z, yaw: Math.atan2(-nx * sd, -nz * sd) });
        placed = true;
        break;
      }
      if (placed) break;
    }
  }
  signCache = out;
  return out;
}
