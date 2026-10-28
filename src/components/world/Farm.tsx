import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getLayout, type Plot } from "@/game/layout";
import { getWorld, rng } from "@/game/world";
import { dampAngle } from "@/game/math";
import { AnimatedAgent } from "./Agents";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { paint } from "./boatGeometry";
import { addDynamicBody, CROP, MODELS, type Collider } from "@/game/scatter";
import { cropGrowth, HEADER_W, TRACTOR_PLOTS, tractorPose } from "@/game/tractor";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useGLTF } from "@react-three/drei";
import { dequantize } from "./dequantize";

type TractorState = { x: number; z: number; yaw: number; cutting: boolean; headX: number; headZ: number };

/**
 * Tractor with a cutter header, harvesting its plot: drives the rows in a
 * serpentine with U-turns, then laps round the headland and starts again from
 * another corner. A farmer in a straw hat drives it.
 */
function Tractor({ plot, phase, color = "#d8453a", out }: { plot: Plot; phase: number; color?: string; out: TractorState }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const reel = useRef<THREE.Group>(null);
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const st = useRef({ roll: 0, px: NaN, pz: NaN, yaw: 0 });
  const w = getWorld();
  const solid = useMemo<Collider>(() => ({ x: plot.x, z: plot.z, r: 1.6 }), [plot.x, plot.z]);
  useEffect(() => addDynamicBody(solid), [solid]);

  const geometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const put = (g: THREE.BufferGeometry, pos: [number, number, number], tint: string, rx = 0) => {
      g.rotateX(rx);
      g.translate(...pos);
      parts.push(paint(g, tint));
    };
    const rbox = (size: [number, number, number], pos: [number, number, number], tint: string, r = 0.08, rx = 0) => put(new RoundedBoxGeometry(size[0], size[1], size[2], 3, Math.min(r, Math.min(...size) / 2 - 0.001)), pos, tint, rx);
    const cyl = (r: number, h: number, pos: [number, number, number], tint: string, seg = 14) => put(new THREE.CylinderGeometry(r, r, h, seg), pos, tint);
    const finish = (pieces: THREE.BufferGeometry[]) => {
      const merged = mergeGeometries(pieces)!;
      for (const p of pieces) p.dispose();
      return merged;
    };
    // chassis, rounded bonnet with louvres, grille, front weights
    rbox([0.84, 0.26, 2.3], [0, 0.67, 0.15], "#393933", 0.06);
    rbox([0.94, 0.66, 1.5], [0, 1.08, 0.66], color, 0.16);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) rbox([0.02, 0.06, 0.5], [s * 0.475, 1.12 - i * 0.09, 0.75], "#2a2b26", 0.01);
    rbox([0.76, 0.5, 0.06], [0, 1.06, 1.42], "#2a2b26", 0.03);
    for (let i = -3; i <= 3; i++) rbox([0.03, 0.42, 0.03], [i * 0.095, 1.06, 1.46], "#c8c2a8", 0.01);
    for (let i = 0; i < 4; i++) rbox([1.1, 0.1, 0.16], [0, 0.6 + i * 0.11, 1.56], "#655f50", 0.03);
    for (const s of [-1, 1]) {
      // headlights in round housings, side steps, fuel tank, mudguards, mirrors, tail lights
      cyl(0.11, 0.08, [s * 0.34, 1.33, 1.42], "#2a2b26");
      cyl(0.085, 0.09, [s * 0.34, 1.33, 1.44], "#fff2c4");
      rbox([0.3, 0.05, 0.22], [s * 0.6, 0.78, 0.25], "#2a2b26", 0.02);
      rbox([0.46, 0.13, 1.34], [s * 0.8, 1.44, -0.55], color, 0.06);
      rbox([0.08, 0.36, 1.12], [s * 0.58, 1.24, -0.55], color, 0.03);
      rbox([0.06, 0.12, 0.12], [s * 0.8, 1.42, -1.22], "#ff3a3a", 0.02);
      rbox([0.04, 0.3, 0.04], [s * 0.74, 2.0, 0.12], "#2a2b26", 0.01);
      rbox([0.06, 0.18, 0.14], [s * 0.8, 2.18, 0.14], "#2a2b26", 0.02);
      for (const z of [-1.04, 0.1]) cyl(0.035, 1.13, [s * 0.55, 1.84, z], "#d7cba8", 8); // cab posts
    }
    cyl(0.16, 0.42, [0.3, 0.86, -0.1], "#4a4a42");
    // exhaust stack with a cap
    cyl(0.06, 1.0, [0.3, 1.86, 0.66], "#49463e", 10);
    cyl(0.085, 0.06, [0.3, 2.38, 0.66], "#2a2b26", 10);
    // seat + backrest, steering column + wheel
    rbox([0.6, 0.14, 0.5], [0, 1.1, -0.57], "#3a2f25", 0.06);
    rbox([0.6, 0.5, 0.12], [0, 1.36, -0.8], "#3a2f25", 0.05, -0.12);
    cyl(0.035, 0.5, [0, 1.16, -0.05], "#655f50", 8);
    const steering = new THREE.TorusGeometry(0.2, 0.026, 6, 18);
    steering.rotateX(-0.65);
    steering.translate(0, 1.43, -0.06);
    parts.push(paint(steering, "#2a2b26"));
    // canopy roof with an amber beacon
    rbox([1.42, 0.12, 1.5], [0, 2.44, -0.46], color, 0.06);
    cyl(0.08, 0.12, [0.4, 2.56, -0.9], "#ffb02e", 10);
    // three-point hitch at the back
    rbox([0.7, 0.1, 0.3], [0, 0.72, -1.25], "#393933", 0.04);

    const wheel = (radius: number, side: number) => {
      const pieces: THREE.BufferGeometry[] = [];
      const tyre = new THREE.CylinderGeometry(radius, radius, 0.36, 24);
      tyre.rotateZ(Math.PI / 2);
      pieces.push(paint(tyre, "#2b2a24"));
      // chevron tread lugs
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        for (const s of [-1, 1]) {
          const lug = new RoundedBoxGeometry(0.17, 0.05, radius * 0.16, 2, 0.02);
          lug.rotateY(s * 0.5);
          lug.translate(s * 0.09, 0, 0);
          lug.rotateX(a);
          lug.translate(0, Math.cos(a) * radius, Math.sin(a) * radius);
          pieces.push(paint(lug, "#33312a"));
        }
      }
      const rim = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, 0.06, 18);
      rim.rotateZ(Math.PI / 2);
      rim.translate(side * 0.19, 0, 0);
      pieces.push(paint(rim, "#e4c578"));
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.BoxGeometry(0.03, radius * 1.05, 0.06);
        sp.rotateX((i / 6) * Math.PI);
        sp.translate(side * 0.215, 0, 0);
        pieces.push(paint(sp, "#c9a95c"));
      }
      const hub = new THREE.CylinderGeometry(radius * 0.19, radius * 0.19, 0.09, 12);
      hub.rotateZ(Math.PI / 2);
      hub.translate(side * 0.24, 0, 0);
      pieces.push(paint(hub, color));
      return finish(pieces);
    };

    // cutter header out front: a wide bar with crop dividers, and a reel of bats that spins
    const hdr: THREE.BufferGeometry[] = [];
    const hput = (g: THREE.BufferGeometry, pos: [number, number, number], tint: string) => {
      g.translate(...pos);
      hdr.push(paint(g, tint));
    };
    hput(new RoundedBoxGeometry(HEADER_W, 0.32, 0.7, 2, 0.06), [0, 0.32, 0], "#e0a234");
    hput(new RoundedBoxGeometry(HEADER_W, 0.06, 0.2, 2, 0.02), [0, 0.18, 0.4], "#9c9c96");
    for (const s of [-1, 1]) {
      const div = new THREE.ConeGeometry(0.1, 0.5, 8);
      div.rotateX(Math.PI / 2);
      hput(div, [s * HEADER_W * 0.5, 0.22, 0.5], "#e0a234");
      hput(new RoundedBoxGeometry(0.06, 0.8, 0.06, 2, 0.02), [s * (HEADER_W / 2 - 0.05), 0.75, -0.1], "#393933");
    }
    hput(new RoundedBoxGeometry(0.2, 0.2, 1.1, 2, 0.05), [0, 0.6, -0.75], "#393933");
    const reelG: THREE.BufferGeometry[] = [];
    const axle = new THREE.CylinderGeometry(0.04, 0.04, HEADER_W - 0.1, 8);
    axle.rotateZ(Math.PI / 2);
    reelG.push(paint(axle, "#393933"));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const bat = new THREE.BoxGeometry(HEADER_W - 0.15, 0.04, 0.1);
      bat.translate(0, Math.cos(a) * 0.36, Math.sin(a) * 0.36);
      reelG.push(paint(bat, "#d8453a"));
      for (const x of [-HEADER_W / 2 + 0.15, 0, HEADER_W / 2 - 0.15]) {
        const arm = new THREE.BoxGeometry(0.03, 0.36, 0.03);
        arm.translate(0, 0.18, 0);
        arm.rotateX(a - Math.PI / 2 + Math.PI / 2);
        arm.translate(x, 0, 0);
        reelG.push(paint(arm, "#393933"));
      }
    }

    // the farmer: overalls, check shirt, straw hat; hands on the wheel
    const man: THREE.BufferGeometry[] = [];
    const mput = (g: THREE.BufferGeometry, pos: [number, number, number], tint: string, rx = 0, rz = 0) => {
      g.rotateX(rx);
      g.rotateZ(rz);
      g.translate(...pos);
      man.push(paint(g, tint));
    };
    for (const s of [-1, 1]) {
      mput(new THREE.CapsuleGeometry(0.075, 0.36, 4, 8), [s * 0.12, 1.22, -0.36], "#3b5f9a", Math.PI / 2); // thighs
      mput(new THREE.CapsuleGeometry(0.065, 0.36, 4, 8), [s * 0.12, 1.0, -0.12], "#3b5f9a", 0.15); // shins
      mput(new RoundedBoxGeometry(0.13, 0.08, 0.24, 2, 0.03), [s * 0.12, 0.8, -0.06], "#4a3020"); // boots
      mput(new THREE.CapsuleGeometry(0.06, 0.26, 4, 8), [s * 0.2, 1.6, -0.36], "#c0392b", -0.9, s * 0.15); // upper arms
      mput(new THREE.CapsuleGeometry(0.05, 0.22, 4, 8), [s * 0.17, 1.47, -0.16], "#c0392b", -1.35); // forearms
      mput(new THREE.SphereGeometry(0.055, 8, 6), [s * 0.16, 1.45, -0.03], "#e6b48a"); // hands on the wheel
    }
    mput(new THREE.CapsuleGeometry(0.17, 0.32, 4, 10), [0, 1.52, -0.52], "#c0392b"); // shirt
    mput(new RoundedBoxGeometry(0.33, 0.36, 0.3, 2, 0.08), [0, 1.42, -0.5], "#3b5f9a"); // overall bib
    for (const s of [-1, 1]) mput(new THREE.BoxGeometry(0.04, 0.3, 0.02), [s * 0.11, 1.68, -0.36], "#3b5f9a");
    const headG: THREE.BufferGeometry[] = [];
    const hd = (g: THREE.BufferGeometry, pos: [number, number, number], tint: string) => {
      g.translate(...pos);
      headG.push(paint(g, tint));
    };
    hd(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), [0, -0.12, 0], "#e6b48a");
    hd(new THREE.SphereGeometry(0.15, 14, 10), [0, 0.04, 0], "#e6b48a");
    hd(new THREE.SphereGeometry(0.03, 6, 5), [0, 0.03, 0.15], "#d9a07a"); // nose
    for (const s of [-1, 1]) {
      hd(new THREE.SphereGeometry(0.018, 6, 5), [s * 0.055, 0.08, 0.135], "#2a1d14"); // eyes
      hd(new THREE.SphereGeometry(0.035, 6, 5), [s * 0.15, 0.03, 0], "#e0aa82"); // ears
    }
    hd(new THREE.BoxGeometry(0.1, 0.025, 0.02), [0, -0.03, 0.14], "#5a3a26"); // moustache
    hd(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 20), [0, 0.15, 0], "#e3c27a"); // hat brim
    hd(new THREE.CylinderGeometry(0.13, 0.16, 0.14, 14), [0, 0.23, 0], "#d8b56a");
    hd(new THREE.CylinderGeometry(0.162, 0.162, 0.035, 14), [0, 0.18, 0], "#8a4a2a"); // band
    return { body: finish(parts), wheels: [wheel(0.68, -1), wheel(0.68, 1), wheel(0.42, -1), wheel(0.42, 1)], header: finish(hdr), reel: finish(reelG), man: finish(man), head: finish(headG) };
  }, [color]);

  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const pose = tractorPose(plot, t, phase);
    const s = st.current;
    if (Number.isNaN(s.px)) {
      s.px = pose.x;
      s.pz = pose.z;
      s.yaw = pose.yaw;
    }
    s.yaw = dampAngle(s.yaw, pose.yaw, dt * 6);
    const moved = Math.hypot(pose.x - s.px, pose.z - s.pz);
    s.px = pose.x;
    s.pz = pose.z;
    s.roll += moved;
    const y = w.gridHeight(pose.x, pose.z);
    g.position.set(pose.x, y, pose.z);
    g.rotation.y = s.yaw;
    solid.x = pose.x;
    solid.z = pose.z;
    for (let i = 0; i < 4; i++) {
      const wh = wheels.current[i];
      if (wh) wh.rotation.x = s.roll / (i < 2 ? 0.68 : 0.42);
    }
    if (body.current) body.current.position.y = Math.sin(t * 22) * 0.012 + Math.sin(t * 3.1) * 0.006;
    if (reel.current) reel.current.rotation.x = pose.cutting ? reel.current.rotation.x - dt * 4 : reel.current.rotation.x - dt * 0.6;
    // the farmer glances around now and then
    if (head.current) head.current.rotation.y = Math.sin(t * 0.4 + phase * 3) * 0.5 * Math.max(0, Math.sin(t * 0.17 + phase));
    // header centre in world space (2.15 m ahead of the tractor)
    out.x = pose.x;
    out.z = pose.z;
    out.yaw = s.yaw;
    out.cutting = pose.cutting;
    out.headX = pose.x + Math.sin(s.yaw) * 2.15;
    out.headZ = pose.z + Math.cos(s.yaw) * 2.15;
  });

  return (
    <group ref={root}>
      <group ref={body}>
        <mesh geometry={geometry.body} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.7} />
        </mesh>
        <mesh geometry={geometry.man} castShadow>
          <meshStandardMaterial vertexColors roughness={0.85} />
        </mesh>
        <group ref={head} position={[0, 1.98, -0.5]}>
          <mesh geometry={geometry.head} castShadow>
            <meshStandardMaterial vertexColors roughness={0.85} />
          </mesh>
        </group>
      </group>
      <group position={[0, 0, 2.15]}>
        <mesh geometry={geometry.header} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.75} />
        </mesh>
        <group ref={reel} position={[0, 0.78, 0.15]}>
          <mesh geometry={geometry.reel} castShadow>
            <meshStandardMaterial vertexColors roughness={0.8} />
          </mesh>
        </group>
      </group>
      {(
        [
          [-0.8, 0.68, -0.55],
          [0.8, 0.68, -0.55],
          [-0.66, 0.42, 1.05],
          [0.66, 0.42, 1.05],
        ] as const
      ).map(([x, y, z], i) => (
        <group
          key={i}
          position={[x, y, z]}
          ref={(el) => {
            wheels.current[i] = el;
          }}
        >
          <mesh geometry={geometry.wheels[i]} castShadow receiveShadow>
            <meshStandardMaterial vertexColors roughness={0.95} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * The crops in a tractor's plot: cut down to stubble where the header passes,
 * growing back a while later — so you can see the harvested strips.
 */
function HarvestPlot({ plot, tr }: { plot: Plot; tr: TractorState }) {
  const c = CROP[plot.crop];
  const { scene } = useGLTF(MODELS[c.key]);
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const out: { g: THREE.BufferGeometry; m: THREE.Material }[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const g = dequantize(mesh.geometry);
      g.applyMatrix4(mesh.matrixWorld);
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      m.roughness = Math.max(0.75, m.roughness ?? 1);
      m.metalness = 0;
      out.push({ g, m });
    });
    return out;
  }, [scene]);
  const crops = useMemo(() => {
    const w = getWorld();
    const r = rng(Math.round(plot.x * 31 + plot.z * 7));
    const list: { x: number; y: number; z: number; rot: number; s: number; cut: number }[] = [];
    for (let zz = -plot.d / 2 + c.dz / 2; zz < plot.d / 2; zz += c.dz)
      for (let xx = -plot.w / 2 + c.dx / 2; xx < plot.w / 2; xx += c.dx) {
        const x = plot.x + xx + (r() - 0.5) * 0.15;
        const z = plot.z + zz;
        list.push({ x, y: w.gridHeight(x, z), z, rot: r() * 6.28, s: c.s * (0.92 + r() * 0.16), cut: -Infinity });
      }
    return list;
  }, [plot, c]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const last = useRef<Float32Array | null>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const d = TMP;
    if (!last.current) last.current = new Float32Array(crops.length).fill(-1);
    let dirty = false;
    crops.forEach((cr, i) => {
      if (tr.cutting && Math.hypot(cr.x - tr.headX, cr.z - tr.headZ) < HEADER_W * 0.55) cr.cut = t;
      const k = cropGrowth(t - cr.cut);
      if (Math.abs(k - last.current![i]) < 0.004) return;
      last.current![i] = k;
      dirty = true;
      d.position.set(cr.x, cr.y, cr.z);
      d.rotation.set(0, cr.rot, 0);
      d.scale.set(cr.s, cr.s * k, cr.s);
      d.updateMatrix();
      for (const im of refs.current) im?.setMatrixAt(i, d.matrix);
    });
    if (dirty)
      for (const im of refs.current)
        if (im) {
          im.instanceMatrix.needsUpdate = true;
          if (!im.boundingSphere) im.computeBoundingSphere();
        }
  });
  return (
    <>
      {parts.map((p, i) => (
        <instancedMesh key={i} ref={(el) => (refs.current[i] = el)} args={[p.g, p.m, crops.length]} receiveShadow frustumCulled={false} />
      ))}
    </>
  );
}

const TMP = new THREE.Object3D();

function Scarecrow({ x, z }: { x: number; z: number }) {
  const y = useMemo(() => getWorld().gridHeight(x, z), [x, z]);
  return (
    <group position={[x, y, z]} rotation-y={0.4}>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 2.2, 5]} />
        <meshStandardMaterial color="#7b4a2b" />
      </mesh>
      <mesh position={[0, 1.7, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.05, 0.05, 1.8, 5]} />
        <meshStandardMaterial color="#7b4a2b" />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <boxGeometry args={[0.7, 0.8, 0.35]} />
        <meshStandardMaterial color="#5f88c9" />
      </mesh>
      <mesh position={[0, 2.25, 0]} castShadow>
        <sphereGeometry args={[0.27, 8, 6]} />
        <meshStandardMaterial color="#e6c98f" />
      </mesh>
      <mesh position={[0, 2.5, 0]} castShadow>
        <coneGeometry args={[0.45, 0.35, 10]} />
        <meshStandardMaterial color="#c99a4b" />
      </mesh>
    </group>
  );
}

const FARMERS = [
  { url: "/models/people/Worker_Male.glb", seed: 81 },
  { url: "/models/people/Worker_Female.glb", seed: 82 },
  { url: "/models/people/Cowboy_Male.glb", seed: 83 },
  { url: "/models/people/Worker_Male.glb", seed: 84 },
];

/** Golden Fields — tractors at work, farmers tending the crops, scarecrows. */
const TRACTOR_COLORS = ["#d8453a", "#3f8f4f", "#2f6fb5"];

export function Farm() {
  const { plots } = getLayout();
  const tractors = useMemo<TractorState[]>(() => TRACTOR_PLOTS.map(() => ({ x: 0, z: 0, yaw: 0, cutting: false, headX: 1e9, headZ: 1e9 })), []);
  return (
    <group>
      {TRACTOR_PLOTS.map((pi, i) => (
        <group key={pi}>
          <Tractor plot={plots[pi]} phase={i * 0.7} color={TRACTOR_COLORS[i]} out={tractors[i]} />
          <HarvestPlot plot={plots[pi]} tr={tractors[i]} />
        </group>
      ))}
      {FARMERS.map((f, i) => {
        const p = plots[[0, 2, 3, 6][i]];
        return (
          <AnimatedAgent
            key={f.seed}
            url={f.url}
            idle="CharacterArmature|PickUp"
            walk="CharacterArmature|Walk"
            greet="CharacterArmature|Victory"
            height={1.75}
            area={{ x: p.x, z: p.z, w: p.w * 0.8, d: p.d * 0.8 }}
            speed={0.9}
            seed={f.seed}
            stride={0.8}
          />
        );
      })}
      <Scarecrow x={plots[0].x} z={plots[0].z} />
      <Scarecrow x={plots[5].x + 2} z={plots[5].z - 1} />
    </group>
  );
}
