import { describe, expect, it } from "vitest";
import { getChillSpots, nearestChill, sipWeight, SIP } from "@/game/chill";

describe("chill spots (relax with a juice and enjoy the view)", () => {
  it("has loungers on the rooftop terraces and benches along the seawalk", () => {
    const spots = getChillSpots();
    expect(spots.some((s) => s.kind === "lounger")).toBe(true);
    expect(spots.some((s) => s.kind === "bench")).toBe(true);
  });

  it("finds the spot you're standing beside, but not one on another level", () => {
    const s = getChillSpots().find((q) => q.kind === "lounger")!;
    expect(nearestChill(s.x + 0.5, s.y, s.z)).toBe(s);
    expect(nearestChill(s.x, s.y - 5, s.z)).toBeNull();
  });

  it("sips now and then, never constantly", () => {
    expect(sipWeight(0.5)).toBe(0);
    const peak = 1.2 + SIP.lasts / 2;
    expect(sipWeight(peak)).toBeCloseTo(1, 2);
    expect(sipWeight(1.2 + SIP.lasts + 1)).toBe(0);
    expect(sipWeight(peak + SIP.every)).toBeCloseTo(1, 2);
  });
});
