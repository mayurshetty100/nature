import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { player, useGame } from "@/game/store";
import { companionGround } from "@/game/ground";
import { dampAngle } from "@/game/math";
import { PETS } from "@/game/characters";
import { PET_MOVE_EVERY, PET_MOVE_SECS, petMove } from "@/game/moves";
import { addCreature, nuzzle, reaction, type Creature } from "@/game/creatures";

const WHITE = "#f4f7fb";
const BLUE = "#3f7cff";
const FACE = "#16223f";
const EYE = "#8fe9ff";

const BYTE_MOVE = PETS.find((p) => p.id === "byte")?.move?.kind ?? "orbit";
const BYTE_SECS = PET_MOVE_SECS[BYTE_MOVE];

/** Byte — the little robot-cat guide who follows the explorer. */
export function Companion() {
  const root = useRef<THREE.Group>(null);
  const state = useRef({ x: 0, z: 0, y: 0, yaw: 0, init: false, hop: 0, lastHint: "", moveAt: -100, nextMove: 12, lastEmote: 0 });
  const me = useMemo<Creature>(() => ({ name: "Byte", x: 0, z: 0, y: 0, r: 0.5, height: 1, voice: "coo", petAt: 0, own: true }), []);
  useEffect(() => addCreature(me), [me]);

  useFrame(({ clock, camera }, raw) => {
    const dt = Math.min(raw, 0.05);
    const t = clock.elapsedTime;
    const s = state.current;
    const p = player.position;
    // follow slot: beside and slightly behind the explorer
    const f = player.facing;
    const sx = p.x + Math.cos(f) * 1.3 - Math.sin(f) * 1.0;
    const sz = p.z - Math.sin(f) * 1.3 - Math.cos(f) * 1.0;
    if (!s.init || Math.hypot(sx - s.x, sz - s.z) > 25) {
      s.x = sx;
      s.z = sz;
      s.init = true;
    }
    const petK = reaction(me, performance.now());
    const pampered = petK >= 0;
    const lean = nuzzle(petK);
    const k = pampered ? 0 : 1 - Math.exp(-3.2 * dt);
    const px = s.x;
    const pz = s.z;
    s.x += (sx - s.x) * k;
    s.z += (sz - s.z) * k;
    const v = Math.hypot(s.x - px, s.z - pz) / Math.max(dt, 1e-4);

    const hint = useGame.getState().hint?.key ?? "";
    if (hint && hint !== s.lastHint) s.hop = 1;
    s.lastHint = hint;
    s.hop = Math.max(0, s.hop - dt * 1.6);
    const hop = Math.sin((1 - s.hop) * Math.PI) * (s.hop > 0 ? 0.6 : 0);

    const gy = companionGround(s.x, s.z);
    s.y += (gy - s.y) * (1 - Math.exp(-10 * dt));
    const bob = Math.sin(t * 3.2) * 0.07 + (v > 0.5 ? Math.abs(Math.sin(t * 11)) * 0.12 : 0);

    const target = pampered ? Math.atan2(p.x - s.x, p.z - s.z) : v > 0.6 ? Math.atan2(s.x - px, s.z - pz) : Math.atan2(camera.position.x - s.x, camera.position.z - s.z);
    s.yaw = dampAngle(s.yaw, target, 6 * dt);

    me.x = s.x;
    me.z = s.z;
    me.y = s.y;
    // signature stunt: now and then, and whenever you pull your own move
    const gs = useGame.getState();
    if (gs.emoteAt && gs.emoteAt !== s.lastEmote) {
      s.lastEmote = gs.emoteAt;
      s.moveAt = t + 0.3;
    }
    if (t > s.nextMove && v < 0.6 && !pampered && t - s.moveAt > BYTE_SECS) {
      s.moveAt = t;
      s.nextMove = t + BYTE_SECS + PET_MOVE_EVERY.min + Math.random() * PET_MOVE_EVERY.range;
    }
    const m = petMove(BYTE_MOVE, (t - s.moveAt) / BYTE_SECS);
    if (root.current) {
      root.current.position.set(s.x, s.y + 0.38 + bob + hop + m.y, s.z);
      // pampered: Byte bends toward your hand and sways into it
      root.current.rotation.set(lean * 0.3 + m.rx, s.yaw + m.ry, Math.sin(t * 2.1) * (0.05 + 0.07 * lean) + m.rz, "YXZ");
      root.current.visible = !useGame.getState().riding;
    }
  });

  return (
    <group ref={root} scale={0.95}>
      <ByteModel />
    </group>
  );
}

/** Byte's body with idle life (head tilt, tail wag, blinking) — used in the world and in previews. */
export function ByteModel() {
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Mesh>(null);
  const eyes = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (head.current) head.current.rotation.z = Math.sin(t * 1.3) * 0.12;
    if (tail.current) tail.current.rotation.y = Math.sin(t * 5) * 0.5;
    if (eyes.current) eyes.current.scale.y = t % 4.2 < 0.12 ? 0.15 : 1;
  });
  return (
    <group>
      {/* body */}
      <mesh castShadow position={[0, 0.15, 0]} scale={[0.42, 0.36, 0.46]}>
        <sphereGeometry args={[1, 20, 16]} />
        <meshStandardMaterial color={WHITE} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.12, 0.38]} scale={[0.2, 0.18, 0.1]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color={BLUE} roughness={0.4} />
      </mesh>
      {/* paws */}
      {[-1, 1].map((k) =>
        [-1, 1].map((j) => (
          <mesh key={`${k}${j}`} position={[k * 0.24, -0.16, j * 0.22]} scale={[0.12, 0.08, 0.14]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color={BLUE} roughness={0.4} />
          </mesh>
        )),
      )}
      {/* head */}
      <group ref={head} position={[0, 0.62, 0.08]}>
        <mesh castShadow scale={[0.46, 0.4, 0.42]}>
          <sphereGeometry args={[1, 22, 18]} />
          <meshStandardMaterial color={WHITE} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.02, 0.27]} scale={[0.34, 0.25, 0.18]}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshStandardMaterial color={FACE} roughness={0.2} metalness={0.2} />
        </mesh>
        <group ref={eyes} position={[0, 0.0, 0.43]}>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[k * 0.12, 0, 0]} scale={[0.055, 0.075, 0.02]}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color={EYE} emissive={EYE} emissiveIntensity={2} />
            </mesh>
          ))}
        </group>
        {[-1, 1].map((k) => (
          <group key={k} position={[k * 0.27, 0.34, 0]} rotation-z={-k * 0.35}>
            <mesh castShadow>
              <coneGeometry args={[0.13, 0.26, 4]} />
              <meshStandardMaterial color={BLUE} roughness={0.4} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.42, 0]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color={EYE} emissive={EYE} emissiveIntensity={2} />
        </mesh>
      </group>
      {/* tail */}
      <mesh ref={tail} position={[0, 0.25, -0.42]} rotation-x={-0.9}>
        <capsuleGeometry args={[0.05, 0.32, 4, 8]} />
        <meshStandardMaterial color={BLUE} roughness={0.4} />
      </mesh>
    </group>
  );
}
