import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { player, useGame } from "@/game/store";
import { DOOR_HALF, getInterior, INTERIOR_ORIGIN, type Decor, type Furn, type Interior as Room, type Prop, type Rect } from "@/game/interiors";
import { FURNITURE, FURN_SCALE, furnitureUrl, type FurnKey } from "@/game/furniture";
import { measureHeight, stylizeModel } from "@/game/models";
import { daylight } from "@/game/dayCycle";
import { boardTexture, floorTexture, paintingTexture, wallTexture } from "./interiorTextures";

/** The interior you're standing in (rendered far from the island while the outside is hidden). */
export function InteriorScene() {
  const inside = useGame((s) => s.inside);
  const I = inside ? getInterior(inside) : null;
  if (!I) return null;
  return (
    <group position={[INTERIOR_ORIGIN.x, 0, INTERIOR_ORIGIN.z]}>
      <Shell key={I.id} I={I} />
      <Suspense fallback={null}>
        <Contents key={I.id} I={I} />
      </Suspense>
      <ambientLight intensity={0.55} color="#fff1dc" />
    </group>
  );
}

/** Rooms use at most this many lamps (checked by a test). */
const ROOM_LIGHTS = 4;

/**
 * A fixed set of room lamps that is always mounted and simply dims to zero
 * outdoors: a changing light count would rebuild every shader on the way in
 * and out of a building (the door "glitch").
 */
export function RoomLights() {
  const inside = useGame((s) => s.inside);
  const I = inside ? getInterior(inside) : null;
  return (
    <group position={[INTERIOR_ORIGIN.x, 0, INTERIOR_ORIGIN.z]}>
      {Array.from({ length: ROOM_LIGHTS }, (_, i) => {
        const l = I?.lights[i];
        return <pointLight key={i} position={l ? [l.x, l.y, l.z] : [0, -50, 0]} color={l?.color ?? "#ffffff"} intensity={l ? l.intensity : 0} distance={l?.distance ?? 1} decay={1.6} />;
      })}
    </group>
  );
}

function subtract(full: Rect, holes: Rect[]): Rect[] {
  if (!holes.length) return [full];
  const h = holes[0];
  const out: Rect[] = [];
  if (h.x0 > full.x0) out.push({ x0: full.x0, x1: h.x0, z0: full.z0, z1: full.z1 });
  if (h.x1 < full.x1) out.push({ x0: h.x1, x1: full.x1, z0: full.z0, z1: full.z1 });
  if (h.z0 > full.z0) out.push({ x0: h.x0, x1: h.x1, z0: full.z0, z1: h.z0 });
  if (h.z1 < full.z1) out.push({ x0: h.x0, x1: h.x1, z0: h.z1, z1: full.z1 });
  return out;
}

/** Box geometry whose UVs repeat by world size (u per `uw` metres, v per `vh` metres). */
function worldBox(w: number, h: number, d: number, uw: number, vh: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // faces: +x, -x, +y, -y, +z, -z
  const dims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / uw, (uv.getY(i) * dims[f][1]) / vh);
    }
  return g;
}

/** Floors, ceilings, walls, wainscot, doorway glow, stairs and railings. */
function Shell({ I }: { I: Room }) {
  const { w, d, levels, storey } = I;
  const mats = useMemo(() => {
    const ft = floorTexture(I.look.floorTex);
    const wt = wallTexture(I.look.wallTex);
    return {
      floor: new THREE.MeshStandardMaterial({ map: ft, color: I.look.floorTex === "marble" || I.look.floorTex === "tile" ? "#f1ece4" : I.look.floor, roughness: 0.7 }),
      ceiling: new THREE.MeshStandardMaterial({ color: I.look.ceiling, roughness: 0.95 }),
      wall: new THREE.MeshStandardMaterial({ map: wt, color: I.look.wall, roughness: 0.9 }),
      low: new THREE.MeshStandardMaterial({ color: I.look.wallLow, roughness: 0.75 }),
      trim: new THREE.MeshStandardMaterial({ color: I.look.trim, roughness: 0.6 }),
      stair: new THREE.MeshStandardMaterial({ color: "#a8743f", roughness: 0.75 }),
      rail: new THREE.MeshStandardMaterial({ color: "#6b4428", roughness: 0.6 }),
      glow: new THREE.MeshBasicMaterial({ color: "#fff4dc", toneMapped: false }),
    };
  }, [I]);
  useFrame(() => {
    mats.glow.color.copy(daylight.sunColor).lerp(new THREE.Color("#fff6e6"), 0.6).multiplyScalar(1 - daylight.night * 0.6);
  });
  const H = levels * storey;
  const T = 0.3;
  const parts = useMemo(() => {
    const floors: { r: Rect; y: number }[] = [];
    I.floors.forEach((f) => {
      for (const r of subtract({ x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }, f.holes)) floors.push({ r, y: f.y });
    });
    return floors;
  }, [I, w, d]);
  const walls = useMemo(() => {
    const list: { p: [number, number, number]; s: [number, number, number] }[] = [];
    list.push({ p: [0, H / 2, -d / 2 - T / 2], s: [w + 2 * T, H, T] });
    list.push({ p: [-w / 2 - T / 2, H / 2, 0], s: [T, H, d] });
    list.push({ p: [w / 2 + T / 2, H / 2, 0], s: [T, H, d] });
    const side = (w / 2 - DOOR_HALF) / 2;
    list.push({ p: [-(DOOR_HALF + side), H / 2, d / 2 + T / 2], s: [w / 2 - DOOR_HALF, H, T] });
    list.push({ p: [DOOR_HALF + side, H / 2, d / 2 + T / 2], s: [w / 2 - DOOR_HALF, H, T] });
    list.push({ p: [0, (H + 2.7) / 2, d / 2 + T / 2], s: [DOOR_HALF * 2, H - 2.7, T] });
    return list;
  }, [w, d, H]);
  const stairs = useMemo(
    () =>
      I.stairs.flatMap((s) => {
        const n = 16;
        const run = (s.x1 - s.x0) / n;
        const rise = (s.y1 - s.y0) / n;
        return Array.from({ length: n }, (_, k) => {
          const idx = s.up > 0 ? k : n - 1 - k;
          const top = s.y0 + rise * (k + 1);
          return { x: s.x0 + run * (idx + 0.5), z: (s.z0 + s.z1) / 2, y: (s.y0 + top) / 2, h: top - s.y0, run, depth: s.z1 - s.z0 };
        });
      }),
    [I],
  );
  return (
    <group>
      {parts.map(({ r, y }, i) => (
        <group key={i}>
          <mesh position={[(r.x0 + r.x1) / 2, y - 0.12, (r.z0 + r.z1) / 2]} material={mats.floor} receiveShadow>
            <primitive object={worldBox(r.x1 - r.x0, 0.24, r.z1 - r.z0, 2, 2)} attach="geometry" />
          </mesh>
          {y > 0 && (
            <mesh position={[(r.x0 + r.x1) / 2, y - 0.245, (r.z0 + r.z1) / 2]} rotation-x={Math.PI / 2} material={mats.ceiling}>
              <planeGeometry args={[r.x1 - r.x0, r.z1 - r.z0]} />
            </mesh>
          )}
        </group>
      ))}
      <mesh position={[0, H + 0.12, 0]} material={mats.ceiling} castShadow>
        <boxGeometry args={[w + 0.6, 0.24, d + 0.6]} />
      </mesh>
      {walls.map((wl, i) => (
        <mesh key={i} position={wl.p} material={mats.wall} castShadow receiveShadow>
          <primitive object={worldBox(wl.s[0], wl.s[1], wl.s[2], 3, storey)} attach="geometry" />
        </mesh>
      ))}
      {/* wainscot + skirting on every storey */}
      {Array.from({ length: levels }, (_, k) => (
        <group key={k} position={[0, k * storey, 0]}>
          <mesh position={[0, 0.55, -d / 2 + 0.03]} material={mats.low}>
            <boxGeometry args={[w, 1.1, 0.06]} />
          </mesh>
          <mesh position={[-w / 2 + 0.03, 0.55, 0]} material={mats.low}>
            <boxGeometry args={[0.06, 1.1, d]} />
          </mesh>
          <mesh position={[w / 2 - 0.03, 0.55, 0]} material={mats.low}>
            <boxGeometry args={[0.06, 1.1, d]} />
          </mesh>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * (DOOR_HALF + (w / 2 - DOOR_HALF) / 2), 0.55, d / 2 - 0.03]} material={mats.low}>
              <boxGeometry args={[w / 2 - DOOR_HALF, 1.1, 0.06]} />
            </mesh>
          ))}
          <mesh position={[0, 1.13, -d / 2 + 0.07]} material={mats.trim}>
            <boxGeometry args={[w, 0.08, 0.06]} />
          </mesh>
        </group>
      ))}
      {/* doorway: frame, a little porch and the view outside */}
      <DoorView d={d} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (DOOR_HALF + 0.08), 1.35, d / 2 + 0.02]} material={mats.trim}>
          <boxGeometry args={[0.16, 2.7, 0.36]} />
        </mesh>
      ))}
      <mesh position={[0, 2.72, d / 2 + 0.02]} material={mats.trim}>
        <boxGeometry args={[DOOR_HALF * 2 + 0.32, 0.16, 0.36]} />
      </mesh>
      {/* stairs */}
      {stairs.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]} material={mats.stair} castShadow receiveShadow>
          <boxGeometry args={[s.run + 0.01, s.h, s.depth]} />
        </mesh>
      ))}
      {I.stairs.map((s, i) => {
        const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
        const ang = Math.atan2(s.y1 - s.y0, s.x1 - s.x0) * s.up;
        const openZ = s.z1 - 0.05;
        return (
          <group key={i}>
            <mesh position={[(s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2 + 1.0, openZ]} rotation-z={ang} material={mats.rail}>
              <boxGeometry args={[len, 0.07, 0.07]} />
            </mesh>
            {Array.from({ length: 7 }, (_, k) => {
              const x = s.x0 + ((k + 0.5) / 7) * (s.x1 - s.x0);
              const t = (x - s.x0) / (s.x1 - s.x0);
              const y = s.up > 0 ? s.y0 + t * (s.y1 - s.y0) : s.y1 - t * (s.y1 - s.y0);
              return (
                <mesh key={k} position={[x, y + 0.5, openZ]} material={mats.rail}>
                  <boxGeometry args={[0.05, 1.0, 0.05]} />
                </mesh>
              );
            })}
          </group>
        );
      })}
      {I.solids
        .filter((s) => s.rail)
        .map((s, i) => (
          <group key={i}>
            <mesh position={[(s.x0 + s.x1) / 2, s.y1 - 0.04, (s.z0 + s.z1) / 2]} material={mats.rail}>
              <boxGeometry args={[Math.max(0.08, s.x1 - s.x0), 0.08, Math.max(0.08, s.z1 - s.z0)]} />
            </mesh>
            <mesh position={[(s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, (s.z0 + s.z1) / 2]} material={mats.rail}>
              <boxGeometry args={[Math.max(0.03, s.x1 - s.x0 - 0.1), s.y1 - s.y0, Math.max(0.03, s.z1 - s.z0 - 0.1)]} />
            </mesh>
          </group>
        ))}
    </group>
  );
}

/** What you see through the open door: a porch step, garden and sky that follow the time of day. */
function DoorView({ d }: { d: number }) {
  const { tex, mat } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const g = c.getContext("2d")!;
    const sky = g.createLinearGradient(0, 0, 0, 150);
    sky.addColorStop(0, "#8cc8f0");
    sky.addColorStop(1, "#ffe6bf");
    g.fillStyle = sky;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#fff6dc";
    for (const [x, y, r] of [
      [50, 40, 16],
      [72, 36, 20],
      [96, 42, 14],
      [190, 60, 12],
      [208, 56, 16],
    ]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#88b07a";
    g.beginPath();
    g.moveTo(0, 150);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, 132 + Math.sin(x * 0.03 + 1) * 12);
    g.lineTo(256, 256);
    g.lineTo(0, 256);
    g.fill();
    g.fillStyle = "#6f9d5c";
    g.fillRect(0, 160, 256, 96);
    g.fillStyle = "#3f7a46";
    for (let k = 0; k < 7; k++) {
      const x = 14 + k * 38 + (k % 2) * 8;
      g.beginPath();
      g.arc(x, 150 - (k % 3) * 6, 18 + (k % 2) * 6, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#d9b98a";
    g.beginPath();
    g.moveTo(96, 256);
    g.lineTo(122, 160);
    g.lineTo(134, 160);
    g.lineTo(160, 256);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { tex: t, mat: new THREE.MeshBasicMaterial({ map: t, toneMapped: false }) };
  }, []);
  useFrame(() => {
    mat.color.set("#ffffff").lerp(daylight.sunColor, 0.25).lerp(new THREE.Color("#28345a"), daylight.night * 0.75);
  });
  void tex;
  return (
    <group>
      <mesh position={[0, 2.2, d / 2 + 4.2]} material={mat}>
        <planeGeometry args={[9, 6.5]} />
      </mesh>
      <mesh position={[0, -0.06, d / 2 + 1.6]} receiveShadow>
        <boxGeometry args={[DOOR_HALF * 2 + 1.6, 0.12, 2.6]} />
        <meshStandardMaterial color="#b98a5a" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.2, d / 2 + 3.6]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[9, 3]} />
        <meshStandardMaterial color="#7da866" roughness={1} />
      </mesh>
    </group>
  );
}

function Contents({ I }: { I: Room }) {
  return (
    <group>
      {I.furn.map((f, i) => (
        <FurniturePiece key={i} f={f} />
      ))}
      {I.props.map((p, i) => (
        <PropPiece key={i} p={p} />
      ))}
      {I.decor.map((d, i) => (
        <DecorPiece key={i} d={d} />
      ))}
    </group>
  );
}

function FurniturePiece({ f }: { f: Furn }) {
  const { scene } = useGLTF(furnitureUrl(f.key));
  const obj = useMemo(() => {
    const o = scene.clone(true);
    const box = new THREE.Box3().setFromObject(o);
    const c = box.getCenter(new THREE.Vector3());
    o.position.set(-c.x, -box.min.y, -c.z);
    o.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (f.tint) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mesh.material = mats.map((mm) => {
          const mat = mm as THREE.MeshStandardMaterial;
          if (!/carpet/i.test(mat.name) || /white/i.test(mat.name)) return mat;
          const c2 = mat.clone();
          c2.color.set(f.tint!);
          return c2;
        }) as unknown as THREE.Material;
        if (mats.length === 1) mesh.material = (mesh.material as unknown as THREE.Material[])[0];
      }
    });
    const g = new THREE.Group();
    g.add(o);
    return g;
  }, [scene, f.tint]);
  return (
    <group position={[f.x, f.y, f.z]} rotation-y={f.rot} scale={FURN_SCALE}>
      <primitive object={obj} />
    </group>
  );
}


function PropPiece({ p }: { p: Prop }) {
  const { scene, animations } = useGLTF(p.url);
  const ref = useRef<THREE.Group>(null);
  const { obj, scale } = useMemo(() => {
    const o = SkeletonUtils.clone(scene);
    o.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false;
      }
    });
    stylizeModel(o, p.url);
    return { obj: o, scale: p.h / measureHeight(o, 1) };
  }, [scene, p.url, p.h]);
  const { actions } = useAnimations(animations, ref);
  useEffect(() => {
    const name = Object.keys(actions).find((n) => /idle|eat/i.test(n)) ?? Object.keys(actions)[0];
    const a = name ? actions[name] : null;
    a?.reset().play();
    return () => {
      a?.stop();
    };
  }, [actions]);
  return (
    <group ref={ref} position={[p.x, p.y, p.z]} rotation-y={p.rot} scale={scale}>
      <primitive object={obj} />
    </group>
  );
}

function Flame({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ref.current?.children.forEach((c, i) => {
      const k = 0.85 + Math.sin(t * 11 + i * 2.1) * 0.12 + Math.sin(t * 17 + i) * 0.06;
      c.scale.set(k, k * (1 + Math.sin(t * 9 + i) * 0.1), k);
    });
  });
  return (
    <group ref={ref} position={position} scale={s}>
      {[
        ["#ffb347", 0.28, 0.75, 0],
        ["#ff7a2e", 0.2, 0.55, 0.18],
        ["#ffe08a", 0.13, 0.4, -0.15],
      ].map(([c, r, h, x], i) => (
        <mesh key={i} position={[x as number, (h as number) / 2, 0]}>
          <coneGeometry args={[r as number, h as number, 8]} />
          <meshBasicMaterial color={c as string} toneMapped={false} transparent opacity={0.92} />
        </mesh>
      ))}
    </group>
  );
}

function Screen({ d }: { d: Extract<Decor, { type: "screen" }> }) {
  const { tex, ctx } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 144;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { tex: t, ctx: c.getContext("2d")! };
  }, []);
  const last = useRef(-1);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (t - last.current < 0.12) return;
    last.current = t;
    // a gentle nature show: sky, sea, hills and a little boat crossing
    const g = ctx;
    const ph = (t * 0.05 + d.seed * 0.13) % 1;
    const grd = g.createLinearGradient(0, 0, 0, 144);
    grd.addColorStop(0, `hsl(${200 + Math.sin(ph * 6.28) * 20}, 70%, 70%)`);
    grd.addColorStop(1, "#ffe1b8");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 144);
    g.fillStyle = "#fff4cf";
    g.beginPath();
    g.arc(200, 40, 16, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#4f9fc8";
    g.fillRect(0, 96, 256, 48);
    g.fillStyle = "#6aa35a";
    g.beginPath();
    g.moveTo(0, 100);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, 84 + Math.sin(x * 0.05 + 1) * 10);
    g.lineTo(256, 100);
    g.fill();
    const bx = ((t * 18 + d.seed * 31) % 300) - 20;
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.moveTo(bx, 110);
    g.lineTo(bx + 22, 110);
    g.lineTo(bx + 18, 118);
    g.lineTo(bx + 4, 118);
    g.fill();
    g.fillStyle = "#f2f2f2";
    g.beginPath();
    g.moveTo(bx + 11, 88);
    g.lineTo(bx + 11, 108);
    g.lineTo(bx + 24, 108);
    g.fill();
    tex.needsUpdate = true;
  });
  return (
    <mesh position={[d.x, d.y, d.z]} rotation-y={d.rot}>
      <planeGeometry args={[d.w, d.h]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

function Gear({ d }: { d: Extract<Decor, { type: "gear" }> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += Math.min(dt, 0.05) * (0.6 / d.r);
  });
  return (
    <group position={[d.x, d.y, d.z]} rotation-y={d.rot}>
      <group ref={ref}>
        <mesh>
          <torusGeometry args={[d.r * 0.75, d.r * 0.16, 8, 24]} />
          <meshStandardMaterial color="#b8893f" metalness={0.7} roughness={0.35} />
        </mesh>
        {Array.from({ length: 10 }, (_, k) => {
          const a = (k / 10) * Math.PI * 2;
          return (
            <mesh key={k} position={[Math.cos(a) * d.r * 0.95, Math.sin(a) * d.r * 0.95, 0]} rotation-z={a}>
              <boxGeometry args={[d.r * 0.3, d.r * 0.22, d.r * 0.2]} />
              <meshStandardMaterial color="#b8893f" metalness={0.7} roughness={0.35} />
            </mesh>
          );
        })}
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[d.r * 0.18, d.r * 0.18, d.r * 0.3, 12]} />
          <meshStandardMaterial color="#6b4a2b" />
        </mesh>
      </group>
    </group>
  );
}

function Beacon({ d }: { d: Extract<Decor, { type: "beacon" }> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += Math.min(dt, 0.05) * 0.8;
  });
  return (
    <group position={[d.x, d.y, d.z]}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.9, 1.0, 1.0, 12]} />
        <meshStandardMaterial color="#3b2a1e" />
      </mesh>
      <group ref={ref} position={[0, 1.6, 0]}>
        <mesh>
          <cylinderGeometry args={[0.75, 0.75, 1.3, 16]} />
          <meshStandardMaterial color="#fff2c4" emissive="#ffcc66" emissiveIntensity={2.4} />
        </mesh>
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} rotation-y={(k * Math.PI) / 2} position={[0, 0, 0]}>
            <boxGeometry args={[0.06, 1.5, 1.8]} />
            <meshStandardMaterial color="#c8a050" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 2.5, 0]}>
        <coneGeometry args={[1.0, 0.7, 12]} />
        <meshStandardMaterial color="#d9473a" />
      </mesh>
    </group>
  );
}

function Window({ d }: { d: Extract<Decor, { type: "window" }> }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#cfe9ff", toneMapped: false }), []);
  useFrame(() => {
    const day = new THREE.Color("#bfe3ff").lerp(daylight.sunColor, 0.25);
    mat.color.copy(day).lerp(new THREE.Color("#1d2a4a"), daylight.night * 0.85);
  });
  return (
    <group position={[d.x, d.y, d.z]} rotation-y={d.rot}>
      <mesh position={[0, 0, 0.01]} material={mat}>
        <planeGeometry args={[d.w, d.h]} />
      </mesh>
      {[
        [0, d.h / 2 + 0.05, d.w + 0.2, 0.1],
        [0, -d.h / 2 - 0.05, d.w + 0.3, 0.14],
        [-d.w / 2 - 0.05, 0, 0.1, d.h + 0.2],
        [d.w / 2 + 0.05, 0, 0.1, d.h + 0.2],
        [0, 0, 0.06, d.h],
        [0, 0, d.w, 0.06],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.04]}>
          <boxGeometry args={[w, h, 0.08]} />
          <meshStandardMaterial color="#f7f1e6" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function DecorPiece({ d }: { d: Decor }) {
  switch (d.type) {
    case "fireplace":
      return (
        <group position={[d.x, d.y, d.z]} rotation-y={d.rot}>
          <mesh position={[0, 0.9, 0]} castShadow>
            <boxGeometry args={[2.0, 1.8, 0.9]} />
            <meshStandardMaterial color="#a39a8c" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.6, 0.3]}>
            <boxGeometry args={[1.2, 0.9, 0.4]} />
            <meshStandardMaterial color="#2a1f1a" />
          </mesh>
          <mesh position={[0, 1.88, 0.05]}>
            <boxGeometry args={[2.3, 0.14, 1.05]} />
            <meshStandardMaterial color="#6b4428" />
          </mesh>
          <mesh position={[0, 2.9, -0.15]}>
            <boxGeometry args={[1.2, 2.0, 0.6]} />
            <meshStandardMaterial color="#a39a8c" roughness={0.95} />
          </mesh>
          <Flame position={[0, 0.2, 0.32]} />
        </group>
      );
    case "painting":
      return (
        <group position={[d.x, d.y, d.z]} rotation-y={d.rot}>
          <mesh position={[0, 0, 0.03]}>
            <boxGeometry args={[d.w + 0.14, d.h + 0.14, 0.05]} />
            <meshStandardMaterial color="#8a5a33" />
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <planeGeometry args={[d.w, d.h]} />
            <meshStandardMaterial map={paintingTexture(d.seed)} roughness={0.8} />
          </mesh>
        </group>
      );
    case "screen":
      return <Screen d={d} />;
    case "board":
      return (
        <group position={[d.x, d.y, d.z]} rotation-y={d.rot}>
          <mesh position={[0, 0, 0.03]}>
            <boxGeometry args={[d.w + 0.16, d.h + 0.16, 0.06]} />
            <meshStandardMaterial color="#5c3a22" />
          </mesh>
          <mesh position={[0, 0, 0.07]}>
            <planeGeometry args={[d.w, d.h]} />
            <meshBasicMaterial map={boardTexture(d.title, d.lines)} toneMapped={false} />
          </mesh>
        </group>
      );
    case "chandelier":
      return (
        <group position={[d.x, d.y, d.z]}>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.4, 4]} />
            <meshStandardMaterial color="#3b2a1e" />
          </mesh>
          <mesh rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.9, 0.06, 8, 24]} />
            <meshStandardMaterial color="#b8893f" metalness={0.7} roughness={0.35} />
          </mesh>
          {Array.from({ length: 8 }, (_, k) => {
            const a = (k / 8) * Math.PI * 2;
            return (
              <group key={k} position={[Math.cos(a) * 0.9, 0.12, Math.sin(a) * 0.9]}>
                <mesh>
                  <cylinderGeometry args={[0.04, 0.04, 0.22, 6]} />
                  <meshStandardMaterial color="#fff6e3" />
                </mesh>
                <mesh position={[0, 0.17, 0]}>
                  <sphereGeometry args={[0.05, 8, 6]} />
                  <meshBasicMaterial color="#ffd27a" toneMapped={false} />
                </mesh>
              </group>
            );
          })}
        </group>
      );
    case "pendant":
      return (
        <group position={[d.x, d.y, d.z]}>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 1.2, 4]} />
            <meshStandardMaterial color="#2a2a2a" />
          </mesh>
          <mesh>
            <coneGeometry args={[0.32, 0.3, 16, 1, true]} />
            <meshStandardMaterial color="#2f4f4a" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -0.08, 0]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshBasicMaterial color={d.color} toneMapped={false} />
          </mesh>
        </group>
      );
    case "banner":
      return (
        <group position={[d.x, d.y, d.z]} rotation-y={d.rot}>
          <mesh position={[0, -1.4, 0.03]}>
            <planeGeometry args={[1.2, 2.8]} />
            <meshStandardMaterial color={d.color} side={THREE.DoubleSide} roughness={0.9} />
          </mesh>
          <mesh position={[0, -1.4, 0.04]}>
            <circleGeometry args={[0.32, 20]} />
            <meshStandardMaterial color="#ffd27e" />
          </mesh>
          <mesh position={[0, 0, 0.03]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.04, 0.04, 1.5, 6]} />
            <meshStandardMaterial color="#b8893f" />
          </mesh>
        </group>
      );
    case "beacon":
      return <Beacon d={d} />;
    case "bell":
      return (
        <group position={[d.x, d.y, d.z]}>
          <mesh>
            <latheGeometry args={[[new THREE.Vector2(0, 0.9), new THREE.Vector2(0.35, 0.85), new THREE.Vector2(0.55, 0.3), new THREE.Vector2(0.75, -0.1), new THREE.Vector2(0.78, -0.18), new THREE.Vector2(0, -0.12)], 20]} />
            <meshStandardMaterial color="#c9993f" metalness={0.8} roughness={0.3} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 1.1, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.08, 0.08, 2.4, 6]} />
            <meshStandardMaterial color="#5c3a22" />
          </mesh>
        </group>
      );
    case "gear":
      return <Gear d={d} />;
    case "box":
      return (
        <mesh position={[d.x, d.y + d.h / 2, d.z]} castShadow receiveShadow>
          <boxGeometry args={[d.w, d.h, d.d]} />
          <meshStandardMaterial color={d.color} roughness={0.85} />
        </mesh>
      );
    case "cyl":
      return (
        <mesh position={[d.x, d.y + d.h / 2, d.z]} castShadow receiveShadow>
          <cylinderGeometry args={[d.r, d.r, d.h, 20]} />
          <meshStandardMaterial color={d.color} roughness={0.9} />
        </mesh>
      );
    case "window":
      return <Window d={d} />;
    case "telescope":
      return (
        <group position={[d.x, d.y, d.z]} rotation-y={d.rot}>
          {[-0.35, 0.35, 0].map((x, i) => (
            <mesh key={i} position={[x * (i < 2 ? 1 : 0), 0.55, i === 2 ? -0.35 : 0.2]} rotation-x={i === 2 ? 0.35 : -0.25}>
              <cylinderGeometry args={[0.03, 0.03, 1.15, 5]} />
              <meshStandardMaterial color="#5c3a22" />
            </mesh>
          ))}
          <mesh position={[0, 1.2, 0.1]} rotation-x={-1.0}>
            <cylinderGeometry args={[0.09, 0.14, 1.1, 12]} />
            <meshStandardMaterial color="#b8893f" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      );
    case "candle":
      return (
        <group position={[d.x, d.y, d.z]}>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.3, 8]} />
            <meshStandardMaterial color="#fff6e3" />
          </mesh>
          <Flame position={[0, 0.3, 0]} s={0.18} />
        </group>
      );
    case "curtain": {
      const pw = d.w * 0.36;
      return (
        <group position={[d.x, d.y, d.z]} rotation-y={d.rot}>
          <mesh position={[0, d.h / 2 + 0.2, 0.14]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.025, 0.025, d.w + 0.9, 6]} />
            <meshStandardMaterial color="#6b4428" />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * (d.w / 2 + 0.12), -0.12, 0.12]}>
              {[-1, 0, 1].map((k) => (
                <mesh key={k} position={[k * pw * 0.3, 0, (k & 1) * 0.03]} castShadow>
                  <boxGeometry args={[pw * 0.38, d.h + 0.6, 0.04]} />
                  <meshStandardMaterial color={d.color} roughness={0.95} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      );
    }
    case "vase":
      return (
        <group position={[d.x, d.y, d.z]}>
          <mesh position={[0, 0.13, 0]} castShadow>
            <latheGeometry args={[[new THREE.Vector2(0, 0), new THREE.Vector2(0.07, 0), new THREE.Vector2(0.1, 0.08), new THREE.Vector2(0.06, 0.2), new THREE.Vector2(0.075, 0.26)], 12]} />
            <meshStandardMaterial color={d.color} roughness={0.4} />
          </mesh>
          {[0, 1, 2, 3, 4].map((k) => {
            const a = k * 1.256;
            const r = k === 0 ? 0 : 0.08;
            return (
              <group key={k} position={[Math.cos(a) * r, 0.42 + (k % 2) * 0.05, Math.sin(a) * r]}>
                <mesh position={[0, -0.08, 0]}>
                  <cylinderGeometry args={[0.008, 0.008, 0.2, 4]} />
                  <meshStandardMaterial color="#4f8a3c" />
                </mesh>
                <mesh>
                  <icosahedronGeometry args={[0.055, 0]} />
                  <meshStandardMaterial color={d.flower} />
                </mesh>
              </group>
            );
          })}
        </group>
      );
    case "shelf":
      return (
        <group position={[d.x, d.y, d.z]} rotation-y={d.rot}>
          <mesh position={[0, 0, 0.16]} castShadow>
            <boxGeometry args={[d.w, 0.06, 0.3]} />
            <meshStandardMaterial color={d.color} />
          </mesh>
          {[-0.4, -0.12, 0.2, 0.45].map((t, k) => (
            <mesh key={k} position={[t * d.w, 0.03 + (k % 2 ? 0.09 : 0.12), 0.17]} castShadow>
              {k % 2 ? <boxGeometry args={[0.12, 0.18, 0.2]} /> : <cylinderGeometry args={[0.07, 0.06, 0.24, 10]} />}
              <meshStandardMaterial color={["#b5623f", "#3f6f8a", "#e9e1d3", "#6f9f62"][k]} roughness={0.6} />
            </mesh>
          ))}
        </group>
      );
    case "easel":
      return (
        <group position={[d.x, d.y, d.z]} rotation-y={d.rot}>
          {[-0.32, 0.32].map((x) => (
            <mesh key={x} position={[x, 0.85, 0.1]} rotation-x={-0.12}>
              <boxGeometry args={[0.05, 1.75, 0.05]} />
              <meshStandardMaterial color="#8a5a33" />
            </mesh>
          ))}
          <mesh position={[0, 0.8, -0.32]} rotation-x={0.35}>
            <boxGeometry args={[0.05, 1.7, 0.05]} />
            <meshStandardMaterial color="#8a5a33" />
          </mesh>
          <mesh position={[0, 0.72, 0.16]}>
            <boxGeometry args={[0.85, 0.05, 0.12]} />
            <meshStandardMaterial color="#8a5a33" />
          </mesh>
          <mesh position={[0, 1.18, 0.15]} rotation-x={-0.12}>
            <planeGeometry args={[0.8, 0.8]} />
            <meshStandardMaterial map={paintingTexture(d.seed)} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
        </group>
      );
    case "lift":
      return (
        <group position={[d.x, d.y, d.z]} rotation-y={d.rot}>
          <mesh position={[0, 1.4, 0.04]}>
            <boxGeometry args={[1.9, 2.8, 0.08]} />
            <meshStandardMaterial color="#5b6670" metalness={0.6} roughness={0.35} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.42, 1.2, 0.1]}>
              <boxGeometry args={[0.8, 2.3, 0.04]} />
              <meshStandardMaterial color="#c9d1d8" metalness={0.8} roughness={0.25} />
            </mesh>
          ))}
          <mesh position={[0, 2.55, 0.1]}>
            <planeGeometry args={[0.5, 0.22]} />
            <meshBasicMaterial color="#ffcf7a" toneMapped={false} />
          </mesh>
          <mesh position={[1.15, 1.2, 0.08]}>
            <boxGeometry args={[0.14, 0.3, 0.04]} />
            <meshStandardMaterial color="#2f3a44" />
          </mesh>
          <mesh position={[1.15, 1.25, 0.11]}>
            <circleGeometry args={[0.035, 12]} />
            <meshBasicMaterial color="#7fd8ff" toneMapped={false} />
          </mesh>
        </group>
      );
    case "books":
      return <BookRows d={d} />;
    case "showerCurtain":
      return <ShowerCurtain d={d} />;
    case "ladder":
      return (
        <group position={[d.x, d.y, d.z]} rotation-y={d.rot}>
          {[-0.28, 0.28].map((x) => (
            <mesh key={x} position={[x, d.h / 2, 0.08]} castShadow>
              <boxGeometry args={[0.06, d.h, 0.06]} />
              <meshStandardMaterial color="#8a5a33" roughness={0.85} />
            </mesh>
          ))}
          {Array.from({ length: Math.floor(d.h / 0.32) }, (_, k) => (
            <mesh key={k} position={[0, 0.3 + k * 0.32, 0.08]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.025, 0.025, 0.56, 6]} />
              <meshStandardMaterial color="#a8693d" roughness={0.8} />
            </mesh>
          ))}
          {/* the hatch, with daylight spilling through */}
          <mesh position={[0, d.h - 0.04, 0.45]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[1.0, 0.9]} />
            <meshBasicMaterial color="#fff1c8" toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, d.h - 0.09, 0.45]}>
            <boxGeometry args={[1.14, 0.06, 1.04]} />
            <meshStandardMaterial color="#6b4428" />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

const BOOK_COLORS = ["#8c3b2b", "#3f6f8a", "#d8a24a", "#6f9f62", "#5b4a8a", "#c45b4a", "#e9e1d3", "#2f4f4a", "#b5623f", "#e07a8a", "#3e4c59", "#f2c14e"];

/** Rows of books (with the odd leaning book, stack or trinket) filling every shelf of a bookcase. */
function BookRows({ d }: { d: Extract<Decor, { type: "books" }> }) {
  const geo = useMemo(() => {
    let seed = d.seed * 9301 + 49297;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const parts: THREE.BufferGeometry[] = [];
    const col = new THREE.Color();
    const push = (g: THREE.BufferGeometry, hex: string) => {
      const ng = g.index ? g.toNonIndexed() : g;
      col.set(hex);
      const n = ng.attributes.position.count;
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b], i * 3);
      ng.setAttribute("color", new THREE.BufferAttribute(c, 3));
      parts.push(ng);
    };
    const gap = 0.24 * FURN_SCALE * 0.82;
    for (const sy of d.shelves) {
      const y0 = sy - d.y;
      let x = -d.w / 2 + 0.02;
      const end = d.w / 2 - 0.02;
      let lean = rand() < 0.35;
      while (x < end - 0.05) {
        const r = rand();
        if (r < 0.07 && end - x > 0.3) {
          // a little stack lying flat
          let yy = y0;
          for (let k = 0; k < 2 + Math.floor(rand() * 2); k++) {
            const h = 0.04 + rand() * 0.03;
            const g = new THREE.BoxGeometry(0.24, h, d.depth * 0.85);
            g.translate(x + 0.13, yy + h / 2, 0);
            push(g, BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)]);
            yy += h;
          }
          x += 0.3;
          continue;
        }
        if (r < 0.11 && end - x > 0.2) {
          // a tiny potted plant or ornament
          const g = new THREE.CylinderGeometry(0.05, 0.04, 0.09, 8);
          g.translate(x + 0.08, y0 + 0.045, 0);
          push(g, "#b5623f");
          const l = new THREE.IcosahedronGeometry(0.08, 0);
          l.translate(x + 0.08, y0 + 0.15, 0);
          push(l, "#6f9f62");
          x += 0.18;
          continue;
        }
        if (r < 0.16) {
          x += 0.04 + rand() * 0.06; // a gap
          lean = true;
          continue;
        }
        const bw = 0.035 + rand() * 0.05;
        const bh = Math.min(gap, gap * (0.62 + rand() * 0.36));
        const bd = d.depth * (0.75 + rand() * 0.2);
        const g = new THREE.BoxGeometry(bw, bh, bd);
        if (lean && x > -d.w / 2 + 0.05) {
          g.translate(bw / 2, bh / 2, 0);
          g.rotateZ(-0.28);
          g.translate(x, y0, 0);
          lean = false;
          x += bw + 0.08;
        } else {
          g.translate(x + bw / 2, y0 + bh / 2, 0);
          x += bw + 0.004;
        }
        push(g, BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)]);
        // a light band on the spine of some books
        if (rand() < 0.4) {
          const band = new THREE.BoxGeometry(bw + 0.002, 0.018, 0.004);
          band.translate(x - bw / 2 - 0.002, y0 + bh * 0.78, bd / 2 + 0.002);
          push(band, "#f2e6c4");
        }
      }
    }
    return parts.length ? mergeGeometries(parts, false) : null;
  }, [d]);
  if (!geo) return null;
  return (
    <mesh geometry={geo} position={[d.x, d.y, d.z]} rotation-y={d.rot} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.82} />
    </mesh>
  );
}

/** A curtain on a rail across a bathroom opening; it slides aside while you walk through. */
function ShowerCurtain({ d }: { d: Extract<Decor, { type: "showerCurtain" }> }) {
  const panels = useRef<THREE.Group>(null);
  const open = useRef(0);
  const N = 7;
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const g = panels.current;
    if (!g) return;
    // explorer in curtain-local space
    const px = player.position.x - INTERIOR_ORIGIN.x - d.x;
    const pz = player.position.z - INTERIOR_ORIGIN.z - d.z;
    const c = Math.cos(d.rot);
    const sn = Math.sin(d.rot);
    const lx = px * c - pz * sn;
    const lz = px * sn + pz * c;
    const near = Math.abs(lz) < 0.9 && Math.abs(lx) < d.w / 2 + 0.5 && Math.abs(player.position.y - d.y) < 1.5;
    open.current += ((near ? 1 : 0) - open.current) * (1 - Math.exp(-(near ? 7 : 2.2) * dt));
    const o = open.current;
    const t = performance.now() / 1000;
    g.children.forEach((m, k) => {
      const spread = -d.w / 2 + ((k + 0.5) / N) * d.w;
      const bunched = -d.w / 2 + 0.05 + k * 0.05;
      m.position.x = spread + (bunched - spread) * o;
      m.rotation.y = (k % 2 ? 0.5 : -0.5) * (0.35 + o * 0.6) + Math.sin(t * 1.3 + k) * 0.03;
      m.position.z = Math.sin(t * 0.9 + k * 0.7) * 0.01;
    });
  });
  const pw = (d.w / N) * 1.25;
  return (
    <group position={[d.x, d.y, d.z]} rotation-y={d.rot}>
      <mesh position={[0, d.h + 0.06, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.02, 0.02, d.w + 0.1, 6]} />
        <meshStandardMaterial color="#c9d1d8" metalness={0.7} roughness={0.3} />
      </mesh>
      <group ref={panels}>
        {Array.from({ length: N }, (_, k) => (
          <mesh key={k} position={[0, d.h / 2 + 0.08, 0]}>
            <planeGeometry args={[pw, d.h - 0.12]} />
            <meshStandardMaterial color={d.color} roughness={0.95} side={THREE.DoubleSide} transparent opacity={0.94} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Fetch every interior model in the background once the world is up, so doors open instantly. */
export function PreloadInteriors() {
  const ready = useGame((s) => s.sceneReady);
  useLayoutEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => {
      for (const k of Object.keys(FURNITURE) as FurnKey[]) useGLTF.preload(furnitureUrl(k));
      for (const u of ["Barrel", "Hay", "Cart", "Crate"]) useGLTF.preload(`/models/village/${u}.glb`);
      for (const u of ["Cow", "Horse", "Chick", "Pig"]) useGLTF.preload(`/models/animals/${u}.glb`);
    }, 6000);
    return () => window.clearTimeout(id);
  }, [ready]);
  return null;
}
