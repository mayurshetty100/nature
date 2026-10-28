import { ACADEMY_STEP } from "@/game/landmarkColliders";
import { plinthFor } from "@/game/foundations";
import { plinthGeometry } from "./plinthGeometry";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles, Text } from "@react-three/drei";
import * as THREE from "three";
import { getWorld } from "@/game/world";
import { STOP_BY_ID } from "@/game/stops";
import { CITY_GIANTS, giantDoorDir } from "@/game/landmarkColliders";
import { getHotspotSigns } from "@/game/layout";
import { makeWindowTexture } from "./materials";
import { lanternMaterial, SIGN_FONT, windowMaterial } from "./constants";
import { StaticBatch } from "./StaticBatch";
import { daylight } from "@/game/dayCycle";
import { Trophy } from "./Trophy";



const WOOD = "#7b4a2b";
const WOOD_LIGHT = "#a8693d";
const STONE = "#b3a796";
const STONE_LIGHT = "#d9cdb8";
const ROOF = "#c4553a";
const SAND = "#e6cc9c";

function useGround(x: number, z: number) {
  return useMemo(() => getWorld().gridHeight(x, z), [x, z]);
}

/** Road frame at a point: tangent angle so landmarks face along the road. */
function useRoadFrame(x: number, z: number) {
  return useMemo(() => {
    const w = getWorld();
    const { index } = w.nearestRoad(x, z, 20);
    const j = Math.min(w.road.count - 1, index + 3);
    const k = Math.max(0, index - 3);
    const tx = w.road.xs[j] - w.road.xs[k];
    const tz = w.road.zs[j] - w.road.zs[k];
    return { x: w.road.xs[index], z: w.road.zs[index], y: w.road.ys[index], yaw: Math.atan2(tx, tz) };
  }, [x, z]);
}

function Lantern({ position }: { position: [number, number, number]; light?: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.8, 4]} />
        <meshStandardMaterial color="#2c2018" />
      </mesh>
      <mesh material={lanternMaterial}>
        <boxGeometry args={[0.42, 0.55, 0.42]} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <coneGeometry args={[0.36, 0.28, 4]} />
        <meshStandardMaterial color="#3b2a1e" />
      </mesh>
    </group>
  );
}

/** REGION 0 — The Forgotten Gate */
export function ForgottenGate() {
  const f = useRoadFrame(STOP_BY_ID.gate.x, STOP_BY_ID.gate.z);
  const half = 3.4;
  return (
    <group position={[f.x, f.y, f.z]} rotation-y={f.yaw}>
      {/* stone plaza */}
      <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[5.4, 28]} />
        <meshStandardMaterial color={STONE_LIGHT} roughness={0.95} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * half, 0, 0]}>
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.85, 1.0, 1.0, 8]} />
            <meshStandardMaterial color={STONE} roughness={0.95} />
          </mesh>
          <mesh position={[0, 3.3, 0]} castShadow>
            <cylinderGeometry args={[0.38, 0.46, 5.4, 8]} />
            <meshStandardMaterial color={WOOD} roughness={0.9} />
          </mesh>
          {/* vines */}
          <mesh position={[0.05, 2.4, 0.2]} castShadow>
            <icosahedronGeometry args={[0.55, 0]} />
            <meshStandardMaterial color="#5e9e3e" />
          </mesh>
          <mesh position={[-0.2, 4.4, -0.2]} castShadow>
            <icosahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial color="#76b04a" />
          </mesh>
          <Lantern position={[s * 0.15, 5.1, 0.55]} light={s === 1} />
        </group>
      ))}
      {/* beams */}
      <mesh position={[0, 6.15, 0]} castShadow>
        <boxGeometry args={[9.4, 0.6, 0.85]} />
        <meshStandardMaterial color={WOOD} roughness={0.9} />
      </mesh>
      <mesh position={[0, 6.62, 0]} castShadow>
        <boxGeometry args={[10.2, 0.32, 1.05]} />
        <meshStandardMaterial color="#5c3820" roughness={0.9} />
      </mesh>
      {/* sign board (faces the visitor arriving from the start) */}
      <group position={[0, 5.0, 0.1]} rotation-y={Math.PI}>
        <mesh castShadow>
          <boxGeometry args={[5.6, 1.45, 0.22]} />
          <meshStandardMaterial color={WOOD_LIGHT} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0, -0.02]}>
          <boxGeometry args={[5.9, 1.7, 0.16]} />
          <meshStandardMaterial color="#5c3820" />
        </mesh>
        <Text font={SIGN_FONT} fontSize={0.78} position={[0, 0.02, 0.13]} color="#fff1d0" outlineWidth={0.035} outlineColor="#5a3418" anchorX="center" anchorY="middle">
          Mayur's World
        </Text>
      </group>
      {/* crest */}
      <mesh position={[0, 7.25, 0]} castShadow>
        <octahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial color="#ffd27e" emissive="#ffb347" emissiveIntensity={1.4} />
      </mesh>
      <WelcomeSignpost position={[-5.6, 0, -3.4]} />
      <DirectionSign position={[6.2, 0, 6.5]} label={STOP_BY_ID.academy.name} rotation={0.35} />
    </group>
  );
}

const LEAF_COLORS = ["#5f9e3a", "#7cb342", "#4e8a3a", "#93c24a"];

/** A little clump of leaves that sprouts from a sign's corner. */
function LeafTuft({ position, scale = 1, seed = 0 }: { position: [number, number, number]; scale?: number; seed?: number }) {
  return (
    <group position={position} scale={scale}>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + seed;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.13, Math.sin(a * 1.7) * 0.06, Math.sin(a) * 0.08]} rotation={[a, a * 0.5, 0.6]} scale={[0.2, 0.06, 0.13]} castShadow>
            <sphereGeometry args={[1, 7, 5]} />
            <meshStandardMaterial color={LEAF_COLORS[(i + Math.round(seed * 3)) % LEAF_COLORS.length]} roughness={0.85} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Leafy wooden plank sign — an arrow-tipped board with a darker bark frame and leaves at the corners. */
function SignBoard({ label, y, flip, tilt }: { label: string; y: number; flip: boolean; tilt: number }) {
  const w = Math.max(2.1, label.length * 0.19 + 0.6);
  const dir = flip ? -1 : 1;
  return (
    <group position={[0, y, 0]} rotation-y={tilt}>
      <group position={[dir * (w / 2 - 0.15), 0, 0]}>
        <mesh position={[0, 0, -0.01]}>
          <boxGeometry args={[w + 0.14, 0.62, 0.1]} />
          <meshStandardMaterial color="#5c3820" roughness={0.95} />
        </mesh>
        <mesh castShadow>
          <boxGeometry args={[w, 0.5, 0.14]} />
          <meshStandardMaterial color={WOOD_LIGHT} roughness={0.9} />
        </mesh>
        {/* grain lines */}
        {[-0.12, 0.1].map((gy) => (
          <mesh key={gy} position={[0, gy, 0.072]}>
            <boxGeometry args={[w * 0.92, 0.018, 0.005]} />
            <meshStandardMaterial color="#8a5530" roughness={1} />
          </mesh>
        ))}
        <mesh position={[dir * (w / 2 + 0.05), 0, 0]} rotation-z={flip ? Math.PI / 4 : -Math.PI / 4}>
          <boxGeometry args={[0.38, 0.38, 0.14]} />
          <meshStandardMaterial color={WOOD_LIGHT} roughness={0.9} />
        </mesh>
        <LeafTuft position={[-dir * (w / 2 - 0.05), 0.26, 0.05]} scale={0.9} seed={label.length} />
        <LeafTuft position={[dir * (w / 2 - 0.3), -0.27, 0.06]} scale={0.6} seed={label.length * 0.37} />
        {[1, -1].map((side) => (
          <Text
            key={side}
            font={SIGN_FONT}
            fontSize={0.3}
            position={[0, 0, 0.08 * side]}
            rotation-y={side === 1 ? 0 : Math.PI}
            color="#fff4d6"
            outlineWidth={0.02}
            outlineColor="#4a2a12"
            anchorX="center"
            anchorY="middle"
          >
            {label}
          </Text>
        ))}
      </group>
    </group>
  );
}

/** Welcome signpost: playful pointers to a few of the island's hotspots. */
function WelcomeSignpost({ position }: { position: [number, number, number] }) {
  const labels = [STOP_BY_ID.academy.name, STOP_BY_ID.forest.name, STOP_BY_ID.city.name, STOP_BY_ID.cove.name];
  return (
    <group position={position} rotation-y={Math.PI + 0.5}>
      <mesh position={[0, 1.7, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.18, 3.4, 6]} />
        <meshStandardMaterial color={WOOD} roughness={0.95} />
      </mesh>
      <LeafTuft position={[0, 3.45, 0]} scale={1.4} seed={1.3} />
      <LeafTuft position={[0.12, 0.7, 0.1]} scale={1} seed={2.1} />
      {labels.map((l, i) => (
        <SignBoard key={l} label={l} y={3.0 - i * 0.66} flip={i % 2 === 1} tilt={(i - 1.5) * 0.18} />
      ))}
    </group>
  );
}

function DirectionSign({ position, label, rotation = 0 }: { position: [number, number, number]; label: string; rotation?: number }) {
  return (
    <group position={position} rotation-y={Math.PI + rotation}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.15, 2.4, 6]} />
        <meshStandardMaterial color={WOOD} roughness={0.95} />
      </mesh>
      <LeafTuft position={[0, 2.45, 0]} scale={1.1} seed={0.7} />
      <SignBoard label={label} y={2.1} flip={false} tilt={0} />
    </group>
  );
}

/** A leafy name board at every hotspot. */
function HotspotSigns() {
  const signs = useMemo(() => getHotspotSigns(), []);
  return (
    <>
      {signs.map((sg) => (
        <group key={sg.id} position={[sg.x, sg.y, sg.z]} rotation-y={sg.yaw}>
          <mesh position={[0, 1.25, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.16, 2.5, 6]} />
            <meshStandardMaterial color={WOOD} roughness={0.95} />
          </mesh>
          <LeafTuft position={[0, 2.55, 0]} scale={1.2} seed={sg.x} />
          <group position={[0, 2.05, 0.12]}>
            <SignBoard label={sg.label} y={0} flip={false} tilt={0} />
          </group>
        </group>
      ))}
    </>
  );
}

/* ---------------- Distant landmarks (detailed in later chapters) ---------------- */

/** Faces a landmark's front (+Z) toward its arrival point on the road. */
function faceRoad(s: { x: number; z: number; lx: number; lz: number }) {
  return Math.atan2(s.x - s.lx, s.z - s.lz);
}

function Flag({ position, color }: { position: [number, number, number]; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 2.2 + position[0]) * 0.35;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.8, 4]} />
        <meshStandardMaterial color="#5c3820" />
      </mesh>
      <mesh ref={ref} position={[0, 1.5, 0]} userData={{ keep: true }}>
        <boxGeometry args={[0.02, 0.6, 1.0]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function AcademyKingdom() {
  const s = STOP_BY_ID.academy;
  const y = useGround(s.lx, s.lz);
  const corners: [number, number][] = [
    [-9, -7],
    [9, -7],
    [-9, 7],
    [9, 7],
  ];
  // stone foundation under the courtyard wherever the hillside falls away
  const plinth = useMemo(() => {
    const p = plinthFor(s.lx, s.lz, ACADEMY_STEP.w, ACADEMY_STEP.d, faceRoad(s), y - 0.2);
    return p ? plinthGeometry([{ ...p, x: 0, z: 0, rot: 0, top: 0.02, bottom: p.bottom - (y - 0.2) }]) : null;
  }, [s, y]);
  return (
    <group position={[s.lx, y - 0.2, s.lz]} rotation-y={faceRoad(s)}>
      {plinth && (
        <mesh geometry={plinth} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.95} />
        </mesh>
      )}
      <mesh position={[0, 0.4, 0]} receiveShadow>
        <boxGeometry args={[21, 0.8, 17]} />
        <meshStandardMaterial color={STONE_LIGHT} />
      </mesh>
      {/* a low step all round so you can walk up onto the courtyard */}
      <mesh position={[0, ACADEMY_STEP.top / 2, 0]} receiveShadow>
        <boxGeometry args={[ACADEMY_STEP.w, ACADEMY_STEP.top, ACADEMY_STEP.d]} />
        <meshStandardMaterial color="#cdbb98" />
      </mesh>
      {/* curtain walls with battlements */}
      {[
        { p: [0, 2.2, -7], s: [18, 3.6, 1.2] },
        { p: [-9, 2.2, 0], s: [1.2, 3.6, 14] },
        { p: [9, 2.2, 0], s: [1.2, 3.6, 14] },
        { p: [-6, 2.2, 7], s: [6, 3.6, 1.2] },
        { p: [6, 2.2, 7], s: [6, 3.6, 1.2] },
      ].map((wl, i) => (
        <mesh key={i} position={wl.p as [number, number, number]} castShadow receiveShadow>
          <boxGeometry args={wl.s as [number, number, number]} />
          <meshStandardMaterial color="#e3d2b2" roughness={0.9} />
        </mesh>
      ))}
      {Array.from({ length: 9 }, (_, k) => (
        <mesh key={k} position={[-8 + k * 2, 4.35, -7]} castShadow>
          <boxGeometry args={[0.9, 0.7, 1.3]} />
          <meshStandardMaterial color="#e3d2b2" />
        </mesh>
      ))}
      {/* gatehouse arch */}
      <mesh position={[0, 4.6, 7]} castShadow>
        <boxGeometry args={[6.2, 1.6, 1.6]} />
        <meshStandardMaterial color="#d8c3a0" />
      </mesh>
      <mesh position={[0, 6.0, 7]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[3.2, 1.6, 4]} />
        <meshStandardMaterial color="#3f6fb5" />
      </mesh>
      {/* corner towers */}
      {corners.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 3.6, 0]} castShadow>
            <cylinderGeometry args={[1.6, 1.8, 6.4, 12]} />
            <meshStandardMaterial color="#efe0c2" />
          </mesh>
          <mesh position={[0, 8.0, 0]} castShadow>
            <coneGeometry args={[2.1, 3.0, 12]} />
            <meshStandardMaterial color={i % 2 ? "#3f6fb5" : ROOF} />
          </mesh>
          <Flag position={[0, 9.4, 0]} color={i % 2 ? "#ffd27e" : "#ff8a5c"} />
        </group>
      ))}
      {/* main hall */}
      <mesh position={[0, 3.6, -2]} castShadow receiveShadow>
        <boxGeometry args={[12, 5.6, 6]} />
        <meshStandardMaterial color={SAND} roughness={0.9} />
      </mesh>
      <mesh position={[0, 7.4, -2]} rotation-y={Math.PI / 4} scale={[1.45, 1, 0.75]} castShadow>
        <coneGeometry args={[6.0, 2.6, 4]} />
        <meshStandardMaterial color={ROOF} />
      </mesh>
      {/* clock tower */}
      <mesh position={[0, 7.5, 1]} castShadow>
        <boxGeometry args={[3, 12, 3]} />
        <meshStandardMaterial color="#efd9ae" />
      </mesh>
      <mesh position={[0, 15, 1]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[2.6, 3.6, 4]} />
        <meshStandardMaterial color="#3f6fb5" />
      </mesh>
      <Flag position={[0, 16.6, 1]} color="#ffd27e" />
      <mesh position={[0, 11.6, 2.52]}>
        <circleGeometry args={[0.95, 24]} />
        <meshStandardMaterial color="#fff8e8" emissive="#ffe7b0" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 11.85, 2.54]}>
        <boxGeometry args={[0.08, 0.6, 0.02]} />
        <meshStandardMaterial color="#3a2a20" />
      </mesh>
      {/* warm windows */}
      {[-4.5, -2.4, 2.4, 4.5].map((x) => (
        <mesh key={x} position={[x, 3.6, 1.02]} material={windowMaterial}>
          <boxGeometry args={[1, 1.6, 0.05]} />
        </mesh>
      ))}
      {/* courtyard steps + path to the gate */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.9 + i * 0.25, 2.6 - i * 0.5]} receiveShadow>
          <boxGeometry args={[5 - i, 0.25, 1.2]} />
          <meshStandardMaterial color={STONE_LIGHT} />
        </mesh>
      ))}
      <Lantern position={[-2.4, 0.8, 8.4]} light />
      <Lantern position={[2.4, 0.8, 8.4]} />
    </group>
  );
}

/** Glass lobby doors with a canopy on the plaza-facing side of a skyscraper. */
function GiantEntrance({ i, w }: { i: number; w: number }) {
  const [nx, nz] = giantDoorDir(i);
  return (
    <group position={[nx * (w / 2), 0.5, nz * (w / 2)]} rotation-y={Math.atan2(nx, nz)}>
      <mesh position={[0, 1.45, 0.04]}>
        <boxGeometry args={[2.4, 2.9, 0.1]} />
        <meshStandardMaterial color="#e9eef2" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.3, 0.1]}>
        <boxGeometry args={[1.9, 2.5, 0.06]} />
        <meshStandardMaterial color="#2c3a48" emissive="#ffd9a0" emissiveIntensity={0.35} roughness={0.2} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.3, 0.14]}>
        <boxGeometry args={[0.05, 2.5, 0.02]} />
        <meshStandardMaterial color="#cfd8de" />
      </mesh>
      <mesh position={[0, 3.05, 0.8]} castShadow>
        <boxGeometry args={[3.0, 0.14, 1.6]} />
        <meshStandardMaterial color="#d9d2c6" />
      </mesh>
    </group>
  );
}

export function CityOfGiants() {
  const s = STOP_BY_ID.city;
  const y = useGround(s.lx, s.lz);
  const tex = useMemo(() => [makeWindowTexture(3), makeWindowTexture(11), makeWindowTexture(29)], []);
  const towers = CITY_GIANTS;
  return (
    <group position={[s.lx, y - 0.3, s.lz]}>
      <mesh position={[0, 0.25, 0]} receiveShadow>
        <cylinderGeometry args={[11.5, 12, 0.6, 28]} />
        <meshStandardMaterial color="#d9d2c6" />
      </mesh>
      {towers.map(([x, z, w, h, t], i) => {
        const map = tex[t].clone();
        map.needsUpdate = true;
        map.repeat.set(w / 3, h / 6);
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, h / 2 + 0.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, h, w]} />
              <meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={0.35} roughness={0.35} metalness={0.15} />
            </mesh>
            <mesh position={[0, h + 0.7, 0]} castShadow>
              <boxGeometry args={[w * 0.8, 0.4, w * 0.8]} />
              <meshStandardMaterial color="#e8eef2" />
            </mesh>
            <GiantEntrance i={i} w={w} />
            {i === 0 && (
              <mesh position={[0, h + 2.2, 0]}>
                <cylinderGeometry args={[0.06, 0.08, 2.6, 4]} />
                <meshStandardMaterial color="#d0d6da" emissive="#ff7a5c" emissiveIntensity={0.4} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function InventorsForest() {
  const s = STOP_BY_ID.forest;
  const y = useGround(s.lx, s.lz);
  const blades = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.z += dt * 0.8;
  });
  return (
    <group position={[s.lx, y - 0.15, s.lz]} rotation-y={faceRoad(s)}>
      {/* workshop cottage */}
      <mesh position={[0, 1.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 3.8, 4.6]} />
        <meshStandardMaterial color="#e4cfa6" />
      </mesh>
      {/* gable roof: a 3-sided prism, apex up, ridge along the cottage's width */}
      <mesh position={[0, 5.25, 0]} rotation={[-Math.PI / 2, Math.PI / 2, 0, "YXZ"]} castShadow>
        <cylinderGeometry args={[2.9, 2.9, 6.6, 3]} />
        <meshStandardMaterial color="#5f8c4a" />
      </mesh>
      <mesh position={[0, 1.4, 2.32]}>
        <boxGeometry args={[1.2, 2.2, 0.06]} />
        <meshStandardMaterial color="#5c3820" />
      </mesh>
      {[-1.9, 1.9].map((x) => (
        <mesh key={x} position={[x, 2.1, 2.32]}>
          <boxGeometry args={[1, 1, 0.05]} />
          <meshStandardMaterial color="#bfefff" emissive="#7fd8ff" emissiveIntensity={0.9} />
        </mesh>
      ))}
      {/* windmill */}
      <group position={[5.6, 0, -1.5]}>
        <mesh position={[0, 3.6, 0]} castShadow>
          <cylinderGeometry args={[1.0, 1.7, 7.2, 8]} />
          <meshStandardMaterial color="#d9c09a" />
        </mesh>
        <mesh position={[0, 7.7, 0]} castShadow>
          <coneGeometry args={[1.5, 1.6, 8]} />
          <meshStandardMaterial color={ROOF} />
        </mesh>
        <group ref={blades} position={[0, 6.6, 1.25]} userData={{ keep: true }}>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} rotation-z={(k * Math.PI) / 2} position={[0, 0, 0]}>
              <boxGeometry args={[0.55, 6.4, 0.08]} />
              <meshStandardMaterial color="#f3e6cf" />
            </mesh>
          ))}
          <mesh rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.3, 0.3, 0.4, 8]} />
            <meshStandardMaterial color="#5c3820" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

const VENOM_VERT = /* glsl */ `
uniform float uTime;
varying vec3 vN;
varying vec3 vW;
varying float vWave;
void main() {
  vec3 p = position;
  // slow, living symbiote waves rolling over the surface
  float w = sin(p.x * 3.1 + uTime * 1.6) * 0.16 + sin(p.y * 4.3 - uTime * 2.1) * 0.12 + sin(p.z * 3.7 + uTime * 1.3) * 0.14;
  p += normal * w;
  vWave = w;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const VENOM_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vN;
varying vec3 vW;
varying float vWave;
void main() {
  vec3 v = normalize(cameraPosition - vW);
  float fres = pow(1.0 - abs(dot(normalize(vN), v)), 2.2);
  vec3 black = vec3(0.012, 0.016, 0.04);
  vec3 navy = vec3(0.03, 0.08, 0.26);
  vec3 purple = vec3(0.42, 0.17, 0.85);
  vec3 sky = vec3(0.37, 0.85, 1.0);
  vec3 c = mix(black, navy, smoothstep(-0.2, 0.25, vWave));
  float streak = smoothstep(0.82, 1.0, sin(vW.y * 6.0 - uTime * 2.4 + vW.x * 2.0) * 0.5 + 0.5);
  c = mix(c, purple, streak * 0.7);
  c += sky * fres * 1.3 + purple * pow(fres, 4.0) * 0.8;
  // glossy highlight
  c += vec3(1.0) * pow(max(0.0, dot(reflect(-v, normalize(vN)), normalize(vec3(0.4, 1.0, 0.3)))), 28.0) * 0.8;
  gl_FragColor = vec4(c, 1.0);
}`;
const FLOOR_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 q = vUv - 0.5;
  float r = length(q) * 2.0;
  float a = atan(q.y, q.x);
  // venom ripples flowing out from the core, with a slow swirl
  float wave = sin(r * 26.0 - uTime * 2.2 + sin(a * 3.0 + uTime * 0.6) * 1.4);
  float crest = smoothstep(0.86, 1.0, wave);
  vec3 base = mix(vec3(0.02, 0.025, 0.06), vec3(0.04, 0.07, 0.2), smoothstep(0.0, 1.0, r));
  vec3 glow = mix(vec3(0.37, 0.85, 1.0), vec3(0.5, 0.25, 0.95), smoothstep(0.2, 0.9, r));
  vec3 c = base + glow * crest * (1.0 - r * 0.55);
  // circuit spokes
  float spoke = smoothstep(0.985, 1.0, cos(a * 12.0)) * step(0.3, r);
  c += vec3(0.37, 0.85, 1.0) * spoke * 0.45;
  gl_FragColor = vec4(c, 1.0);
}`;
const FLOOR_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/**
 * Forbidden Tricks Square, cyberpunk edition: an obsidian plinth with a
 * flowing venom floor, a floating tech cube (glowing edges, glossy black
 * shell, purple core, orbiting cubelets) rising out of a living symbiote pool,
 * and holo screens on sleek posts — sky blue, black, dark blue and purple.
 */
export function SkillsGrove() {
  const s = STOP_BY_ID.skills;
  const y = useGround(s.lx, s.lz);
  const cube = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const orbit = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const venom = useMemo(() => new THREE.ShaderMaterial({ vertexShader: VENOM_VERT, fragmentShader: VENOM_FRAG, uniforms: { uTime: { value: 0 } } }), []);
  const floor = useMemo(() => new THREE.ShaderMaterial({ vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG, uniforms: { uTime: { value: 0 } } }), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(2.3, 2.3, 2.3)), []);
  const edgeMat = useMemo(() => new THREE.LineBasicMaterial({ color: "#7fe3ff", toneMapped: false }), []);
  const shell = useMemo(() => new THREE.MeshStandardMaterial({ color: "#060914", metalness: 0.85, roughness: 0.18, emissive: "#0b1a4a", emissiveIntensity: 0.35, transparent: true, opacity: 0.88 }), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    venom.uniforms.uTime.value = t;
    floor.uniforms.uTime.value = t;
    if (cube.current) {
      cube.current.rotation.set(t * 0.35, t * 0.5, t * 0.2);
      cube.current.position.y = 3.6 + Math.sin(t * 1.3) * 0.22;
    }
    if (core.current) {
      core.current.rotation.set(-t * 0.9, -t * 0.7, 0);
      const k = 1 + Math.sin(t * 3) * 0.08;
      core.current.scale.setScalar(k);
    }
    if (orbit.current) orbit.current.rotation.y = -t * 0.8;
    if (halo.current) halo.current.rotation.z = t * 0.4;
  });
  return (
    <group position={[s.lx, y, s.lz]}>
      {/* obsidian plinth with glowing rims */}
      <mesh position={[0, 0.25, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[5.6, 6, 0.7, 32]} />
        <meshStandardMaterial color="#0a0e1c" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.58, 0]}>
        <torusGeometry args={[5.62, 0.05, 6, 64]} />
        <meshStandardMaterial color="#5fd8ff" emissive="#5fd8ff" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <torusGeometry args={[6.02, 0.05, 6, 64]} />
        <meshStandardMaterial color="#8f5bff" emissive="#8f5bff" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {/* flowing venom floor */}
      <mesh position={[0, 0.605, 0]} rotation-x={-Math.PI / 2} material={floor} userData={{ keep: true }}>
        <circleGeometry args={[5.5, 64]} />
      </mesh>
      {/* living symbiote pool the cube rises from */}
      <mesh position={[0, 1.0, 0]} scale={[1.9, 0.7, 1.9]} material={venom} userData={{ keep: true }}>
        <icosahedronGeometry args={[1, 5]} />
      </mesh>
      {/* the tech cube */}
      <group ref={cube} position={[0, 3.6, 0]} userData={{ keep: true }}>
        <mesh material={shell} castShadow>
          <boxGeometry args={[2.2, 2.2, 2.2]} />
        </mesh>
        <lineSegments geometry={edges} material={edgeMat} />
        <mesh ref={core}>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshStandardMaterial color="#9a6bff" emissive="#7a3bff" emissiveIntensity={2.4} toneMapped={false} />
        </mesh>
        {/* circuit traces on each face */}
        {[0, 1, 2, 3, 4, 5].map((f) => {
          const rot: [number, number, number] = [[0, 0, 0], [0, Math.PI / 2, 0], [0, Math.PI, 0], [0, -Math.PI / 2, 0], [Math.PI / 2, 0, 0], [-Math.PI / 2, 0, 0]][f] as [number, number, number];
          return (
            <group key={f} rotation={rot}>
              <mesh position={[0.35, -0.2, 1.105]}>
                <boxGeometry args={[0.9, 0.04, 0.01]} />
                <meshBasicMaterial color={f % 2 ? "#5fd8ff" : "#a77bff"} toneMapped={false} />
              </mesh>
              <mesh position={[-0.1, 0.25, 1.105]}>
                <boxGeometry args={[0.04, 0.9, 0.01]} />
                <meshBasicMaterial color={f % 2 ? "#a77bff" : "#5fd8ff"} toneMapped={false} />
              </mesh>
            </group>
          );
        })}
      </group>
      <group ref={orbit} position={[0, 3.6, 0]} userData={{ keep: true }}>
        {[0, 1, 2, 3, 4, 5].map((k) => {
          const a = (k / 6) * Math.PI * 2;
          return (
            <mesh key={k} position={[Math.cos(a) * 2.4, Math.sin(a * 2) * 0.5, Math.sin(a) * 2.4]} rotation={[a, a, 0]}>
              <boxGeometry args={[0.28, 0.28, 0.28]} />
              <meshStandardMaterial color={k % 2 ? "#0b1a4a" : "#120a2a"} emissive={k % 2 ? "#5fd8ff" : "#8f5bff"} emissiveIntensity={1.4} metalness={0.6} roughness={0.25} />
            </mesh>
          );
        })}
      </group>
      <mesh ref={halo} position={[0, 3.6, 0]} rotation-x={Math.PI / 2.4} userData={{ keep: true }}>
        <torusGeometry args={[2.9, 0.035, 6, 64]} />
        <meshStandardMaterial color="#5fd8ff" emissive="#5fd8ff" emissiveIntensity={1.8} toneMapped={false} />
      </mesh>
      {/* holo screens on sleek black posts */}
      {[0, 1, 2, 3].map((k) => {
        const a = (k / 4) * Math.PI * 2 + 0.4;
        const c = k % 2 ? "#8f5bff" : "#5fd8ff";
        return (
          <group key={k} position={[Math.cos(a) * 4.6, 2.3, Math.sin(a) * 4.6]} rotation-y={-a + Math.PI / 2}>
            <mesh>
              <boxGeometry args={[1.9, 1.25, 0.06]} />
              <meshStandardMaterial color="#05070f" emissive="#0b1a4a" emissiveIntensity={0.8} metalness={0.5} roughness={0.2} transparent opacity={0.9} />
            </mesh>
            {[
              [0, 0.64, 1.95, 0.04],
              [0, -0.64, 1.95, 0.04],
              [0.96, 0, 0.04, 1.3],
              [-0.96, 0, 0.04, 1.3],
            ].map(([x, yy, w, h], i) => (
              <mesh key={i} position={[x, yy, 0.04]}>
                <boxGeometry args={[w, h, 0.02]} />
                <meshBasicMaterial color={c} toneMapped={false} />
              </mesh>
            ))}
            {[0.3, 0.05, -0.2].map((yy, i) => (
              <mesh key={`l${i}`} position={[-0.2 + i * 0.1, yy, 0.04]}>
                <boxGeometry args={[1.1 - i * 0.25, 0.06, 0.01]} />
                <meshBasicMaterial color={i === 1 ? "#a77bff" : "#5fd8ff"} transparent opacity={0.75} toneMapped={false} />
              </mesh>
            ))}
            <mesh position={[0, -1.25, 0]}>
              <cylinderGeometry args={[0.06, 0.09, 1.3, 8]} />
              <meshStandardMaterial color="#0a0e1c" metalness={0.7} roughness={0.25} />
            </mesh>
            <mesh position={[0, -1.25, 0.07]}>
              <boxGeometry args={[0.025, 1.2, 0.02]} />
              <meshBasicMaterial color={c} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      <Sparkles position={[0, 3, 0]} count={36} scale={[8, 4, 8]} size={3} speed={0.4} color="#8fd8ff" />
      <Sparkles position={[0, 2, 0]} count={20} scale={[7, 3, 7]} size={3} speed={0.3} color="#a77bff" />
    </group>
  );
}

export function AchievementPeak() {
  const s = STOP_BY_ID.peak;
  const y = useGround(s.lx, s.lz);
  return (
    <group position={[s.lx, y, s.lz]}>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[2.2, 2.6, 1.6, 8]} />
        <meshStandardMaterial color={STONE} />
      </mesh>
      <mesh position={[0, 2.0, 0]} castShadow>
        <cylinderGeometry args={[1.4, 1.7, 0.9, 8]} />
        <meshStandardMaterial color={STONE_LIGHT} />
      </mesh>
      {/* gold trim round the plinth */}
      <mesh position={[0, 2.44, 0]}>
        <cylinderGeometry args={[1.42, 1.42, 0.06, 8]} />
        <meshStandardMaterial color="#e8b13a" metalness={0.7} roughness={0.3} />
      </mesh>
      <Trophy />
    </group>
  );
}

const BEAM_VERT = /* glsl */ `
varying float vAlong;
varying float vRim;
void main() {
  vAlong = uv.y;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vec3 v = normalize(cameraPosition - wp.xyz);
  vRim = abs(dot(n, v));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
varying float vAlong;
varying float vRim;
void main() {
  // brightest at the lamp, fading softly out to the sea; soft edges, bright core
  float a = pow(vAlong, 1.6) * pow(vRim, 1.8) * uStrength;
  gl_FragColor = vec4(uColor * a, a);
}`;

/**
 * Two sweeping beams angled down from the lantern room so they land on the
 * sea, each with a soft pool of light where it meets the water; brighter at
 * dusk and night, faint by day.
 */
function LighthouseBeam({ lampY, x, z }: { lampY: number; x: number; z: number }) {
  const spin = useRef<THREE.Group>(null);
  // the open-sea side: the middle of the widest run of directions whose beam lands on water
  const { seaYaw, arc } = useMemo(() => {
    const w = getWorld();
    const N = 72;
    const wet = Array.from({ length: N }, (_, i) => {
      const a = (i / N) * Math.PI * 2;
      let ok = true;
      for (const d of [44, 56, 68]) if (w.depthAt(x + Math.sin(a) * d, z + Math.cos(a) * d) < 0.3) ok = false;
      return ok;
    });
    let best = { start: 0, len: 0 };
    for (let i = 0; i < N; i++) {
      if (!wet[i] || wet[(i - 1 + N) % N]) continue;
      let len = 0;
      while (len < N && wet[(i + len) % N]) len++;
      if (len > best.len) best = { start: i, len };
    }
    if (best.len === 0) return { seaYaw: Math.atan2(x, z), arc: 0.4 };
    // half the sweep: 90° each way, narrower if the open water is narrower
    return { seaYaw: ((best.start + (best.len - 1) / 2) / N) * Math.PI * 2, arc: Math.min(Math.PI / 2, (best.len / N) * Math.PI - 0.12) };
  }, [x, z]);
  const LEN = 62;
  // aim each beam down so it reaches sea level at the far end
  const pitch = Math.asin(Math.min(0.95, Math.max(0.05, (lampY - 0.1) / LEN)));
  const reach = Math.cos(pitch) * LEN;
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BEAM_VERT,
        fragmentShader: BEAM_FRAG,
        uniforms: { uColor: { value: new THREE.Color("#fff1c2") }, uStrength: { value: 0.3 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const swept = useRef(0);
  const pool = useMemo(() => new THREE.MeshBasicMaterial({ color: "#fff1c2", transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  useFrame((_, dt) => {
    // sweep back and forth across a 180° arc over the sea, never inland
    swept.current += dt;
    if (spin.current) spin.current.rotation.y = seaYaw + Math.sin(swept.current * 0.42) * arc;
    const k = Math.min(1, daylight.night + Math.max(0, daylight.lanterns - 0.6));
    mat.uniforms.uStrength.value = 0.22 + k * 0.6;
    pool.opacity = 0.08 + k * 0.32;
  });
  return (
    <group ref={spin} position={[0, 12.2, 0]} userData={{ keep: true }}>
      {[0].map((yaw) => (
        <group key={yaw} rotation-y={yaw}>
          <group rotation-x={pitch}>
            {/* cone apex at the lamp, opening out toward the sea */}
            <mesh position={[0, 0, LEN / 2]} rotation-x={Math.PI / 2} material={mat}>
              <coneGeometry args={[5, LEN, 24, 1, true]} />
            </mesh>
          </group>
          {/* light pool on the water where the beam lands */}
          <mesh position={[0, -(lampY - 0.05), reach]} rotation-x={-Math.PI / 2} scale={[5, 11, 1]} material={pool}>
            <circleGeometry args={[1, 28]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function LighthouseCove() {
  const s = STOP_BY_ID.cove;
  const y = useGround(s.lx, s.lz);
  return (
    <group position={[s.lx, y - 0.2, s.lz]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[2.4, 2.8, 1, 10]} />
        <meshStandardMaterial color={STONE} />
      </mesh>
      {[0, 1, 2, 3, 4].map((k) => (
        <mesh key={k} position={[0, 1 + k * 2 + 1, 0]} castShadow>
          <cylinderGeometry args={[1.75 - (k + 1) * 0.1, 1.75 - k * 0.1, 2, 12]} />
          <meshStandardMaterial color={k % 2 ? "#d9473a" : "#fbf4e8"} />
        </mesh>
      ))}
      <mesh position={[0, 11.2, 0]}>
        <cylinderGeometry args={[1.6, 1.6, 0.3, 12]} />
        <meshStandardMaterial color="#3b2a1e" />
      </mesh>
      <mesh position={[0, 12.2, 0]}>
        <cylinderGeometry args={[1.0, 1.0, 1.7, 10]} />
        <meshStandardMaterial color="#fff2c4" emissive="#ffcc66" emissiveIntensity={2.2} />
      </mesh>
      <mesh position={[0, 13.6, 0]} castShadow>
        <coneGeometry args={[1.4, 1.3, 10]} />
        <meshStandardMaterial color="#d9473a" />
      </mesh>
      <LighthouseBeam lampY={y - 0.2 + 12.2} x={s.lx} z={s.lz} />
      {/* keeper's cottage */}
      <group position={[-5.2, 0, -2.5]} rotation-y={0.5}>
        <mesh position={[0, 1.6, 0]} castShadow>
          <boxGeometry args={[4.2, 3.2, 3.6]} />
          <meshStandardMaterial color="#f1e2c4" />
        </mesh>
        <mesh position={[0, 4.33, 0]} rotation={[-Math.PI / 2, Math.PI / 2, 0, "YXZ"]} castShadow>
          <cylinderGeometry args={[2.25, 2.25, 4.6, 3]} />
          <meshStandardMaterial color="#9a4b35" />
        </mesh>
        <mesh position={[0, 1.8, 1.82]} material={windowMaterial}>
          <boxGeometry args={[0.9, 0.9, 0.05]} />
        </mesh>
      </group>
    </group>
  );
}

export function Landmarks() {
  return (
    <group>
      {/* each landmark bakes separately so off-screen ones still get culled */}
      <StaticBatch><ForgottenGate /></StaticBatch>
      <StaticBatch><HotspotSigns /></StaticBatch>
      <StaticBatch><AcademyKingdom /></StaticBatch>
      <StaticBatch><CityOfGiants /></StaticBatch>
      <StaticBatch><InventorsForest /></StaticBatch>
      <StaticBatch><SkillsGrove /></StaticBatch>
      <StaticBatch><AchievementPeak /></StaticBatch>
      <StaticBatch><LighthouseCove /></StaticBatch>
    </group>
  );
}

