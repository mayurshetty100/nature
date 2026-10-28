import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getWorld } from "@/game/world";
import { player } from "@/game/store";
import { dampAngle } from "@/game/math";
import { addDynamicBody } from "@/game/scatter";
import { addCreature, nuzzle, reaction, type Creature } from "@/game/creatures";
import { ZONE_BY_ID } from "@/game/zones";
import { getLayout } from "@/game/layout";
import { makeWander, wanderStep, type Area } from "@/game/wander";
import { AnimatedAgent } from "./Agents";
import { inView } from "./cull";

// the sunny glade in the woods (falls back to its planned spot if the zone list changes)
const glade = ZONE_BY_ID.glade ?? { x: -88, z: 10, r: 15 };
const SAVANNA: Area = { x: glade.x, z: glade.z, r: glade.r - 2 };
/** forest clearings for deer and foxes, just off the woodland road */
const DEER_AREAS: Area[] = [
  { x: -112, z: 30, r: 5 },
  { x: -104, z: 8, r: 5 },
  { x: -78, z: -40, r: 5 },
  { x: -126, z: -6, r: 4 },
];
const FOX_AREA: Area = { x: -96, z: -6, r: 5 };

const A = (n: string) => `/models/animals/${n}.glb`;

// what each pettable animal is called, how it sounds and the clip it plays when patted
const COW = { name: "cow", voice: "moo", happy: "Armature|Jump" } as const;
const HORSE = { name: "horse", voice: "neigh", happy: "Armature|Jump" } as const;
const SHEEP = { name: "sheep", voice: "baa", happy: "Armature|Jump" } as const;
const PIG = { name: "piglet", voice: "oink", happy: "Armature|Jump" } as const;
const LLAMA = { name: "llama", voice: "baa", happy: "Armature|Jump" } as const;
const ZEBRA = { name: "zebra", voice: "neigh", happy: "Armature|Jump" } as const;
const FOX = { name: "fox", voice: "yip" } as const;

/* ---------- procedural lion & elephant (stylised low-poly, animated) ---------- */

type BeastKind = "lion" | "elephant" | "deer";

function Beast({ kind, seed, size = 1, area = SAVANNA }: { kind: BeastKind; seed: number; size?: number; area?: Area }) {
  const root = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const ears = useRef<(THREE.Mesh | null)[]>([]);
  const trunk = useRef<(THREE.Group | null)[]>([]);
  const w = useMemo(() => makeWander(area, seed), [area, seed]);
  const world = getWorld();
  const phase = useRef(0);
  const el = kind === "elephant";
  const deer = kind === "deer";
  const me = useMemo<Creature>(
    () => ({
      name: el ? "elephant" : deer ? "deer" : "lion",
      x: w.x,
      z: w.z,
      y: 0,
      r: (el ? 1.5 : deer ? 0.7 : 0.85) * size,
      height: (el ? 3 : deer ? 1.9 : 1.5) * size,
      voice: el ? "trumpet" : deer ? "coo" : "purr",
      petAt: 0,
    }),
    [w, el, deer, size],
  );
  useEffect(() => {
    const a = addDynamicBody(me);
    const b = addCreature(me);
    return () => {
      a();
      b();
    };
  }, [me]);
  const body = el ? "#9a979e" : deer ? "#b9773f" : "#d9a35b";
  const dark = el ? "#7c7980" : deer ? "#8a5a33" : "#a8541f";

  useFrame(({ clock, camera }, raw) => {
    const dt = Math.min(raw, 0.05);
    if (root.current) root.current.visible = inView(camera, clock.elapsedTime, w.x, root.current.position.y + 1.5 * size, w.z, 3 * size, 200);
    const happy = reaction(me, performance.now());
    let v = 0;
    if (happy >= 0) w.yaw = dampAngle(w.yaw, Math.atan2(player.position.x - w.x, player.position.z - w.z), dt * 5);
    else v = wanderStep(w, area, el ? 1.1 : deer ? 1.4 : 1.6, dt);
    phase.current += dt * (v > 0.05 ? (el ? 4 : 7) : 0);
    const t = clock.elapsedTime;
    const g = root.current;
    if (!g) return;
    // patted: bend lovingly toward the explorer's hand and sway into it
    const lean = nuzzle(happy);
    g.position.set(w.x + Math.sin(w.yaw) * lean * 0.12 * size, world.gridHeight(w.x, w.z), w.z + Math.cos(w.yaw) * lean * 0.12 * size);
    g.rotation.set(lean * (el ? 0.05 : 0.1), w.yaw, Math.sin(t * 2.2 + seed) * 0.06 * lean, "YXZ");
    me.x = w.x;
    me.z = w.z;
    me.y = g.position.y;
    const swing = v > 0.05 ? 0.45 : 0;
    legs.current.forEach((l, i) => {
      if (l) l.rotation.x = Math.sin(phase.current + (i === 0 || i === 3 ? 0 : Math.PI)) * swing;
    });
    if (head.current) head.current.rotation.x = happy >= 0 ? lean * 0.42 + Math.sin(t * 2.6 + seed) * 0.05 * lean : Math.sin(t * 1.3 + seed) * 0.06 + (v > 0.05 ? Math.sin(phase.current * 2) * 0.03 : 0);
    if (tail.current) tail.current.rotation.z = Math.sin(t * (happy >= 0 ? 14 : 2.4) + seed) * 0.5;
    ears.current.forEach((e, i) => {
      if (e) e.rotation.y = (i ? -1 : 1) * (0.25 + Math.sin(t * 2 + seed) * 0.25);
    });
    trunk.current.forEach((s, i) => {
      // patted elephants lift their trunk in a happy salute
      if (s) s.rotation.x = happy >= 0 && happy < 0.8 ? -0.55 - i * 0.15 : 0.18 + Math.sin(t * 1.6 + i * 0.6 + seed) * 0.12;
    });
  });

  const legPos: [number, number][] = el
    ? [
        [-0.55, 0.85],
        [0.55, 0.85],
        [-0.55, -0.85],
        [0.55, -0.85],
      ]
    : [
        [-0.28, 0.55],
        [0.28, 0.55],
        [-0.28, -0.55],
        [0.28, -0.55],
      ];
  const legH = el ? 1.25 : deer ? 0.95 : 0.7;
  const legR = el ? 0.28 : deer ? 0.06 : 0.11;
  return (
    <group ref={root} scale={size}>
      <group position={[0, legH, 0]}>
        {/* body */}
        <mesh castShadow position={[0, el ? 0.65 : 0.3, 0]} scale={el ? [0.95, 0.85, 1.35] : deer ? [0.3, 0.3, 0.68] : [0.36, 0.34, 0.8]}>
          <icosahedronGeometry args={[1, 3]} />
          <meshStandardMaterial color={body} roughness={0.9} />
        </mesh>
        {deer &&
          Array.from({ length: 12 }, (_, i) => (
            <mesh key={`sp${i}`} position={[(i % 2 ? 1 : -1) * (0.25 + (i % 3) * 0.02), 0.42 + ((i * 37) % 5) * 0.03, -0.35 + (i % 6) * 0.13]}>
              <sphereGeometry args={[0.035, 8, 6]} />
              <meshStandardMaterial color="#f6ead6" roughness={0.9} />
            </mesh>
          ))}
        {legPos.map(([x, z], i) => (
          <group
            key={i}
            position={[x, el ? 0.3 : 0.15, z]}
            ref={(r) => {
              legs.current[i] = r;
            }}
          >
            <mesh castShadow position={[0, -legH / 2 - (el ? 0.15 : 0.08), 0]}>
              <cylinderGeometry args={[legR, legR * 0.9, legH + (el ? 0.3 : 0.16), 14]} />
              <meshStandardMaterial color={el ? body : deer ? body : "#cf9850"} />
            </mesh>
            {/* hooves / paws */}
            <mesh castShadow position={[0, -legH - (el ? 0.28 : 0.16), deer ? 0.01 : 0.03]} scale={deer ? [1, 0.8, 1.2] : el ? [1.05, 0.5, 1.05] : [1.25, 0.7, 1.5]}>
              <sphereGeometry args={[legR * 1.05, 12, 8]} />
              <meshStandardMaterial color={deer ? "#2e2018" : el ? body : "#e2b06c"} roughness={0.8} />
            </mesh>
            {el &&
              [-1, 0, 1].map((n) => (
                <mesh key={n} position={[n * 0.12, -legH - 0.3, 0.24]}>
                  <sphereGeometry args={[0.06, 10, 8]} />
                  <meshStandardMaterial color="#efe6d2" roughness={0.6} />
                </mesh>
              ))}
          </group>
        ))}
        {/* head */}
        {deer && (
          <mesh castShadow position={[0, 0.55, 0.62]} rotation-x={-0.6}>
            <cylinderGeometry args={[0.09, 0.13, 0.6, 6]} />
            <meshStandardMaterial color={body} />
          </mesh>
        )}
        <group ref={head} position={[0, el ? 0.95 : deer ? 0.85 : 0.55, el ? 1.45 : deer ? 0.8 : 0.85]}>
          <mesh castShadow scale={el ? [0.62, 0.62, 0.6] : [0.27, 0.26, 0.3]}>
            <icosahedronGeometry args={[1, 3]} />
            <meshStandardMaterial color={body} />
          </mesh>
          {el ? (
            <>
              {[-1, 1].map((k, i) => (
                <mesh
                  key={k}
                  ref={(r) => {
                    ears.current[i] = r;
                  }}
                  position={[k * 0.62, 0.05, -0.1]}
                  scale={[0.08, 0.62, 0.52]}
                  castShadow
                >
                  <sphereGeometry args={[1, 10, 8]} />
                  <meshStandardMaterial color={dark} />
                </mesh>
              ))}
              {/* trunk segments */}
              <group position={[0, -0.15, 0.5]}>
                <group ref={(r) => (trunk.current[0] = r)}>
                  <mesh position={[0, -0.22, 0.05]}>
                    <cylinderGeometry args={[0.2, 0.24, 0.5, 8]} />
                    <meshStandardMaterial color={body} />
                  </mesh>
                  <group position={[0, -0.45, 0.06]} ref={(r) => (trunk.current[1] = r)}>
                    <mesh position={[0, -0.2, 0.04]}>
                      <cylinderGeometry args={[0.15, 0.19, 0.45, 8]} />
                      <meshStandardMaterial color={body} />
                    </mesh>
                    <group position={[0, -0.42, 0.05]} ref={(r) => (trunk.current[2] = r)}>
                      <mesh position={[0, -0.16, 0.05]}>
                        <cylinderGeometry args={[0.11, 0.14, 0.36, 8]} />
                        <meshStandardMaterial color={body} />
                      </mesh>
                    </group>
                  </group>
                </group>
              </group>
              {[-1, 1].map((k) => (
                <mesh key={k} position={[k * 0.25, -0.35, 0.45]} rotation-x={-1.1}>
                  <coneGeometry args={[0.06, 0.55, 6]} />
                  <meshStandardMaterial color="#f5efe0" />
                </mesh>
              ))}
              {[-1, 1].map((k) => (
                <Eye key={k} side={k} r={0.075} position={[k * 0.3, 0.16, 0.46]} lid={dark} />
              ))}

            </>
          ) : (
            <>
              {/* mane (lion) or antlers (deer) */}
              {!deer && (
                <group position={[0, 0.02, -0.06]}>
                  {/* a full, fluffy mane: two rings of tufts round the face */}
                  {Array.from({ length: 22 }, (_, i) => {
                    const a = (i / 22) * Math.PI * 2;
                    const ring = i % 2 ? 0.38 : 0.31;
                    return (
                      <mesh key={i} castShadow position={[Math.cos(a) * ring, Math.sin(a) * ring * 0.95, -0.04 - (i % 2) * 0.07]} scale={[0.15, 0.15, 0.2]}>
                        <sphereGeometry args={[1, 10, 8]} />
                        <meshStandardMaterial color={i % 3 ? dark : "#8a3f16"} roughness={0.95} />
                      </mesh>
                    );
                  })}
                </group>
              )}
              {deer &&
                [-1, 1].map((k) => (
                  <group key={k} position={[k * 0.1, 0.24, -0.04]} rotation-z={-k * 0.45}>
                    <mesh position={[0, 0.25, 0]}>
                      <cylinderGeometry args={[0.025, 0.035, 0.5, 5]} />
                      <meshStandardMaterial color="#e8d8b8" />
                    </mesh>
                    <mesh position={[k * 0.06, 0.38, 0.06]} rotation-x={0.7}>
                      <cylinderGeometry args={[0.02, 0.025, 0.22, 4]} />
                      <meshStandardMaterial color="#e8d8b8" />
                    </mesh>
                    <mesh position={[0, 0.48, -0.04]} rotation-x={-0.6}>
                      <cylinderGeometry args={[0.018, 0.022, 0.2, 4]} />
                      <meshStandardMaterial color="#e8d8b8" />
                    </mesh>
                  </group>
                ))}
              <mesh position={[0, -0.05, 0.25]} scale={[0.13, 0.11, 0.14]}>
                <icosahedronGeometry args={[1, 3]} />
                <meshStandardMaterial color="#e8c088" />
              </mesh>
              <mesh position={[0, -0.0, 0.37]}>
                <sphereGeometry args={[0.035, 6, 6]} />
                <meshStandardMaterial color="#3a2418" />
              </mesh>
              {[-1, 1].map((k) => (
                <Eye key={k} side={k} r={deer ? 0.045 : 0.042} position={[k * (deer ? 0.15 : 0.13), 0.09, 0.22]} lid={body} />
              ))}
              {/* mouth line + whisker dots (lion) */}
              {!deer && (
                <mesh position={[0, -0.1, 0.33]} rotation-x={Math.PI / 2}>
                  <torusGeometry args={[0.05, 0.008, 4, 10, Math.PI]} />
                  <meshStandardMaterial color="#3a2418" />
                </mesh>
              )}
              {[-1, 1].map((k) => (
                <mesh key={k} position={[k * 0.2, 0.28, 0]}>
                  <sphereGeometry args={[0.07, 6, 6]} />
                  <meshStandardMaterial color={body} />
                </mesh>
              ))}
            </>
          )}
        </group>
        {/* tail */}
        <group ref={tail} position={[0, el ? 0.75 : 0.42, el ? -1.3 : -0.78]}>
          <mesh position={[0, el ? -0.35 : -0.05, -0.15]} rotation-x={el ? 0.25 : -0.9}>
            <cylinderGeometry args={[0.03, 0.04, el ? 0.75 : 0.7, 5]} />
            <meshStandardMaterial color={body} />
          </mesh>
          <mesh position={[0, el ? -0.72 : 0.18, el ? -0.25 : -0.48]}>
            <sphereGeometry args={[el ? 0.06 : 0.08, 6, 6]} />
            <meshStandardMaterial color={deer ? "#f3ede2" : dark} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** A glossy cartoon eye: white, dark iris, a sparkle and a soft lid (blinks now and then). */
function Eye({ side, r, position, lid }: { side: number; r: number; position: [number, number, number]; lid: string }) {
  const g = useRef<THREE.Group>(null);
  const seed = useMemo(() => Math.random() * 10, []);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const bt = (clock.elapsedTime + seed) % 4.6;
    g.current.scale.y = bt < 0.13 ? 0.15 : 1;
  });
  return (
    <group ref={g} position={position} rotation-y={side * 0.4}>
      <mesh>
        <sphereGeometry args={[r, 14, 10]} />
        <meshStandardMaterial color="#fbfaf6" roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, r * 0.5]}>
        <sphereGeometry args={[r * 0.66, 12, 8]} />
        <meshStandardMaterial color="#2a1a10" roughness={0.2} />
      </mesh>
      <mesh position={[r * 0.2, r * 0.32, r * 0.98]}>
        <sphereGeometry args={[r * 0.2, 6, 4]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh rotation-x={-0.4}>
        <sphereGeometry args={[r * 1.07, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.38]} />
        <meshStandardMaterial color={lid} roughness={0.85} />
      </mesh>
    </group>
  );
}

export function Wildlife() {
  const PADDOCK: Area = useMemo(() => {
    const p = getLayout().paddock;
    return { x: p.x, z: p.z, w: p.w - 3, d: p.d - 3 };
  }, []);
  return (
    <group>
      {/* pasture */}
      <AnimatedAgent url={A("Cow")} idle="Armature|Idle" walk="Armature|WalkSlow" height={1.6} radius={0.9} pet={COW} area={PADDOCK} speed={0.8} seed={31} stride={1.2} />
      <AnimatedAgent url={A("Cow")} idle="Armature|Idle" walk="Armature|WalkSlow" height={1.5} radius={0.9} pet={COW} area={PADDOCK} speed={0.8} seed={32} stride={1.2} />
      <AnimatedAgent url={A("Cow")} idle="Armature|Idle" walk="Armature|WalkSlow" height={1.45} radius={0.85} pet={COW} area={PADDOCK} speed={0.8} seed={38} stride={1.2} />
      <AnimatedAgent url={A("Horse")} idle="Armature|Idle" walk="Armature|Walk" height={2.0} radius={0.9} pet={HORSE} area={PADDOCK} speed={1.4} seed={33} stride={0.8} />
      <AnimatedAgent url={A("Sheep")} idle="Armature|Idle" walk="Armature|Jump" height={1.1} radius={0.6} pet={SHEEP} area={PADDOCK} speed={0.7} seed={34} hopWalk />
      <AnimatedAgent url={A("Sheep")} idle="Armature|Idle" walk="Armature|Jump" height={1.0} radius={0.6} pet={SHEEP} area={PADDOCK} speed={0.7} seed={35} hopWalk />
      <AnimatedAgent url={A("Pig")} idle="Armature|Idle" walk="Armature|Jump" height={0.9} radius={0.55} pet={PIG} area={PADDOCK} speed={0.6} seed={36} hopWalk />
      <AnimatedAgent url={A("Llama")} idle="Armature|Idle" walk="Armature|Jump" height={1.9} radius={0.7} pet={LLAMA} area={PADDOCK} speed={0.6} seed={37} hopWalk />
      {/* sunny glade in the woods */}
      <AnimatedAgent url={A("Zebra")} idle="Armature|Idle" walk="Armature|Walk" height={1.8} radius={0.85} pet={ZEBRA} area={SAVANNA} speed={1.4} seed={41} stride={0.8} />
      <AnimatedAgent url={A("Zebra")} idle="Armature|Idle" walk="Armature|Walk" height={1.7} radius={0.85} pet={ZEBRA} area={SAVANNA} speed={1.4} seed={42} stride={0.8} />
      <Beast kind="elephant" seed={51} size={1.25} />
      <Beast kind="elephant" seed={52} size={0.7} />
      <Beast kind="lion" seed={53} size={1.5} />
      <Beast kind="lion" seed={54} size={1.35} />
      {/* deer and a fox in the woodland clearings */}
      {DEER_AREAS.map((ar, i) => (
        <Beast key={i} kind="deer" seed={60 + i} size={1.25 - (i % 2) * 0.2} area={ar} />
      ))}
      <AnimatedAgent url={A("RedFox")} idle="Armature|ArmatureAction" walk="Armature|ArmatureAction" height={0.7} radius={0.45} pet={FOX} area={FOX_AREA} speed={1.6} seed={61} />
    </group>
  );
}
