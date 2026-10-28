import { describe, expect, it } from "vitest";
import { RIDES, VEHICLES, YACHT } from "@/game/vehicles";
import { cityLoopDist, CITY_ROAD_HALF, getCityLoop, getLayout, loopPose } from "@/game/layout";
import { getBuildings } from "@/game/buildings";
import { floorAt, getInterior } from "@/game/interiors";
import { getWorld, islandDist, SEA_LEVEL } from "@/game/world";
import { collidersNear } from "@/game/scatter";

describe("vehicles", () => {
  it("is a fleet of race bikes and supercars only — no SUVs or jeeps", () => {
    const types = VEHICLES.map((v) => v.type.toLowerCase());
    expect(VEHICLES.filter((v) => v.kind === "bike").length).toBeGreaterThanOrEqual(2);
    for (const v of VEHICLES) {
      const t = v.type.toLowerCase();
      if (v.kind === "bike") expect(t, v.id).toContain("race bike");
      else expect(/supercar|hypercar|grand tourer/.test(t), v.id).toBe(true);
    }
    expect(types.some((t) => t.includes("suv") || t.includes("jeep"))).toBe(false);
  });

  it("gives every vehicle its own engine sound", () => {
    const voices = [...VEHICLES, YACHT].map((v) => JSON.stringify(v.engine));
    expect(new Set(voices).size).toBe(voices.length);
  });

  it("lets every land vehicle drive into water and over rocks", () => {
    for (const v of VEHICLES) {
      expect(v.climb, v.id).toBeGreaterThan(0);
      expect(v.offroad, v.id).toBeGreaterThan(0);
    }
    // the jeep is the best climber
    const jeep = RIDES.jeep;
    for (const v of VEHICLES) expect(jeep.climb).toBeGreaterThanOrEqual(v.climb);
  });
});

describe("city traffic", () => {
  it("drives a closed ring road, not back and forth", () => {
    const lp = getCityLoop();
    const a = loopPose(0, 0);
    const b = loopPose(lp.length, 0);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.5);
    // every point of the lap stays on the asphalt
    for (let s = 0; s < lp.length; s += 3) {
      const p = loopPose(s, 1.75);
      expect(cityLoopDist(p.x, p.z)).toBeLessThan(CITY_ROAD_HALF);
    }
  });

  it("keeps city blocks off the ring road", () => {
    for (const t of getLayout().towers) expect(cityLoopDist(t.x, t.z), `${t.x},${t.z}`).toBeGreaterThan(CITY_ROAD_HALF + 1);
  });
});

describe("buildings", () => {
  const all = getBuildings();

  it("lets you walk into every village house, city block and landmark", () => {
    const L = getLayout();
    expect(all.filter((b) => ["cottage", "inn", "belfry", "mill"].includes(b.kind)).length).toBeGreaterThanOrEqual(L.village.length);
    expect(all.filter((b) => ["apartment", "office", "cafe"].includes(b.kind)).length).toBeGreaterThanOrEqual(L.towers.length);
    for (const k of ["castle", "workshop", "lighthouse", "barn", "treehouse"]) expect(all.some((b) => b.kind === k), k).toBe(true);
  });

  it("furnishes every interior and gives multi-storey buildings stairs", () => {
    for (const b of all) {
      const I = getInterior(b.id)!;
      expect(I, b.id).toBeTruthy();
      expect(I.furn.length + I.props.length + I.decor.length, b.id).toBeGreaterThan(3);
      if (I.levels > 1) expect(I.stairs.length, b.id).toBeGreaterThanOrEqual(I.levels - 1);
    }
    // apartments have a television
    const apt = getInterior(all.find((b) => b.kind === "apartment")!.id)!;
    expect(apt.furn.some((f) => /television/i.test(f.key)) || apt.decor.some((d) => d.type === "screen")).toBe(true);
  });

  it("can walk up the stairs to the top floor", () => {
    const b = all.find((x) => getInterior(x.id)!.levels > 1)!;
    const I = getInterior(b.id)!;
    const s = I.stairs[0];
    const z = (s.z0 + s.z1) / 2;
    const bottom = s.up > 0 ? s.x0 + 0.05 : s.x1 - 0.05;
    const top = s.up > 0 ? s.x1 - 0.05 : s.x0 + 0.05;
    expect(floorAt(I, bottom, z, s.y0 + 0.1)).toBeLessThan(s.y0 + 0.5);
    expect(floorAt(I, top, z, s.y1 - 0.3)).toBeGreaterThan(s.y1 - 0.5);
  });

  it("puts every door on open ground you can reach", () => {
    for (const b of all) {
      if (b.kind === "treehouse") continue;
      const blocked = collidersNear(b.x, b.z).some((c) => c.h === undefined && Math.hypot(c.x - b.x, c.z - b.z) < c.r * 0.7);
      expect(blocked, b.id).toBe(false);
    }
  });
});

describe("ocean", () => {
  const w = getWorld();
  it("has no land barrier: you can head well out to sea", () => {
    const far = { x: 0, z: 112 * 1.7 };
    expect(islandDist(far.x, far.z)).toBeGreaterThan(1.3);
    expect(w.inBounds(far.x, far.z)).toBe(true);
    expect(w.waterSurface(far.x, far.z)).toBe(SEA_LEVEL);
    expect(w.depthAt(far.x, far.z)).toBeGreaterThan(3);
  });
});
