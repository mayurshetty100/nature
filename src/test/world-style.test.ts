import { describe, expect, it } from "vitest";
import { getScatter, type ModelKey } from "@/game/scatter";
import { getLayout } from "@/game/layout";
import { getSeawalk, seawalkDist } from "@/game/coast";
import { storyFor } from "@/game/story";
import { STOPS } from "@/game/stops";
import { profile } from "@/data/portfolio";

const TREES: ModelKey[] = ["oak", "default", "detailed", "fat", "tall", "pineTall", "pineRound", "cone"];

describe("trees have breathing space", () => {
  it("never plants two grid trees closer than 4.5 m", () => {
    const { items } = getScatter();
    const all = TREES.flatMap((k) => items[k]);
    expect(all.length).toBeGreaterThan(100);
    const hash = new Map<string, { x: number; z: number }[]>();
    for (const t of all) {
      const k = `${Math.floor(t.x / 5)},${Math.floor(t.z / 5)}`;
      if (!hash.has(k)) hash.set(k, []);
      hash.get(k)!.push(t);
    }
    let closest = Infinity;
    for (const t of all) {
      const cx = Math.floor(t.x / 5);
      const cz = Math.floor(t.z / 5);
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++)
          for (const o of hash.get(`${cx + i},${cz + j}`) ?? []) if (o !== t) closest = Math.min(closest, Math.hypot(o.x - t.x, o.z - t.z));
    }
    expect(closest).toBeGreaterThanOrEqual(4.5);
  });

  it("gives every tree its own leaf shade", () => {
    const { items } = getScatter();
    const tints = new Set(TREES.flatMap((k) => items[k].map((t) => t.tint)));
    expect(tints.has(undefined)).toBe(false);
    expect(tints.size).toBeGreaterThanOrEqual(10);
  });
});

describe("the seawalk", () => {
  it("is a real boardwalk along the beach", () => {
    expect(getSeawalk().points.length).toBeGreaterThan(30);
  });
  it("has no palm tree standing on it", () => {
    for (const p of getLayout().palms) expect(seawalkDist(p.x, p.z)).toBeGreaterThanOrEqual(3.5);
  });
});

describe("story chapters", () => {
  it("never show a phone number", () => {
    for (const s of STOPS) {
      const text = [storyFor(s.id).title, ...storyFor(s.id).lines].join(" ");
      expect(text).not.toMatch(/\+?\d[\d\s-]{8,}\d/);
    }
  });
  it("always end the intro with Mayur's real name", () => {
    expect(storyFor("gate").title).toContain(profile.name);
  });
});
