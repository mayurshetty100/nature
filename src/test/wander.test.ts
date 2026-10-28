import { describe, expect, it } from "vitest";
import { makeWander, wanderStep } from "@/game/wander";

describe("animals move smoothly", () => {
  it("ease into and out of walking instead of snapping between stop and full speed", () => {
    const area = { x: 0, z: 0, r: 12 };
    const w = makeWander(area, 7);
    w.wait = 0;
    let last = 0;
    let maxJump = 0;
    let moved = false;
    for (let i = 0; i < 3000; i++) {
      const v = wanderStep(w, area, 1.5, 1 / 60);
      maxJump = Math.max(maxJump, Math.abs(v - last));
      if (v > 0.5) moved = true;
      last = v;
    }
    expect(moved).toBe(true);
    // never more than a small fraction of cruising speed per frame
    expect(maxJump).toBeLessThan(0.1);
  });
});
