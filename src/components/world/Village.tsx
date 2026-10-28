import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paint } from "./boatGeometry";
import { Sparkles } from "@react-three/drei";
import { getWorld } from "@/game/world";
import { getLayout } from "@/game/layout";
import type { Area } from "@/game/wander";
import { AnimatedAgent } from "./Agents";

const PEOPLE = [
  { url: "/models/people/Worker_Female.glb", seed: 11 },
  { url: "/models/people/OldClassy_Female.glb", seed: 13 },
  { url: "/models/people/Chef_Male.glb", seed: 14 },
  { url: "/models/people/Kimono_Female.glb", seed: 16 },
  { url: "/models/people/Casual_Male.glb", seed: 17 },
];

/** The CC0 House_3 / House_4 pieces ship without roofs — give each a storybook gable roof (one merged mesh). */
function VillageRoofs() {
  const geometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const palette = ["#2f7f86", "#8c3b2b", "#4e5d6c"];
    const w = getWorld();
    let n = 0;
    for (const house of getLayout().village) {
      if (house.model !== "House_3" && house.model !== "House_4") continue;
      const top = house.model === "House_3" ? 2.09 : 1.07;
      const cx = house.model === "House_3" ? -0.01 : 0;
      const hx = 0.97;
      const hz = 1.065;
      const cz = 0.005;
      const pitch = Math.PI * 0.235;
      const slope = Math.tan(pitch);
      const rise = hz * slope;
      const roofHz = hz + 0.12;
      const roofW = (hx + 0.12) * 2;
      const tint = palette[n++ % palette.length];
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(house.x, w.gridHeight(house.x, house.z) - 0.08, house.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), house.rot),
        new THREE.Vector3(house.scale, house.scale, house.scale),
      );
      const add = (g: THREE.BufferGeometry, color: string) => {
        g.applyMatrix4(m);
        parts.push(paint(g, color));
      };
      const box = (size: [number, number, number], pos: [number, number, number], color: string, rx = 0) => {
        const g = new THREE.BoxGeometry(...size);
        g.rotateX(rx);
        g.translate(...pos);
        add(g, color);
      };
      // solid gable: ridge along local X, slopes face front/back
      const tri = new THREE.Shape();
      tri.moveTo(-hz, 0);
      tri.lineTo(hz, 0);
      tri.lineTo(0, rise);
      tri.closePath();
      const gable = new THREE.ExtrudeGeometry(tri, { depth: hx * 2, bevelEnabled: false, steps: 1 });
      gable.rotateY(Math.PI / 2);
      gable.translate(cx - hx, top, cz);
      add(gable, "#d9c6a0");
      const th = 0.09;
      for (const side of [-1, 1]) {
        box(
          [roofW, th, roofHz / Math.cos(pitch)],
          [cx, top + rise - (roofHz * slope) / 2 + (th * Math.cos(pitch)) / 2, cz + (side * roofHz) / 2 + (side * th * Math.sin(pitch)) / 2],
          tint,
          side * pitch,
        );
        // timber framing on each gable end
        box([0.045, 0.065, hz * 2], [cx + side * (hx + 0.005), top + 0.035, cz], "#73533d");
        box([0.045, rise, 0.055], [cx + side * (hx + 0.008), top + rise / 2, cz], "#73533d");
      }
      const ridge = new THREE.CylinderGeometry(0.085, 0.085, roofW + 0.05, 6);
      ridge.rotateZ(Math.PI / 2);
      ridge.translate(cx, top + rise + 0.07, cz);
      add(ridge, tint);
      const chz = cz - 0.48;
      const chBase = top + rise - 0.48 * slope;
      box([0.27, 0.68, 0.29], [cx + 0.5, chBase + 0.27, chz], "#938878");
      box([0.35, 0.09, 0.37], [cx + 0.5, chBase + 0.64, chz], "#b6aa93");
      box([0.18, 0.012, 0.2], [cx + 0.5, chBase + 0.691, chz], "#49453e");
    }
    if (!parts.length) return null;
    // Extrude is non-indexed, boxes are indexed — flatten everything so they merge
    const flat = parts.map((p) => {
      p.deleteAttribute("uv");
      const f = p.index ? p.toNonIndexed() : p;
      if (f !== p) p.dispose();
      return f;
    });
    const merged = mergeGeometries(flat)!;
    for (const p of flat) p.dispose();
    return merged;
  }, []);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} />
    </mesh>
  );
}

/** Maple Village — the houses are instanced with the scenery; here live the villagers who cheer as you pass. */
export function Village() {
  const { plaza } = getLayout();
  const areas = useMemo(() => {
    const ring: Area[] = [];
    for (let k = 0; k < PEOPLE.length; k++) {
      const a = (k / PEOPLE.length) * Math.PI * 2 + 0.6;
      ring.push({ x: plaza.x + Math.cos(a) * 6.5, z: plaza.z + Math.sin(a) * 6.5, r: 2.2 });
    }
    return ring;
  }, [plaza]);
  const glow = useMemo(() => getWorld().gridHeight(plaza.x, plaza.z) + 1.4, [plaza]);
  return (
    <group>
      <VillageRoofs />
      {PEOPLE.map((p, i) => (
        <AnimatedAgent
          key={p.seed}
          url={p.url}
          idle="CharacterArmature|Idle"
          walk="CharacterArmature|Walk"
          greet="CharacterArmature|Victory"
          height={1.75}
          area={areas[i]}
          speed={1.2}
          seed={p.seed}
          stride={0.8}
        />
      ))}
      {[21, 22, 23].map((s) => (
        <AnimatedAgent
          key={s}
          url="/models/animals/Chick.glb"
          idle="Armature|ArmatureAction.002"
          walk="Armature|ArmatureAction.002"
          height={0.35}
          area={{ x: plaza.x - 8, z: plaza.z + 8, r: 3 }}
          speed={0.6}
          seed={s}
        />
      ))}
      <Sparkles position={[plaza.x, glow, plaza.z]} count={14} scale={[8, 2.5, 8]} size={3} speed={0.5} color="#ffd9a0" opacity={0.6} />
    </group>
  );
}
