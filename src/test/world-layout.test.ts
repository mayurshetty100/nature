import { describe, expect, it } from "vitest";
import { STOPS, START_POSITION } from "@/game/stops";
import { REGIONS } from "@/game/regions";
import { getWorld, naturalHeight } from "@/game/world";
import { VEHICLE_SPOTS } from "@/game/zones";

describe("world layout", () => {
  const w = getWorld();

  it("visits the regions in order: meadow, forest, fields, village, city, cliffs, harbor", () => {
    expect(REGIONS.map((r) => r.id)).toEqual(["meadow", "forest", "fields", "village", "city", "cliffs", "harbor"]);
    expect(STOPS.map((s) => w.regionAt(s.x, s.z))).toEqual(["meadow", "forest", "fields", "village", "city", "cliffs", "harbor"]);
  });

  it("puts every key point, the start and the parked vehicles on walkable land", () => {
    for (const s of STOPS) expect(w.walkable(s.x, s.z), s.id).toBe(true);
    expect(w.walkable(START_POSITION.x, START_POSITION.z)).toBe(true);
    for (const v of Object.values(VEHICLE_SPOTS)) expect(w.walkable(v.x, v.z)).toBe(true);
  });

  it("keeps the road on land except for the harbor pier", () => {
    for (let i = 0; i < w.road.count; i++) {
      if (w.pier[i]) continue;
      expect(naturalHeight(w.road.xs[i], w.road.zs[i])).toBeGreaterThan(0.3);
    }
    expect(w.pier.some((p) => p === 1)).toBe(true);
  });

  it("is one long journey (over 450 units of road)", () => {
    expect(w.road.length).toBeGreaterThan(450);
  });
});
