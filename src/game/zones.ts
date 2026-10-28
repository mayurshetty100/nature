/** Named areas kept clear of forest for meadows, farms, wildlife, the village and the city. */
export type ZoneKind = "village" | "farm" | "pasture" | "savanna" | "meadow" | "city";
export type Zone = { id: string; x: number; z: number; r: number; kind: ZoneKind };

export const ZONES: Zone[] = [
  { id: "meadow-welcome", x: -121, z: 67, r: 12, kind: "meadow" },
  { id: "meadow-west", x: -146, z: 38, r: 10, kind: "meadow" },
  { id: "glade", x: -88, z: 10, r: 15, kind: "savanna" },
  { id: "farm", x: -6, z: 54, r: 24, kind: "farm" },
  { id: "farm-north", x: 14, z: -18, r: 14, kind: "farm" },
  { id: "pasture", x: 30, z: 42, r: 12, kind: "pasture" },
  { id: "village", x: 54, z: -24, r: 20, kind: "village" },
  { id: "city", x: 106, z: 26, r: 34, kind: "city" },
  // woodland clearings where the deer graze
  { id: "clearing-1", x: -112, z: 30, r: 6, kind: "meadow" },
  { id: "clearing-2", x: -104, z: 8, r: 6, kind: "meadow" },
  { id: "clearing-3", x: -78, z: -40, r: 6, kind: "meadow" },
];

export const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z])) as Record<string, Zone>;

export function zoneAt(x: number, z: number, pad = 0) {
  for (const zn of ZONES) if ((zn.x - x) ** 2 + (zn.z - z) ** 2 < (zn.r + pad) ** 2) return zn;
  return null;
}

/** Parked vehicles beside the road at the start (x, z, facing). */
export const VEHICLE_SPOTS = {
  motorbike: { x: -134.4, z: 65.2, yaw: 2.47 },
  car: { x: -144.2, z: 57.2, yaw: 2.47 },
} as const;
