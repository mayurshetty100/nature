/**
 * The world's regions in journey order. Each region begins where the road
 * passes its anchor point; everything off the road belongs to the region of
 * the nearest stretch of road.
 */
export type RegionId = "meadow" | "forest" | "fields" | "village" | "city" | "cliffs" | "harbor";

export type Region = { id: RegionId; name: string; ax: number; az: number };

export const REGIONS: Region[] = [
  { id: "meadow", name: "Meet-Cute Meadow", ax: -140, az: 64 },
  { id: "forest", name: "Sweet Nothings Woods", ax: -121, az: 28 },
  { id: "fields", name: "Butterfly Crush Fields", ax: -38, az: -10 },
  { id: "village", name: "Cosy Crush Village", ax: 30, az: 6 },
  { id: "city", name: "Downtown Drama", ax: 72, az: 0 },
  { id: "cliffs", name: "Cliffhanger Heights", ax: 126, az: 6 },
  { id: "harbor", name: "Sunset Rizz Harbor", ax: 150, az: -16 },
];

export const REGION_INDEX = Object.fromEntries(REGIONS.map((r, i) => [r.id, i])) as Record<RegionId, number>;
