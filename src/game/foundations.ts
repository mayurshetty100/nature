/**
 * Foundations: wherever a building's floor sits above the slope it's built on,
 * a stone plinth fills the gap down into the ground, so nothing floats.
 * Pure data, built lazily (tested).
 */
import { getWorld } from "./world";
import { getLayout, shellFootprint } from "./layout";

export type Plinth = { x: number; z: number; w: number; d: number; rot: number; top: number; bottom: number };

/** Lowest ground under an oriented footprint (three.js Y-rotation `rot`), sampled on a 5×5 grid. */
export function footprintMinGround(x: number, z: number, w: number, d: number, rot: number) {
  const g = getWorld();
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  let min = Infinity;
  for (let i = 0; i <= 4; i++)
    for (let j = 0; j <= 4; j++) {
      const u = (i / 4 - 0.5) * w;
      const v = (j / 4 - 0.5) * d;
      min = Math.min(min, g.gridHeight(x + u * c + v * s, z - u * s + v * c));
    }
  return min;
}

/** A plinth for a footprint whose floor is at `top`, or null when it already sits on the ground. */
export function plinthFor(x: number, z: number, w: number, d: number, rot: number, top: number): Plinth | null {
  const low = footprintMinGround(x, z, w + 0.3, d + 0.3, rot);
  if (top - low < 0.06) return null;
  return { x, z, w: w + 0.3, d: d + 0.3, rot, top: top + 0.02, bottom: low - 0.35 };
}

let cache: Plinth[] | null = null;

/** Plinths under the village houses and the barn. */
export function getFoundations(): Plinth[] {
  if (cache) return cache;
  const w = getWorld();
  const { village, barn } = getLayout();
  const out: Plinth[] = [];
  const add = (model: string, bx: number, bz: number, scale: number, rot: number) => {
    const f = shellFootprint(model, bx, bz, scale, rot);
    if (!f) return;
    // the house model stands at the ground under its origin (see scatter `add`)
    const p = plinthFor(f.x, f.z, f.w, f.d, rot, w.gridHeight(bx, bz) - 0.08);
    if (p) out.push(p);
  };
  for (const b of village) add(b.model, b.x, b.z, b.scale, b.rot);
  add("Stable", barn.x, barn.z, 2.6, barn.rot);
  cache = out;
  return out;
}
