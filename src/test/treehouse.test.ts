import { describe, expect, it } from "vitest";
import { getForest } from "@/game/trails";
import { STEP_UP, footprintDist } from "@/game/scatter";
import { getChillSpots } from "@/game/chill";
import { getSwing, swingAngle, SWING_MAX } from "@/game/swing";
import { fallColliders, getFalls } from "@/game/falls";

describe("treehouse spiral stairs", () => {
  const th = getForest().treehouse;
  const cols = getForest().colliders;

  it("winds round the trunk with even, walkable risers from the ground to the deck", () => {
    expect(th.steps.length).toBeGreaterThanOrEqual(10);
    const last = th.steps[th.steps.length - 1];
    expect(last.top - last.base).toBeLessThanOrEqual(STEP_UP);
    for (let i = 1; i < th.steps.length; i++) expect(th.steps[i - 1].top - th.steps[i].top).toBeLessThanOrEqual(STEP_UP);
    expect(th.deck.top - th.steps[0].top).toBeLessThanOrEqual(STEP_UP);
    // circular: every tread sits on the same ring round the tree
    for (const s of th.steps) expect(Math.hypot(s.x - th.tree.x, s.z - th.tree.z)).toBeCloseTo(th.spiral.mid, 1);
  });

  it("has a solid railing on both sides of every upper tread", () => {
    for (const s of th.steps.slice(0, -2)) {
      for (const r of [th.spiral.inner - 0.05, th.spiral.outer + 0.05]) {
        const x = th.tree.x + Math.cos(s.a) * r;
        const z = th.tree.z + Math.sin(s.a) * r;
        const rail = cols.find((c) => c.hw !== undefined && c.top !== undefined && c.top > s.top + 0.9 && footprintDist(c, x, z) <= 0);
        expect(rail, `tread at ${s.a.toFixed(2)} r=${r}`).toBeTruthy();
      }
    }
  });
});

describe("rope swing", () => {
  it("is a spot you can sit on that swings once you're on it", () => {
    const sw = getSwing();
    const spot = getChillSpots().find((s) => s.kind === "swing");
    expect(spot).toBeTruthy();
    expect(Math.hypot(spot!.x - sw.px, spot!.z - sw.pz)).toBeLessThan(0.01);
    const since = 1000;
    let max = 0;
    for (let t = since + 6000; t < since + 12000; t += 50) max = Math.max(max, Math.abs(swingAngle(t, since)));
    expect(max).toBeGreaterThan(SWING_MAX * 0.9);
    // empty, it barely moves
    for (let t = 0; t < 5000; t += 100) expect(Math.abs(swingAngle(t, 0))).toBeLessThan(0.06);
  });
});

describe("waterfalls", () => {
  it("are solid where the water falls", () => {
    const { cliff, mountain } = getFalls();
    const cols = fallColliders();
    for (const f of [...cliff, mountain]) {
      const mid = { x: f.x + f.dirX * f.reach * 0.5, z: f.z + f.dirZ * f.reach * 0.5 };
      expect(cols.some((c) => footprintDist(c, mid.x, mid.z) <= 0)).toBe(true);
    }
  });
});

describe("indoor stairs", () => {
  it("have a solid banister: you can't walk off the open side of a flight", async () => {
    const { getBuildings } = await import("@/game/buildings");
    const { getInterior, collideInterior, stairHeight } = await import("@/game/interiors");
    const multi = getBuildings()
      .map((b) => getInterior(b.id))
      .filter((I) => I && I.stairs.length);
    expect(multi.length).toBeGreaterThan(0);
    for (const I of multi) {
      for (const s of I!.stairs) {
        const x = (s.x0 + s.x1) / 2;
        const feet = stairHeight(s, x);
        // standing on the middle of the flight, walking out over the open side in small steps
        let z = (s.z0 + s.z1) / 2;
        for (let k = 0; k < 30; k++) z = collideInterior(I!, x, z + 0.05, feet, 0.35).z;
        expect(z, I!.id).toBeLessThan(s.z1);
      }
    }
  });
});
