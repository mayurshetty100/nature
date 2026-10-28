import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { player, rides, useGame } from "@/game/store";
import { getWorld } from "@/game/world";
import { daylight } from "@/game/dayCycle";
import { RIDES, type VehicleId } from "@/game/vehicles";
import { nitroFlames, type Wheel } from "./vehicleModel";
import { buildRide } from "./supercarModel";
import { readMoveAxes } from "@/game/input";
import { buildYacht, makePoolMaterial } from "./yachtModel";

const euler = new THREE.Euler();

/** Pose a ride: follows the explorer while ridden, otherwise sits where it was parked. */
function usePose(which: "land" | "yacht", id: string, ref: React.RefObject<THREE.Group | null>, pop: React.RefObject<THREE.Group | null>) {
  const world = getWorld();
  const placedAt = useRef({ x: NaN, z: NaN, t: -10 });
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const st = useGame.getState();
    const v = rides[which];
    const ridden = st.riding === id;
    g.visible = v.placed && !st.inside;
    if (!g.visible) return;
    const t = clock.elapsedTime;
    if (ridden) {
      euler.set(player.pitch, player.facing, player.roll, "YXZ");
      g.position.copy(player.position);
      g.rotation.copy(euler);
    } else {
      let y = v.y;
      if (which === "yacht") {
        y = Math.sin(t * 1.1) * 0.08;
        g.rotation.set(Math.sin(t * 0.8) * 0.02, v.yaw, Math.sin(t * 1.1) * 0.025, "YXZ");
      } else {
        const s = world.waterSurface(v.x, v.z);
        const gr = world.groundAt(v.x, v.z);
        y = s !== null && s - gr > 1.1 ? s - 0.45 + Math.sin(t * 1.4) * 0.05 : Math.max(gr, Math.min(v.y, gr + 1.4));
        g.rotation.set(0, v.yaw, 0);
      }
      g.position.set(v.x, y, v.z);
    }
    // a little pop when the vehicle is called over
    if (v.x !== placedAt.current.x || v.z !== placedAt.current.z) {
      if (!ridden && Math.hypot(v.x - placedAt.current.x, v.z - placedAt.current.z) > 4) placedAt.current.t = t;
      placedAt.current.x = v.x;
      placedAt.current.z = v.z;
    }
    if (pop.current) {
      const k = Math.min(1, (t - placedAt.current.t) / 0.45);
      const s = k < 1 ? 1 - Math.pow(1 - k, 3) * 0.6 + Math.sin(k * Math.PI) * 0.12 : 1;
      pop.current.scale.setScalar(s);
    }
  });
}

/** Wheels roll with the speed and front wheels steer into turns. */
function useWheels(id: string, wheels: Wheel[], radius: number) {
  const spin = useRef(0);
  const steer = useRef(0);
  const lastYaw = useRef(0);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const ridden = useGame.getState().riding === id;
    // tyres turn with the road speed, plus hard wheelspin when they lose grip on a climb
    spin.current += ((ridden ? player.drive + player.slip * 26 * (Math.sign(player.drive) || 1) : 0) * dt) / radius;
    let dy = player.facing - lastYaw.current;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    lastYaw.current = player.facing;
    const want = ridden ? THREE.MathUtils.clamp((dy / Math.max(dt, 1e-3)) * 0.4 * Math.sign(player.drive || 1), -0.5, 0.5) : 0;
    steer.current += (want - steer.current) * (1 - Math.exp(-8 * dt));
    for (const w of wheels) w.node.rotation.set(spin.current, w.front ? steer.current : 0, 0, "YXZ");
  });
}

/** Nitro: flames roar out of the exhausts while you boost (Shift / full joystick) at speed. */
function useNitro(id: string, model: THREE.Object3D) {
  const k = useRef(0);
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const ridden = useGame.getState().riding === id;
    const want = ridden && player.drive > 4 && readMoveAxes().run ? 1 : 0;
    k.current += (want - k.current) * (1 - Math.exp(-(want ? 10 : 6) * dt));
    nitroFlames(model, k.current, clock.elapsedTime);
  });
}

/** Foam + spray around a vehicle moving through water. */
function Wake({ id, width, back }: { id: string; width: number; back: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const world = getWorld();
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const st = useGame.getState();
    const ridden = st.riding === id;
    const p = player.position;
    const s = ridden ? world.waterSurface(p.x, p.z) : null;
    const speed = Math.abs(player.drive);
    m.visible = ridden && s !== null && speed > 1.2;
    if (!m.visible || s === null) return;
    m.position.set(p.x - Math.sin(player.facing) * back, s + 0.04, p.z - Math.cos(player.facing) * back);
    m.rotation.set(-Math.PI / 2, 0, player.facing + Math.PI);
    const k = Math.min(1, speed / 14);
    m.scale.set(width * (0.6 + k * 0.6), 2 + k * 9, 1);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.25 + k * 0.35 + Math.sin(clock.elapsedTime * 9) * 0.04;
  });
  const geo = useMemo(() => {
    // a V of foam that widens behind the hull
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, -1, -1, 0, 1, -1, 0, -0.35, -1, 0, 0.35, -1, 0, 0, -0.6, 0], 3));
    g.setIndex([0, 1, 3, 0, 4, 2, 0, 3, 5, 0, 5, 4]);
    g.translate(0, 0, 0);
    return g;
  }, []);
  return (
    <mesh ref={ref} geometry={geo} visible={false} frustumCulled={false}>
      <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/**
 * The one headlamp in the world: it rides with whatever you're driving. Kept
 * permanently mounted (never hidden) because adding or removing a light makes
 * every material rebuild its shader — the classic "stutter when you hop in".
 */
export function RideLamp() {
  const l = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const lamp = l.current;
    if (!lamp) return;
    const riding = useGame.getState().riding;
    if (!riding) {
      lamp.intensity = 0;
      return;
    }
    const ahead = riding === "yacht" ? 6 : 3;
    lamp.position.set(player.position.x + Math.sin(player.facing) * ahead, player.position.y + (riding === "yacht" ? 2 : 1), player.position.z + Math.cos(player.facing) * ahead);
    lamp.intensity = 2 + daylight.night * 12;
  });
  return <pointLight ref={l} color="#fff0c8" intensity={0} distance={16} decay={2} />;
}

function Ride({ id }: { id: VehicleId }) {
  const def = RIDES[id];
  const { model, wheels, roll } = useMemo(() => buildRide(id, def), [id, def]);
  const ref = useRef<THREE.Group>(null);
  const pop = useRef<THREE.Group>(null);
  usePose("land", id, ref, pop);
  useWheels(id, wheels, roll);
  useNitro(id, model);
  return (
    <>
      <group ref={ref} visible={false}>
        <group ref={pop}>
          <primitive object={model} />
        </group>
      </group>
      <Wake id={id} width={def.kind === "bike" ? 1.2 : def.radius * 1.6} back={def.kind === "bike" ? 1.2 : def.length * 0.5} />
    </>
  );
}

function Yacht() {
  const y = useMemo(() => buildYacht(), []);
  const mats = useMemo(
    () => ({
      solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05 }),
      glass: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.3, clearcoat: 1, transparent: true, opacity: 0.82 }),
      glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      water: makePoolMaterial(),
    }),
    [],
  );
  const ref = useRef<THREE.Group>(null);
  const pop = useRef<THREE.Group>(null);
  usePose("yacht", "yacht", ref, pop);
  return (
    <>
      <group ref={ref}>
        <group ref={pop}>
          <mesh geometry={y.solid} material={mats.solid} castShadow receiveShadow />
          <mesh geometry={y.glass} material={mats.glass} />
          <mesh geometry={y.glow} material={mats.glow} />
          <mesh geometry={y.water} material={mats.water} />
        </group>
      </group>
      <Wake id="yacht" width={4.6} back={6.5} />
    </>
  );
}

/** Soft ring under the ride in reach. */
function ReachRing() {
  const ring = useRef<THREE.Mesh>(null);
  const world = getWorld();
  useFrame(({ clock }) => {
    const r = ring.current;
    if (!r) return;
    const st = useGame.getState();
    const id = st.nearVehicle;
    const v = id === "yacht" ? rides.yacht : rides.land;
    r.visible = !!id && !st.riding && v.placed && (id === "yacht" || Math.hypot(v.x - player.position.x, v.z - player.position.z) < 7);
    if (!r.visible || !id) return;
    const s = world.waterSurface(v.x, v.z);
    r.position.set(v.x, Math.max(world.groundAt(v.x, v.z), s ?? -99) + 0.08, v.z);
    const size = RIDES[id === "yacht" ? "yacht" : st.vehicleId].radius * 1.25;
    r.scale.setScalar(size * (1 + Math.sin(clock.elapsedTime * 4) * 0.06));
  });
  return (
    <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
      <ringGeometry args={[1, 1.12, 48]} />
      <meshBasicMaterial color="#fffaf0" transparent opacity={0.6} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

/** The vehicle you picked (called to your side with F) and the harbor yacht. */
export function Vehicles() {
  const vehicleId = useGame((s) => s.vehicleId);
  return (
    <group>
      <Ride key={vehicleId} id={vehicleId} />
      <Yacht />
      <ReachRing />
    </group>
  );
}

