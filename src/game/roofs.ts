/**
 * Rooftop terraces on the city's apartment blocks and cafés. Climb the ladder on
 * a building's top floor and you step out onto its real roof, high above the
 * island; the hatch beside you takes you back downstairs. Pure data, built lazily.
 */
import { getLayout, type Tower } from "./layout";
import { getBuildings } from "./buildings";
import { getWorld } from "./world";

/** Ground level a city block stands on (matches the renderer). */
export function towerBase(t: Tower) {
  const w = getWorld();
  return Math.min(w.gridHeight(t.x, t.z), w.gridHeight(t.x + t.w / 2, t.z + t.d / 2), w.gridHeight(t.x - t.w / 2, t.z - t.d / 2)) - 0.4;
}

/** Height of the walkable roof surface (top of the cornice / roof slab). */
export function roofTop(t: Tower) {
  const H = t.h + 0.4;
  return towerBase(t) + H + (t.kind === 1 ? 0.5 : 0.425);
}

/** Tower-local (x along w, z along d) → world. */
export function towerToWorld(t: Tower, lx: number, lz: number) {
  const c = Math.cos(t.rot);
  const s = Math.sin(t.rot);
  return { x: t.x + lx * c + lz * s, z: t.z - lx * s + lz * c };
}

export type Roof = {
  /** building whose top floor connects to this roof */
  id: string;
  tower: number;
  y: number;
  /** the hatch kiosk (tower-local and world) */
  hatchL: { x: number; z: number };
  hatch: { x: number; z: number };
  /** where you stand when you come up */
  arrive: { x: number; z: number; yaw: number };
  /** rail inset from the roof edge */
  inset: number;
  /** terrace furniture, tower-local */
  props: RoofProp[];
};

export type RoofProp = { kind: "lounger" | "planter" | "umbrella" | "bistro"; lx: number; lz: number; rot: number };

export const RAIL_INSET = 0.4;
export const RAIL_HEIGHT = 1.05;

let cache: Roof[] | null = null;

/** Apartments and cafés have terraces (glass office towers keep their plant rooms). */
export function getRoofs(): Roof[] {
  if (cache) return cache;
  const { towers } = getLayout();
  const out: Roof[] = [];
  for (const b of getBuildings()) {
    if (b.tower === undefined || (b.kind !== "apartment" && b.kind !== "cafe")) continue;
    const t = towers[b.tower];
    const hatchL = { x: -t.w / 2 + 1.2, z: -t.d / 2 + 1.2 };
    const hatch = towerToWorld(t, hatchL.x, hatchL.z);
    const a = towerToWorld(t, hatchL.x + 1.3, hatchL.z + 1.3);
    // arrive facing the roof's far corner (the view)
    const far = towerToWorld(t, t.w / 2, t.d / 2);
    const hw = t.w / 2;
    const hd = t.d / 2;
    const props: RoofProp[] = [
      { kind: "lounger", lx: hw - 1.3, lz: -0.9, rot: 0 },
      { kind: "lounger", lx: hw - 1.3, lz: 0.9, rot: 0 },
      { kind: "umbrella", lx: hw - 1.3, lz: 0, rot: 0 },
      { kind: "planter", lx: -hw + 1.0, lz: hd - 0.85, rot: 0 },
      { kind: "planter", lx: hw - 1.0, lz: hd - 0.85, rot: 0 },
      { kind: "planter", lx: hw - 1.0, lz: -hd + 0.85, rot: 0 },
      { kind: "bistro", lx: -0.6, lz: 0.9, rot: 0 },
    ];
    out.push({ id: b.id, tower: b.tower, y: roofTop(t), hatchL, hatch, arrive: { x: a.x, z: a.z, yaw: Math.atan2(far.x - a.x, far.z - a.z) }, inset: RAIL_INSET, props });
  }
  cache = out;
  return out;
}

export function roofFor(buildingId: string) {
  return getRoofs().find((r) => r.id === buildingId) ?? null;
}

/** The roof hatch within reach of someone standing at (x, y, z). */
export function nearestHatch(x: number, y: number, z: number, reach = 1.7) {
  for (const r of getRoofs()) {
    if (Math.abs(y - r.y) > 0.8) continue;
    if (Math.hypot(r.hatch.x - x, r.hatch.z - z) < reach) return r;
  }
  return null;
}

/**
 * Solid parts of every roof: support circles you can stand on, a railing ring you
 * can't walk through, and the hatch kiosk. `top` is absolute height.
 */
export function roofColliders() {
  const { towers } = getLayout();
  const out: { x: number; z: number; r: number; h: number; top: number }[] = [];
  for (const r of getRoofs()) {
    const t = towers[r.tower];
    // walkable slab: a grid of support discs
    for (let lx = -t.w / 2 + 0.9; lx <= t.w / 2 - 0.8; lx += 1.2)
      for (let lz = -t.d / 2 + 0.9; lz <= t.d / 2 - 0.8; lz += 1.2) {
        const p = towerToWorld(t, lx, lz);
        out.push({ ...p, r: 0.95, h: 1, top: r.y });
      }
    // railing
    const hw = t.w / 2 - r.inset;
    const hd = t.d / 2 - r.inset;
    const edge = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.ceil(len / 0.55));
      for (let k = 0; k <= n; k++) {
        const p = towerToWorld(t, x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n);
        out.push({ ...p, r: 0.18, h: 1, top: r.y + RAIL_HEIGHT });
      }
    };
    edge(-hw, -hd, hw, -hd);
    edge(hw, -hd, hw, hd);
    edge(hw, hd, -hw, hd);
    edge(-hw, hd, -hw, -hd);
    out.push({ ...r.hatch, r: 0.55, h: 1, top: r.y + 2.2 });
    for (const pr of r.props) {
      if (pr.kind === "umbrella") continue;
      const p = towerToWorld(t, pr.lx, pr.lz);
      out.push({ ...p, r: pr.kind === "lounger" ? 0.45 : 0.4, h: 1, top: r.y + (pr.kind === "planter" ? 0.55 : 0.42) });
    }
  }
  return out;
}
