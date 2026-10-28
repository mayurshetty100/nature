import { describe, expect, it } from "vitest";
import { cityLoopDist, CITY_ROAD_HALF, getLamps, getLayout } from "@/game/layout";
import { getBuildings } from "@/game/buildings";
import { getScatter } from "@/game/scatter";
import { getInterior, type Interior } from "@/game/interiors";
import { FURNITURE, FURN_SCALE } from "@/game/furniture";
import { getWorld, ROAD_HALF } from "@/game/world";
import { addCreature, nearestCreature, nuzzle, PET_REACT_MS, PET_WAVE_MS, petHand, reaction, type Creature } from "@/game/creatures";

const CHAIRS = new Set(["chair", "chairCushion", "chairRounded", "benchCushion"]);
const TABLES = new Set(["table", "tableCloth", "tableRound"]);
const interiors = () => getBuildings().map((b) => getInterior(b.id) as Interior);

describe("nothing stands on the roads", () => {
  it("keeps every lamp post off the main road and the city ring road", () => {
    const w = getWorld();
    const lamps = getLamps();
    expect(lamps.length).toBeGreaterThan(10);
    for (const l of lamps) {
      expect(w.nearestRoad(l.x, l.z, 20).dist).toBeGreaterThanOrEqual(ROAD_HALF + 0.45);
      expect(cityLoopDist(l.x, l.z)).toBeGreaterThanOrEqual(CITY_ROAD_HALF + 0.45);
    }
  });

  it("keeps every doorway free of trees, bushes and props", () => {
    const { items } = getScatter();
    const doors = getBuildings().filter((d) => d.kind !== "treehouse");
    for (const [key, list] of Object.entries(items)) {
      if (key.startsWith("house") || ["inn", "mill", "bellTower", "stable"].includes(key)) continue;
      for (const p of list) for (const d of doors) expect(Math.hypot(p.x - d.x, p.z - d.z), `${key} at ${d.name}`).toBeGreaterThanOrEqual(3.2);
    }
  });

  it("keeps beach palms off the ring road", () => {
    for (const p of getLayout().palms) expect(cityLoopDist(p.x, p.z)).toBeGreaterThanOrEqual(CITY_ROAD_HALF + 3);
  });
});

describe("furniture", () => {
  it("turns every chair and bench at a table to face that table", () => {
    for (const I of interiors()) {
      const tables = I.furn.filter((f) => TABLES.has(f.key));
      for (const c of I.furn.filter((f) => CHAIRS.has(f.key))) {
        const t = tables.filter((q) => Math.abs(q.y - c.y) < 0.1).sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0];
        if (!t || Math.hypot(t.x - c.x, t.z - c.z) > 1.5) continue;
        const dx = t.x - c.x;
        const dz = t.z - c.z;
        const l = Math.hypot(dx, dz) || 1;
        const facing = (Math.sin(c.rot) * dx + Math.cos(c.rot) * dz) / l;
        expect(facing, `${I.id} ${c.key} at ${c.x.toFixed(1)},${c.z.toFixed(1)}`).toBeGreaterThan(0.3);
      }
    }
  });

  it("pushes every bed into a corner of its room", () => {
    for (const I of interiors()) {
      for (const b of I.furn.filter((f) => f.key.startsWith("bed"))) {
        const [fw, , fd] = FURNITURE[b.key];
        const turned = Math.abs(Math.round(b.rot / (Math.PI / 2))) % 2 === 1;
        const hw = ((turned ? fd : fw) * FURN_SCALE) / 2;
        const hd = ((turned ? fw : fd) * FURN_SCALE) / 2;
        const side = Math.min(Math.abs(b.x - hw + I.w / 2), Math.abs(b.x + hw - I.w / 2));
        const end = Math.min(Math.abs(b.z - hd + I.d / 2), Math.abs(b.z + hd - I.d / 2));
        expect(side, `${I.id} ${b.key} side wall`).toBeLessThan(0.25);
        expect(end, `${I.id} ${b.key} end wall`).toBeLessThan(0.25);
      }
    }
  });

  it("offers a sit or lie-down spot in every home that has a seat or bed", () => {
    for (const I of interiors()) {
      const restable = I.furn.some((f) => CHAIRS.has(f.key) || f.key.startsWith("bed") || f.key.startsWith("lounge"));
      if (restable) expect(I.spots.some((s) => s.kind === "sit" || s.kind === "lie"), I.id).toBe(true);
    }
  });

  it("gives the village cottages different layouts", () => {
    const cottages = getBuildings().filter((b) => b.kind === "cottage");
    const layouts = new Set(cottages.map((b) => getInterior(b.id)!.furn.map((f) => f.key).sort().join(",")));
    expect(layouts.size).toBeGreaterThanOrEqual(4);
  });
});

describe("city towers", () => {
  it("lets you walk into all six skyscrapers, each with a lift on every floor", () => {
    const towers = getBuildings().filter((b) => b.kind === "skyscraper");
    expect(towers.length).toBe(6);
    for (const t of towers) {
      const I = getInterior(t.id)!;
      expect(I.levels).toBeGreaterThanOrEqual(4);
      const lifts = I.spots.filter((s) => s.kind === "lift");
      expect(new Set(lifts.map((s) => s.level)).size).toBe(I.levels);
    }
  });
});

describe("petting animals", () => {
  it("finds an animal within reach and lets it react for a while after a pat", () => {
    const cow: Creature = { name: "cow", x: 1000, z: 1000, y: 0, r: 0.9, height: 1.5, voice: "moo", petAt: 0 };
    const off = addCreature(cow);
    expect(nearestCreature(1001.5, 1000, 0)).toBe(cow);
    expect(nearestCreature(1004, 1000, 0)).toBe(null);
    cow.petAt = 5000;
    expect(reaction(cow, 5000 + PET_REACT_MS / 2)).toBeGreaterThan(0);
    expect(reaction(cow, 5000 + PET_REACT_MS + 1)).toBe(-1);
    off();
  });

  it("animals lean fully into the hand mid-pat and stand straight again afterwards", () => {
    expect(nuzzle(-1)).toBe(0);
    expect(nuzzle(0.4)).toBe(1);
    expect(nuzzle(1)).toBe(0);
  });

  it("the explorer's hand is out and waving mid-pat and lowered once the wave ends", () => {
    expect(petHand(PET_WAVE_MS / 2)).toBe(1);
    expect(petHand(PET_WAVE_MS)).toBe(0);
  });
});
