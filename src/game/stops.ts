/**
 * Journey hotspots (listed along the road; visit them in any order). One long
 * road runs through every region of the world.
 * Positions are world XZ coordinates.
 */
export type StopId = "gate" | "academy" | "forest" | "skills" | "city" | "peak" | "cove";

export type Stop = {
  id: StopId;
  order: number;
  name: string;
  subtitle: string;
  chapter: string;
  /** region of the world this key point sits in */
  region: string;
  /** arrival point on the road */
  x: number;
  z: number;
  /** landmark centre (buildings) */
  lx: number;
  lz: number;
  /** keep vegetation away from the landmark within this radius */
  clear: number;
  /** distance at which the visitor counts as "arrived" */
  radius: number;
  /** content for this stop is unlocked in this build */
  open: boolean;
};

export const STOPS: Stop[] = [
  { id: "gate", order: 1, name: "Hey Stranger Gate", subtitle: "Swipe right on this adventure", chapter: "Main character intro", region: "Meet-Cute Meadow", x: -132, z: 54, lx: -132, lz: 54, clear: 9, radius: 10, open: true },
  { id: "academy", order: 2, name: "Big Brain Castle", subtitle: "Where the nerd arc went legendary", chapter: "The nerd arc", region: "Sweet Nothings Woods", x: -98, z: -24, lx: -112, lz: -40, clear: 15, radius: 13, open: true },
  { id: "forest", order: 3, name: "Crush-Worthy Creations Mill", subtitle: "Ideas spun till they fell in love with reality", chapter: "The builder era", region: "Butterfly Crush Fields", x: -6, z: 16, lx: 3, lz: 31, clear: 11, radius: 13, open: true },
  { id: "skills", order: 4, name: "Forbidden Tricks Square", subtitle: "Dangerously good with these", chapter: "Secret weapons", region: "Cosy Crush Village", x: 46, z: -14, lx: 54, lz: -25, clear: 9, radius: 12, open: true },
  { id: "city", order: 5, name: "Towers of Situationships", subtitle: "Internships: short, intense, unforgettable", chapter: "The work arc", region: "Downtown Drama", x: 104, z: 22, lx: 110, lz: 42, clear: 11, radius: 14, open: true },
  { id: "peak", order: 6, name: "Main Character Peak", subtitle: "Trophies that flirt back", chapter: "Flex zone", region: "Cliffhanger Heights", x: 134, z: -34, lx: 142, lz: -47, clear: 7, radius: 13, open: true },
  { id: "cove", order: 7, name: "Slide-Into-My-DMs Lighthouse", subtitle: "Don't ghost me — say hi", chapter: "Happily ever after?", region: "Sunset Rizz Harbor", x: 152, z: 28, lx: 150, lz: 50, clear: 8, radius: 13, open: true },
];

export const STOP_BY_ID = Object.fromEntries(STOPS.map((s) => [s.id, s])) as Record<StopId, Stop>;

/** Road control points (in journey order). The road passes through every stop. */
export const ROAD_POINTS: [number, number][] = [
  [-140, 64],
  [-132, 54],
  [-124, 40],
  [-120, 22],
  [-116, 4],
  [-108, -12],
  [-98, -24],
  [-82, -32],
  [-66, -28],
  [-50, -18],
  [-34, -8],
  [-20, 4],
  [-6, 16],
  [10, 20],
  [24, 12],
  [36, -2],
  [46, -14],
  [60, -12],
  [76, 4],
  [90, 14],
  [104, 22],
  [118, 18],
  [128, 2],
  [132, -16],
  [134, -34],
  [146, -28],
  [152, -8],
  [154, 10],
  [152, 28],
  [160, 33],
  [170, 35],
  [178, 36],
];

/** River from the northern mountain falls, through the woods and fields, off the south cliffs. */
export const RIVER_POINTS: [number, number][] = [
  [-58, -66],
  [-56, -46],
  [-51, -20],
  [-46, 6],
  [-41, 34],
  [-37, 62],
  [-34, 90],
  [-33, 120],
];

export const START_POSITION = { x: -138.6, z: 61.6 };

/**
 * Hotspots can be visited in any order. The guide suggests the nearest one
 * not yet visited (from the given position), or the first unvisited one.
 */
export function nextStop(visited: readonly StopId[], from?: { x: number; z: number }): StopId | null {
  const left = STOPS.filter((s) => !visited.includes(s.id));
  if (!left.length) return null;
  if (!from) return left[0].id;
  let best = left[0];
  let bd = Infinity;
  for (const s of left) {
    const d = Math.hypot(from.x - s.x, from.z - s.z);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best.id;
}

/** No locks: every hotspot is open from the start. */
export function isUnlocked(_id: StopId, _visited: readonly StopId[]) {
  return true;
}

/** Every hotspot visited? */
export function allVisited(visited: readonly StopId[]) {
  return STOPS.every((s) => visited.includes(s.id));
}
