import { boxColliders, getLayout } from "./layout";
import { roofColliders, roofTop } from "./roofs";

/** Solid footprints for the city blocks (with real roof heights you can stand on), roof terraces and beach palms. */
export function cityColliders() {
  const { towers, palms } = getLayout();
  const out: { x: number; z: number; r: number; h?: number; top?: number }[] = [];
  for (const t of towers) {
    const top = roofTop(t);
    for (const c of boxColliders(t.x, t.z, t.w, t.d, t.rot)) out.push({ ...c, h: 1, top });
  }
  out.push(...roofColliders());
  for (const p of palms) out.push({ x: p.x, z: p.z, r: 0.5 });
  return out;
}
