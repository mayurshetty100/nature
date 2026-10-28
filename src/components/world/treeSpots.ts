import type { Placement } from "@/game/scatter";
import { PROCEDURAL_TREES } from "./constants";

/** A tree in the world that life can use (procedural broadleaf / conifer kinds only). */
export type TreeSpot = { key: string; x: number; y: number; z: number; s: number; rot: number };

const BROADLEAF = new Set(["oak", "default", "detailed", "fat", "tall"]);

/** Every procedural tree, flattened. Leaves fall from broadleaf crowns; birds perch on any of them. */
export function leafTree(items: Record<string, Placement[]>): TreeSpot[] {
  const out: TreeSpot[] = [];
  for (const k of Object.keys(items)) {
    if (!PROCEDURAL_TREES.has(k)) continue;
    for (const p of items[k]) out.push({ key: k, x: p.x, y: p.y, z: p.z, s: p.s, rot: p.rot });
  }
  return out;
}

/** The `max` trees nearest (x, z) within `radius`, broadleaf first. */
export function nearTrees(all: TreeSpot[], x: number, z: number, radius: number, max: number) {
  const r2 = radius * radius;
  return all
    .map((t) => ({ t, d: (t.x - x) ** 2 + (t.z - z) ** 2 - (BROADLEAF.has(t.key) ? 40 : 0) }))
    .filter((q) => q.d < r2)
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map((q) => q.t);
}

/** Wind gust strength 0..1 — the same slow rhythm that rustles the tent and the leaves. */
export function gustAt(t: number) {
  const g = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1);
  return Math.max(0, Math.min(1, g));
}
