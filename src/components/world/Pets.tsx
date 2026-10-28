import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { player, useGame } from "@/game/store";
import { PET_CLIPS, PETS, type Pet as PetDef } from "@/game/characters";
import { dampAngle } from "@/game/math";
import { measureHeight, stylizeModel } from "@/game/models";
import { dressPet, type PetRig } from "@/game/petModel";
import { MagicAura } from "./MagicAura";
import { companionGround } from "@/game/ground";
import { sound } from "@/game/audio";
import { PET_MOVE_EVERY, PET_MOVE_SECS, petMove } from "@/game/moves";
import { addCreature, nuzzle, reaction, type Creature } from "@/game/creatures";
import { Companion } from "./Companion";
import { DragonModel } from "./Dragon";

/** Renders whichever pet the visitor picked. */
export function Pet() {
  const petId = useGame((s) => s.petId);
  if (petId === "byte") return <Companion />;
  const pet = PETS.find((p) => p.id === petId);
  if (!pet || pet.id === "none") return null;
  if (pet.id === "dragon") return <PetFollower key={pet.id} pet={pet} />;
  if (!pet.url) return null;
  return <CubePet key={pet.id} pet={pet} url={pet.url} />;
}

/** A Kenney cube pet, dressed up with big eyes, blush and its accessory. */
function CubePet({ pet, url }: { pet: PetDef; url: string }) {
  const { scene, animations } = useGLTF(url);
  const inner = useRef<THREE.Group>(null);
  const { model, scale, rig } = useMemo(() => {
    const m = scene.clone(true);
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false;
      }
    });
    stylizeModel(m, url);
    const rig = dressPet(m, pet);
    return { model: m, scale: (pet.height ?? 0.8) / measureHeight(m, 1.4), rig };
  }, [scene, url, pet]);
  const { actions } = useAnimations(animations, inner);
  return (
    <PetFollower pet={pet} actions={actions} rig={rig}>
      <group ref={inner} scale={scale}>
        <primitive object={model} />
      </group>
    </PetFollower>
  );
}

type Actions = Record<string, THREE.AnimationAction | null>;

/** Floating hearts / sleepy Zs / a puff of flame above the pet. */
function useHeartGeometry() {
  return useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.12);
    s.bezierCurveTo(-0.02, -0.06, -0.16, -0.02, -0.16, 0.06);
    s.bezierCurveTo(-0.16, 0.16, -0.04, 0.17, 0, 0.09);
    s.bezierCurveTo(0.04, 0.17, 0.16, 0.16, 0.16, 0.06);
    s.bezierCurveTo(0.16, -0.02, 0.02, -0.06, 0, -0.12);
    const heart = new THREE.ShapeGeometry(s);
    const z = new THREE.Shape();
    z.moveTo(-0.1, 0.1);
    z.lineTo(0.1, 0.1);
    z.lineTo(-0.05, -0.07);
    z.lineTo(0.1, -0.07);
    z.lineTo(0.1, -0.1);
    z.lineTo(-0.1, -0.1);
    z.lineTo(0.05, 0.07);
    z.lineTo(-0.1, 0.07);
    z.closePath();
    return { heart, z: new THREE.ShapeGeometry(z) };
  }, []);
}

/** Shared follow logic; each pet's `behavior` gives it its own personality. */
function PetFollower({ pet, actions, rig, children }: { pet: PetDef; actions?: Actions; rig?: PetRig; children?: React.ReactNode }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const fx = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const clip = useRef("");
  const s = useRef({ x: 0, z: 0, y: 0, yaw: 0, init: false, idleFor: 0, trickAt: 0, orbit: 0, happyAt: -10, lastJump: 0, lastEmote: 0, blinkAt: 1, puffAt: 4, nearFor: 0, chirpAt: -10, moveAt: -100, nextMove: 10 });
  const b = pet.behavior;
  const { heart, z: zGeo } = useHeartGeometry();
  // your own companion can be pampered (E / the action button when close)
  const me = useMemo<Creature>(() => ({ name: pet.name, x: 0, z: 0, y: 0, r: 0.5, height: pet.height ?? 0.8, voice: "coo", petAt: 0, own: true }), [pet]);
  useEffect(() => addCreature(me), [me]);
  const lastPet = useRef(0);
  const aura = useRef(0);

  const play = (name: string, ts = 1, once = false) => {
    const a = actions?.[name];
    if (!a) return;
    if (clip.current !== name) {
      actions?.[clip.current]?.fadeOut(0.2);
      a.reset();
      a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      a.clampWhenFinished = false;
      a.fadeIn(0.2).play();
      clip.current = name;
    }
    a.timeScale = ts;
  };

  useFrame(({ camera, clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const st = s.current;
    const t = clock.elapsedTime;
    const p = player.position;
    const f = player.facing;
    const gs = useGame.getState();
    const riding = gs.riding;
    const playerIdle = player.speed < 0.35;
    st.idleFor = playerIdle ? st.idleFor + dt : 0;

    // reasons to be happy: you jump, you emote, or you stand close for a while
    if (player.jumpedAt !== st.lastJump) {
      st.lastJump = player.jumpedAt;
      st.happyAt = t + 0.15;
    }
    if (gs.emoteAt && gs.emoteAt !== st.lastEmote) {
      st.lastEmote = gs.emoteAt;
      st.happyAt = t;
      // join in: the pet pulls its own signature stunt when you pull yours
      if (pet.move) st.moveAt = t + 0.3;
    }
    // pampered: a big happy wiggle, then settle beside you
    if (me.petAt !== lastPet.current) {
      lastPet.current = me.petAt;
      st.happyAt = t;
      st.idleFor = 0;
    }
    const petK = reaction(me, performance.now());
    const pampered = petK >= 0;
    const lean = nuzzle(petK);
    const near = Math.hypot(p.x - st.x, p.z - st.z) < 2.6;
    st.nearFor = near && playerIdle ? st.nearFor + dt : 0;
    if (st.nearFor > 3 && t - st.happyAt > 6) st.happyAt = t;
    const happy = t - st.happyAt;
    if (happy >= 0 && happy < 0.05 && t - st.chirpAt > 1.5) {
      st.chirpAt = t;
      sound.chirp(pet.id);
    }
    const sleeping = st.idleFor > 24 && !b.fly && !pampered;

    let side = b.side;
    let back = b.back;
    if (b.circle && st.idleFor > 1.5 && !sleeping) {
      st.orbit += dt * 0.9;
      side = Math.cos(st.orbit) * 2.2;
      back = Math.sin(st.orbit) * 2.2;
    }
    const sx = p.x + Math.cos(f) * side - Math.sin(f) * back;
    const sz = p.z - Math.sin(f) * side - Math.cos(f) * back;
    if (!st.init || Math.hypot(sx - st.x, sz - st.z) > 25) {
      st.x = sx;
      st.z = sz;
      st.y = companionGround(sx, sz);
      st.init = true;
    }
    const k = 1 - Math.exp(-(riding ? 5 : b.follow) * dt);
    const px = st.x;
    const pz = st.z;
    if (!sleeping && !pampered) {
      st.x += (sx - st.x) * k;
      st.z += (sz - st.z) * k;
    }
    const v = Math.hypot(st.x - px, st.z - pz) / Math.max(dt, 1e-4);
    const moving = v > 0.6;

    const ground = companionGround(st.x, st.z);
    let wantY = ground;
    if (b.fly) {
      const sky = Math.max(ground + b.fly, p.y + 0.6);
      wantY = sky + Math.sin(t * 2.2) * 0.25;
    }
    st.y += (wantY - st.y) * (1 - Math.exp(-(b.fly ? 4 : 12) * dt));

    const target = pampered ? Math.atan2(p.x - st.x, p.z - st.z) : moving ? Math.atan2(st.x - px, st.z - pz) : Math.atan2(camera.position.x - st.x, camera.position.z - st.z);
    st.yaw = dampAngle(st.yaw, target, 6 * dt);

    let hopY = 0;
    let roll = 0;
    let pitch = 0;
    let squash = 1;
    if (moving && b.hop) hopY = Math.abs(Math.sin(t * 8)) * b.hop;
    if (moving && b.waddle) roll = Math.sin(t * 11) * b.waddle;
    const sliding = !!b.slide && v > 5;
    if (sliding) {
      pitch = 1.25;
      roll = 0;
      hopY = -0.15;
    }
    if (happy >= 0 && happy < 0.7 && !pampered) hopY += Math.sin((happy / 0.7) * Math.PI) * 0.55;
    if (pampered) {
      // bend lovingly toward your hand and sway into it
      pitch = lean * 0.35;
      roll = Math.sin(t * 2.4) * 0.12 * lean;
    }
    if (sleeping) {
      squash = 0.82 + Math.sin(t * 1.6) * 0.02;
      roll = 0.5;
    }
    me.x = st.x;
    me.z = st.z;
    me.y = st.y;
    // signature stunt now and then while you explore together
    const mv = pet.move;
    if (mv && t > st.nextMove && !moving && !sleeping && !pampered && !riding && t - st.moveAt > PET_MOVE_SECS[mv.kind]) {
      st.moveAt = t;
      st.nextMove = t + PET_MOVE_SECS[mv.kind] + PET_MOVE_EVERY.min + Math.random() * PET_MOVE_EVERY.range;
    }
    const stunt = mv ? petMove(mv.kind, (t - st.moveAt) / PET_MOVE_SECS[mv.kind]) : null;
    const stunting = !!stunt && t - st.moveAt >= 0 && t - st.moveAt < PET_MOVE_SECS[mv!.kind];
    if (root.current) {
      const fz = stunting ? stunt!.z : 0;
      root.current.position.set(st.x + Math.sin(st.yaw) * fz, st.y + hopY + (stunting ? stunt!.y : 0), st.z + Math.cos(st.yaw) * fz);
      root.current.rotation.y = st.yaw + (stunting ? stunt!.ry : happy >= 0 && happy < 0.7 && !moving && !pampered ? (happy / 0.7) * Math.PI * 2 : 0);
      root.current.visible = !riding;
    }
    if (body.current) {
      const r = body.current.rotation;
      if (stunting) {
        r.x = stunt!.rx;
        r.z = stunt!.rz;
        body.current.scale.y = stunt!.sy;
        // flip round the belly, not the feet
        const c = (pet.height ?? 0.8) * 0.5;
        body.current.position.set(c * Math.sin(r.z), c * (2 - Math.cos(r.x) - Math.cos(r.z)), -c * Math.sin(r.x));
      } else {
        body.current.position.set(0, 0, 0);
        // flips end a full turn round: unwrap so it doesn't spin back
        r.x = Math.atan2(Math.sin(r.x), Math.cos(r.x));
        r.z = Math.atan2(Math.sin(r.z), Math.cos(r.z));
        r.z += (roll - r.z) * 0.25;
        r.x += ((b.fly && !pampered ? (moving ? 0.25 : 0) : pitch) - r.x) * (b.fly ? 0.1 : 0.2);
        body.current.scale.y += (squash - body.current.scale.y) * 0.2;
      }
    }
    // tail wag (the whole body shimmies a little at the back)
    if (rig?.cape) rig.cape.rotation.x = -0.15 - Math.min(1.1, v * 0.16) + Math.sin(t * (6 + v)) * 0.08 * Math.min(1, v / 2 + 0.2);
    aura.current = happy >= 0 && happy < 2 ? 1 - happy / 2 : 0;
    if (rig?.wag && b.wag) rig.wag.rotation.y = (happy >= 0 && happy < 2) || (!moving && st.idleFor > 1 && !sleeping) ? Math.sin(t * 16) * 0.09 : 0;
    // blink, and keep the eyes shut while asleep
    if (rig) {
      if (t > st.blinkAt + 0.14) st.blinkAt = t + 2 + Math.random() * 3;
      const shut = sleeping || (t > st.blinkAt && t < st.blinkAt + 0.14);
      for (const l of rig.lids) l.visible = shut;
    }
    // floating hearts / Zs
    if (fx.current) {
      const show = sleeping || (happy >= 0 && happy < (pampered ? 3.2 : 1.6));
      fx.current.visible = show && !riding;
      if (show) {
        fx.current.position.set(st.x, st.y + (pet.height ?? 0.8) + 0.35, st.z);
        fx.current.quaternion.copy(camera.quaternion);
        fx.current.children.forEach((c, i) => {
          const m = c as THREE.Mesh;
          const ph = ((t * 0.7 + i * 0.33) % 1);
          m.geometry = sleeping ? zGeo : heart;
          (m.material as THREE.MeshBasicMaterial).color.set(sleeping ? "#dfe8ff" : "#ff6f91");
          m.position.set((i - 1) * 0.22 + Math.sin(t * 2 + i) * 0.05, ph * 0.8, 0);
          m.scale.setScalar((sleeping ? 0.8 : 1) * (0.6 + ph * 0.6));
          (m.material as THREE.MeshBasicMaterial).opacity = 1 - ph;
        });
      }
    }
    // Ember puffs a tiny flame now and then
    if (flame.current) {
      const puff = b.puff && t > st.puffAt && t < st.puffAt + 0.6;
      if (b.puff && t > st.puffAt + 0.6) st.puffAt = t + 6 + Math.random() * 6;
      flame.current.visible = !!puff;
      if (puff) {
        const kk = (t - st.puffAt) / 0.6;
        flame.current.scale.set(0.6 + kk, 0.6 + kk * 1.6, 0.6 + kk);
        (flame.current.material as THREE.MeshBasicMaterial).opacity = 1 - kk;
      }
    }

    if (!actions) return;
    if (sleeping) play(PET_CLIPS.idle, 0.25);
    else if (sliding) play(PET_CLIPS.idle, 0.5);
    else if (moving) play(v > 4.5 ? PET_CLIPS.run : PET_CLIPS.walk, THREE.MathUtils.clamp(v / (v > 4.5 ? 6 : 3), 0.7, 2.2));
    else if (happy >= 0 && happy < 1.2 && actions["dance"]) play("dance", 1.2);
    else if (b.idleTrick && st.idleFor > 3.5 && t - st.trickAt > 7) {
      st.trickAt = t;
      play(b.idleTrick, 1);
    } else if (!b.idleTrick || t - st.trickAt > 2.6) play(PET_CLIPS.idle, 1);
  });

  return (
    <>
      <group ref={root}>
        <group ref={body}>
          {children ?? (
            <group scale={pet.height ?? 0.9}>
              <DragonModel />
            </group>
          )}
          {pet.magic && <MagicAura colors={pet.magic.colors} radius={(pet.height ?? 0.8) * 0.6} height={(pet.height ?? 0.8) * 1.2} count={16} size={0.06} boost={aura} />}
          {b.puff && (
            <mesh ref={flame} position={[0, 0.45, 0.75]} rotation-x={Math.PI / 2} visible={false}>
              <coneGeometry args={[0.12, 0.45, 8]} />
              <meshBasicMaterial color="#ffa23a" transparent toneMapped={false} />
            </mesh>
          )}
        </group>
      </group>
      <group ref={fx} visible={false}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={heart}>
            <meshBasicMaterial color="#ff6f91" transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </>
  );
}

for (const p of PETS) if (p.url) useGLTF.preload(p.url);
