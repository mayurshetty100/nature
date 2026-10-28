/**
 * Every building you can walk into: village houses, the inn, the bell tower,
 * the barn and mill, each city block, the landmarks and the treehouse. Each
 * gets a door just outside its footprint and the kind of interior it opens.
 * Pure data, built lazily once.
 */
import { getLayout } from "./layout";
import { STOP_BY_ID } from "./stops";
import { getForest } from "./trails";
import { CITY_GIANTS, giantDoorDir } from "./landmarkColliders";
import { getWorld } from "./world";

export type InteriorKind = "cottage" | "inn" | "apartment" | "office" | "skyscraper" | "cafe" | "barn" | "mill" | "workshop" | "castle" | "lighthouse" | "belfry" | "treehouse";

/** Which resume chapter a landmark's interior shows on its wall board. */
export type BoardId = "education" | "projects" | "experience" | "contact";

export type Enterable = {
  id: string;
  kind: InteriorKind;
  name: string;
  /** door (world) — just outside the building */
  x: number;
  z: number;
  y: number;
  /** direction pointing out of the building */
  yaw: number;
  seed: number;
  board?: BoardId;
  /** interior flavour (e.g. "coastal" for the lighthouse keeper's cottage) */
  style?: string;
  /** index into the city layout's towers (city blocks only) */
  tower?: number;
};

const COTTAGE_NAMES = ["Love Nest Cottage", "Crush Cottage", "Heartbeat House", "Cuddle Cabin", "Blush Bungalow", "Wink Cottage", "Sweetpea House", "Daydream Den", "Puppy-Love Lodge", "First-Date Cottage", "Butterflies Bungalow", "Honeybun House"];
const APARTMENT_NAMES = ["Situationship Suites", "Read-Receipt Residences", "Left-On-Seen Lofts", "Swipe-Right Heights", "Ex-Free Flats", "Plot-Twist Apartments"];
const OFFICE_NAMES = ["Overtime Romance Tower", "Deadline Drama HQ", "Pitch-Perfect Plaza", "Corner-Office Crush", "Big Boss Energy Tower"];
const GIANT_NAMES = ["Mixed Signals Spire", "Rooftop Rizz Tower", "Commitment-Issues Tower", "Cloud Nine Plaza", "Butterflies Tower"];
const CAFE_NAMES = ["Espresso Yourself", "Brew-tiful Café", "Latte Love", "Spill the Tea", "Bun Intended Bakery"];

let cached: Enterable[] | null = null;

export function getBuildings(): Enterable[] {
  if (cached) return cached;
  const w = getWorld();
  const L = getLayout();
  const out: Enterable[] = [];
  let seed = 1;
  const add = (kind: InteriorKind, name: string, cx: number, cz: number, yaw: number, reach: number, extra?: Partial<Enterable>) => {
    const x = cx + Math.sin(yaw) * reach;
    const z = cz + Math.cos(yaw) * reach;
    out.push({ id: `${kind}-${out.length}`, kind, name, x, z, y: w.groundAt(x, z), yaw, seed: seed++, ...extra });
  };

  // Maple Village
  let cottages = 0;
  for (const b of L.village) {
    const reach = b.r * 0.82 + 0.75;
    if (b.model === "Inn") add("inn", "The Flirty Fox Inn", b.x, b.z, b.rot, reach);
    else if (b.model === "Bell_Tower") add("belfry", "Wedding Bells Tower", b.x, b.z, b.rot, reach);
    else if (b.model === "Mill") add("mill", "Grind & Glow Mill", b.x, b.z, b.rot, reach);
    else add("cottage", COTTAGE_NAMES[cottages++ % COTTAGE_NAMES.length], b.x, b.z, b.rot, reach);
  }
  // the farm barn
  add("barn", "Hay There Barn", L.barn.x, L.barn.z, L.barn.rot, 4.3 * 0.85 + 0.9);

  // City blocks: apartments, offices and cafés, doors on the street face
  let na = 0;
  let no = 0;
  let nc = 0;
  L.towers.forEach((t, ti) => {
    const dx = Math.cos(t.rot) * t.side;
    const dz = -Math.sin(t.rot) * t.side;
    const yaw = Math.atan2(dx, dz);
    const reach = t.w / 2 + 0.8;
    if (t.kind === 2) add("cafe", CAFE_NAMES[nc++ % CAFE_NAMES.length], t.x, t.z, yaw, reach, { tower: ti });
    else if (t.kind === 1) add("office", OFFICE_NAMES[no++ % OFFICE_NAMES.length], t.x, t.z, yaw, reach, { tower: ti });
    else add("apartment", APARTMENT_NAMES[na++ % APARTMENT_NAMES.length], t.x, t.z, yaw, reach, { tower: ti });
  });

  // Landmarks
  {
    const a = STOP_BY_ID.academy;
    const rot = Math.atan2(a.x - a.lx, a.z - a.lz);
    // the keep stands at local (0, -2); its door faces the courtyard gate
    const kx = a.lx + -2 * Math.sin(rot);
    const kz = a.lz + -2 * Math.cos(rot);
    add("castle", STOP_BY_ID.academy.name, kx, kz, rot, 4.5 + 0.7, { board: "education" });
  }
  {
    const f = STOP_BY_ID.forest;
    add("workshop", STOP_BY_ID.forest.name, f.lx, f.lz, Math.atan2(f.x - f.lx, f.z - f.lz), 4.2 + 0.7, { board: "projects" });
  }
  // the six skyscrapers round the City of Giants plaza — every one has a lobby door
  {
    const c = STOP_BY_ID.city;
    CITY_GIANTS.forEach(([ox, oz, wd], i) => {
      const [nx, nz] = giantDoorDir(i);
      add("skyscraper", i === 0 ? "Situationship HQ" : GIANT_NAMES[(i - 1) % GIANT_NAMES.length], c.lx + ox, c.lz + oz, Math.atan2(nx, nz), wd * 0.72 + 0.7, i === 0 ? { board: "experience" } : undefined);
    });
  }
  {
    const v = STOP_BY_ID.cove;
    add("lighthouse", STOP_BY_ID.cove.name, v.lx, v.lz, Math.atan2(v.x - v.lx, v.z - v.lz), 2.8 + 0.7, { board: "contact" });
    // keeper's cottage beside it (local -5.2, -2.5, turned 0.5)
    add("cottage", "Lonely Keeper's Cottage", v.lx - 5.2, v.lz - 2.5, 0.5, 1.8 + 0.75, { style: "coastal" });
  }
  {
    const th = getForest().treehouse;
    out.push({ id: "treehouse", kind: "treehouse", name: "Secret Crush Treehouse", x: th.door.x, z: th.door.z, y: th.door.y, yaw: th.door.yaw, seed: seed++ });
  }
  cached = out;
  return out;
}

export function getBuilding(id: string) {
  return getBuildings().find((b) => b.id === id) ?? null;
}

/** The closest door within reach of a visitor standing at (x, y, z). */
export function nearestDoor(x: number, y: number, z: number, reach = 2.4) {
  let best: Enterable | null = null;
  let bd = reach;
  for (const b of getBuildings()) {
    if (Math.abs(b.y - y) > 1.6) continue;
    const d = Math.hypot(b.x - x, b.z - z);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}
