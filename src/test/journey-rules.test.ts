import { describe, expect, it } from "vitest";
import { allVisited, isUnlocked, nextStop, STOPS, STOP_BY_ID } from "@/game/stops";
import { storyFor } from "@/game/story";

describe("free-roam hotspots", () => {
  it("starts by suggesting the Welcome gate", () => {
    expect(nextStop([])).toBe("gate");
  });

  it("never locks a hotspot — any order is fine", () => {
    for (const s of STOPS) expect(isUnlocked(s.id, [])).toBe(true);
  });

  it("suggests the nearest hotspot not yet visited", () => {
    const city = STOP_BY_ID.city;
    expect(nextStop(["gate"], { x: city.x + 1, z: city.z })).toBe("city");
    expect(nextStop(["gate", "city"], { x: city.x + 1, z: city.z })).not.toBe("city");
  });

  it("reports completion only when every hotspot is visited", () => {
    const all = STOPS.map((s) => s.id);
    expect(allVisited(all.slice(1))).toBe(false);
    expect(allVisited(all)).toBe(true);
    expect(nextStop(all)).toBeNull();
  });

  it("uses no numbers in hotspot names", () => {
    for (const s of STOPS) expect(s.name).not.toMatch(/\d/);
  });
});

describe("story text", () => {
  it("never shows a phone number", () => {
    const text = STOPS.map((s) => {
      const st = storyFor(s.id);
      return [st.title, ...st.lines].join(" ");
    }).join(" ");
    expect(text).not.toMatch(/\+?91[\s-]?\d{5}|\d{10}/);
  });

  it("ends with the resume and LinkedIn links", () => {
    const labels = storyFor("cove").links?.map((l) => l.label);
    expect(labels).toEqual(expect.arrayContaining(["Resume", "LinkedIn"]));
  });
});
