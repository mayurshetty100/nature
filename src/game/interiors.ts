/**
 * Walk-in interiors. Every enterable building opens a furnished room set (one
 * or more storeys joined by switch-back stairs) generated from its kind and
 * seed. Rooms live far outside the island at INTERIOR_ORIGIN and use their own
 * floor / wall physics, so the outside world can be hidden while you're inside.
 * Local coordinates: x across, z front(+, door wall) to back(−), y up.
 */
import { FURNITURE, FURN_SCALE, type FurnKey } from "./furniture";
import { getBuilding, type BoardId, type InteriorKind } from "./buildings";
import { rng } from "./world";
import { education, experience, profile, projects } from "@/data/portfolio";

export const INTERIOR_ORIGIN = { x: 1500, z: 1500 };
export const STEP = 0.45;
/** Width of the front door gap. */
export const DOOR_HALF = 0.95;

export type Rect = { x0: number; x1: number; z0: number; z1: number };
export type Solid = Rect & { y0: number; y1: number; rail?: boolean; wall?: boolean };
/** A straight flight rising along x (`up` = +1 rises toward x1). */
export type Stair = Rect & { y0: number; y1: number; up: 1 | -1 };
export type Floor = { y: number; holes: Rect[] };
export type Furn = { key: FurnKey; x: number; y: number; z: number; rot: number; tint?: string };
/** Larger CC0 models from the village / animal packs (hay, barrels, cows…). */
export type Prop = { url: string; x: number; y: number; z: number; rot: number; h: number; clip?: string };
export type Decor =
  | { type: "fireplace"; x: number; y: number; z: number; rot: number }
  | { type: "painting"; x: number; y: number; z: number; rot: number; w: number; h: number; seed: number }
  | { type: "screen"; x: number; y: number; z: number; rot: number; w: number; h: number; seed: number }
  | { type: "chandelier"; x: number; y: number; z: number }
  | { type: "pendant"; x: number; y: number; z: number; color: string }
  | { type: "banner"; x: number; y: number; z: number; rot: number; color: string }
  | { type: "beacon"; x: number; y: number; z: number }
  | { type: "bell"; x: number; y: number; z: number }
  | { type: "gear"; x: number; y: number; z: number; rot: number; r: number }
  | { type: "board"; x: number; y: number; z: number; rot: number; w: number; h: number; title: string; lines: string[] }
  | { type: "box"; x: number; y: number; z: number; w: number; h: number; d: number; color: string }
  | { type: "cyl"; x: number; y: number; z: number; r: number; h: number; color: string }
  | { type: "window"; x: number; y: number; z: number; rot: number; w: number; h: number }
  | { type: "telescope"; x: number; y: number; z: number; rot: number }
  | { type: "candle"; x: number; y: number; z: number }
  | { type: "curtain"; x: number; y: number; z: number; rot: number; w: number; h: number; color: string }
  | { type: "vase"; x: number; y: number; z: number; color: string; flower: string }
  | { type: "shelf"; x: number; y: number; z: number; rot: number; w: number; color: string }
  | { type: "easel"; x: number; y: number; z: number; rot: number; seed: number }
  | { type: "lift"; x: number; y: number; z: number; rot: number; level: number }
  /** a row of books filling each shelf of a bookcase (shelf tops are absolute heights) */
  | { type: "books"; x: number; y: number; z: number; rot: number; w: number; depth: number; shelves: number[]; seed: number }
  /** bathroom curtain on a rail — it slides open as you walk through */
  | { type: "showerCurtain"; x: number; y: number; z: number; rot: number; w: number; h: number; color: string }
  /** ladder up to the roof hatch */
  | { type: "ladder"; x: number; y: number; z: number; rot: number; h: number };
/** Somewhere to rest (sit / lie down) or a lift landing; shown as a prompt when you're close. */
export type Spot = {
  kind: "sit" | "lie" | "lift" | "roof";
  x: number;
  y: number;
  z: number;
  /** direction the explorer faces while using it */
  yaw: number;
  level: number;
  label: string;
  /** where you stand back up */
  standX: number;
  standZ: number;
};
export type Light = { x: number; y: number; z: number; color: string; intensity: number; distance: number };

export type FloorTex = "wood" | "tile" | "stone" | "carpet" | "plank" | "marble";
export type WallTex = "paint" | "brick" | "stone" | "timber" | "glass";

export type Interior = {
  id: string;
  kind: InteriorKind;
  name: string;
  w: number;
  d: number;
  storey: number;
  levels: number;
  floors: Floor[];
  stairs: Stair[];
  solids: Solid[];
  furn: Furn[];
  props: Prop[];
  decor: Decor[];
  lights: Light[];
  spots: Spot[];
  look: { wall: string; wallLow: string; floor: string; trim: string; ceiling: string; floorTex: FloorTex; wallTex: WallTex };
  spawn: { x: number; z: number; yaw: number };
};

const S = FURN_SCALE;

/** Seat / mattress height and how far forward of centre you sit (model units), per restable model. */
const SEATS: Partial<Record<FurnKey, { kind: "sit" | "lie"; h: number; fwd: number; label: string }>> = {
  chair: { kind: "sit", h: 0.21, fwd: 0.02, label: "Sit on the chair" },
  chairCushion: { kind: "sit", h: 0.21, fwd: 0.02, label: "Sit on the chair" },
  chairRounded: { kind: "sit", h: 0.21, fwd: 0.02, label: "Sit on the chair" },
  chairDesk: { kind: "sit", h: 0.25, fwd: 0.03, label: "Sit at the desk" },
  stoolBar: { kind: "sit", h: 0.43, fwd: 0, label: "Sit on the stool" },
  benchCushion: { kind: "sit", h: 0.22, fwd: 0.02, label: "Sit on the bench" },
  loungeChair: { kind: "sit", h: 0.2, fwd: 0.05, label: "Sit in the armchair" },
  loungeSofa: { kind: "sit", h: 0.2, fwd: 0.05, label: "Sit on the sofa" },
  loungeDesignSofa: { kind: "sit", h: 0.2, fwd: 0.05, label: "Sit on the sofa" },
  loungeSofaLong: { kind: "sit", h: 0.2, fwd: 0.18, label: "Sit on the sofa" },
  bedDouble: { kind: "lie", h: 0.2, fwd: 0, label: "Lie down on the bed" },
  bedSingle: { kind: "lie", h: 0.2, fwd: 0, label: "Lie down on the bed" },
  bedBunk: { kind: "lie", h: 0.17, fwd: 0, label: "Lie down on the bunk" },
};
/** Shelf heights (model units) inside each bookcase model. */
const BOOK_SHELVES: Partial<Record<FurnKey, number[]>> = {
  bookcaseOpen: [0.13, 0.37, 0.61],
  bookcaseClosedWide: [0.07, 0.31, 0.55],
};
const Q = Math.PI / 2;
const V = (n: string) => `/models/village/${n}.glb`;
const A = (n: string) => `/models/animals/${n}.glb`;

const inRect = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

export function stairHeight(s: Stair, x: number) {
  const t = Math.min(1, Math.max(0, (x - s.x0) / (s.x1 - s.x0)));
  return s.up > 0 ? s.y0 + t * (s.y1 - s.y0) : s.y1 - t * (s.y1 - s.y0);
}

/** Highest surface (floor, stair or furniture top) the feet can stand on here. */
export function floorAt(I: Interior, x: number, z: number, feet: number) {
  let best = -Infinity;
  for (const f of I.floors) {
    if (f.y > feet + STEP || f.y <= best) continue;
    if (f.holes.some((h) => inRect(h, x, z))) continue;
    best = f.y;
  }
  for (const s of I.stairs) {
    if (!inRect(s, x, z)) continue;
    const h = stairHeight(s, x);
    if (h <= feet + STEP && h > best) best = h;
  }
  for (const b of I.solids) {
    if (b.wall || !inRect(b, x, z)) continue;
    if (b.y1 <= feet + STEP && b.y1 > best) best = b.y1;
  }
  return best === -Infinity ? 0 : best;
}

function pushOut(r: Rect, x: number, z: number, rad: number) {
  const cx = Math.min(r.x1, Math.max(r.x0, x));
  const cz = Math.min(r.z1, Math.max(r.z0, z));
  let dx = x - cx;
  let dz = z - cz;
  const d = Math.hypot(dx, dz);
  if (d >= rad) return null;
  if (d < 1e-5) {
    // centre inside the box: leave by the nearest side
    const opts = [
      [x - r.x0, -1, 0],
      [r.x1 - x, 1, 0],
      [z - r.z0, 0, -1],
      [r.z1 - z, 0, 1],
    ];
    opts.sort((a, b) => a[0] - b[0]);
    const [, sx, sz] = opts[0];
    return { x: sx ? (sx < 0 ? r.x0 - rad : r.x1 + rad) : x, z: sz ? (sz < 0 ? r.z0 - rad : r.z1 + rad) : z };
  }
  dx /= d;
  dz /= d;
  return { x: cx + dx * rad, z: cz + dz * rad };
}

/** Slide a body of radius `rad` out of walls, furniture and stair sides it can't step onto. */
export function collideInterior(I: Interior, x: number, z: number, feet: number, rad: number) {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of I.solids) {
      if (!b.wall && feet >= b.y1 - STEP) continue;
      if (feet + 1.7 < b.y0) continue;
      const p = pushOut(b, x, z, rad);
      if (p) {
        x = p.x;
        z = p.z;
      }
    }
    for (const s of I.stairs) {
      const cx = Math.min(s.x1, Math.max(s.x0, x));
      if (feet >= stairHeight(s, cx) - STEP) continue;
      if (feet + 1.7 < s.y0) continue;
      const p = pushOut(s, x, z, rad);
      if (p) {
        x = p.x;
        z = p.z;
      }
    }
  }
  return { x, z };
}

/** Index of the storey the feet are on. */
export function levelOf(I: Interior, feet: number) {
  return Math.max(0, Math.min(I.levels - 1, Math.floor((feet + 0.6) / I.storey)));
}

/** Standing in the doorway, heading out. */
export function atExit(I: Interior, x: number, z: number, feet: number) {
  return feet < 0.6 && Math.abs(x) < DOOR_HALF && z > I.d / 2 - 0.45;
}

/* ------------------------------------------------------------------ */
/* generators                                                          */
/* ------------------------------------------------------------------ */

const WALLS = ["#f3e6cf", "#e9d8bd", "#dfe8e1", "#f1dccf", "#e3e0ee", "#f4ead7", "#dbe6ef"];
const WALL_LOW = ["#b98d62", "#8fae8f", "#a46f5a", "#7d93b0", "#c09a6b", "#8c7aa3"];
const FLOORS = ["#b98252", "#a06d43", "#c69a68", "#8f5d3a"];
const SOFA = ["#4f7fae", "#c45b4a", "#6f9f62", "#d8a24a", "#8a6bb0", "#3f6f6a", "#e07a8a"];

function boardFor(id: BoardId): { title: string; lines: string[] } {
  if (id === "education") return { title: "Brains? Certified.", lines: [education.degree, education.institution, education.period, `CGPA ${education.cgpa}`] };
  if (id === "experience") return { title: "Companies that got a taste", lines: experience.map((e) => `${e.company} — ${e.role} · ${e.period}`) };
  if (id === "projects") return { title: "Stuff that slaps", lines: projects.map((p) => `${p.name} — ${p.tags.split("·")[0].trim()}`) };
  const strip = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  return { title: "Slide into my DMs", lines: [profile.links.email, strip(profile.links.linkedin), strip(profile.links.github)] };
}

class Room {
  I: Interior;
  rand: () => number;
  m: 1 | -1;
  constructor(id: string, kind: InteriorKind, name: string, w: number, d: number, levels: number, storey: number, seed: number, mirror = true) {
    this.rand = rng(seed * 7919 + 17);
    this.m = mirror && this.rand() < 0.5 ? -1 : 1;
    const pick = <T>(a: T[]) => a[Math.floor(this.rand() * a.length)];
    this.I = {
      id,
      kind,
      name,
      w,
      d,
      storey,
      levels,
      floors: Array.from({ length: levels }, (_, k) => ({ y: k * storey, holes: [] })),
      stairs: [],
      solids: [],
      furn: [],
      props: [],
      decor: [],
      lights: [],
      spots: [],
      look: { wall: pick(WALLS), wallLow: pick(WALL_LOW), floor: pick(FLOORS), trim: "#f7f1e6", ceiling: "#f6efe2", floorTex: "wood", wallTex: "paint" },
      spawn: { x: 0, z: d / 2 - 1.2, yaw: Math.PI },
    };
  }
  pick<T>(a: T[]) {
    return a[Math.floor(this.rand() * a.length)];
  }
  x(v: number) {
    return v * this.m;
  }
  r(rot: number) {
    return this.m < 0 ? -rot : rot;
  }
  rect(x0: number, x1: number, z0: number, z1: number): Rect {
    const a = this.x(x0);
    const b = this.x(x1);
    return { x0: Math.min(a, b), x1: Math.max(a, b), z0, z1 };
  }
  y(level: number) {
    return level * this.I.storey;
  }
  /** Furniture with its own box collider (you can hop onto anything low enough). */
  furn(key: FurnKey, x: number, z: number, rot = 0, level = 0, o: { y?: number; solid?: boolean; tint?: string; top?: number } = {}) {
    const [fw, fh, fd] = FURNITURE[key];
    const y = this.y(level) + (o.y ?? 0);
    const turned = Math.abs(Math.round(rot / Q)) % 2 === 1;
    const w = (turned ? fd : fw) * S;
    const d = (turned ? fw : fd) * S;
    const X = this.x(x);
    const yaw = this.r(rot);
    this.I.furn.push({ key, x: X, y, z, rot: yaw, tint: o.tint });
    if (o.solid !== false) this.I.solids.push({ x0: X - w / 2, x1: X + w / 2, z0: z - d / 2, z1: z + d / 2, y0: y, y1: y + (o.top ?? fh * S) });
    const shelves = BOOK_SHELVES[key];
    if (shelves) {
      // books on every shelf (model centred: shelf back sits a little behind centre)
      const fz = Math.cos(yaw);
      const fx = Math.sin(yaw);
      const inner = (key === "bookcaseOpen" ? 0.36 : 0.76) * S;
      this.I.decor.push({ type: "books", x: X + fx * 0.03, y, z: z + fz * 0.03, rot: yaw, w: inner, depth: 0.3, shelves: shelves.map((h) => y + h * S), seed: Math.floor(this.rand() * 9999) });
    }
    const seat = SEATS[key];
    if (seat && !o.y) {
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      // lying down: feet toward the foot of the bed, head on the pillow
      const off = seat.kind === "lie" ? 0.9 : seat.fwd * S;
      const out = (fd * S) / 2 + 0.6;
      this.I.spots.push({ kind: seat.kind, x: X + fx * off, y: y + seat.h * S, z: z + fz * off, yaw, level, label: seat.label, standX: X + fx * out, standZ: z + fz * out });
    }
    return { w, d, h: fh * S, y };
  }
  solid(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, extra: Partial<Solid> = {}) {
    this.I.solids.push({ ...this.rect(x0, x1, z0, z1), y0, y1, ...extra });
  }
  prop(url: string, x: number, z: number, rot: number, h: number, level = 0, r = 0, clip?: string) {
    const y = this.y(level);
    this.I.props.push({ url, x: this.x(x), y, z, rot: this.r(rot), h, clip });
    if (r > 0) this.I.solids.push({ x0: this.x(x) - r, x1: this.x(x) + r, z0: z - r, z1: z + r, y0: y, y1: y + h });
  }
  decor(d: Decor) {
    const out = { ...d } as Decor & { x: number; rot?: number };
    out.x = this.x(out.x);
    if (typeof out.rot === "number") out.rot = this.r(out.rot);
    this.I.decor.push(out);
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, solid = true) {
    this.decor({ type: "box", x, y, z, w, h, d, color });
    if (solid) this.solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y, y + h);
  }
  light(x: number, y: number, z: number, color = "#ffd9a0", intensity = 14, distance = 13) {
    this.I.lights.push({ x: this.x(x), y, z, color, intensity, distance });
  }
  /** curtain fabric colour for this home's windows (none in offices / barns) */
  curtain: string | null = null;
  /** No window where a painting, board, fireplace or tall furniture already stands against that wall. */
  private covered(x: number, y: number, z: number, rot: number, w: number, h: number) {
    const alongZ = Math.abs(Math.abs(rot) - Q) < 0.01;
    const at = alongZ ? z : x;
    for (const dd of this.I.decor) {
      if (dd.type !== "painting" && dd.type !== "board" && dd.type !== "shelf" && dd.type !== "screen" && dd.type !== "fireplace" && dd.type !== "lift") continue;
      if (Math.abs(dd.rot - rot) > 0.01) continue;
      if (alongZ ? Math.abs(dd.x - x) > 0.7 : Math.abs(dd.z - z) > 0.7) continue;
      const half = ("w" in dd ? dd.w : 2.3) / 2;
      const tall = dd.type === "fireplace" || dd.type === "lift";
      if (!tall && Math.abs(dd.y - y) > 1.6) continue;
      if (Math.abs((alongZ ? dd.z : dd.x) - at) < half + w / 2 + 0.12) return true;
    }
    for (const s of this.I.solids) {
      if (s.wall || s.rail || s.y1 - s.y0 < 1.3) continue;
      if (s.y0 > y + h / 2 || s.y1 < y - h / 2) continue;
      if (alongZ) {
        if (Math.min(Math.abs(s.x0 - x), Math.abs(s.x1 - x)) > 0.9) continue;
        if (s.z1 < z - w / 2 || s.z0 > z + w / 2) continue;
      } else {
        if (Math.min(Math.abs(s.z0 - z), Math.abs(s.z1 - z)) > 0.9) continue;
        if (s.x1 < x - w / 2 || s.x0 > x + w / 2) continue;
      }
      return true;
    }
    return false;
  }
  private win(x: number, y: number, z: number, rot: number, w: number, h: number) {
    if (this.covered(x, y, z, rot, w, h)) return;
    this.I.decor.push({ type: "window", x, y, z, rot, w, h });
    if (this.curtain) this.I.decor.push({ type: "curtain", x, y, z, rot, w, h, color: this.curtain });
  }
  /** Windows spaced along the side and back walls of a storey. */
  windows(level: number, h = 1.5, every = 3.4, ww = 1.4) {
    const { w, d } = this.I;
    const y = this.y(level) + 1.1 + h / 2;
    for (let z = -d / 2 + 2.2; z < d / 2 - 1.4; z += every) {
      this.win(-w / 2 + 0.02, y, z, Q, ww, h);
      this.win(w / 2 - 0.02, y, z, -Q, ww, h);
    }
    for (let x = -w / 2 + 2; x < w / 2 - 1.5; x += every + 0.6) {
      if (this.I.stairs.length && level < this.I.levels && x < -w / 2 + 9) continue;
      if (this.liftX !== null && Math.abs(x - this.liftX) < 1.8) continue;
      this.win(x, y, -d / 2 + 0.02, 0, ww, h);
    }
    // front wall, either side of the door
    for (const sx of [-1, 1]) this.win(sx * Math.min(w / 2 - 1.4, 3.2), y, d / 2 - 0.02, Math.PI, ww, h);
  }
  liftX: number | null = null;
  /** A lift on the back wall at x, with a landing on every storey. */
  lift(x: number) {
    const { d, levels } = this.I;
    this.liftX = x;
    const z = -d / 2 + 0.05;
    for (let k = 0; k < levels; k++) {
      this.I.decor.push({ type: "lift", x, y: this.y(k), z, rot: 0, level: k });
      this.I.spots.push({ kind: "lift", x, y: this.y(k), z: z + 1.1, yaw: Math.PI, level: k, label: "", standX: x, standZ: z + 1.3 });
    }
  }
  /** Ladder in the back-left corner of the top floor, up through a hatch to the rooftop terrace. */
  roofLadder() {
    const { w, d, levels, storey } = this.I;
    const level = levels - 1;
    const x = this.x(-w / 2 + 0.85);
    const y = this.y(level);
    const z = -d / 2 + 0.14;
    this.I.decor.push({ type: "ladder", x, y, z, rot: 0, h: storey });
    this.I.spots.push({ kind: "roof", x, y, z: z + 0.9, yaw: Math.PI, level, label: "Climb up to the rooftop terrace", standX: x, standZ: z + 1.0 });
  }
  /** Switch-back stairs along the back wall, joining every storey. */
  stairs() {
    const { w, d, levels, storey } = this.I;
    const LEN = 6.3;
    const LANE = 1.6;
    const x0 = -w / 2 + 1.9;
    const x1 = x0 + LEN;
    const zA0 = -d / 2;
    const zA1 = zA0 + LANE;
    const zB1 = zA1 + LANE;
    for (let k = 0; k < levels - 1; k++) {
      const laneA = k % 2 === 0;
      const r = { x0, x1, z0: laneA ? zA0 : zA1, z1: laneA ? zA1 : zB1 };
      const y0 = k * storey;
      const y1 = (k + 1) * storey;
      // stairs are never mirrored (they define the room's back corner)
      this.I.stairs.push({ ...r, y0, y1, up: laneA ? 1 : -1 });
      this.I.floors[k + 1].holes.push(r);
      const ry1 = y1 + 1.05;
      this.I.solids.push({ x0, x1, z0: zA1 - 0.06, z1: zA1 + 0.06, y0: y1, y1: ry1, rail: true });
      if (!laneA) this.I.solids.push({ x0, x1, z0: zB1 - 0.06, z1: zB1 + 0.06, y0: y1, y1: ry1, rail: true });
      const bx = laneA ? x0 : x1;
      this.I.solids.push({ x0: bx - 0.06, x1: bx + 0.06, z0: r.z0, z1: r.z1, y0: y1, y1: ry1, rail: true });
      // the banister along the open side of the flight is solid too: it climbs with the steps
      // (short boxes, each topping out a rail-height above the steps it guards) so you can't step off the side
      const SEG = 8;
      for (let q = 0; q < SEG; q++) {
        const sx0 = x0 + ((x1 - x0) * q) / SEG;
        const sx1 = x0 + ((x1 - x0) * (q + 1)) / SEG;
        const hi = Math.max(laneA ? y0 + ((y1 - y0) * (q + 1)) / SEG : y1 - ((y1 - y0) * q) / SEG, y0);
        this.I.solids.push({ x0: sx0, x1: sx1, z0: r.z1 - 0.1, z1: r.z1 + 0.02, y0, y1: hi + 1.0 });
      }
    }
    this.m = 1; // keep furniture clear of the stair corner: no mirroring once stairs exist
  }
  /** Furnished zone starts in front of the stair lanes. */
  get backZ() {
    return this.I.stairs.length ? -this.I.d / 2 + 3.6 : -this.I.d / 2 + 0.3;
  }
  board(id: BoardId | undefined, x: number, y: number, z: number, rot: number, w = 3.4, h = 2.2) {
    if (!id) return;
    const b = boardFor(id);
    this.I.decor.push({ type: "board", x, y, z, rot, w, h, title: b.title, lines: b.lines });
  }
  finish() {
    const { w, d, levels, storey } = this.I;
    const H = levels * storey + 1;
    const T = 0.35;
    const wall = (x0: number, x1: number, z0: number, z1: number) => this.I.solids.push({ x0, x1, z0, z1, y0: -1, y1: H, wall: true });
    wall(-w / 2 - T, w / 2 + T, -d / 2 - T, -d / 2);
    wall(-w / 2 - T, -w / 2, -d / 2, d / 2 + T);
    wall(w / 2, w / 2 + T, -d / 2, d / 2 + T);
    wall(-w / 2, -DOOR_HALF, d / 2, d / 2 + T);
    wall(DOOR_HALF, w / 2, d / 2, d / 2 + T);
    // a stop just beyond the doorway (you leave before reaching it)
    wall(-DOOR_HALF, DOOR_HALF, d / 2 + 0.5, d / 2 + 0.8);
    return this.I;
  }
}

/* ---- room recipes ---- */
// Convention: rot = 0 turns a model's front toward the door (+z); rot = π faces the back wall,
// Q (π/2) faces +x and -Q faces -x. Seats face the table / TV they belong to.

const CURTAINS = ["#c45b4a", "#e8d8b0", "#6f9f62", "#4f7fae", "#d8a24a", "#b97aa6", "#8c3b2b"];
const SHEERS = ["#ece7dd", "#d9dde2", "#e8e1d4", "#cfd8dc"];
const FLOWERS = ["#ff6f91", "#ffd23f", "#ffffff", "#b388ff", "#ff8a3d", "#ff4f5e"];
const VASES = ["#3f6f8a", "#e9e1d3", "#b5623f", "#6f9f62", "#d8a24a"];
const RUSTIC_WALLS = ["#f1e2c6", "#ead6b4", "#f4e7d0", "#e6d3b3"];
const RUSTIC_LOW = ["#8a5a33", "#6f8f5a", "#9a5b3f", "#7a6a4f"];
const MODERN_WALLS = ["#f2f2ee", "#eceff1", "#f4efe8", "#e9eef0"];
const MODERN_LOW = ["#5b6b78", "#9aa7a0", "#b8a48c", "#4f5d75"];

function vase(R: Room, x: number, y: number, z: number) {
  R.decor({ type: "vase", x, y, z, color: R.pick(VASES), flower: R.pick(FLOWERS) });
}

/** Exposed timber ceiling beams (village homes). */
function beams(R: Room, level = 0) {
  const { w, d, storey } = R.I;
  for (let z = -d / 2 + 1.2; z < d / 2 - 0.5; z += 2.2) R.box(0, R.y(level) + storey - 0.34, z, w, 0.24, 0.22, "#6b4428", false);
}

/** A little group of framed photos on a wall (rot = direction the wall faces). */
function photos(R: Room, x: number, y: number, z: number, rot: number) {
  const ax = Math.cos(rot);
  const az = -Math.sin(rot);
  const sizes: [number, number, number, number][] = [
    [-0.62, 0.08, 0.42, 0.52],
    [0, -0.05, 0.6, 0.44],
    [0.6, 0.12, 0.38, 0.38],
  ];
  for (const [o, dy, w, h] of sizes)
    R.decor({ type: "painting", x: x + ax * o, y: y + dy, z: z + az * o, rot, w, h, seed: Math.floor(R.rand() * 999) });
}

/** Bed pushed into a corner (headboard to the back or front wall), night stand + lamp at its head. */
function bedCorner(R: Room, side: 1 | -1, level: number, key: "bedDouble" | "bedSingle" | "bedBunk", front = false, wallZ?: number) {
  const { w, d } = R.I;
  const bw = FURNITURE[key][0] * S;
  const bd = FURNITURE[key][2] * S;
  const x = side * (w / 2 - bw / 2 - 0.08);
  const z = front ? d / 2 - bd / 2 - 0.08 : (wallZ ?? -d / 2) + bd / 2 + 0.08;
  const rot = front ? Math.PI : 0;
  R.furn(key, x, z, rot, level, { tint: R.pick(SOFA) });
  const nx = side * (w / 2 - bw - 0.66);
  const nz = front ? d / 2 - 0.32 : (wallZ ?? -d / 2) + 0.32;
  const st = R.furn("sideTable", nx, nz, rot, level);
  R.furn("lampRoundTable", nx - side * 0.28, nz, rot, level, { y: st.h, solid: false });
  if (R.rand() < 0.6) R.furn("books", nx + side * 0.25, nz, rot, level, { y: st.h, solid: false });
  R.furn("rugSquare", x - side * (bw / 2 + 0.7), z + (front ? -0.35 : 0.35), 0, level, { solid: false });
  return { x, z, bw, bd };
}

/** Cabinets in a row along a side wall (x fixed, running toward +z). */
function kitchenRun(R: Room, x: number, z0: number, level = 0, facing = -Q, keys: FurnKey[] = ["kitchenFridge", "kitchenCabinet", "kitchenStove", "kitchenSink", "kitchenCabinetDrawer"]) {
  let z = z0;
  for (const k of keys) {
    const step = FURNITURE[k][0] * S;
    const f = R.furn(k, x, z + step / 2, facing, level);
    if (k === "kitchenCabinet") R.furn("kitchenMicrowave", x, z + step / 2, facing, level, { y: f.h, solid: false });
    if (k === "kitchenCabinetDrawer") R.furn("kitchenCoffeeMachine", x, z + step / 2, facing, level, { y: f.h, solid: false });
    z += step;
  }
  return z;
}

/** Cabinets in a row along the back wall (z fixed, running toward +x), upper cupboards above. */
function kitchenRow(R: Room, x0: number, level = 0, keys: FurnKey[] = ["kitchenFridge", "kitchenCabinet", "kitchenStove", "kitchenSink", "kitchenCabinetDrawer", "kitchenCabinet"]) {
  const z = -R.I.d / 2 + 0.52;
  let x = x0;
  for (const k of keys) {
    const step = FURNITURE[k][0] * S;
    const f = R.furn(k, x + step / 2, k === "kitchenFridge" ? -R.I.d / 2 + 0.36 : z, 0, level);
    if (k === "kitchenCabinet" || k === "kitchenSink" || k === "kitchenCabinetDrawer")
      R.furn("kitchenCabinetUpper", x + step / 2, -R.I.d / 2 + 0.26, 0, level, { y: 1.55, solid: false });
    if (k === "kitchenCabinetDrawer") R.furn("toaster", x + step / 2, z, 0, level, { y: f.h, solid: false });
    x += step;
  }
  return x;
}

/** Rectangular dining table with 4 or 6 chairs facing it, flowers in the middle. */
function dining(R: Room, x: number, z: number, level = 0, six = false, chair: FurnKey = "chairCushion", cloth = false) {
  const t = R.furn(cloth ? "tableCloth" : "table", x, z, 0, level);
  const seats: [number, number, number][] = [
    [-0.5, 0.86, Math.PI],
    [0.5, 0.86, Math.PI],
    [-0.5, -0.86, 0],
    [0.5, -0.86, 0],
  ];
  if (six) seats.push([1.28, 0, -Q], [-1.28, 0, Q]);
  for (const [dx, dz, rot] of seats) R.furn(chair, x + dx, z + dz, rot, level, { top: 0.48 });
  vase(R, x, R.y(level) + t.h, z);
  R.decor({ type: "pendant", x, y: R.y(level) + R.I.storey - 1.1, z, color: "#ffe2a6" });
}

/** Round table with chairs evenly around it, each turned to face the table. */
function roundTable(R: Room, x: number, z: number, level = 0, n = 3, chair: FurnKey = "chair", flowers = true) {
  const t = R.furn("tableRound", x, z, 0, level);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + 0.5;
    const cx = x + Math.cos(a) * 1.15;
    const cz = z + Math.sin(a) * 1.15;
    R.furn(chair, cx, cz, Math.atan2(-Math.cos(a), -Math.sin(a)), level, { top: 0.5 });
  }
  if (flowers) vase(R, x, R.y(level) + t.h, z);
}

/** Sofa facing a TV across a rug (TV on the −z side), coffee table and an armchair. */
function living(R: Room, cx: number, cz: number, level = 0, modern = true, armSide: 1 | -1 = 1) {
  const tint = R.pick(SOFA);
  R.furn(modern ? "rugRectangle" : "rugRound", cx, cz, 0, level, { solid: false });
  R.furn(modern && R.rand() < 0.5 ? "loungeDesignSofa" : "loungeSofa", cx, cz + 1.5, Math.PI, level, { tint });
  const ct = R.furn(modern ? "tableCoffeeGlass" : "tableCoffee", cx, cz + 0.1, 0, level);
  if (R.rand() < 0.6) vase(R, cx + 0.3, R.y(level) + ct.h, cz + 0.1);
  else R.furn("books", cx - 0.2, cz + 0.1, 0, level, { y: ct.h, solid: false });
  if (modern) {
    const tv = R.furn("cabinetTelevision", cx, cz - 1.6, 0, level);
    R.furn("televisionModern", cx, cz - 1.6, 0, level, { y: tv.h, solid: false });
    R.decor({ type: "screen", x: cx, y: R.y(level) + tv.h + 0.52, z: cz - 1.6 + 0.15, rot: 0, w: 1.3, h: 0.74, seed: Math.floor(R.rand() * 1000) });
    R.furn("speaker", cx - 1.25, cz - 1.6, 0, level);
    R.furn("speaker", cx + 1.25, cz - 1.6, 0, level);
  } else {
    const st = R.furn("sideTable", cx, cz - 1.6, 0, level);
    R.furn("televisionVintage", cx, cz - 1.6, 0, level, { y: st.h, solid: false });
    R.decor({ type: "screen", x: cx, y: R.y(level) + st.h + 0.3, z: cz - 1.6 + 0.3, rot: 0, w: 0.5, h: 0.36, seed: Math.floor(R.rand() * 1000) });
  }
  R.furn("loungeChair", cx + armSide * 2.15, cz + 0.2, -armSide * Q, level, { tint: R.pick(SOFA) });
  R.furn(modern ? "lampSquareFloor" : "lampRoundFloor", cx - armSide * 1.45, cz + 1.75, 0, level, { solid: false });
}

/** Bathroom tucked into the front-right corner behind two partition walls. */
function bathroomCorner(R: Room, level: number) {
  const { w, d } = R.I;
  const y = R.y(level);
  R.furn("bathtub", w / 2 - 1.4, d / 2 - 0.66, Math.PI, level);
  R.furn("toilet", w / 2 - 0.58, d / 2 - 2.4, -Q, level);
  R.furn("bathroomSink", w / 2 - 0.36, d / 2 - 3.4, -Q, level);
  R.furn("bathroomMirror", w / 2 - 0.12, d / 2 - 3.4, -Q, level, { y: 1.45, solid: false });
  R.furn("rugDoormat", w / 2 - 1.4, d / 2 - 1.7, 0, level, { solid: false });
  R.decor({ type: "box", x: w / 2 - 1.45, y: y + 0.005, z: d / 2 - 2.05, w: 2.9, h: 0.01, d: 4.1, color: "#dfe9ec" });
  // partitions with a gap to walk in
  R.box(w / 2 - 0.85, y, d / 2 - 4.1, 1.7, 2.6, 0.12, "#e8eef0");
  R.box(w / 2 - 2.9, y, d / 2 - 1.4, 0.12, 2.6, 2.8, "#e8eef0");
  // privacy curtains across the way in — walk through and they slide aside
  const cc = R.pick(["#f4f1ea", "#cfe3e8", "#e8d3dc", "#d9e8cf", "#f2e2c4"]);
  R.decor({ type: "showerCurtain", x: w / 2 - 2.3, y, z: d / 2 - 4.1, rot: 0, w: 1.2, h: 2.3, color: cc });
  R.decor({ type: "showerCurtain", x: w / 2 - 2.9, y, z: d / 2 - 3.45, rot: Q, w: 1.3, h: 2.3, color: cc });
  R.light(w / 2 - 1.4, y + R.I.storey - 0.5, d / 2 - 2.2, "#f2f6ff", 6, 6);
}

/** Desk against the left wall with a chair facing it. */
function deskLeft(R: Room, z: number, level: number, laptop = true) {
  const { w } = R.I;
  const desk = R.furn("desk", -w / 2 + 0.46, z, Q, level);
  R.furn(laptop ? "laptop" : "computerScreen", -w / 2 + 0.46, z, Q, level, { y: desk.h, solid: false });
  R.furn("chairDesk", -w / 2 + 1.35, z, -Q, level, { top: 0.7 });
}

function study(R: Room, x: number, z: number, rot: number, level = 0) {
  const desk = R.furn("desk", x, z, rot, level);
  R.furn(R.rand() < 0.5 ? "laptop" : "computerScreen", x, z, rot, level, { y: desk.h, solid: false });
  R.furn("chairDesk", x + Math.sin(rot) * 0.9, z + Math.cos(rot) * 0.9, rot + Math.PI, level, { top: 0.7 });
}

function rustic(R: Room, stone = false) {
  R.I.look.wallTex = stone ? "stone" : R.rand() < 0.5 ? "timber" : "paint";
  R.I.look.floorTex = "plank";
  R.I.look.wall = R.pick(RUSTIC_WALLS);
  R.I.look.wallLow = R.pick(RUSTIC_LOW);
  R.curtain = R.pick(CURTAINS);
}

function doorway(R: Room) {
  const { d } = R.I;
  R.furn("coatRackStanding", -1.65, d / 2 - 0.6, 0);
  R.furn("rugDoormat", 0, d / 2 - 0.55, 0, 0, { solid: false });
}

/* Village homes: four different layouts so no two neighbours look alike. */

function cottageHearth(R: Room) {
  const { w, d } = R.I;
  R.decor({ type: "fireplace", x: 0, y: 0, z: -d / 2 + 0.45, rot: 0 });
  R.solid(-1, 1, -d / 2, -d / 2 + 0.9, 0, 1.2);
  R.light(0, 0.8, -d / 2 + 1.2, "#ff9a4a", 10, 8);
  R.furn("rugRectangle", 0, -1.9, 0, 0, { solid: false });
  R.furn("loungeSofa", 0, -0.6, Math.PI, 0, { tint: R.pick(SOFA) });
  const ct = R.furn("tableCoffee", 0, -2.0, 0);
  vase(R, 0.25, ct.h, -2.0);
  R.furn("loungeChair", -2.1, -2.2, Q, 0, { tint: R.pick(SOFA) });
  R.furn("loungeChair", 2.1, -2.2, -Q, 0, { tint: R.pick(SOFA) });
  const st = R.furn("sideTable", -2.6, -d / 2 + 0.3, 0);
  R.furn("radio", -2.6, -d / 2 + 0.3, 0, 0, { y: st.h, solid: false });
  bedCorner(R, 1, 0, "bedDouble");
  R.decor({ type: "painting", x: w / 2 - 1.1, y: 2.25, z: -d / 2 + 0.05, rot: 0, w: 1.2, h: 0.8, seed: Math.floor(R.rand() * 999) });
  R.furn("bookcaseClosedWide", w / 2 - 0.3, -1.3, -Q);
  kitchenRun(R, -w / 2 + 0.55, -d / 2 + 0.3, 0, Q);
  dining(R, -3.4, 2.4, 0, false, "chair");
  R.furn("loungeChair", 3.6, 3.5, -2.36, 0, { tint: R.pick(SOFA) });
  R.furn("bookcaseOpen", w / 2 - 0.3, 2.5, -Q);
  R.furn("bookcaseOpen", w / 2 - 0.3, 3.45, -Q);
  R.furn("lampRoundFloor", 4.5, 4.45, 0, 0, { solid: false });
  R.decor({ type: "painting", x: w / 2 - 0.05, y: 2.1, z: 0.9, rot: -Q, w: 1.1, h: 0.8, seed: Math.floor(R.rand() * 999) });
  photos(R, -2.6, 2.3, -d / 2 + 0.05, 0);
  R.furn("pottedPlant", -w / 2 + 0.55, d / 2 - 0.55, 0);
  doorway(R);
}

function cottageFarmhouse(R: Room) {
  const { w, d } = R.I;
  kitchenRow(R, -2.8);
  photos(R, 0, 2.95, -d / 2 + 0.05, 0);
  dining(R, 0, -1.3, 0, true, "chair", true);
  R.decor({ type: "fireplace", x: -w / 2 + 0.45, y: 0, z: -2.0, rot: Q });
  R.solid(-w / 2, -w / 2 + 0.9, -2.9, -1.1, 0, 1.2);
  R.light(-w / 2 + 1.2, 0.8, -2.0, "#ff9a4a", 10, 8);
  R.furn("loungeChair", -4.2, -0.2, -2.5, 0, { tint: R.pick(SOFA) });
  // sleeping alcove behind a timber partition
  bedCorner(R, 1, 0, "bedDouble", true);
  R.box(2.5, 0, 3.45, 0.12, 2.2, 3.1, "#8a5a33");
  R.furn("bookcaseClosedWide", w / 2 - 0.3, 0.4, -Q);
  R.decor({ type: "painting", x: w / 2 - 0.05, y: 2.2, z: -2.2, rot: -Q, w: 1.2, h: 0.85, seed: Math.floor(R.rand() * 999) });
  // cosy corner with a little old TV
  R.furn("rugRectangle", -3.8, 3.0, 0, 0, { solid: false });
  R.furn("loungeSofa", -3.8, d / 2 - 0.5, Math.PI, 0, { tint: R.pick(SOFA) });
  R.furn("tableCoffee", -3.8, 3.2, 0);
  const st = R.furn("sideTable", -3.8, 1.75, 0);
  R.furn("televisionVintage", -3.8, 1.75, 0, 0, { y: st.h, solid: false });
  R.decor({ type: "screen", x: -3.8, y: st.h + 0.3, z: 1.75 + 0.3, rot: 0, w: 0.5, h: 0.36, seed: Math.floor(R.rand() * 999) });
  R.furn("pottedPlant", w / 2 - 0.55, -d / 2 + 0.55, 0);
  R.decor({ type: "shelf", x: -w / 2 + 0.05, y: 2.0, z: 0.8, rot: Q, w: 1.6, color: "#6b4428" });
  R.furn("rugDoormat", 0, d / 2 - 0.55, 0, 0, { solid: false });
  R.furn("coatRackStanding", 1.65, d / 2 - 0.6, 0);
}

function cottageArtist(R: Room) {
  const { w, d } = R.I;
  R.I.look.wallTex = "paint";
  bedCorner(R, -1, 0, "bedSingle");
  R.box(-w / 2 + 0.62, 0, -1.9, 1.0, 0.5, 0.6, "#8a5a33");
  R.decor({ type: "shelf", x: -w / 2 + 0.05, y: 2.1, z: -0.4, rot: Q, w: 1.6, color: "#6b4428" });
  for (const [i, x] of [3.0, 3.9, 4.8].entries()) {
    R.furn("bookcaseOpen", x, -d / 2 + 0.3, 0);
    if (i === 1) R.furn("plantSmall1", x, -d / 2 + 0.3, 0, 0, { y: 1.9, solid: false });
  }
  R.furn("loungeChair", 4.0, -3.2, 0.3, 0, { tint: R.pick(SOFA) });
  R.furn("lampRoundFloor", 5.3, -3.0, 0, 0, { solid: false });
  R.furn("rugRound", 1.0, -1.4, 0, 0, { solid: false });
  R.decor({ type: "easel", x: 1.8, y: 0, z: -1.2, rot: -0.5, seed: Math.floor(R.rand() * 999) });
  R.solid(1.4, 2.2, -1.6, -0.8, 0, 1.8);
  R.decor({ type: "easel", x: -0.6, y: 0, z: -2.6, rot: 0.4, seed: Math.floor(R.rand() * 999) });
  R.solid(-1.0, -0.2, -3.0, -2.2, 0, 1.8);
  kitchenRun(R, w / 2 - 0.55, -0.6, 0, -Q, ["kitchenCabinet", "kitchenStove", "kitchenSink"]);
  roundTable(R, -3.4, 2.5, 0, 2, "chairRounded");
  for (const [x, z, rot] of [
    [-w / 2 + 0.05, 0.9, Q],
    [w / 2 - 0.05, -2.4, -Q],
    [-2.3, -d / 2 + 0.05, 0],
    [0.4, -d / 2 + 0.05, 0],
  ] as const)
    R.decor({ type: "painting", x, y: 2.15, z, rot, w: 0.9 + R.rand() * 0.5, h: 0.7 + R.rand() * 0.3, seed: Math.floor(R.rand() * 999) });
  R.furn("pottedPlant", w / 2 - 0.55, d / 2 - 0.55, 0);
  R.furn("pottedPlant", -w / 2 + 0.55, d / 2 - 0.55, 0);
  doorway(R);
}

function cottageFamily(R: Room) {
  const { w, d } = R.I;
  bedCorner(R, -1, 0, "bedBunk");
  bedCorner(R, 1, 0, "bedDouble");
  R.furn("rugRound", -3.6, -1.3, 0, 0, { solid: false });
  R.furn("bear", -3.4, -1.1, 0.5, 0, { solid: false });
  R.furn("books", -3.9, -1.5, 1.2, 0, { solid: false });
  living(R, 2.4, -0.9, 0, false, 1);
  R.furn("bookcaseClosedWide", w / 2 - 0.3, -1.1, -Q);
  kitchenRun(R, -w / 2 + 0.55, 0.2, 0, Q);
  dining(R, -2.6, 2.4, 0, false, "chairCushion");
  photos(R, 2.4, 2.5, -d / 2 + 0.05, 0);
  R.decor({ type: "painting", x: w / 2 - 0.05, y: 2.1, z: 1.6, rot: -Q, w: 1.2, h: 0.8, seed: Math.floor(R.rand() * 999) });
  R.furn("pottedPlant", w / 2 - 0.55, d / 2 - 0.55, 0);
  R.furn("coatRackStanding", 1.65, d / 2 - 0.6, 0);
  R.furn("rugDoormat", 0, d / 2 - 0.55, 0, 0, { solid: false });
}

/** The lighthouse keeper's cottage: blue-and-white, sea paintings, a telescope at the window. */
function cottageCoastal(R: Room) {
  const { w, d } = R.I;
  R.I.look.wallTex = "paint";
  R.I.look.floorTex = "plank";
  R.I.look.wall = "#eaf2f5";
  R.I.look.wallLow = "#3f6f8a";
  R.I.look.floor = "#c9a87c";
  R.curtain = "#3f6f8a";
  bedCorner(R, -1, 0, "bedSingle");
  const desk = R.furn("desk", 4.2, -d / 2 + 0.46, 0);
  R.furn("radio", 4.6, -d / 2 + 0.46, 0, 0, { y: desk.h, solid: false });
  R.furn("books", 3.7, -d / 2 + 0.46, 0, 0, { y: desk.h, solid: false });
  R.furn("chairDesk", 4.2, -d / 2 + 1.35, Math.PI, 0, { top: 0.7 });
  R.decor({ type: "painting", x: 4.2, y: 2.2, z: -d / 2 + 0.05, rot: 0, w: 1.6, h: 1.0, seed: 4 });
  kitchenRun(R, w / 2 - 0.55, -1.8, 0, -Q, ["kitchenCabinet", "kitchenStove", "kitchenSink"]);
  R.prop(V("Barrel"), w / 2 - 0.7, 1.6, 0, 1.0, 0, 0.45);
  R.prop(V("Crate"), w / 2 - 0.7, 2.6, 0.3, 0.8, 0, 0.45);
  roundTable(R, -2.8, 0.6, 0, 2, "chair");
  R.decor({ type: "fireplace", x: -w / 2 + 0.45, y: 0, z: 3.0, rot: Q });
  R.solid(-w / 2, -w / 2 + 0.9, 2.1, 3.9, 0, 1.2);
  R.light(-w / 2 + 1.2, 0.8, 3.0, "#ff9a4a", 9, 7);
  R.furn("loungeChair", -3.9, 3.2, -Q, 0, { tint: "#3f6f8a" });
  R.decor({ type: "telescope", x: 3.6, y: 0, z: d / 2 - 1.0, rot: Math.PI - 0.4 });
  for (const [x, z, rot] of [
    [-w / 2 + 0.05, -1.4, Q],
    [w / 2 - 0.05, -3.4, -Q],
  ] as const)
    R.decor({ type: "painting", x, y: 2.1, z, rot, w: 1.2, h: 0.8, seed: Math.floor(R.rand() * 999) });
  R.furn("rugDoormat", 0, d / 2 - 0.55, 0, 0, { solid: false });
}

function cottage(R: Room, board?: BoardId, style?: string) {
  const { w, d } = R.I;
  rustic(R);
  if (style === "coastal") cottageCoastal(R);
  else [cottageHearth, cottageFarmhouse, cottageArtist, cottageFamily][Math.floor(R.rand() * 4)](R);
  if (style !== "coastal") beams(R);
  R.light(0, R.I.storey - 0.6, 0, "#ffe0b0", 16, 14);
  R.light(-w / 2 + 3, R.I.storey - 0.8, d / 2 - 2.5, "#ffd9a0", 8, 9);
  R.windows(0);
  R.board(board, 0, 2.2, -d / 2 + 0.06, 0);
}

function inn(R: Room) {
  const { w, d } = R.I;
  rustic(R);
  R.I.look.wallTex = "timber";
  R.stairs();
  beams(R, 0);
  beams(R, 1);
  // bar counter on the right, stools facing it
  for (let k = 0; k < 4; k++) {
    const z = -1.6 + k * 0.92;
    const bar = R.furn("kitchenBar", w / 2 - 2.4, z, -Q);
    R.furn("stoolBar", w / 2 - 3.45, z, Q, 0, { top: 0.9 });
    if (k === 1) vase(R, w / 2 - 2.4, bar.h, z);
  }
  R.prop(V("Barrel"), w / 2 - 0.7, -1.4, 0, 1.2, 0, 0.55);
  R.prop(V("Barrel"), w / 2 - 0.7, -0.2, 0.6, 1.2, 0, 0.55);
  R.prop(V("Barrel"), w / 2 - 0.7, 1.0, 1.2, 1.2, 0, 0.55);
  R.decor({ type: "shelf", x: w / 2 - 0.05, y: 2.2, z: -0.2, rot: -Q, w: 2.4, color: "#6b4428" });
  for (const [x, z] of [
    [-3.6, 0.4],
    [-0.4, 2.6],
    [-3.8, 3.7],
  ])
    roundTable(R, x, z, 0, 3, "chair");
  R.decor({ type: "fireplace", x: -w / 2 + 0.45, y: 0, z: 2.2, rot: Q });
  R.solid(-w / 2, -w / 2 + 0.9, 1.3, 3.1, 0, 1.2);
  R.light(-w / 2 + 1.3, 0.8, 2.2, "#ff9a4a", 12, 9);
  R.decor({ type: "chandelier", x: -1.5, y: R.I.storey - 0.9, z: 1.5 });
  R.light(-1.5, R.I.storey - 1, 1.5, "#ffd9a0", 18, 14);
  photos(R, 2.6, 2.4, -d / 2 + 0.05, 0);
  R.windows(0);
  // upstairs: two guest rooms, beds against the front wall
  const bd = FURNITURE.bedSingle[2] * S;
  const bw = FURNITURE.bedSingle[0] * S;
  for (const side of [-1, 1]) {
    const x = side * (w / 2 - bw / 2 - 0.08);
    R.furn("bedSingle", x, d / 2 - bd / 2 - 0.08, Math.PI, 1, { tint: R.pick(SOFA) });
    const st = R.furn("sideTable", x - side * 1.35, d / 2 - 0.32, Math.PI, 1);
    R.furn("lampRoundTable", x - side * 1.1, d / 2 - 0.32, Math.PI, 1, { y: st.h, solid: false });
    R.furn("rugRound", x - side * 0.4, d / 2 - bd - 1.0, 0, 1, { solid: false });
  }
  R.box(-0.6, R.y(1), d / 2 - 1.5, 0.12, 2.4, 3.0, "#8a5a33");
  R.furn("bookcaseClosedWide", w / 2 - 0.3, 1.6, -Q, 1);
  R.furn("loungeChair", 3.6, 0.0, -Q, 1, { tint: R.pick(SOFA) });
  R.furn("rugRectangle", 2.4, 0.2, 0, 1, { solid: false });
  R.decor({ type: "painting", x: w / 2 - 0.05, y: R.y(1) + 2.2, z: -1.0, rot: -Q, w: 1.2, h: 0.8, seed: Math.floor(R.rand() * 999) });
  R.light(0, R.y(1) + R.I.storey - 0.6, 0.5, "#ffe0b0", 14, 12);
  R.windows(1);
}

/* City homes and towers: bright, modern and different on every floor. */

function modern(R: Room) {
  R.I.look.wallTex = "paint";
  R.I.look.floorTex = R.pick(["wood", "marble", "wood", "tile"] as FloorTex[]);
  R.I.look.wall = R.pick(MODERN_WALLS);
  R.I.look.wallLow = R.pick(MODERN_LOW);
  R.curtain = R.pick(SHEERS);
}

function apartment(R: Room) {
  const { w, d } = R.I;
  modern(R);
  R.stairs();
  const v = Math.floor(R.rand() * 3);
  // L0 kitchen + island, lounge, dining
  kitchenRun(R, w / 2 - 0.55, -d / 2 + 0.4, 0);
  for (let k = 0; k < 3; k++) {
    const z = -3.6 + k * 0.92;
    R.furn("kitchenBar", 3.7, z, Q);
    R.furn("stoolBar", 2.78, z, Q, 0, { top: 0.9 });
  }
  R.furn("rugRectangle", 3.0, 2.8, 0, 0, { solid: false });
  R.furn(v === 1 ? "loungeDesignSofa" : "loungeSofa", 3.0, d / 2 - 0.52, Math.PI, 0, { tint: R.pick(SOFA) });
  const ct = R.furn("tableCoffeeGlass", 3.0, 3.1, 0);
  vase(R, 3.2, ct.h, 3.1);
  const tv = R.furn("cabinetTelevision", 3.0, 1.0, 0);
  R.furn("televisionModern", 3.0, 1.0, 0, 0, { y: tv.h, solid: false });
  R.decor({ type: "screen", x: 3.0, y: tv.h + 0.52, z: 1.15, rot: 0, w: 1.3, h: 0.74, seed: Math.floor(R.rand() * 999) });
  R.furn("loungeChair", 5.2, 2.7, -Q, 0, { tint: R.pick(SOFA) });
  if (v === 2) roundTable(R, -3.4, 2.5, 0, 4, "chairRounded");
  else dining(R, -3.4, 2.5, 0, false, v === 0 ? "chairCushion" : "chair");
  R.furn("bookcaseOpen", -w / 2 + 0.3, -0.6, Q);
  R.furn("pottedPlant", -w / 2 + 0.55, -d / 2 + 0.55, 0);
  R.furn("pottedPlant", -w / 2 + 0.55, d / 2 - 0.55, 0);
  R.decor({ type: "painting", x: -w / 2 + 0.05, y: 2.3, z: 1.2, rot: Q, w: 1.6, h: 1.0, seed: Math.floor(R.rand() * 999) });
  R.furn("coatRackStanding", -1.65, d / 2 - 0.6, 0);
  R.furn("rugDoormat", 0, d / 2 - 0.55, 0, 0, { solid: false });
  R.light(0, R.I.storey - 0.5, 1, "#ffe6c0", 16, 14);
  R.windows(0, 1.8, 3);
  // L1 bedroom, bathroom, study
  bedCorner(R, 1, 1, "bedDouble");
  photos(R, 4.9, R.y(1) + 2.3, -d / 2 + 0.05, 0);
  R.furn("bookcaseClosedWide", w / 2 - 0.3, -1.3, -Q, 1);
  bathroomCorner(R, 1);
  deskLeft(R, 2.6, 1, v !== 1);
  R.furn("bookcaseOpen", -w / 2 + 0.3, 0.6, Q, 1);
  R.furn("loungeChair", -1.9, d / 2 - 0.6, Math.PI, 1, { tint: R.pick(SOFA) });
  R.furn("lampSquareFloor", -3.0, d / 2 - 0.5, 0, 1, { solid: false });
  R.furn("pottedPlant", 2.2, d / 2 - 0.55, 0, 1);
  R.light(0, R.y(1) + R.I.storey - 0.5, 0.5, "#ffe6c0", 14, 13);
  R.windows(1, 1.8, 3);
  // L2 rooftop lounge — music room, library or games room
  if (R.I.levels > 2) {
    const y = 2;
    if (v === 0) {
      living(R, 2.6, 1.8, y, true, -1);
      R.furn("radio", 5.4, -d / 2 + 0.4, 0, y, { solid: false });
    } else if (v === 1) {
      for (let k = 0; k < 4; k++) R.furn("bookcaseClosedWide", w / 2 - 0.3, -3.4 + k * 1.75, -Q, y);
      R.furn("loungeChair", 2.4, 0.4, Q, y, { tint: R.pick(SOFA) });
      R.furn("loungeChair", 2.4, 2.2, Q, y, { tint: R.pick(SOFA) });
      R.furn("lampRoundFloor", 1.6, 1.3, 0, y, { solid: false });
      R.furn("rugRound", 3.4, 1.3, 0, y, { solid: false });
      study(R, -3.2, 2.6, Math.PI, y);
    } else {
      roundTable(R, 2.4, 1.2, y, 4, "chairCushion", false);
      R.furn("loungeDesignSofa", 3.0, d / 2 - 0.52, Math.PI, y, { tint: R.pick(SOFA) });
      R.furn("speaker", 5.4, -2.0, -Q, y);
      R.furn("speaker", 5.4, 0.2, -Q, y);
      R.decor({ type: "screen", x: w / 2 - 0.06, y: R.y(y) + 2.0, z: -0.9, rot: -Q, w: 2.4, h: 1.35, seed: Math.floor(R.rand() * 999) });
    }
    R.furn("pottedPlant", -w / 2 + 0.55, d / 2 - 0.55, 0, y);
    R.furn("pottedPlant", -w / 2 + 0.55, -0.4, 0, y);
    R.light(0, R.y(y) + R.I.storey - 0.5, 0.5, "#ffd6a0", 14, 13);
    R.windows(y, 2.4, 2.4);
  }
  R.roofLadder();
}

function office(R: Room, board?: BoardId) {
  const { w, d } = R.I;
  R.I.look.floorTex = "marble";
  R.I.look.wallTex = "glass";
  R.I.look.wall = "#eef2f4";
  R.I.look.wallLow = R.pick(MODERN_LOW);
  R.stairs();
  R.lift(w / 2 - 1.6);
  // L0 lobby: reception, waiting lounge
  const rd = R.furn("deskCorner", 3.2, 0.6, 0);
  R.furn("computerScreen", 3.2, 0.6, Math.PI, 0, { y: rd.h, solid: false });
  R.furn("chairDesk", 3.4, -0.75, 0, 0, { top: 0.7 });
  R.furn("loungeDesignSofa", -w / 2 + 0.5, 2.4, Q, 0, { tint: R.pick(SOFA) });
  const ct = R.furn("tableCoffeeGlass", -w / 2 + 1.9, 2.4, Q);
  vase(R, -w / 2 + 1.9, ct.h, 2.4);
  R.furn("loungeChair", -w / 2 + 3.2, 1.6, -Q, 0, { tint: R.pick(SOFA) });
  R.furn("loungeChair", -w / 2 + 3.2, 3.2, -Q, 0, { tint: R.pick(SOFA) });
  R.furn("pottedPlant", -w / 2 + 0.55, d / 2 - 0.55, 0);
  R.furn("pottedPlant", w / 2 - 0.55, d / 2 - 0.55, 0);
  R.furn("pottedPlant", w / 2 - 0.55, 1.6, 0);
  R.light(0, R.I.storey - 0.4, 1, "#f2f4ff", 18, 16);
  R.windows(0, 2.4, 2.2);
  R.board(board, -w / 2 + 0.06, 2.4, -0.6, Q, 3.2, 2.0);
  // L1 open-plan desks + coffee point
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++) study(R, -3.6 + c * 3.2, 0.5 + r * 2.7, Math.PI, 1);
  kitchenRun(R, w / 2 - 0.55, 0.4, 1, -Q, ["kitchenFridge", "kitchenCabinetDrawer", "kitchenCabinet"]);
  R.furn("pottedPlant", w / 2 - 0.55, d / 2 - 0.55, 0, 1);
  R.furn("pottedPlant", -w / 2 + 0.55, d / 2 - 0.55, 0, 1);
  R.light(0, R.y(1) + R.I.storey - 0.4, 1, "#f2f4ff", 16, 16);
  R.windows(1, 2.4, 2.2);
  // L2 meeting room
  if (R.I.levels > 2) {
    for (const x of [-1.0, 0.8]) R.furn("table", x, 1.4, 0, 2);
    for (const x of [-1.6, -0.5, 0.6, 1.7]) {
      R.furn("chairCushion", x - 0.1, 2.3, Math.PI, 2, { top: 0.48 });
      R.furn("chairCushion", x - 0.1, 0.5, 0, 2, { top: 0.48 });
    }
    R.decor({ type: "screen", x: -0.1, y: R.y(2) + 2.2, z: -d / 2 + 3.3, rot: 0, w: 2.6, h: 1.4, seed: 7 });
    R.furn("speaker", 2.8, -1.4, 0, 2);
    R.furn("pottedPlant", -w / 2 + 0.55, d / 2 - 0.55, 0, 2);
    R.furn("loungeSofa", 4.6, d / 2 - 0.52, Math.PI, 2, { tint: R.pick(SOFA) });
    R.light(0, R.y(2) + R.I.storey - 0.4, 1, "#f2f4ff", 16, 14);
    R.windows(2, 2.4, 2.2);
  }
}

/** The six skyscrapers round the City of Giants plaza: lobby, co-working, sky restaurant, observation lounge. */
function skyscraper(R: Room, board?: BoardId) {
  const { w, d } = R.I;
  R.I.look.floorTex = "marble";
  R.I.look.wallTex = "glass";
  R.I.look.wall = R.pick(["#eef2f4", "#f1efe9", "#e9f0f2"]);
  R.I.look.wallLow = R.pick(["#3e4c59", "#5b6b78", "#6b5a4a", "#2f4f4a"]);
  const accent = R.pick(SOFA);
  R.stairs();
  R.lift(w / 2 - 1.8);
  // L0 grand lobby
  const rd = R.furn("deskCorner", 3.4, -0.6, 0);
  R.furn("computerScreen", 3.0, -0.6, Math.PI, 0, { y: rd.h, solid: false });
  R.furn("computerScreen", 3.8, -0.6, Math.PI, 0, { y: rd.h, solid: false });
  R.furn("chairDesk", 3.4, -2.0, 0, 0, { top: 0.7 });
  vase(R, 2.7, rd.h, 0.2);
  R.furn("rugRectangle", -4.6, 2.9, 0, 0, { solid: false });
  R.furn("loungeDesignSofa", -4.6, 1.5, 0, 0, { tint: accent });
  R.furn("loungeDesignSofa", -4.6, 4.4, Math.PI, 0, { tint: accent });
  const ct = R.furn("tableCoffeeGlass", -4.6, 2.95, 0);
  vase(R, -4.4, ct.h, 2.95);
  for (const [x, z] of [
    [-w / 2 + 0.55, d / 2 - 0.55],
    [w / 2 - 0.55, d / 2 - 0.55],
    [w / 2 - 0.55, 1.4],
    [-w / 2 + 0.55, 0.0],
  ])
    R.furn("pottedPlant", x, z, 0);
  R.furn("benchCushion", 3.6, d / 2 - 0.5, Math.PI);
  R.furn("benchCushion", 4.6, d / 2 - 0.5, Math.PI);
  R.decor({ type: "painting", x: w / 2 - 0.05, y: 2.4, z: -0.6, rot: -Q, w: 2.0, h: 1.3, seed: Math.floor(R.rand() * 999) });
  R.decor({ type: "chandelier", x: 0, y: R.I.storey - 1.0, z: 1.6 });
  R.light(0, R.I.storey - 0.6, 1.4, "#fff2dc", 22, 18);
  R.windows(0, 2.6, 2.2, 1.6);
  R.board(board, 2.6, 2.4, -d / 2 + 0.07, 0, 3.4, 2.2);
  // L1 co-working
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++) study(R, -4.4 + c * 3.4, 0.6 + r * 2.9, Math.PI, 1);
  for (let k = 0; k < 3; k++) {
    const z = 0.2 + k * 0.92;
    const bar = R.furn("kitchenBar", w / 2 - 0.5, z, -Q, 1);
    if (k === 1) R.furn("kitchenCoffeeMachine", w / 2 - 0.5, z, -Q, 1, { y: bar.h, solid: false });
    R.furn("stoolBar", w / 2 - 1.5, z, Q, 1, { top: 0.9 });
  }
  R.furn("loungeSofa", 4.4, d / 2 - 0.52, Math.PI, 1, { tint: accent });
  R.furn("pottedPlant", -w / 2 + 0.55, d / 2 - 0.55, 0, 1);
  R.light(0, R.y(1) + R.I.storey - 0.4, 1, "#f2f4ff", 18, 16);
  R.windows(1, 2.6, 2.2, 1.6);
  // L2 sky restaurant
  for (const [x, z] of [
    [-4.6, 0.6],
    [-4.4, 3.8],
    [-0.8, 2.2],
    [2.6, 0.8],
    [3.0, 3.9],
  ])
    roundTable(R, x, z, 2, 3, "chairRounded");
  for (const [x, z] of [
    [-4.6, 0.6],
    [-0.8, 2.2],
    [3.0, 3.9],
  ])
    R.decor({ type: "pendant", x, y: R.y(2) + R.I.storey - 1.1, z, color: R.pick(["#ffd38a", "#ffb38a", "#fff0c0"]) });
  R.furn("pottedPlant", w / 2 - 0.55, d / 2 - 0.55, 0, 2);
  R.furn("pottedPlant", -w / 2 + 0.55, d / 2 - 0.55, 0, 2);
  R.light(0, R.y(2) + R.I.storey - 0.5, 1, "#ffdcae", 16, 16);
  R.windows(2, 2.6, 2.2, 1.6);
  // L3 observation lounge with tall windows
  const top = R.I.levels - 1;
  R.furn("rugRectangle", 0, 2.4, 0, top, { solid: false });
  R.furn("loungeSofa", -1.4, 1.6, 0, top, { tint: accent });
  R.furn("loungeSofa", 1.4, 1.6, 0, top, { tint: accent });
  R.furn("tableCoffeeGlass", 0, 2.9, 0, top);
  R.decor({ type: "telescope", x: -3.4, y: R.y(top), z: d / 2 - 1.0, rot: Math.PI + 0.3 });
  R.decor({ type: "telescope", x: 3.4, y: R.y(top), z: d / 2 - 1.0, rot: Math.PI - 0.3 });
  R.furn("speaker", -w / 2 + 0.5, 1.0, Q, top);
  R.furn("pottedPlant", w / 2 - 0.55, d / 2 - 0.55, 0, top);
  R.furn("pottedPlant", -w / 2 + 0.55, d / 2 - 0.55, 0, top);
  R.light(0, R.y(top) + R.I.storey - 0.5, 1.5, "#ffe6c0", 14, 16);
  R.windows(top, 2.9, 1.9, 1.7);
}

function cafe(R: Room) {
  const { w, d } = R.I;
  R.I.look.floorTex = "tile";
  R.I.look.wall = R.pick(["#f4e7d0", "#eef0e6", "#f6e1d6"]);
  R.I.look.wallLow = R.pick(["#3f6f6a", "#8c3b2b", "#4f5d75"]);
  R.curtain = R.pick(CURTAINS);
  // serving counter faces the room, barista side behind
  for (let k = 0; k < 5; k++) {
    const x = -3.2 + k * 0.92;
    const f = R.furn("kitchenBar", x, -d / 2 + 1.7, 0);
    if (k === 1) R.furn("kitchenCoffeeMachine", x, -d / 2 + 1.7, 0, 0, { y: f.h, solid: false });
    if (k === 2) vase(R, x, f.h, -d / 2 + 1.7);
    if (k === 3) R.furn("kitchenBlender", x, -d / 2 + 1.7, 0, 0, { y: f.h, solid: false });
    if (k === 4) R.furn("toaster", x, -d / 2 + 1.7, 0, 0, { y: f.h, solid: false });
  }
  R.furn("kitchenFridgeLarge", w / 2 - 0.8, -d / 2 + 0.5, 0);
  R.decor({ type: "shelf", x: -1.4, y: 1.7, z: -d / 2 + 0.05, rot: 0, w: 3.0, color: "#6b4428" });
  R.decor({ type: "board", x: -1.4, y: 2.8, z: -d / 2 + 0.06, rot: 0, w: 3.2, h: 1.1, title: "Menu", lines: ["Espresso · Latte · Masala chai", "Fresh juice · Croissants · Cookies"] });
  for (const [x, z] of [
    [-3.6, 0.8],
    [0.2, 1.0],
    [3.6, 0.6],
    [-3.2, 3.4],
  ])
    roundTable(R, x, z, 0, 2, "chairRounded");
  // window bar along the right wall
  for (let k = 0; k < 3; k++) R.furn("stoolBar", w / 2 - 1.1, 2.0 + k * 0.95, Q, 0, { top: 0.9 });
  R.box(w / 2 - 0.35, 0, 2.95, 0.6, 1.05, 3.2, "#8a5a33");
  R.furn("pottedPlant", -w / 2 + 0.55, d / 2 - 0.55, 0);
  R.furn("pottedPlant", 2.0, d / 2 - 0.55, 0);
  for (const [x, z] of [
    [-3.6, 0.8],
    [0.2, 1.0],
    [3.6, 0.6],
  ])
    R.decor({ type: "pendant", x, y: R.I.storey - 1.1, z, color: R.pick(["#ffd38a", "#ffb38a", "#fff0c0"]) });
  R.decor({ type: "painting", x: -w / 2 + 0.05, y: 2.3, z: 1.6, rot: Q, w: 1.4, h: 1.0, seed: Math.floor(R.rand() * 999) });
  R.light(0, R.I.storey - 0.5, 0.6, "#ffdcae", 16, 14);
  R.windows(0, 2.2, 2.6);
  R.roofLadder();
}

function barn(R: Room, mill: boolean) {
  const { w, d } = R.I;
  R.I.look.wallTex = "timber";
  R.I.look.floorTex = "plank";
  R.I.look.wall = "#b5623f";
  R.I.look.wallLow = "#7e3f27";
  for (let k = 0; k < 3; k++) {
    const x = -w / 2 + 2.6 + k * 3.6;
    R.box(x + 1.7, 0, -d / 2 + 2.2, 0.15, 1.2, 4.2, "#8a5a33");
    if (!mill) R.prop(A(k === 1 ? "Horse" : "Cow"), x, -d / 2 + 2.4, Math.PI * 0.5 + (k - 1) * 0.3, k === 1 ? 2.1 : 1.6, 0, 0.9);
  }
  for (const [x, z, r] of [
    [w / 2 - 1.4, 2.8, 0.3],
    [w / 2 - 1.4, 1.2, 1.2],
    [w / 2 - 2.9, 2.6, 2.4],
  ])
    R.prop(V("Hay"), x, z, r, 1.3, 0, 0.75);
  R.prop(V("Cart"), -w / 2 + 2.2, d / 2 - 2.2, 0.8, 1.8, 0, 1.1);
  R.prop(V("Crate"), 1.0, d / 2 - 1.2, 0.3, 0.9, 0, 0.5);
  R.prop(V("Barrel"), 2.0, d / 2 - 1.0, 0, 1.1, 0, 0.5);
  if (mill) {
    R.decor({ type: "cyl", x: 0, y: 0, z: 0, r: 1.6, h: 0.9, color: "#9a948a" });
    R.decor({ type: "cyl", x: 0, y: 0.9, z: 0, r: 1.5, h: 0.5, color: "#b4ada2" });
    R.solid(-1.6, 1.6, -1.6, 1.6, 0, 1.4);
    R.decor({ type: "gear", x: 0, y: 4.2, z: -d / 2 + 0.3, rot: 0, r: 1.6 });
    for (let k = 0; k < 4; k++) R.box(-3 + k * 0.9, 0, 2.6, 0.7, 0.8, 0.6, "#e6d6b2");
    R.furn("benchCushion", -3.2, 1.2, Math.PI);
  } else {
    R.prop(A("Chick"), -1.2, 1.4, 1.2, 0.35, 0, 0);
    R.prop(A("Chick"), -0.6, 2.0, -0.4, 0.35, 0, 0);
    R.prop(A("Pig"), 2.6, 0.2, -1.4, 0.9, 0, 0.6);
    R.furn("benchCushion", -2.8, d / 2 - 0.5, Math.PI);
  }
  R.light(0, R.I.storey - 1.2, 0, "#ffd08a", 18, 16);
  R.light(-3, 2.2, -2, "#ffb36a", 6, 8);
  R.windows(0, 1.4, 4.2);
}

function workshop(R: Room, board?: BoardId) {
  const { w, d } = R.I;
  R.I.look.wallTex = "timber";
  R.curtain = R.pick(CURTAINS);
  R.stairs();
  study(R, -2.6, 1.2, Math.PI);
  study(R, 0.6, 1.2, Math.PI);
  study(R, 3.4, 2.6, -Q);
  R.box(-w / 2 + 0.7, 0, 2.4, 1.0, 1.0, 3.0, "#8a5a33");
  R.decor({ type: "gear", x: -w / 2 + 0.1, y: 2.8, z: -0.6, rot: Q, r: 0.9 });
  R.decor({ type: "gear", x: -w / 2 + 0.1, y: 2.0, z: 0.8, rot: Q, r: 0.55 });
  R.decor({ type: "gear", x: w / 2 - 0.1, y: 2.6, z: 0.6, rot: -Q, r: 0.75 });
  R.board(board, 0.4, 2.3, -d / 2 + 3.25, 0, 4.4, 2.4);
  R.furn("pottedPlant", w / 2 - 0.55, d / 2 - 0.55, 0);
  R.light(0, R.I.storey - 0.4, 1, "#fff0d0", 16, 14);
  R.windows(0);
  // upstairs: reading loft
  R.furn("loungeSofa", -1.5, 2.8, Math.PI, 1, { tint: R.pick(SOFA) });
  R.furn("rugRectangle", -1.5, 1.4, 0, 1, { solid: false });
  R.furn("bookcaseOpen", 2.0, -1.2, 0, 1);
  R.furn("bookcaseOpen", 3.0, -1.2, 0, 1);
  R.decor({ type: "telescope", x: 3.6, y: R.y(1), z: 2.8, rot: 0.6 });
  R.light(0, R.y(1) + R.I.storey - 0.4, 1, "#fff0d0", 12, 12);
  R.windows(1);
}

function castle(R: Room, board?: BoardId) {
  const { w, d } = R.I;
  R.I.look.wallTex = "stone";
  R.I.look.floorTex = "stone";
  R.I.look.wall = "#cfc6b4";
  R.I.look.wallLow = "#9d9381";
  R.curtain = "#8c2f39";
  R.stairs();
  // great hall: two long tables with benches either side, facing the table
  for (const x of [-3.6, 3.6]) {
    for (let k = 0; k < 3; k++) R.furn("table", x, -0.4 + k * 0.97, Q);
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++) R.furn("benchCushion", x + s * 0.95, -0.05 + k * 1.1, s > 0 ? -Q : Q, 0, { top: 0.48 });
    vase(R, x, FURNITURE.table[1] * S, 0.55);
  }
  for (let k = 0; k < 4; k++) R.furn("bookcaseOpen", -w / 2 + 0.3, -1.4 + k * 0.95, Q);
  for (let k = 0; k < 4; k++) R.furn("bookcaseOpen", w / 2 - 0.3, -1.4 + k * 0.95, -Q);
  for (const x of [-w / 2 + 2.6, w / 2 - 2.6]) R.decor({ type: "banner", x, y: R.I.storey - 0.4, z: d / 2 - 0.08, rot: Math.PI, color: x < 0 ? "#b8323b" : "#2f5aa0" });
  R.decor({ type: "chandelier", x: 0, y: R.I.storey - 1.1, z: 1.4 });
  R.light(0, R.I.storey - 1.3, 1.4, "#ffd9a0", 22, 18);
  R.board(board, 0.6, 2.4, -d / 2 + 3.25, 0, 4.4, 2.4);
  R.windows(0, 2.2, 3.2);
  // library gallery upstairs: two rows of shelves facing the reading aisle between them
  for (let k = 0; k < 3; k++) {
    R.furn("bookcaseClosedWide", -3 + k * 2.4, 0.3, 0, 1);
    R.furn("bookcaseClosedWide", -3 + k * 2.4, 3.0, Math.PI, 1);
  }
  R.furn("benchCushion", -1.8, 1.65, 0, 1, { top: 0.48 });
  R.furn("benchCushion", 0.6, 1.65, Math.PI, 1, { top: 0.48 });
  study(R, 4.6, 1.6, -Q, 1);
  R.decor({ type: "chandelier", x: 0, y: R.y(1) + R.I.storey - 1, z: 1.6 });
  R.light(0, R.y(1) + R.I.storey - 1, 1.6, "#ffd9a0", 16, 16);
  R.windows(1, 2, 3.2);
}

function tower(R: Room, kind: "lighthouse" | "belfry", board?: BoardId) {
  const { w, d, levels } = R.I;
  R.I.look.wallTex = kind === "lighthouse" ? "paint" : "stone";
  R.I.look.floorTex = kind === "lighthouse" ? "plank" : "stone";
  if (kind === "lighthouse") {
    R.I.look.wall = "#f4ede0";
    R.curtain = "#3f6f8a";
  }
  R.stairs();
  R.prop(V("Barrel"), w / 2 - 0.8, 0.4, 0, 1.1, 0, 0.5);
  R.prop(V("Crate"), w / 2 - 0.8, 1.6, 0.4, 0.9, 0, 0.5);
  R.light(0, R.I.storey - 0.5, 1.6, "#ffe0b0", 12, 11);
  R.windows(0, 1.2, 4);
  if (kind === "lighthouse") {
    R.furn("tableRound", -1.6, 2.4, 0);
    R.furn("chair", -0.45, 2.4, -Q, 0, { top: 0.5 });
    R.furn("radio", -1.6, 2.4, 0, 0, { y: 0.79, solid: false });
    R.board(board, 0.4, 2.3, -d / 2 + 3.25, 0, 3.6, 2.2);
    study(R, 2.8, 2.6, -Q, 1);
    R.furn("bookcaseOpen", -w / 2 + 0.3, 2.4, Q, 1);
    R.decor({ type: "telescope", x: -2.4, y: R.y(1), z: 3.2, rot: -0.6 });
    R.light(0, R.y(1) + R.I.storey - 0.5, 1.6, "#ffe0b0", 12, 11);
    R.windows(1, 1.2, 4);
    const top = levels - 1;
    R.decor({ type: "beacon", x: 1.2, y: R.y(top), z: 1.6 });
    R.solid(0.2, 2.2, 0.6, 2.6, R.y(top), R.y(top) + 2.4);
    R.light(1.2, R.y(top) + 1.6, 1.6, "#ffe6a0", 30, 14);
    R.windows(top, 2.6, 1.8);
  } else {
    for (const x of [-2.6, 0.2]) for (const z of [1.4, 3.2]) R.furn("benchCushion", x, z, Math.PI, 0, { top: 0.48 });
    for (const x of [-3.6, 3.4]) R.decor({ type: "candle", x, y: 0.9, z: d / 2 - 0.6 });
    R.decor({ type: "gear", x: 0, y: R.y(1) + 2.2, z: -d / 2 + 3.4, rot: 0, r: 1.2 });
    R.decor({ type: "gear", x: 2.2, y: R.y(1) + 1.6, z: -d / 2 + 3.4, rot: 0, r: 0.7 });
    R.light(0, R.y(1) + R.I.storey - 0.5, 1.6, "#ffe0b0", 10, 11);
    R.windows(1, 1.2, 4);
    const top = levels - 1;
    R.decor({ type: "bell", x: 1.6, y: R.y(top) + 3.2, z: 1.8 });
    R.light(1.6, R.y(top) + 2, 1.8, "#ffe0b0", 10, 10);
    R.windows(top, 1.8, 2.4);
  }
}

function treehouse(R: Room) {
  const { w, d } = R.I;
  R.I.look.wallTex = "timber";
  R.I.look.floorTex = "plank";
  R.I.look.wall = "#c89a64";
  R.curtain = "#6f9f62";
  const bw = FURNITURE.bedBunk[0] * S;
  const bd = FURNITURE.bedBunk[2] * S;
  R.furn("bedBunk", -w / 2 + bw / 2 + 0.08, -d / 2 + bd / 2 + 0.08, 0, 0, { tint: "#6f9f62" });
  R.furn("rugRound", 0.6, 0.2, 0, 0, { solid: false });
  R.furn("bear", 0.8, 0.0, 0.4, 0, { solid: false });
  R.furn("books", w / 2 - 0.5, -d / 2 + 0.5, 0, 0, { solid: false });
  R.decor({ type: "telescope", x: w / 2 - 1, y: 0, z: 0.8, rot: -0.8 });
  R.decor({ type: "candle", x: 0.2, y: 0.02, z: -d / 2 + 0.6 });
  R.furn("pottedPlant", w / 2 - 0.55, d / 2 - 0.6, 0);
  R.light(0, R.I.storey - 0.4, 0, "#ffd08a", 10, 9);
  R.windows(0, 1.1, 2.4);
}

const SIZES: Record<InteriorKind, { w: number; d: number; levels: number; storey: number }> = {
  cottage: { w: 12, d: 10, levels: 1, storey: 3.8 },
  inn: { w: 14, d: 11, levels: 2, storey: 4.2 },
  apartment: { w: 12, d: 10, levels: 3, storey: 4.2 },
  office: { w: 14, d: 11, levels: 3, storey: 4.4 },
  skyscraper: { w: 16, d: 12, levels: 4, storey: 4.6 },
  cafe: { w: 12, d: 10, levels: 1, storey: 4.2 },
  barn: { w: 15, d: 12, levels: 1, storey: 6.4 },
  mill: { w: 12, d: 10, levels: 1, storey: 6.4 },
  workshop: { w: 12, d: 10, levels: 2, storey: 4.2 },
  castle: { w: 16, d: 12, levels: 2, storey: 5.4 },
  lighthouse: { w: 10.5, d: 9, levels: 3, storey: 4.2 },
  belfry: { w: 10.5, d: 9, levels: 3, storey: 4.2 },
  treehouse: { w: 7, d: 6, levels: 1, storey: 3.2 },
};

const cache = new Map<string, Interior>();

/** Build (once) the interior behind a building's door. */
export function getInterior(id: string): Interior | null {
  const hit = cache.get(id);
  if (hit) return hit;
  const b = getBuilding(id);
  if (!b) return null;
  const sz = SIZES[b.kind];
  const R = new Room(b.id, b.kind, b.name, sz.w, sz.d, sz.levels, sz.storey, b.seed);
  switch (b.kind) {
    case "cottage":
      cottage(R, b.board, b.style);
      break;
    case "inn":
      inn(R);
      break;
    case "apartment":
      apartment(R);
      break;
    case "office":
      office(R, b.board);
      break;
    case "skyscraper":
      skyscraper(R, b.board);
      break;
    case "cafe":
      cafe(R);
      break;
    case "barn":
      barn(R, false);
      break;
    case "mill":
      barn(R, true);
      break;
    case "workshop":
      workshop(R, b.board);
      break;
    case "castle":
      castle(R, b.board);
      break;
    case "lighthouse":
    case "belfry":
      tower(R, b.kind, b.board);
      break;
    case "treehouse":
      treehouse(R);
      break;
  }
  const I = R.finish();
  cache.set(id, I);
  return I;
}

/** Nearest usable spot (seat, bed or lift landing) within reach on the storey you're on. */
export function nearestSpot(I: Interior, x: number, z: number, feet: number, reach = 1.5) {
  const level = levelOf(I, feet);
  let best = -1;
  let bd = reach;
  I.spots.forEach((s, i) => {
    if (s.level !== level) return;
    const byStand = s.kind === "lift" || s.kind === "roof";
    const d = Math.hypot(byStand ? s.standX - x : s.x - x, byStand ? s.standZ - z : s.z - z);
    const r = s.kind === "lie" ? bd + 0.6 : bd;
    if (d < r) {
      bd = d;
      best = i;
    }
  });
  return best;
}
