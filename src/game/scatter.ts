/**
 * Deterministic placement of vegetation, rocks, crops, village buildings and
 * the collider set used by the player. Region-aware: dense woods, open
 * meadows, planted fields, a village street, the city and the beach.
 * Built lazily once.
 */
import { STOPS } from "./stops";
import { beachWeight, getWorld, islandDist, rng, ROAD_HALF, RIVER_HALF } from "./world";
import { ZONE_BY_ID, zoneAt } from "./zones";
import { getBuildings } from "./buildings";
import { boxColliders, cityLoopDist, shellFootprint, CITY_ROAD_HALF, getHotspotSigns, getLamps, getLayout, type CropKind } from "./layout";
import { TRACTOR_PLOTS } from "./tractor";
import { BOULDER_GARDENS, getForest, inForestClearing, trailDist, TRAIL_HALF } from "./trails";
import type { RegionId } from "./regions";

/** `tint` (0xRRGGBB) recolours a tree's leaves so no two neighbours share a shade. */
/** Crop model, scale and row spacing per crop kind. */
export const CROP: Record<CropKind, { key: ModelKey; s: number; dx: number; dz: number }> = {
  wheat: { key: "wheat", s: 3.2, dx: 1.25, dz: 1.5 },
  corn: { key: "corn", s: 2.7, dx: 1.5, dz: 1.7 },
  leafs: { key: "leafs", s: 3.2, dx: 1.4, dz: 1.6 },
  pumpkin: { key: "pumpkin", s: 3.2, dx: 1.8, dz: 1.9 },
  dirt: { key: "dirtRows", s: 2.4, dx: 2.4, dz: 2.4 },
};

export type Placement = { x: number; y: number; z: number; rot: number; s: number; sy?: number; tint?: number };

/** Leaf palettes: fresh greens with the odd autumn blaze or spring blossom, deeper greens for conifers. */
const BROAD_GREENS = [0x6aa84f, 0x7cb342, 0x8bc34a, 0x5d9c3a, 0x9ccc65, 0x4e8a3a, 0x78a94a, 0xa4c96a];
const AUTUMN = [0xe69138, 0xf1c232, 0xd9643a, 0xc9822f];
const BLOSSOM = [0xf4a7c0, 0xf7c6d9, 0xe8a0d0];
const PINE_GREENS = [0x3f7d4e, 0x4c8c5a, 0x2f6b45, 0x5a9a63, 0x467a3e];
const PINE_KEYS = new Set<string>(["pineTall", "pineRound", "cone"]);
const BROAD_KEYS = new Set<string>(["oak", "default", "detailed", "fat", "tall", "acacia"]);

const N = (n: string) => `/models/nature/${n}.glb`;
const V = (n: string) => `/models/village/${n}.glb`;

export const MODELS = {
  oak: N("tree_oak"),
  default: N("tree_default"),
  detailed: N("tree_detailed"),
  fat: N("tree_fat"),
  tall: N("tree_tall"),
  pineTall: N("tree_pineTallA_detailed"),
  pineRound: N("tree_pineRoundC"),
  cone: N("tree_cone"),
  bushLarge: N("plant_bushLarge"),
  bush: N("plant_bush"),
  bushDetailed: N("plant_bushDetailed"),
  flowerRed: N("flower_redA"),
  flowerYellow: N("flower_yellowA"),
  flowerPurple: N("flower_purpleA"),
  grass: N("grass"),
  grassLarge: N("grass_large"),
  rockA: N("rock_largeA"),
  rockC: N("rock_largeC"),
  rockTall: N("rock_tallB"),
  rockSmall: N("rock_smallA"),
  mushroom: N("mushroom_redGroup"),
  stump: N("stump_round"),
  log: N("log"),
  lily: N("lily_large"),
  fence: N("fence_simple"),
  fencePlanks: N("fence_planks"),
  flowerRedB: N("flower_redB"),
  flowerYellowB: N("flower_yellowB"),
  flowerPurpleB: N("flower_purpleB"),
  corn: N("crops_cornStageD"),
  wheat: N("crops_wheatStageB"),
  pumpkin: N("crop_pumpkin"),
  leafs: N("crops_leafsStageB"),
  dirtRows: N("crops_dirtDoubleRow"),
  acacia: N("tree_plateau"),
  acaciaFall: N("tree_plateau_fall"),
  house1: V("House_1"),
  house2: V("House_2"),
  house3: V("House_3"),
  house4: V("House_4"),
  inn: V("Inn"),
  mill: V("Mill"),
  bellTower: V("Bell_Tower"),
  stable: V("Stable"),
  well: V("Well"),
  market1: V("MarketStand_1"),
  market2: V("MarketStand_2"),
  bench: V("Bench_1"),
  barrel: V("Barrel"),
  crate: V("Crate"),
  hay: V("Hay"),
  cart: V("Cart"),
  gazebo: V("Gazebo"),
} as const;

export type ModelKey = keyof typeof MODELS;

const BUILDING_KEY: Record<string, ModelKey> = {
  House_1: "house1",
  House_2: "house2",
  House_3: "house3",
  House_4: "house4",
  Inn: "inn",
  Mill: "mill",
  Bell_Tower: "bellTower",
  Stable: "stable",
};

/**
 * Circular obstacle. `h` (height above the ground) makes it climbable: the
 * explorer can jump onto it and stand on top. Without `h` it is a solid wall.
 */
/**
 * A solid footprint. Circles by default; with `hw`/`hd` it is a box rotated by
 * `rot` (local x axis = (cos rot, −sin rot)) and `r` is its bounding radius.
 * `h`/`top` make it climbable: you can stand on top, the sides still block.
 */
export type Collider = {
  x: number;
  z: number;
  r: number;
  h?: number;
  top?: number;
  hw?: number;
  hd?: number;
  rot?: number;
  /** pitched roof: height above the ground at the eaves, ridge along local x or z (top = ridge) */
  roof?: { eave: number; ridge: "x" | "z" };
  q?: number;
};

/** A building shell: walls all round, top follows the pitched roof. */
function shellCollider(f: NonNullable<ReturnType<typeof shellFootprint>>): Collider {
  const g = getWorld().gridHeight(f.x, f.z);
  return { ...boxCollider(f.x, f.z, f.w, f.d, f.rot, { h: f.h, top: g + f.h }), roof: { eave: f.eave, ridge: f.ridge } };
}

/** Oriented box collider (r = bounding radius). */
export function boxCollider(x: number, z: number, w: number, d: number, rot: number, extra?: { h?: number; top?: number }): Collider {
  return { x, z, r: Math.hypot(w, d) / 2, hw: w / 2, hd: d / 2, rot, ...extra };
}

const near = { x: 0, z: 0, d: 0, inside: false };
/** Closest point of a collider's footprint to (x, z): writes `near` (shared, read straight away). */
function closest(c: Collider, x: number, z: number) {
  const dx = x - c.x;
  const dz = z - c.z;
  if (c.hw === undefined) {
    const d = Math.hypot(dx, dz);
    near.inside = d < c.r;
    near.d = d - c.r;
    const k = d > 1e-6 ? c.r / d : 0;
    near.x = c.x + dx * k;
    near.z = c.z + dz * k;
    return near;
  }
  const co = Math.cos(c.rot ?? 0);
  const si = Math.sin(c.rot ?? 0);
  const lx = dx * co - dz * si;
  const lz = dx * si + dz * co;
  const hw = c.hw;
  const hd = c.hd ?? hw;
  let px = Math.max(-hw, Math.min(hw, lx));
  let pz = Math.max(-hd, Math.min(hd, lz));
  near.inside = Math.abs(lx) < hw && Math.abs(lz) < hd;
  if (near.inside) {
    // inside: nearest edge
    const ex = hw - Math.abs(lx);
    const ez = hd - Math.abs(lz);
    if (ex < ez) px = Math.sign(lx || 1) * hw;
    else pz = Math.sign(lz || 1) * hd;
    near.d = -Math.min(ex, ez);
  } else near.d = Math.hypot(lx - px, lz - pz);
  near.x = c.x + px * co + pz * si;
  near.z = c.z - px * si + pz * co;
  return near;
}

/**
 * Height of the collider's top surface at (x, z): flat tops are level,
 * pitched roofs slope from the eaves up to the ridge.
 */
export function surfaceAt(c: Collider, x: number, z: number) {
  const top = colliderTop(c);
  if (!c.roof || c.hw === undefined) return top;
  const base = top - c.h!;
  const co = Math.cos(c.rot ?? 0);
  const si = Math.sin(c.rot ?? 0);
  const dx = x - c.x;
  const dz = z - c.z;
  // distance across the ridge, 0 at the ridge line → 1 at the eaves
  const across = c.roof.ridge === "x" ? Math.abs(dx * si + dz * co) / (c.hd ?? c.hw) : Math.abs(dx * co - dz * si) / c.hw;
  const k = Math.min(1, across);
  return base + c.roof.eave + (c.h! - c.roof.eave) * (1 - k);
}

/** Distance from (x, z) to the footprint edge (negative inside). */
export function footprintDist(c: Collider, x: number, z: number) {
  return closest(c, x, z).d;
}

/** True when a disc of radius `rad` at (x, z) touches the footprint. */
export function overlaps(c: Collider, x: number, z: number, rad: number) {
  return closest(c, x, z).d < rad;
}

const pushed = { x: 0, z: 0, hit: false };
/**
 * Push a disc of radius `rad` at (x, z) out of the footprint. `fx`/`fz` is
 * the direction the mover came from, used when it sits dead centre.
 */
export function pushOut(c: Collider, x: number, z: number, rad: number, fx = 0, fz = 0) {
  const n = closest(c, x, z);
  pushed.x = x;
  pushed.z = z;
  pushed.hit = false;
  if (n.d >= rad) return pushed;
  pushed.hit = true;
  if (c.hw === undefined) {
    // circle: straight out from the centre (or back the way we came when dead centre)
    let dx = x - c.x;
    let dz = z - c.z;
    let dl = Math.hypot(dx, dz);
    if (dl < 1e-6) {
      dx = fx;
      dz = fz;
      dl = Math.hypot(dx, dz);
      if (dl < 1e-6) {
        dx = 1;
        dz = 0;
        dl = 1;
      }
    }
    pushed.x = c.x + (dx / dl) * (c.r + rad);
    pushed.z = c.z + (dz / dl) * (c.r + rad);
    return pushed;
  }
  let ox = n.inside ? n.x - x : x - n.x;
  let oz = n.inside ? n.z - z : z - n.z;
  let l = Math.hypot(ox, oz);
  if (l < 1e-6) {
    // dead centre: back out the way we came
    ox = fx;
    oz = fz;
    l = Math.hypot(ox, oz);
    if (l < 1e-6) {
      ox = 1;
      oz = 0;
      l = 1;
    }
  }
  pushed.x = n.x + (ox / l) * rad;
  pushed.z = n.z + (oz / l) * rad;
  return pushed;
}

type Scatter = { items: Record<ModelKey, Placement[]>; colliders: Collider[] };

let cached: Scatter | null = null;

/** Trees per grid cell by region — kept sparse so every area has room to breathe and explore. */
const TREE_DENSITY: Record<RegionId, number> = {
  meadow: 0.045,
  forest: 0.34,
  fields: 0.025,
  village: 0.05,
  city: 0,
  cliffs: 0.15,
  harbor: 0.012,
};

export function getScatter(): Scatter {
  if (cached) return cached;
  const w = getWorld();
  const layout = getLayout();
  const rand = rng(1337);
  const items = Object.fromEntries(Object.keys(MODELS).map((k) => [k, [] as Placement[]])) as Record<ModelKey, Placement[]>;
  const colliders: Collider[] = [];

  const nearStop = (x: number, z: number, pad: number) =>
    STOPS.some((s) => (s.lx - x) ** 2 + (s.lz - z) ** 2 < (s.clear + pad) ** 2 || (s.x - x) ** 2 + (s.z - z) ** 2 < (5 + pad) ** 2);
  const roadDist = (x: number, z: number) => w.nearestRoad(x, z, 16).dist;
  const riverDist = (x: number, z: number) => w.nearestRiver(x, z, 12).dist;
  const slope = (x: number, z: number) => {
    const h = w.gridHeight(x, z);
    return Math.abs(w.gridHeight(x + 1, z) - h) + Math.abs(w.gridHeight(x, z + 1) - h);
  };
  const nearBuilding = (x: number, z: number, pad: number) =>
    layout.village.some((b) => (b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + pad) ** 2) ||
    layout.towers.some((t) => Math.abs(t.x - x) < Math.max(t.w, t.d) / 2 + pad && Math.abs(t.z - z) < Math.max(t.w, t.d) / 2 + pad) ||
    layout.palms.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < (1 + pad) ** 2);
  const inPlot = (x: number, z: number, pad: number) =>
    layout.plots.some((p) => Math.abs(p.x - x) < p.w / 2 + pad && Math.abs(p.z - z) < p.d / 2 + pad) ||
    (Math.abs(layout.paddock.x - x) < layout.paddock.w / 2 + pad && Math.abs(layout.paddock.z - z) < layout.paddock.d / 2 + pad);

  const add = (key: ModelKey, x: number, z: number, s: number, collide = 0, sy?: number, climb?: number, rot?: number) => {
    const y = w.gridHeight(x, z) - 0.08;
    const pal = PINE_KEYS.has(key) ? PINE_GREENS : BROAD_KEYS.has(key) ? BROAD_GREENS : null;
    items[key].push({ x, y, z, rot: rot ?? rand() * Math.PI * 2, s, sy, tint: pal ? pal[Math.floor(rand() * pal.length)] : undefined });
    if (collide > 0) colliders.push({ x, z, r: collide, h: climb });
  };
  /** A fence panel (model centred on x/z): a thin box you can hop over. */
  const fenceAt = (x: number, z: number, rot: number, s: number, sy: number) => {
    colliders.push(boxCollider(x, z, s, Math.max(0.3, s * 0.08), rot, { h: 0.35 * sy }));
  };
  /** Boulders are longer than wide: a box matching the model's footprint, with a top to stand on. */
  const rockAt = (key: "rockA" | "rockC", x: number, z: number, s: number) => {
    add(key, x, z, s);
    const it = items[key][items[key].length - 1];
    const [hw, hd, ht] = key === "rockA" ? [0.39, 0.51, 0.26] : [0.53, 0.51, 0.32];
    colliders.push(boxCollider(x, z, hw * 2 * s * 0.9, hd * 2 * s * 0.9, it.rot, { h: ht * s * 0.9 }));
  };

  const broad: ModelKey[] = ["oak", "default", "detailed", "fat", "tall"];
  const pines: ModelKey[] = ["pineTall", "pineRound", "cone"];

  // Trees on a jittered grid, with a minimum gap between trunks so canopies never mash together
  const TS = 4;
  const treeHash = new Map<string, { x: number; z: number }[]>();
  const tooClose = (x: number, z: number, gap: number) => {
    const cx = Math.floor(x / 8);
    const cz = Math.floor(z / 8);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) for (const t of treeHash.get(`${cx + i},${cz + j}`) ?? []) if ((t.x - x) ** 2 + (t.z - z) ** 2 < gap * gap) return true;
    return false;
  };
  const markTree = (x: number, z: number) => {
    const k = `${Math.floor(x / 8)},${Math.floor(z / 8)}`;
    if (!treeHash.has(k)) treeHash.set(k, []);
    treeHash.get(k)!.push({ x, z });
  };
  for (let gz = -118; gz < 118; gz += TS) {
    for (let gx = -190; gx < 190; gx += TS) {
      const x = gx + rand() * TS;
      const z = gz + rand() * TS;
      const d = islandDist(x, z);
      if (d > 0.9) continue;
      const region = w.regionAt(x, z);
      const h = w.gridHeight(x, z);
      const mountain = h > 11;
      let density = TREE_DENSITY[region];
      if (mountain) density = h > 21 ? 0 : Math.max(density, 0.2);
      // groves: clumps rather than an even sprinkle
      const grove = 0.5 + 0.5 * Math.sin(x * 0.07 + 2) * Math.cos(z * 0.09 - 1);
      density *= 0.55 + grove * 0.9;
      if (rand() > density) continue;
      const rd = roadDist(x, z);
      if (rd < ROAD_HALF + (region === "forest" ? 3.2 : 4)) continue;
      if (riverDist(x, z) < RIVER_HALF + 2.2) continue;
      if (nearStop(x, z, 2)) continue;
      if (zoneAt(x, z, 2.5)) continue;
      if (nearBuilding(x, z, 2.5) || inPlot(x, z, 2.5)) continue;
      if (beachWeight(x, z) > 0.4 && h < 3.4) continue;
      if (slope(x, z) > 1.6) continue;
      if (Math.hypot(x + 138, z - 62) < 9) continue;
      if (region === "forest" && (trailDist(x, z) < TRAIL_HALF + 2.6 || inForestClearing(x, z, 2))) continue;
      if (cityLoopDist(x, z) < CITY_ROAD_HALF + 4) continue;
      const pine = mountain || region === "cliffs" || (region === "forest" && rand() < 0.5) || rand() < 0.1;
      const key = pine ? pines[Math.floor(rand() * pines.length)] : broad[Math.floor(rand() * broad.length)];
      const big = region === "forest" ? 1.3 : 1;
      if (tooClose(x, z, region === "forest" ? (pine ? 4.6 : 5.6) : 7.5)) continue;
      markTree(x, z);
      const s = (pine ? 4.2 + rand() * 2.8 : 4.4 + rand() * 2.6) * big;
      add(key, x, z, s, 0.75 * big, s * (0.9 + rand() * 0.28));
      const r = rand();
      const pick = (pal: number[]) => pal[Math.floor(rand() * pal.length)];
      items[key][items[key].length - 1].tint = pine
        ? pick(PINE_GREENS)
        : r < 0.1 && region !== "harbor"
          ? pick(AUTUMN)
          : r < 0.17 && (region === "meadow" || region === "village")
            ? pick(BLOSSOM)
            : pick(BROAD_GREENS);
    }
  }

  // Undergrowth: bushes, flowers, grass, rocks, mushrooms
  const US = 2.3;
  for (let gz = -118; gz < 118; gz += US) {
    for (let gx = -190; gx < 190; gx += US) {
      const x = gx + rand() * US;
      const z = gz + rand() * US;
      const d = islandDist(x, z);
      if (d > 0.91) continue;
      const region = w.regionAt(x, z);
      if (region === "city") continue;
      const keep = region === "fields" ? 0.2 : region === "harbor" ? 0.16 : region === "village" ? 0.32 : region === "forest" ? 0.36 : 0.42;
      if (rand() > keep) continue;
      const rd = roadDist(x, z);
      if (rd < ROAD_HALF + 0.6) continue;
      const rv = riverDist(x, z);
      if (rv < RIVER_HALF + 0.8) continue;
      if (nearStop(x, z, -2)) continue;
      if (region === "forest" && (trailDist(x, z) < TRAIL_HALF + 0.6 || inForestClearing(x, z, 0))) continue;
      if (cityLoopDist(x, z) < CITY_ROAD_HALF + 2) continue;
      const zn = zoneAt(x, z, 1);
      if (zn && zn.kind !== "meadow" && zn.kind !== "savanna") continue;
      if (nearBuilding(x, z, 0.8) || inPlot(x, z, 0.6)) continue;
      const h = w.gridHeight(x, z);
      if (h < 1.1) continue;
      const sandy = beachWeight(x, z) > 0.5 && h < 3;
      const r = rand();
      const forest = region === "forest";
      const rocky = region === "cliffs" || h > 12;
      if (sandy) {
        if (r < 0.3) add("grassLarge", x, z, 2.6 + rand() * 1.5);
        else if (r < 0.36) {
          const sr = 3 + rand() * 2;
          add("rockSmall", x, z, sr, 0.17 * sr, undefined, 0.19 * sr * 0.92);
        }
        continue;
      }
      if (r < (forest ? 0.2 : 0.1)) {
        if (rd < ROAD_HALF + 1.8) continue;
        add((["bushLarge", "bush", "bushDetailed"] as ModelKey[])[Math.floor(rand() * 3)], x, z, 4 + rand() * 2.5);
      } else if (r < (forest ? 0.3 : rocky ? 0.2 : 0.42)) {
        add((["flowerRed", "flowerYellow", "flowerPurple"] as ModelKey[])[Math.floor(rand() * 3)], x, z, 3 + rand() * 1.6);
      } else if (r < 0.78) {
        add(rand() < 0.5 ? "grass" : "grassLarge", x, z, 3 + rand() * 2.4);
      } else if (r < (rocky ? 0.9 : 0.84)) {
        if (rd < ROAD_HALF + 2.5) continue;
        const big = rand() < 0.5;
        const s = big ? 3 + rand() * 3 : 3 + rand() * 2;
        if (big) rockAt(rand() < 0.5 ? "rockA" : "rockC", x, z, s);
        else add("rockSmall", x, z, s, 0.17 * s, undefined, 0.19 * s * 0.92);
      } else if (r < (rocky ? 0.93 : 0.86)) {
        if (rd < ROAD_HALF + 2.5) continue;
        const s = 2.4 + rand() * 1.6;
        add("rockTall", x, z, s, 1.0, undefined, 0.88 * s * 0.92);
      } else if (r < (forest ? 0.93 : 0.88)) {
        add("mushroom", x, z, 3 + rand() * 1.5);
      } else if (r < (forest ? 0.96 : 0.895)) {
        if (rd < ROAD_HALF + 2.5) continue;
        const stump = rand() < 0.5;
        const s = 4 + rand() * 1.5;
        add(stump ? "stump" : "log", x, z, s, 0.6, undefined, (stump ? 0.2 : 0.17) * s);
      }
    }
  }

  // Flower fields in the meadows, planted in colour bands
  for (const id of ["meadow-welcome", "meadow-west"]) {
    const zn = ZONE_BY_ID[id];
    const kinds: ModelKey[] = ["flowerRed", "flowerYellow", "flowerPurple", "flowerRedB", "flowerYellowB", "flowerPurpleB"];
    for (let n = 0; n < 520; n++) {
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand()) * zn.r;
      const x = zn.x + Math.cos(a) * rr;
      const z = zn.z + Math.sin(a) * rr;
      if (islandDist(x, z) > 0.89) continue;
      if (roadDist(x, z) < ROAD_HALF + 0.5 || riverDist(x, z) < RIVER_HALF + 0.8) continue;
      const band = Math.floor((x * 0.7 + z * 0.3 + 300) / 2.4) % kinds.length;
      add(kinds[band], x, z, 3.2 + rand() * 1.4);
    }
  }

  // Golden Fields: crop rows in every plot, a low fence around each
  for (const [pi, p] of layout.plots.entries()) {
    const c = CROP[p.crop];
    // tractor plots grow their own crops (Farm.tsx) so the harvest trail can cut them
    const harvested = (TRACTOR_PLOTS as readonly number[]).includes(pi);
    for (let zz = -p.d / 2 + c.dz / 2; zz < p.d / 2 && !harvested; zz += c.dz) {
      for (let xx = -p.w / 2 + c.dx / 2; xx < p.w / 2; xx += c.dx) {
        const x = p.x + xx + (rand() - 0.5) * 0.15;
        const z = p.z + zz;
        add(c.key, x, z, c.s * (0.92 + rand() * 0.16), 0, undefined, undefined, p.crop === "dirt" ? 0 : rand() * 6.28);
      }
    }
    // fence posts along the long sides, a gap in the middle for the farmers
    for (const side of [-1, 1]) {
      for (let xx = -p.w / 2; xx <= p.w / 2 + 0.01; xx += 2.6) {
        if (Math.abs(xx) < 1.6) continue;
        const x = p.x + xx;
        const z = p.z + side * (p.d / 2 + 0.9);
        items.fence.push({ x, y: w.gridHeight(x, z) - 0.05, z, rot: 0, s: 2.6, sy: 2.6 });
        fenceAt(x, z, 0, 2.6, 2.6);
      }
    }
  }

  // Pasture paddock + barn
  {
    const pd = layout.paddock;
    for (let xx = -pd.w / 2; xx <= pd.w / 2 + 0.01; xx += 2.4) {
      for (const side of [-1, 1]) {
        const x = pd.x + xx;
        const z = pd.z + side * (pd.d / 2);
        items.fencePlanks.push({ x, y: w.gridHeight(x, z) - 0.05, z, rot: 0, s: 2.4, sy: 3.4 });
        fenceAt(x, z, 0, 2.4, 3.4);
      }
    }
    for (let zz = -pd.d / 2 + 1.2; zz <= pd.d / 2 - 1.2 + 0.01; zz += 2.4) {
      for (const side of [-1, 1]) {
        if (side === -1 && Math.abs(zz) < 2) continue; // gate on the road side
        const x = pd.x + side * (pd.w / 2);
        const z = pd.z + zz;
        items.fencePlanks.push({ x, y: w.gridHeight(x, z) - 0.05, z, rot: Math.PI / 2, s: 2.4, sy: 3.4 });
        fenceAt(x, z, Math.PI / 2, 2.4, 3.4);
      }
    }
    const b = layout.barn;
    add("stable", b.x, b.z, 2.6, 0, undefined, undefined, b.rot);
    const f = shellFootprint("Stable", b.x, b.z, 2.6, b.rot);
    if (f) colliders.push(shellCollider(f));
    for (const [ox, oz] of [
      [-4, 6],
      [-2.4, 6.4],
      [3, 6.2],
    ]) {
      add("hay", b.x + ox, b.z + oz, 8, 0.9, undefined, 0.18 * 8 - 0.1);
    }
  }

  // Maple Village buildings and the plaza
  for (const b of layout.village) {
    const key = BUILDING_KEY[b.model];
    if (!key) continue;
    add(key, b.x, b.z, b.scale, 0, undefined, undefined, b.rot);
    // real walls and a pitched roof you can land on and walk over
    const f = shellFootprint(b.model, b.x, b.z, b.scale, b.rot);
    if (f) colliders.push(shellCollider(f));
    else colliders.push(boxCollider(b.x, b.z, b.r * 1.4, b.r * 1.4, b.rot));
  }
  {
    const pl = layout.plaza;
    const props: [ModelKey, number, number, number, number, number?][] = [
      // key, angle (deg), dist, scale, collider radius, climb height
      ["well", 200, 6.2, 2.6, 1.0],
      ["market1", 140, 6.8, 2.8, 1.5],
      ["market2", 112, 7.2, 2.8, 1.3],
      ["bench", 250, 6.6, 3, 0.9, 0.32 * 3 - 0.05],
      ["bench", 300, 6.6, 3, 0.9, 0.32 * 3 - 0.05],
      ["cart", 60, 7.2, 2.4, 1.1, 0.8 * 2.4 * 0.55],
      ["barrel", 165, 8, 4.5, 0.45, 0.2 * 4.5 - 0.05],
      ["barrel", 171, 8.6, 4.5, 0.45, 0.2 * 4.5 - 0.05],
      ["crate", 100, 8.4, 5, 0.5, 0.16 * 5 - 0.05],
      ["hay", 40, 8.2, 7, 0.55, 0.18 * 7 - 0.1],
      ["gazebo", 340, 7.4, 3.2, 0],
    ];
    for (const [key, ang, dist, s, r, climb] of props) {
      const a = (ang * Math.PI) / 180;
      const x = pl.x + Math.cos(a) * dist;
      const z = pl.z + Math.sin(a) * dist;
      if (roadDist(x, z) < ROAD_HALF + 1.2) continue;
      add(key, x, z, s, r, undefined, climb, Math.atan2(pl.x - x, pl.z - z));
    }
  }

  // Savanna glade: flat-topped acacias and dry grass
  {
    const zn = ZONE_BY_ID.glade;
    for (let n = 0; n < 9; n++) {
      const a = rand() * Math.PI * 2;
      const rr = zn.r * (0.7 + rand() * 0.4);
      const x = zn.x + Math.cos(a) * rr;
      const z = zn.z + Math.sin(a) * rr;
      if (roadDist(x, z) < ROAD_HALF + 3) continue;
      add(rand() < 0.5 ? "acacia" : "acaciaFall", x, z, 6.5 + rand() * 2, 0.8);
    }
    for (let n = 0; n < 160; n++) {
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand()) * zn.r;
      const x = zn.x + Math.cos(a) * rr;
      const z = zn.z + Math.sin(a) * rr;
      if (roadDist(x, z) < ROAD_HALF + 0.5) continue;
      add(rand() < 0.5 ? "grassLarge" : "wheat", x, z, 2.6 + rand() * 1.5);
    }
  }

  // City street trees along the sidewalks
  for (let i = 0; i < w.road.count; i += 18) {
    if (w.roadRegion[i] !== 4) continue;
    const j = Math.min(w.road.count - 1, i + 1);
    const tx = w.road.xs[j] - w.road.xs[i];
    const tz = w.road.zs[j] - w.road.zs[i];
    const l = Math.hypot(tx, tz) || 1;
    for (const side of [-1, 1]) {
      const x = w.road.xs[i] + (-tz / l) * (ROAD_HALF + 2.6) * side;
      const z = w.road.zs[i] + (tx / l) * (ROAD_HALF + 2.6) * side;
      if (nearBuilding(x, z, 0.5) || nearStop(x, z, -4)) continue;
      if (cityLoopDist(x, z) < CITY_ROAD_HALF + 1.5) continue;
      if (roadDist(x, z) < ROAD_HALF + 1.6) continue;
      if (getLamps().some((lp) => (lp.x - x) ** 2 + (lp.z - z) ** 2 < 4)) continue;
      add(rand() < 0.5 ? "oak" : "default", x, z, 3.6 + rand() * 0.8, 0.5);
    }
  }

  // Lily pads along the river
  for (let i = 0; i < w.river.count; i += 7) {
    if (rand() > 0.55) continue;
    const x = w.river.xs[i] + (rand() - 0.5) * RIVER_HALF * 1.4;
    const z = w.river.zs[i] + (rand() - 0.5) * RIVER_HALF * 1.4;
    if (islandDist(x, z) > 0.9) continue;
    items.lily.push({ x, y: w.river.ys[i] + 0.02, z, rot: rand() * 6.28, s: 3 + rand() * 2 });
  }

  // Rail fences along the meadow stretch of the road, like a guided trail
  for (let i = 4; i < w.road.count - 1; i += 5) {
    const region = w.roadRegion[i];
    const cum = w.road.cum[i];
    if (!(region === 0 || (region === 2 && cum < 236) || (region === 1 && cum > 140))) continue;
    if (w.bridge[i]) continue;
    const j = Math.min(w.road.count - 1, i + 1);
    const tx = w.road.xs[j] - w.road.xs[i];
    const tz = w.road.zs[j] - w.road.zs[i];
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len;
    const nz = tx / len;
    const rot = Math.atan2(-tz, tx);
    for (const side of [-1, 1]) {
      const x = w.road.xs[i] + nx * (ROAD_HALF + 0.9) * side;
      const z = w.road.zs[i] + nz * (ROAD_HALF + 0.9) * side;
      if (STOPS.some((s) => Math.hypot(s.x - x, s.z - z) < 6.5)) continue;
      if (riverDist(x, z) < RIVER_HALF + 1) continue;
      if (roadDist(x, z) < ROAD_HALF + 0.5) continue;
      items.fence.push({ x, y: w.gridHeight(x, z) - 0.05, z, rot, s: 2.6, sy: 3.4 });
      fenceAt(x, z, rot, 2.6, 3.4);
    }
  }

  // Overlook fence behind the start (cliff edge)
  for (let k = -3; k <= 3; k++) {
    const x = -143 + k * 2.5;
    const z = 67.5 + Math.abs(k) * -0.4;
    if (!w.walkable(x, z)) continue;
    items.fence.push({ x, y: w.gridHeight(x, z) - 0.05, z, rot: -0.65, s: 2.6, sy: 3.4 });
    fenceAt(x, z, -0.65, 2.6, 3.4);
  }

  // Boulder gardens: stepped rocks to scramble up (low → high, each reachable from the last)
  for (const bg of BOULDER_GARDENS) {
    const steps = [
      [0, 0, 3.2],
      [2.6, 1.4, 4.6],
      [4.4, -1.2, 6.2],
      [6.4, 1.0, 7.6],
      [-2.4, 2.2, 4.0],
      [-1.6, -2.8, 5.4],
    ];
    for (const [ox, oz, s] of steps) {
      const x = bg.x + ox;
      const z = bg.z + oz;
      if (roadDist(x, z) < ROAD_HALF + 3) continue;
      rockAt(rand() < 0.5 ? "rockA" : "rockC", x, z, s);
    }
  }
  colliders.push(...getForest().colliders);
  // lantern posts are solid
  for (const lp of getLamps()) colliders.push({ x: lp.x, z: lp.z, r: 0.3 });
  for (const sg of getHotspotSigns()) colliders.push({ x: sg.x, z: sg.z, r: 0.3 });

  // keep every doorway clear: no tree, bush or prop right in front of a door
  const doors = getBuildings().filter((d) => d.kind !== "treehouse");
  const blocksDoor = (x: number, z: number) => doors.some((d) => (d.x - x) ** 2 + (d.z - z) ** 2 < 3.2 ** 2);
  const keepers = new Set<string>(Object.values(BUILDING_KEY));
  for (const k of Object.keys(items) as ModelKey[]) if (!keepers.has(k)) items[k] = items[k].filter((p) => !blocksDoor(p.x, p.z));
  for (let i = colliders.length - 1; i >= 0; i--) if (colliders[i].r < 1.3 && blocksDoor(colliders[i].x, colliders[i].z)) colliders.splice(i, 1);

  cached = { items, colliders };
  return cached;
}

/** Spatial hash of colliders for fast player queries */
let grid: Map<number, Collider[]> | null = null;
const CELL = 8;
const key = (cx: number, cz: number) => (cx + 100) * 1000 + (cz + 100);

export function registerExtraColliders(extra: Collider[]) {
  const s = getScatter();
  s.colliders.push(...extra);
  grid = null;
}

/** Top surface height of a climbable collider (lazily cached). */
export function colliderTop(c: Collider) {
  if (c.h === undefined) return Infinity;
  if (c.top === undefined) c.top = getWorld().gridHeight(c.x, c.z) + c.h;
  return c.top;
}

/** How high a step the explorer can walk straight up without jumping. */
export const STEP_UP = 0.45;

/**
 * Height the explorer stands at: the terrain, or the top of anything
 * climbable underneath them that their feet are already above.
 */
export function supportAt(x: number, z: number, feetY: number) {
  let y = getWorld().groundAt(x, z);
  for (const c of collidersNear(x, z)) {
    if (c.h === undefined) continue;
    // stand on it anywhere over its footprint (a hair inside the edge)
    if (footprintDist(c, x, z) > (c.hw === undefined ? -c.r * 0.08 : -0.05)) continue;
    const t = surfaceAt(c, x, z);
    if (feetY >= t - STEP_UP && t > y) y = t;
  }
  return y;
}

/**
 * Moving solids (villagers, animals, traffic) — owners update x/z every frame.
 * Kept out of the static hash; collidersNear() appends the ones close by.
 */
export const dynamicBodies: Collider[] = [];

export function addDynamicBody(b: Collider) {
  dynamicBodies.push(b);
  return () => {
    const i = dynamicBodies.indexOf(b);
    if (i >= 0) dynamicBodies.splice(i, 1);
  };
}

let queryId = 0;
/** Everything solid within reach of (x, z). Large footprints are hashed into every cell they cover. */
export function collidersNear(x: number, z: number): Collider[] {
  if (!grid) {
    grid = new Map();
    for (const c of getScatter().colliders) {
      const x0 = Math.floor((c.x - c.r) / CELL);
      const x1 = Math.floor((c.x + c.r) / CELL);
      const z0 = Math.floor((c.z - c.r) / CELL);
      const z1 = Math.floor((c.z + c.r) / CELL);
      for (let gx = x0; gx <= x1; gx++)
        for (let gz = z0; gz <= z1; gz++) {
          const k = key(gx, gz);
          let b = grid.get(k);
          if (!b) grid.set(k, (b = []));
          b.push(c);
        }
    }
  }
  const out: Collider[] = [];
  const id = ++queryId;
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
      const b = grid.get(key(cx + dx, cz + dz));
      if (!b) continue;
      for (const c of b) {
        if (c.q === id) continue;
        c.q = id;
        out.push(c);
      }
    }
  for (const b of dynamicBodies) if (Math.abs(b.x - x) < 12 && Math.abs(b.z - z) < 12) out.push(b);
  return out;
}
