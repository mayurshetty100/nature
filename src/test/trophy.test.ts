import { describe, expect, it } from "vitest";
import { carryWeight, LIFT, nearTrophy, trophySpot } from "@/game/trophy";

describe("lifting the trophy", () => {
  it("floats into the hands, stays up for the celebration, then goes back", () => {
    expect(carryWeight(0)).toBe(0);
    expect(carryWeight(LIFT.flyIn)).toBe(1);
    expect(carryWeight(LIFT.ms / 2)).toBe(1);
    expect(carryWeight(LIFT.ms)).toBe(0);
  });

  it("can be lifted only when standing beside the pedestal", () => {
    const t = trophySpot();
    expect(nearTrophy(t.x + 3.5, t.z)).toBe(true);
    expect(nearTrophy(t.x + 12, t.z)).toBe(false);
  });
});
