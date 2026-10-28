import { describe, expect, it } from "vitest";
import { getLayout, shellFootprint } from "@/game/layout";
import { footprintMinGround, getFoundations, plinthFor } from "@/game/foundations";
import { getWorld } from "@/game/world";
import { STOP_BY_ID } from "@/game/stops";
import { ACADEMY_STEP } from "@/game/landmarkColliders";

describe("buildings sit on the ground", () => {
  it("every village house floating over a slope gets a plinth reaching below the ground", () => {
    const w = getWorld();
    const plinths = getFoundations();
    for (const b of getLayout().village) {
      const f = shellFootprint(b.model, b.x, b.z, b.scale, b.rot);
      if (!f) continue;
      const floor = w.gridHeight(b.x, b.z) - 0.08;
      const low = footprintMinGround(f.x, f.z, f.w, f.d, b.rot);
      if (floor - low < 0.06) continue;
      const p = plinths.find((q) => Math.hypot(q.x - f.x, q.z - f.z) < 0.01);
      expect(p, b.model).toBeTruthy();
      expect(p!.bottom).toBeLessThan(low);
      expect(p!.top).toBeGreaterThanOrEqual(floor);
    }
  });

  it("the castle courtyard has a foundation when the hillside drops away", () => {
    const s = STOP_BY_ID.academy;
    const y = getWorld().gridHeight(s.lx, s.lz) - 0.2;
    const p = plinthFor(s.lx, s.lz, ACADEMY_STEP.w, ACADEMY_STEP.d, 0, y);
    const low = footprintMinGround(s.lx, s.lz, ACADEMY_STEP.w, ACADEMY_STEP.d, 0);
    if (y - low >= 0.06) expect(p && p.bottom < low).toBe(true);
  });
});
