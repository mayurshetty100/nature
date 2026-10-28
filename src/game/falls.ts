import { getWorld, islandDist, rng } from "./world";
import { boxCollider, type Collider } from "./scatter";

/** One waterfall: lip at (x, z, top), tumbling along (dirX, dirZ) down to `bottom`. */
export type Fall = { x: number; z: number; top: number; bottom: number; dirX: number; dirZ: number; width: number; reach: number; seed: number; pool?: { x: number; z: number; y: number } };
export type FallRock = { p: [number, number, number]; s: [number, number, number]; r: number };

let cache: { cliff: Fall[]; mountain: Fall; rocks: FallRock[] } | null = null;

/** Every waterfall on the island (cliff-edge falls + the big mountain fall), built lazily. */
export function getFalls() {
  if (cache) return cache;
  const w = getWorld();
  const angles = [Math.PI * 0.97, Math.PI * 0.78, Math.PI * 0.42, -Math.PI * 0.45, -Math.PI * 0.68, -Math.PI * 0.88];
  const cliff: Fall[] = angles.map((a, i) => {
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    let r = 20;
    while (islandDist(dx * r, dz * r) < 0.915 && r < 230) r += 0.4;
    const x = dx * r;
    const z = dz * r;
    const top = w.gridHeight(x - dx * 1.5, z - dz * 1.5) - 0.25;
    const px = x - dx * 3.2;
    const pz = z - dz * 3.2;
    return { x: x - dx * 1.6, z: z - dz * 1.6, top, bottom: -0.2, dirX: dx, dirZ: dz, width: 2.6, reach: 6.5, seed: i + 1, pool: { x: px, z: pz, y: w.gridHeight(px, pz) } };
  });
  const r = w.river;
  const hx = r.xs[0];
  const hz = r.zs[0];
  const bottom = r.ys[0];
  const ddx = r.xs[6] - hx;
  const ddz = r.zs[6] - hz;
  const l = Math.hypot(ddx, ddz) || 1;
  const ux = ddx / l;
  const uz = ddz / l;
  const lx = hx - ux * 5;
  const lz = hz - uz * 5;
  const top = bottom + 10;
  const rand = rng(77);
  const rocks: FallRock[] = [];
  for (let k = 0; k < 16; k++) {
    const side = (k / 15 - 0.5) * 16;
    const back = 1.2 + rand() * 3;
    const px = lx - uz * side - ux * back;
    const pz = lz + ux * side - uz * back;
    const ground = w.gridHeight(px, pz);
    const hgt = top - ground + 1.5 - Math.abs(side) * 0.35;
    rocks.push({ p: [px, ground + hgt / 2 - 0.5, pz], s: [2.4 + rand() * 1.6, Math.max(2, hgt / 2), 2.2 + rand() * 1.4], r: rand() * 6 });
  }
  const mountain: Fall = { x: lx, z: lz, top, bottom, dirX: ux, dirZ: uz, width: 4.2, reach: 3.4, seed: 9 };
  cache = { cliff, mountain, rocks };
  return cache;
}

/**
 * Falling water and the rock wall behind it are solid: you can't drive or
 * walk through a waterfall's curtain or its cliff.
 */
export function fallColliders(): Collider[] {
  const { cliff, mountain, rocks } = getFalls();
  const out: Collider[] = [];
  for (const f of [...cliff, mountain]) {
    const d = f.reach + 1.2;
    const cx = f.x + f.dirX * (d / 2 - 0.3);
    const cz = f.z + f.dirZ * (d / 2 - 0.3);
    out.push(boxCollider(cx, cz, f.width * 1.25, d, Math.atan2(f.dirX, f.dirZ)));
  }
  // mountain ledge rocks: solid boulders (no climbing up the fall)
  for (const r of rocks) out.push({ x: r.p[0], z: r.p[2], r: Math.min(r.s[0], r.s[2]) * 0.85 });
  return out;
}
