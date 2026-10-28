import { beachWeight, getWorld, RIVER_HALF, ROAD_HALF, SEA_LEVEL } from "@/game/world";
import { getCityLoop, getLayout, CITY_ROAD_HALF } from "@/game/layout";
import { REGION_INDEX } from "@/game/regions";
import { getSeawalk, ICEBERGS } from "@/game/coast";

/** World area the map shows (x / z, world units). */
export const MAP_VB = { x: -196, z: -126, w: 392, h: 252 };
/** pixels per world unit */
const PX = 2;

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** matte ground colour per region, in journey order */
const REGION_RGB = ["#8fd06a", "#4f9a4c", "#b8cf5c", "#97c96c", "#a3ad98", "#86a960", "#b3d27a"].map(hex);
const SAND = hex("#f0dca8");
const ROCK = hex("#9a8f80");
const SNOW = hex("#f4f6f8");
const SHALLOW = hex("#63d2d6");
const DEEP = hex("#1f6f9e");
const CROP: Record<string, string> = { wheat: "#e8c45a", corn: "#d9b23a", leafs: "#6fbf4a", pumpkin: "#e8873a", dirt: "#9a6b45" };
const TOWER = ["#f2b8a0", "#a7c7e7", "#f4d58d", "#c9b6e4", "#a8d8b9", "#f7c6d9"];

let cache: string | null = null;

/**
 * A real top-down picture of the island, drawn once from the terrain: sea
 * depth, sand, region ground colours with hill shading, rock and snow peaks,
 * the river, the road, the city ring road, crop plots, houses, city blocks,
 * the seawalk and the icebergs. Returns a data URL (cached).
 */
export function mapImage(): string {
  if (cache) return cache;
  const w = getWorld();
  const W = MAP_VB.w * PX;
  const H = MAP_VB.h * PX;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let py = 0; py < H; py++) {
    const z = MAP_VB.z + (py + 0.5) / PX;
    for (let px = 0; px < W; px++) {
      const x = MAP_VB.x + (px + 0.5) / PX;
      const h = w.gridHeight(x, z);
      let c: number[];
      if (h < SEA_LEVEL - 0.02) {
        const k = Math.min(1, (SEA_LEVEL - h) / 7);
        c = SHALLOW.map((v, i) => v + (DEEP[i] - v) * k);
        // gentle wave sparkle
        const s = Math.sin(x * 0.9 + z * 0.4) * Math.sin(z * 0.7 - x * 0.2);
        if (s > 0.92) c = c.map((v) => v + 30);
      } else {
        const reg = REGION_RGB[REGION_INDEX[w.regionAt(x, z)]];
        c = reg;
        const b = beachWeight(x, z);
        if (h < 1.6 || b > 0.5) c = c.map((v, i) => v + (SAND[i] - v) * Math.min(1, Math.max(b, (1.6 - h) / 1.2)));
        if (h > 12) c = c.map((v, i) => v + (ROCK[i] - v) * Math.min(1, (h - 12) / 6));
        if (h > 21) c = c.map((v, i) => v + (SNOW[i] - v) * Math.min(1, (h - 21) / 3));
        // hill shading, lit from the north-west
        const gx = w.gridHeight(x + 1, z) - w.gridHeight(x - 1, z);
        const gz = w.gridHeight(x, z + 1) - w.gridHeight(x, z - 1);
        const shade = Math.min(1.25, Math.max(0.68, 1 - (gx + gz) * 0.09));
        c = c.map((v) => v * shade);
      }
      const o = (py * W + px) * 4;
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // world → canvas
  ctx.setTransform(PX, 0, 0, PX, -MAP_VB.x * PX, -MAP_VB.z * PX);
  const stroke = (xs: ArrayLike<number>, zs: ArrayLike<number>, n: number, width: number, color: string, close = false, dash?: number[]) => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, xs[i], zs[i]);
    if (close) ctx.closePath();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(dash ?? []);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  // river
  stroke(w.river.xs, w.river.zs, w.river.count, RIVER_HALF * 2 + 1, "#3e9fc9");
  stroke(w.river.xs, w.river.zs, w.river.count, RIVER_HALF * 2 - 1.2, "#6fd0e6");
  // crop plots + pasture
  const L = getLayout();
  for (const p of L.plots) {
    ctx.fillStyle = CROP[p.crop] ?? "#c9b46a";
    ctx.fillRect(p.x - p.w / 2, p.z - p.d / 2, p.w, p.d);
    ctx.strokeStyle = "rgba(90,60,30,0.45)";
    ctx.lineWidth = 0.4;
    ctx.strokeRect(p.x - p.w / 2, p.z - p.d / 2, p.w, p.d);
  }
  ctx.fillStyle = "rgba(160,210,110,0.9)";
  ctx.fillRect(L.paddock.x - L.paddock.w / 2, L.paddock.z - L.paddock.d / 2, L.paddock.w, L.paddock.d);
  ctx.strokeStyle = "#8a5a33";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(L.paddock.x - L.paddock.w / 2, L.paddock.z - L.paddock.d / 2, L.paddock.w, L.paddock.d);
  // city ring road
  const loop = getCityLoop();
  stroke(loop.xs, loop.zs, loop.count, CITY_ROAD_HALF * 2 + 0.6, "#2b2e36", true);
  stroke(loop.xs, loop.zs, loop.count, 0.35, "#f2e3b0", true, [2, 2]);
  // main road (sandy track with a pale centre)
  stroke(w.road.xs, w.road.zs, w.road.count, ROAD_HALF * 2 + 1.2, "#8a6a45");
  stroke(w.road.xs, w.road.zs, w.road.count, ROAD_HALF * 2 - 0.6, "#e9d3a0");
  // seawalk
  const sw = getSeawalk();
  stroke(sw.points.map((p) => p.x), sw.points.map((p) => p.z), sw.points.length, 2.6, "#a8693d");
  ctx.beginPath();
  ctx.arc(sw.lookout.x, sw.lookout.z, sw.lookout.r, 0, Math.PI * 2);
  ctx.fillStyle = "#b98a5b";
  ctx.fill();
  // village plaza + houses (terracotta roofs)
  ctx.beginPath();
  ctx.arc(L.plaza.x, L.plaza.z, L.plaza.r, 0, Math.PI * 2);
  ctx.fillStyle = "#e6d3ad";
  ctx.fill();
  const rect = (x: number, z: number, wd: number, dp: number, rot: number, fill: string, edge: string) => {
    ctx.save();
    ctx.translate(x, z);
    ctx.rotate(-rot);
    ctx.fillStyle = fill;
    ctx.fillRect(-wd / 2, -dp / 2, wd, dp);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.35;
    ctx.strokeRect(-wd / 2, -dp / 2, wd, dp);
    // ridge line
    ctx.beginPath();
    ctx.moveTo(-wd / 2, 0);
    ctx.lineTo(wd / 2, 0);
    ctx.stroke();
    ctx.restore();
  };
  for (const b of L.village) rect(b.x, b.z, 3.6 * b.scale, 3.2 * b.scale, b.rot, "#c8633f", "#7a3a22");
  rect(L.barn.x, L.barn.z, 7, 5, L.barn.rot, "#b8322b", "#6e1c18");
  // city blocks: pastel roofs, glass towers bluish
  L.towers.forEach((t) => rect(t.x, t.z, t.w, t.d, t.rot, t.kind === 1 ? "#9cc7e8" : TOWER[t.palette % TOWER.length], "#4b4f5c"));
  // palms
  ctx.fillStyle = "#3f8f4a";
  for (const p of L.palms) {
    ctx.beginPath();
    ctx.arc(p.x, p.z, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // icebergs
  for (const b of ICEBERGS) {
    ctx.beginPath();
    ctx.arc(b.x, b.z, b.r, 0, Math.PI * 2);
    ctx.fillStyle = "#f4fbff";
    ctx.fill();
    ctx.strokeStyle = "#9fd8ea";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  cache = canvas.toDataURL("image/png");
  return cache;
}
