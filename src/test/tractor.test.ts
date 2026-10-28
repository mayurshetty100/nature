import { describe, expect, it } from "vitest";
import { getLayout } from "@/game/layout";
import { cropGrowth, REGROW, TRACTOR_PLOTS, tractorLaps, tractorPose } from "@/game/tractor";

describe("harvesting tractors", () => {
  const plot = getLayout().plots[TRACTOR_PLOTS[0]];

  it("drives a continuous loop (no jumps between laps)", () => {
    const laps = tractorLaps(plot);
    for (let i = 0; i < laps.length; i++) {
      const a = laps[i];
      const b = laps[(i + 1) % laps.length];
      expect(Math.hypot(a.xs[a.xs.length - 1] - b.xs[0], a.zs[a.zs.length - 1] - b.zs[0])).toBeLessThan(0.01);
      for (let k = 1; k < a.xs.length; k++) expect(Math.hypot(a.xs[k] - a.xs[k - 1], a.zs[k] - a.zs[k - 1])).toBeLessThan(2);
    }
  });

  it("covers the whole plot in rows, not just back and forth on one line", () => {
    const zs = new Set<number>();
    for (let t = 0; t < 400; t += 0.5) {
      const p = tractorPose(plot, t);
      if (p.cutting) zs.add(Math.round(p.z));
    }
    expect(zs.size).toBeGreaterThanOrEqual(3);
  });

  it("only cuts inside the plot, and laps start from different corners", () => {
    for (let t = 0; t < 400; t += 0.5) {
      const p = tractorPose(plot, t);
      if (p.cutting) {
        expect(Math.abs(p.x - plot.x)).toBeLessThanOrEqual(plot.w / 2 + 0.3);
        expect(Math.abs(p.z - plot.z)).toBeLessThanOrEqual(plot.d / 2);
      }
    }
    const starts = tractorLaps(plot).map((l) => `${Math.sign(l.xs[0] - plot.x)},${Math.sign(l.zs[0] - plot.z)}`);
    expect(new Set(starts).size).toBeGreaterThanOrEqual(3);
  });

  it("leaves stubble that grows back later", () => {
    expect(cropGrowth(1)).toBeLessThan(0.2);
    expect(cropGrowth(Infinity)).toBe(1);
    expect(cropGrowth(REGROW.after + REGROW.takes + 1)).toBeCloseTo(1);
  });
});
