import { describe, expect, it } from "vitest";
import { boxCollider, collidersNear, footprintDist, getScatter, overlaps, pushOut } from "@/game/scatter";
import { getLayout } from "@/game/layout";

describe("solid scenery", () => {
  it("pushes the explorer out of a building wall, corners included", () => {
    // a 6 × 4 house turned 45°
    const house = boxCollider(0, 0, 6, 4, Math.PI / 4);
    // a point just inside the long wall, then pushed out to body radius beyond it
    const o = pushOut(house, 0.5, 0.5, 0.3);
    expect(o.hit).toBe(true);
    expect(footprintDist(house, o.x, o.z)).toBeCloseTo(0.3, 5);
  });

  it("blocks the corner of a square house that a round collider would miss", () => {
    const house = boxCollider(0, 0, 4, 4, 0);
    // 2.7 m along the diagonal sits inside the box corner region (corner at 2.83 m)
    const p = 2.7 / Math.SQRT2;
    expect(overlaps(house, p, p, 0.3)).toBe(true);
  });

  it("backs you out the way you came when you end up dead centre", () => {
    const rock = { x: 10, z: 10, r: 1 };
    const o = pushOut(rock, 10, 10, 0.3, -1, 0);
    expect(o.x).toBeCloseTo(10 - 1.3, 5);
    expect(o.z).toBeCloseTo(10, 5);
  });

  it("gives every small rock and fence panel a solid footprint", () => {
    const { items } = getScatter();
    const missing = [...items.rockSmall, ...items.fence, ...items.fencePlanks].filter((it) => !collidersNear(it.x, it.z).some((c) => footprintDist(c, it.x, it.z) <= 0));
    expect(missing.length).toBe(0);
  });

  it("makes boulders climbable: a rock top you can stand on", () => {
    const { items } = getScatter();
    const r = items.rockA[0] ?? items.rockC[0];
    const tops = collidersNear(r.x, r.z).filter((c) => c.h !== undefined && footprintDist(c, r.x, r.z) < 0);
    expect(tops.length).toBeGreaterThan(0);
  });

  it("covers every village house with a wall footprint", () => {
    const uncovered = getLayout().village.filter((b) => !collidersNear(b.x, b.z).some((c) => c.hw !== undefined && footprintDist(c, b.x, b.z) < 0));
    expect(uncovered.length).toBe(0);
  });
});

describe("roofs and floors you can stand on", () => {
  it("lands you on a house roof: ridge in the middle, lower at the eaves", async () => {
    const { supportAt, surfaceAt } = await import("@/game/scatter");
    const b = getLayout().village[0];
    const roof = collidersNear(b.x, b.z).find((c) => c.roof && footprintDist(c, b.x, b.z) < 0)!;
    expect(roof).toBeTruthy();
    const ridge = surfaceAt(roof, roof.x, roof.z);
    // feet just above the roof → you stand on it, not on the ground below
    expect(supportAt(roof.x, roof.z, ridge + 0.1)).toBeCloseTo(ridge, 3);
    // near a wall the roof is lower than at the ridge
    const edge = roof.roof!.ridge === "x" ? { x: roof.x + Math.sin(roof.rot!) * (roof.hd! - 0.1), z: roof.z + Math.cos(roof.rot!) * (roof.hd! - 0.1) } : { x: roof.x + Math.cos(roof.rot!) * (roof.hw! - 0.1), z: roof.z - Math.sin(roof.rot!) * (roof.hw! - 0.1) };
    expect(surfaceAt(roof, edge.x, edge.z)).toBeLessThan(ridge - 1);
  });

  it("lets you stand on the castle courtyard floor instead of sinking into it", async () => {
    const { landmarkColliders } = await import("@/game/landmarkColliders");
    const { STOP_BY_ID } = await import("@/game/stops");
    const { getWorld } = await import("@/game/world");
    const a = STOP_BY_ID.academy;
    const floor = landmarkColliders().find((c) => c.hw === 21 / 2)!;
    expect(floor.top).toBeCloseTo(getWorld().gridHeight(a.lx, a.lz) + 0.6, 3);
  });
});
