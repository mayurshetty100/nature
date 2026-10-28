import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { dequantize } from "./dequantize";
import { smoothGeometry } from "@/game/models";
import { treeParts } from "./treeModels";
import { PROCEDURAL_TREES } from "./constants";
import { getScatter, MODELS, type ModelKey, type Placement } from "@/game/scatter";
import { addWind } from "./materials";
import { player, useGame } from "@/game/store";
import { SHADOW_LAYER } from "./constants";

/** wind sway, shadows, recentre the model, hide beyond this camera distance */
type Opts = { wind?: number; shadow?: boolean; center?: boolean; far?: number; leaves?: boolean };

const SMALL = 150;
const MID = 260;
/** trees, rocks and buildings: beyond this they're lost in the fog anyway */
const FAR_DEFAULT = 440;

const MODEL_OPTS: Partial<Record<ModelKey, Opts>> = {
  oak: { leaves: true, wind: 0.05, shadow: true },
  default: { leaves: true, wind: 0.04, shadow: true },
  detailed: { leaves: true, wind: 0.05, shadow: true },
  fat: { leaves: true, wind: 0.05, shadow: true },
  tall: { leaves: true, wind: 0.035, shadow: true },
  pineTall: { leaves: true, wind: 0.03, shadow: true },
  pineRound: { leaves: true, wind: 0.035, shadow: true },
  cone: { leaves: true, wind: 0.03, shadow: true },
  bushLarge: { wind: 0.6, shadow: true, far: MID },
  bush: { wind: 0.6, shadow: true, far: MID },
  bushDetailed: { wind: 0.4, shadow: true, far: MID },
  flowerRed: { wind: 3.2, far: SMALL },
  flowerYellow: { wind: 3.2, far: SMALL },
  flowerPurple: { wind: 3.2, far: SMALL },
  grass: { wind: 3.5, far: SMALL },
  grassLarge: { wind: 3.5, far: SMALL },
  rockA: { shadow: true },
  rockC: { shadow: true },
  rockTall: { shadow: true },
  rockSmall: { far: MID },
  mushroom: { far: SMALL },
  stump: { shadow: true, far: MID },
  log: { shadow: true, far: MID },
  lily: { far: MID },
  fence: { shadow: true, center: true, far: MID },
  fencePlanks: { shadow: true, center: true, far: MID },
  flowerRedB: { wind: 3.2, far: SMALL },
  flowerYellowB: { wind: 3.2, far: SMALL },
  flowerPurpleB: { wind: 3.2, far: SMALL },
  corn: { wind: 0.9, shadow: true, far: MID },
  wheat: { wind: 3, far: MID },
  pumpkin: { far: MID },
  leafs: { wind: 2, far: MID },
  dirtRows: { far: MID },
  acacia: { leaves: true, wind: 0.03, shadow: true },
  acaciaFall: { wind: 0.03, shadow: true },
  house1: { shadow: true },
  house2: { shadow: true },
  house3: { shadow: true },
  house4: { shadow: true },
  inn: { shadow: true },
  mill: { shadow: true },
  bellTower: { shadow: true },
  stable: { shadow: true },
  well: { shadow: true, far: MID },
  market1: { shadow: true, far: MID },
  market2: { shadow: true, far: MID },
  bench: { shadow: true, far: SMALL },
  barrel: { shadow: true, far: SMALL },
  crate: { shadow: true, far: SMALL },
  hay: { shadow: true, far: MID },
  cart: { shadow: true, far: MID },
  gazebo: { shadow: true, far: MID },
};

const CHUNK = 72;

/** Instanced copies of one model, split into map chunks so off-screen and far chunks are skipped. */
export function InstancedGLB({ url, items, opts = {} }: { url: string; items: Placement[]; opts?: Opts }) {
  const { scene } = useGLTF(url);
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const out: { g: THREE.BufferGeometry; m: THREE.Material | THREE.Material[]; leaf: boolean }[] = [];
    const box = new THREE.Box3().setFromObject(scene);
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // soft clay shading: round off the low-poly facets (crisp corners stay crisp)
      const g = smoothGeometry(dequantize(mesh.geometry));
      g.applyMatrix4(mesh.matrixWorld);
      if (opts.center) g.translate(-cx, 0, -cz);
      const srcs = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
      let leaf = false;
      const mats = srcs.map((src) => {
        const m = src.clone();
        // leaf parts go neutral grey (keeping their light/dark contrast) so each tree's tint shows true
        if (opts.leaves && m.color && srcs.length === 1) {
          const hsl = { h: 0, s: 0, l: 0 };
          m.color.getHSL(hsl);
          if (hsl.h > 0.2 && hsl.h < 0.55 && hsl.s > 0.2) {
            leaf = true;
            m.color.setScalar(Math.min(1, 0.55 + hsl.l));
            if (opts.wind) addWind(m, opts.wind);
            return m;
          }
        }
        m.roughness = Math.max(0.75, m.roughness ?? 1);
        m.metalness = 0;
        // warm the Kenney teal greens toward fresh meadow/leaf greens
        if (m.color) {
          const hsl = { h: 0, s: 0, l: 0 };
          m.color.getHSL(hsl);
          if (hsl.h > 0.26 && hsl.h < 0.55 && hsl.s > 0.2) {
            m.color.setHSL(0.27 + (hsl.h - 0.26) * 0.18, Math.min(1, hsl.s * 0.95), Math.min(0.62, hsl.l * 1.02));
          }
        }
        if (opts.wind) addWind(m, opts.wind);
        return m;
      });
      const m: THREE.Material | THREE.Material[] = Array.isArray(mesh.material) ? mats : mats[0];
      out.push({ g, m, leaf });
    });
    return out;
  }, [scene, opts.wind, opts.center, opts.leaves]);

  return <InstancedParts parts={parts} items={items} opts={opts} />;
}

/** Instanced parts (from a GLB or a procedural template), chunked and distance-culled. */
function InstancedParts({ parts, items, opts = {} }: { parts: { g: THREE.BufferGeometry; m: THREE.Material | THREE.Material[]; leaf: boolean }[]; items: Placement[]; opts?: Opts }) {
  const chunks = useMemo(() => {
    const map = new Map<string, Placement[]>();
    for (const it of items) {
      const k = `${Math.floor(it.x / CHUNK)},${Math.floor(it.z / CHUNK)}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return [...map.values()].map((list) => {
      let sx = 0;
      let sz = 0;
      for (const it of list) {
        sx += it.x;
        sz += it.z;
      }
      return { list, cx: sx / list.length, cz: sz / list.length };
    });
  }, [items]);

  const groups = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ camera }) => {
    // the opening overview sees the whole island; while exploring, far chunks sit deep in the haze
    const far = (opts.far ?? FAR_DEFAULT) * (useGame.getState().phase === "intro" ? 3 : 1);
    const f2 = (far + CHUNK * 0.7) ** 2;
    chunks.forEach((c, i) => {
      const g = groups.current[i];
      if (g) g.visible = (camera.position.x - c.cx) ** 2 + (camera.position.z - c.cz) ** 2 < f2;
    });
  });

  if (!items.length) return null;
  return (
    <>
      {chunks.map((c, ci) => (
        <group
          key={ci}
          ref={(el) => {
            groups.current[ci] = el;
          }}
        >
          {parts.map((p, pi) => (
            <ChunkMesh key={pi} g={p.g} m={p.m} list={c.list} tinted={p.leaf} />
          ))}
        </group>
      ))}
      {opts.shadow && parts.map((p, pi) => <ShadowCasters key={pi} g={p.g} m={p.m} items={items} />)}
    </>
  );
}

/**
 * Shadow-only copies of the instances near the explorer. Lives on SHADOW_LAYER,
 * which only the sun's shadow camera sees — so the shadow pass draws a few
 * dozen nearby trees instead of every tree in every chunk that touches it.
 */
function ShadowCasters({ g, m, items }: { g: THREE.BufferGeometry; m: THREE.Material | THREE.Material[]; items: Placement[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const last = useRef({ x: 1e9, z: 1e9, intro: false });
  const d = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    ref.current?.layers.set(SHADOW_LAYER);
  }, []);
  useFrame(() => {
    const im = ref.current;
    if (!im) return;
    const intro = useGame.getState().phase === "intro";
    const fx = intro ? 0 : player.position.x;
    const fz = intro ? 0 : player.position.z;
    const l = last.current;
    if (l.intro === intro && (fx - l.x) ** 2 + (fz - l.z) ** 2 < 64) return;
    l.x = fx;
    l.z = fz;
    l.intro = intro;
    const r2 = (intro ? 120 : 62) ** 2;
    let n = 0;
    for (const it of items) {
      if ((it.x - fx) ** 2 + (it.z - fz) ** 2 > r2) continue;
      d.position.set(it.x, it.y, it.z);
      d.rotation.set(0, it.rot, 0);
      d.scale.set(it.s, it.sy ?? it.s, it.s);
      d.updateMatrix();
      im.setMatrixAt(n++, d.matrix);
    }
    im.count = n;
    im.visible = n > 0;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  });
  return <instancedMesh ref={ref} args={[g, m, items.length]} castShadow frustumCulled={false} />;
}

function ChunkMesh({ g, m, list, tinted }: { g: THREE.BufferGeometry; m: THREE.Material | THREE.Material[]; list: Placement[]; tinted: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    list.forEach((it, i) => {
      if (tinted) im.setColorAt(i, c.setHex(it.tint ?? 0x6aa84f));
      d.position.set(it.x, it.y, it.z);
      d.rotation.set(0, it.rot, 0);
      d.scale.set(it.s, it.sy ?? it.s, it.s);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.computeBoundingBox();
  }, [list, tinted]);
  return <instancedMesh ref={ref} args={[g, m, list.length]} receiveShadow />;
}

/** A procedural tree kind (realistic branches + tiny leaves), instanced like the GLBs. */
function ProceduralTrees({ kind, items, opts }: { kind: string; items: Placement[]; opts: Opts }) {
  const parts = useMemo(() => treeParts(kind, opts.wind ?? 0.04)!, [kind, opts.wind]);
  return <InstancedParts parts={parts} items={items} opts={opts} />;
}

export function Vegetation() {
  const { items } = useMemo(() => getScatter(), []);
  const touch = useGame((s) => s.isTouch);
  // phones: keep ~60% of the tiny ground cover (grass, flowers, mushrooms) — same look, far less to draw
  const shown = useMemo(() => {
    if (!touch) return items;
    const out = { ...items };
    for (const k of Object.keys(MODELS) as ModelKey[]) if (MODEL_OPTS[k]?.far === SMALL) out[k] = items[k].filter((_, i) => i % 5 < 3);
    return out;
  }, [items, touch]);
  return (
    <group>
      {(Object.keys(MODELS) as ModelKey[]).map((k) =>
        PROCEDURAL_TREES.has(k) ? (
          <ProceduralTrees key={k} kind={k} items={shown[k]} opts={MODEL_OPTS[k] ?? {}} />
        ) : (
          <InstancedGLB key={k} url={MODELS[k]} items={shown[k]} opts={MODEL_OPTS[k]} />
        ),
      )}
    </group>
  );
}

(Object.keys(MODELS) as ModelKey[]).forEach((k) => !PROCEDURAL_TREES.has(k) && useGLTF.preload(MODELS[k]));
