/**
 * Pure world geometry: the island height field, road and river curves, regions
 * and ground queries. Built lazily once (never at module scope) and shared by
 * the scene, the player and the map.
 */
import * as THREE from "three";
import { RIVER_POINTS, ROAD_POINTS, STOPS, type StopId } from "./stops";
import { REGIONS, type RegionId } from "./regions";

/** The island is a rounded rectangle (superellipse) with a sandy east coast. */
export const ISLAND_RX = 180;
export const ISLAND_RZ = 112;
export const ISLAND_P = 4;
export const PLATEAU = 6;
export const ROAD_HALF = 2.4;
export const RIVER_HALF = 3;
export const SEA_LEVEL = 0;
/** Open-ocean floor beyond the island's height field. */
export const SEABED = -9;
/** How far out to sea you can roam (in island radii). */
export const OCEAN_LIMIT = 2.3;
/** Height of the harbor pier deck above the sea. */
export const PIER_Y = 1.35;

export const TERRAIN_W = 400;
export const TERRAIN_D = 260;
export const TERRAIN_SEG_X = 320;
export const TERRAIN_SEG_Z = 208;

const GRID_MIN = -215;
const GRID_SPAN = 430;

/** Mountains and hills: x, z, height, spread. */
export const MOUNTAINS: [number, number, number, number][] = [
  [-60, -90, 22, 13],
  [-100, -86, 17, 13],
  [-136, -70, 13, 11],
  [-20, -92, 15, 12],
  [18, -88, 19, 13],
  [58, -90, 14, 12],
  [96, -82, 12, 11],
  [142, -48, 12, 12],
  [151, 52, 6.5, 6],
  [-112, -42, 3.5, 9],
  [-156, -30, 8, 10],
];

export function edgeNoise(angle: number) {
  return (
    0.03 * Math.sin(3 * angle + 1) +
    0.022 * Math.sin(7 * angle + 2) +
    0.012 * Math.sin(13 * angle + 0.5) +
    0.007 * Math.sin(23 * angle + 4)
  );
}

/** 0 at the centre, ~1 at the coastline. */
export function islandDist(x: number, z: number) {
  const a = Math.atan2(z, x);
  return Math.pow(Math.pow(Math.abs(x) / ISLAND_RX, ISLAND_P) + Math.pow(Math.abs(z) / ISLAND_RZ, ISLAND_P), 1 / ISLAND_P) + edgeNoise(a);
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** 1 along the sandy east coast (beach slope), 0 where the island ends in cliffs. */
export function beachWeight(x: number, z: number) {
  if (x <= 0) return 0;
  const c = x / (Math.hypot(x, z) || 1);
  return smoothstep(0.62, 0.86, c);
}

function hills(x: number, z: number) {
  return (
    Math.sin(x * 0.06 + 1.3) * Math.cos(z * 0.055 - 0.4) * 1.1 +
    Math.sin(x * 0.13 + z * 0.1) * 0.45 +
    Math.sin(x * 0.27 - z * 0.23 + 2) * 0.18
  );
}

function mountains(x: number, z: number) {
  let h = 0;
  for (const [cx, cz, a, s] of MOUNTAINS) {
    const d2 = (x - cx) ** 2 + (z - cz) ** 2;
    if (d2 > 9 * s * s * 4) continue;
    h += a * Math.exp(-d2 / (2 * s * s));
  }
  return h;
}

/** Flat ground for the city blocks and the farm plots. */
function flatness(x: number, z: number) {
  const city = 1 - smoothstep(28, 42, Math.hypot(x - 106, z - 26));
  const farm = 1 - smoothstep(22, 32, Math.hypot(x + 6, z - 54));
  return Math.max(city * 0.85, farm * 0.6);
}

/** Plateau lowers gently toward the harbor and the east coast. */
function plateau(x: number) {
  return PLATEAU - 3.7 * smoothstep(80, 134, x);
}

/** Height before road flattening / river carving / coast */
function rawHeight(x: number, z: number) {
  return plateau(x) + hills(x, z) * (1 - flatness(x, z)) + mountains(x, z);
}

/** Cliffs all round, a gentle beach on the east coast. */
function applyCoast(x: number, z: number, h: number) {
  const d = islandDist(x, z);
  const bw = beachWeight(x, z);
  const cliff = smoothstep(0.925, 1.0, d);
  const hc = h + (-5 - h) * cliff;
  if (bw <= 0) return hc;
  const shore = smoothstep(0.9, 1.05, d);
  const hb = h + (-3.4 - h) * shore;
  return hc + (hb - hc) * bw;
}

/** Natural ground (no road or river). */
export function naturalHeight(x: number, z: number) {
  return applyCoast(x, z, rawHeight(x, z));
}

type CurveSamples = { xs: Float32Array; zs: Float32Array; ys: Float32Array; cum: Float32Array; length: number; count: number };

function sampleCurve(points: [number, number][], spacing: number): CurveSamples {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    "centripetal",
  );
  const length = curve.getLength();
  const count = Math.max(2, Math.ceil(length / spacing));
  const pts = curve.getSpacedPoints(count - 1);
  const xs = new Float32Array(count);
  const zs = new Float32Array(count);
  const ys = new Float32Array(count);
  const cum = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    xs[i] = pts[i].x;
    zs[i] = pts[i].z;
    cum[i] = (i / (count - 1)) * length;
  }
  return { xs, zs, ys, cum, length, count };
}

/** Uniform grid for nearest-sample queries */
class SampleGrid {
  cell: number;
  size: number;
  buckets: number[][];
  constructor(
    private s: CurveSamples,
    cell = 6,
  ) {
    this.cell = cell;
    this.size = Math.ceil(GRID_SPAN / cell);
    this.buckets = Array.from({ length: this.size * this.size }, () => []);
    for (let i = 0; i < s.count; i++) {
      const cx = Math.floor((s.xs[i] - GRID_MIN) / cell);
      const cz = Math.floor((s.zs[i] - GRID_MIN) / cell);
      if (cx >= 0 && cz >= 0 && cx < this.size && cz < this.size) this.buckets[cz * this.size + cx].push(i);
    }
  }
  nearest(x: number, z: number, maxR: number) {
    const r = Math.ceil(maxR / this.cell);
    const cx = Math.floor((x - GRID_MIN) / this.cell);
    const cz = Math.floor((z - GRID_MIN) / this.cell);
    let best = -1;
    let bestD = maxR * maxR;
    for (let dz = -r; dz <= r; dz++) {
      const zz = cz + dz;
      if (zz < 0 || zz >= this.size) continue;
      for (let dx = -r; dx <= r; dx++) {
        const xx = cx + dx;
        if (xx < 0 || xx >= this.size) continue;
        const b = this.buckets[zz * this.size + xx];
        for (let k = 0; k < b.length; k++) {
          const i = b[k];
          const d = (this.s.xs[i] - x) ** 2 + (this.s.zs[i] - z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
    }
    return { index: best, dist: best < 0 ? Infinity : Math.sqrt(bestD) };
  }
}

export type World = ReturnType<typeof buildWorld>;

const REGION_CELL = 4;

function buildWorld() {
  const road = sampleCurve(ROAD_POINTS, 0.5);
  const river = sampleCurve(RIVER_POINTS, 0.6);
  const roadGrid = new SampleGrid(road);
  const riverGrid = new SampleGrid(river);

  // Road heights: natural height smoothed along the road (gentle grades);
  // where the ground drops into the sea the road becomes the harbor pier.
  const raw = new Float32Array(road.count);
  const pierW = new Float32Array(road.count);
  for (let i = 0; i < road.count; i++) {
    const n = naturalHeight(road.xs[i], road.zs[i]);
    raw[i] = Math.max(n, PIER_Y);
    pierW[i] = smoothstep(1.4, 0.4, n) * beachWeight(road.xs[i], road.zs[i]);
  }
  const W = 14;
  for (let i = 0; i < road.count; i++) {
    let s = 0;
    let n = 0;
    for (let k = -W; k <= W; k++) {
      const j = Math.min(road.count - 1, Math.max(0, i + k));
      s += raw[j];
      n++;
    }
    road.ys[i] = s / n;
  }
  const pier = new Uint8Array(road.count);
  for (let i = 0; i < road.count; i++) {
    road.ys[i] = road.ys[i] + (PIER_Y - road.ys[i]) * pierW[i];
    if (pierW[i] > 0.5) pier[i] = 1;
  }
  // River water level: smoothed and monotonically descending
  for (let i = 0; i < river.count; i++) river.ys[i] = rawHeight(river.xs[i], river.zs[i]) - 0.75;
  for (let i = 1; i < river.count; i++) river.ys[i] = Math.min(river.ys[i], river.ys[i - 1]);
  for (let i = 0; i < river.count; i++) river.ys[i] = Math.max(river.ys[i], PLATEAU - 1.4);

  // Bridges: road samples that cross the river, with a smoothed deck lift
  const bridge = new Uint8Array(road.count);
  for (let i = 0; i < road.count; i++) {
    const r = riverGrid.nearest(road.xs[i], road.zs[i], RIVER_HALF + 5);
    if (r.dist < RIVER_HALF + 3.2) bridge[i] = 1;
  }
  const deck = new Float32Array(road.count);
  for (let i = 0; i < road.count; i++) {
    let m = 0;
    for (let k = -8; k <= 8; k++) {
      const j = i + k;
      if (j < 0 || j >= road.count || !bridge[j]) continue;
      m = Math.max(m, 1 - Math.abs(k) / 9);
    }
    deck[i] = 0.55 * Math.sin((m * Math.PI) / 2);
  }

  // Regions along the road
  const anchorIdx = REGIONS.map((rg) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < road.count; i++) {
      const d = (road.xs[i] - rg.ax) ** 2 + (road.zs[i] - rg.az) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  });
  const roadRegion = new Uint8Array(road.count);
  for (let i = 0; i < road.count; i++) {
    let r = 0;
    for (let k = 0; k < anchorIdx.length; k++) if (i >= anchorIdx[k]) r = k;
    roadRegion[i] = r;
  }
  const rnx = Math.ceil(TERRAIN_W / REGION_CELL) + 1;
  const rnz = Math.ceil(TERRAIN_D / REGION_CELL) + 1;
  const regionGrid = new Uint8Array(rnx * rnz);
  const sub: number[] = [];
  for (let i = 0; i < road.count; i += 6) sub.push(i);
  for (let j = 0; j < rnz; j++) {
    const z = -TERRAIN_D / 2 + j * REGION_CELL;
    for (let i = 0; i < rnx; i++) {
      const x = -TERRAIN_W / 2 + i * REGION_CELL;
      let best = 0;
      let bd = Infinity;
      for (const k of sub) {
        const d = (road.xs[k] - x) ** 2 + (road.zs[k] - z) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      regionGrid[j * rnx + i] = roadRegion[best];
    }
  }
  function regionIndexAt(x: number, z: number) {
    const i = Math.min(rnx - 1, Math.max(0, Math.round((x + TERRAIN_W / 2) / REGION_CELL)));
    const j = Math.min(rnz - 1, Math.max(0, Math.round((z + TERRAIN_D / 2) / REGION_CELL)));
    return regionGrid[j * rnx + i];
  }
  function regionAt(x: number, z: number): RegionId {
    return REGIONS[regionIndexAt(x, z)].id;
  }

  function terrainHeight(x: number, z: number) {
    let h = rawHeight(x, z);
    const rv = riverGrid.nearest(x, z, RIVER_HALF + 5);
    if (rv.index >= 0) {
      const carve = 1 - smoothstep(RIVER_HALF * 0.55, RIVER_HALF + 3, rv.dist);
      const bed = river.ys[rv.index] - 0.9;
      h = h + (Math.min(h, bed) - h) * carve;
    }
    h = applyCoast(x, z, h);
    const rr = roadGrid.nearest(x, z, ROAD_HALF + 6);
    if (rr.index >= 0) {
      const w = (1 - smoothstep(ROAD_HALF * 0.8, ROAD_HALF + 5, rr.dist)) * (1 - pierW[rr.index]);
      h = h + (road.ys[rr.index] - 0.06 - h) * w;
    }
    return h;
  }

  // Height grid (matches the rendered terrain mesh)
  const nx = TERRAIN_SEG_X + 1;
  const nz = TERRAIN_SEG_Z + 1;
  const heights = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    const z = -TERRAIN_D / 2 + (j / TERRAIN_SEG_Z) * TERRAIN_D;
    for (let i = 0; i < nx; i++) {
      const x = -TERRAIN_W / 2 + (i / TERRAIN_SEG_X) * TERRAIN_W;
      heights[j * nx + i] = terrainHeight(x, z);
    }
  }

  function gridHeight(x: number, z: number) {
    const fx = ((x + TERRAIN_W / 2) / TERRAIN_W) * TERRAIN_SEG_X;
    const fz = ((z + TERRAIN_D / 2) / TERRAIN_D) * TERRAIN_SEG_Z;
    const i = Math.min(TERRAIN_SEG_X - 1, Math.max(0, Math.floor(fx)));
    const j = Math.min(TERRAIN_SEG_Z - 1, Math.max(0, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - i));
    const tz = Math.min(1, Math.max(0, fz - j));
    const h00 = heights[j * nx + i];
    const h10 = heights[j * nx + i + 1];
    const h01 = heights[(j + 1) * nx + i];
    const h11 = heights[(j + 1) * nx + i + 1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  }

  function nearestRoad(x: number, z: number, maxR = 40) {
    return roadGrid.nearest(x, z, maxR);
  }
  function nearestRiver(x: number, z: number, maxR = 12) {
    return riverGrid.nearest(x, z, maxR);
  }

  /** Walkable ground height (road surface / bridge deck / pier / terrain / open sea floor) */
  function groundAt(x: number, z: number) {
    const r = roadGrid.nearest(x, z, ROAD_HALF + 1);
    if (r.index >= 0 && r.dist <= ROAD_HALF + 0.3) {
      return road.ys[r.index] + deck[r.index] + 0.05;
    }
    if (Math.abs(x) > TERRAIN_W / 2 - 2 || Math.abs(z) > TERRAIN_D / 2 - 2) return SEABED;
    return gridHeight(x, z);
  }

  /** Water surface height here (river or sea), or null on dry land. */
  function waterSurface(x: number, z: number): number | null {
    if (islandDist(x, z) < 0.935) {
      const rv = riverGrid.nearest(x, z, RIVER_HALF + 1);
      if (rv.index >= 0 && rv.dist < RIVER_HALF + 0.55) {
        const s = river.ys[rv.index];
        return groundAt(x, z) < s ? s : null;
      }
    }
    return groundAt(x, z) < SEA_LEVEL - 0.02 ? SEA_LEVEL : null;
  }

  /** Water depth at a spot (0 on dry land). */
  function depthAt(x: number, z: number) {
    const s = waterSurface(x, z);
    return s === null ? 0 : Math.max(0, s - groundAt(x, z));
  }

  /** Inside the explorable area (the island plus the surrounding ocean). */
  function inBounds(x: number, z: number) {
    return islandDist(x, z) < OCEAN_LIMIT;
  }

  /** Dry, gentle land a visitor can safely be placed on. */
  function walkable(x: number, z: number) {
    const d = islandDist(x, z);
    if (d > 0.995) return false;
    const r = roadGrid.nearest(x, z, ROAD_HALF + 1);
    if (r.index >= 0 && r.dist <= ROAD_HALF + 0.3) return true;
    if (d > 0.9 && beachWeight(x, z) < 0.5) return false;
    const rv = riverGrid.nearest(x, z, RIVER_HALF + 1);
    if (rv.index >= 0 && rv.dist < RIVER_HALF + 0.4) return false;
    const h = gridHeight(x, z);
    if (h < SEA_LEVEL + 0.3) return false;
    const s = Math.abs(gridHeight(x + 0.6, z) - h) + Math.abs(gridHeight(x, z + 0.6) - h);
    return s < 1.4;
  }

  const stopRoadIndex = Object.fromEntries(
    STOPS.map((s) => [s.id, roadGrid.nearest(s.x, s.z, 30).index]),
  ) as Record<StopId, number>;

  return {
    road,
    river,
    bridge,
    deck,
    pier,
    roadRegion,
    regionAt,
    regionIndexAt,
    heights,
    terrainHeight,
    gridHeight,
    groundAt,
    walkable,
    waterSurface,
    depthAt,
    inBounds,
    nearestRoad,
    nearestRiver,
    stopRoadIndex,
    nx,
    nz,
  };
}

let cached: World | null = null;
export function getWorld(): World {
  if (!cached) cached = buildWorld();
  return cached;
}

/** Deterministic PRNG (mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export { smoothstep };
