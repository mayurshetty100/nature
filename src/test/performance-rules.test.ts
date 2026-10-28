import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { getBuildings } from "@/game/buildings";
import { getInterior } from "@/game/interiors";
import { bakeStatic } from "@/components/world/bakeStatic";

describe("smoothness rules", () => {
  it("no room needs more than the 4 always-mounted room lamps", () => {
    for (const b of getBuildings()) {
      const I = getInterior(b.id);
      if (I) expect(I.lights.length, b.id).toBeLessThanOrEqual(4);
    }
  });

  it("still scenery merges into one draw, animated parts stay separate", () => {
    const root = new THREE.Group();
    const still = [0, 1, 2].map((i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: i === 0 ? "#ff0000" : "#00ff00" }));
      m.position.x = i * 2;
      root.add(m);
      return m;
    });
    const spinner = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: "#0000ff" }));
    spinner.userData.keep = true;
    root.add(spinner);

    const undo = bakeStatic(root);
    const baked = root.children.filter((c) => c.name === "baked");
    expect(baked).toHaveLength(1);
    expect(still.every((m) => !m.visible)).toBe(true);
    expect(spinner.visible).toBe(true);

    undo();
    expect(root.children.filter((c) => c.name === "baked")).toHaveLength(0);
    expect(still.every((m) => m.visible)).toBe(true);
  });

  it("glowing materials are never merged into a copy (night glow keeps working)", () => {
    const root = new THREE.Group();
    const glow = new THREE.MeshStandardMaterial({ color: "#ffd27e", emissive: "#ffa940", emissiveIntensity: 1 });
    for (let i = 0; i < 3; i++) root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), glow));
    bakeStatic(root);
    const baked = root.children.filter((c) => c.name === "baked") as THREE.Mesh[];
    expect(baked).toHaveLength(1);
    expect(baked[0].material).toBe(glow);
  });
});

describe("model clean-up", () => {
  it("strips lights that ship inside animal models", async () => {
    const { stylizeModel } = await import("@/game/models");
    const fox = new THREE.Group();
    fox.add(new THREE.DirectionalLight(), new THREE.PointLight(), new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    stylizeModel(fox, "/models/animals/RedFox.glb");
    let lights = 0;
    fox.traverse((o) => {
      if ((o as THREE.Light).isLight) lights++;
    });
    expect(lights).toBe(0);
  });
});
