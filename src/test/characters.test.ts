import { describe, expect, it } from "vitest";
import { HEROES, PETS, POWERS } from "@/game/characters";
import { footBoost, powerTiming } from "@/game/abilities";

describe("explorers and pets", () => {
  it("offers Mayur's own explorer first, named Shetty", () => {
    expect(HEROES[0].id).toBe("mayur");
    expect(HEROES[0].name).toBe("Shetty");
  });

  it("gives every explorer a different super power", () => {
    const powers = HEROES.map((h) => h.power);
    expect(new Set(powers).size).toBe(HEROES.length);
    for (const p of powers) expect(POWERS[p]).toBeDefined();
  });

  it("gives no explorer a stick weapon", () => {
    for (const h of HEROES) expect(h.look).not.toHaveProperty("weapon");
  });

  it("includes every pet the user asked for", () => {
    const ids = PETS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["panda", "penguin", "bunny", "dragon", "cat", "puppy", "fox"]));
  });

  it("gives every pet its own ability and its own signature move", () => {
    const pets = PETS.filter((p) => p.id !== "none");
    const perks = pets.map((p) => p.magic?.perk);
    const moves = pets.map((p) => p.move?.kind);
    expect(perks.every(Boolean)).toBe(true);
    expect(new Set(perks).size).toBe(pets.length);
    expect(new Set(moves).size).toBe(pets.length);
  });

  it("names are unique across explorers, pets and rides", () => {
    const names = [...HEROES.map((h) => h.name), ...PETS.map((p) => p.name)];
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("abilities really change movement", () => {
  it("Flash Rush doubles running speed and Moon Leap jumps higher in low gravity", () => {
    expect(footBoost("speed", undefined).walk).toBeGreaterThanOrEqual(2);
    const leap = footBoost("leap", undefined);
    expect(leap.jump).toBeGreaterThan(1);
    expect(leap.gravity).toBeLessThan(1);
  });

  it("pet abilities stack on top of a power", () => {
    expect(footBoost("speed", "speed").walk).toBeCloseTo(2.1 * 1.25);
    expect(footBoost(null, "swim").swim).toBeGreaterThan(1.5);
    expect(footBoost(null, "glide").fall).toBeLessThan(1);
    expect(footBoost(null, "ride").ride).toBeGreaterThan(1);
  });

  it("Byte halves the recharge and Bao stretches the power time", () => {
    expect(powerTiming({ seconds: 12, cooldown: 6 }, "cooldown")).toEqual({ seconds: 12, cooldown: 3 });
    expect(powerTiming({ seconds: 12, cooldown: 6 }, "duration")).toEqual({ seconds: 18, cooldown: 6 });
  });
});
