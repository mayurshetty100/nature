import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { player, useGame } from "@/game/store";
import { EMOTES, HERO_CLIPS, HEROES, SIT_POSE } from "@/game/characters";
import { animateGear, buildHero, moveGear, type HeroRig } from "@/game/heroModel";
import { RIDES } from "@/game/vehicles";
import { petHand } from "@/game/creatures";
import { heroMove } from "@/game/moves";
import { LOUNGER, sipWeight } from "@/game/chill";
import { swingAngle, swingOffset } from "@/game/swing";
import { carryWeight } from "@/game/trophy";
import { dapPose } from "@/game/dap";
import { aim, applyGait, applyMove, beginPose, endPose, gaitState, rigLimbs, SIDE, UP } from "@/game/heroPose";

const euler = new THREE.Euler();
/** Hip height the body flips around (metres). */
const HIP = 0.9;
const seat = new THREE.Vector3();

/** Damped spring on one angle (hair / cloth secondary motion). */
function spring(s: { a: number; v: number }, target: number, k: number, damp: number, dt: number) {
  s.v += ((target - s.a) * k - s.v * damp) * dt;
  s.a += s.v * dt;
  return s.a;
}

const dir = new THREE.Vector3();
const dir2 = new THREE.Vector3();
const qBody = new THREE.Quaternion();
const shoulder = new THREE.Vector3();
const hand = new THREE.Vector3();
const qInv = new THREE.Quaternion();
const loungePose = heroMove("jetpack", -1);

/** The visible explorer — a rigged, animated human with swaying hair, blinking eyes and an emote. */
export function HeroModel() {
  const heroId = useGame((s) => s.heroId);
  const hero = HEROES.find((h) => h.id === heroId) ?? HEROES[0];
  return <HeroBody key={hero.id} heroId={hero.id} />;
}

function HeroBody({ heroId }: { heroId: string }) {
  const hero = HEROES.find((h) => h.id === heroId) ?? HEROES[0];
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(hero.url);
  const { model, scale } = useMemo(() => buildHero(scene, hero.url, hero.look), [scene, hero]);
  const rig = (model.userData.rig ?? { hair: null, lids: [], tails: [] }) as HeroRig;
  const { actions } = useAnimations(animations, inner);
  const clip = useRef("");
  const aura = useRef<THREE.Mesh>(null);
  const ripple = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const blanket = useRef<THREE.Group>(null);
  const juice = useRef<THREE.Group>(null);
  const fade = useRef(1);
  const sway = useRef({ hx: { a: 0, v: 0 }, hz: { a: 0, v: 0 }, tx: { a: 0, v: 0 }, tz: { a: 0, v: 0 }, lastSpeed: 0, lastYaw: 0, blinkAt: 2, spin: 0 });
  const limbs = useMemo(() => rigLimbs(model), [model]);
  /** real hip height above the feet (metres) — the pivot for lying back on a lounger */
  const hipH = useMemo(() => {
    model.updateMatrixWorld(true);
    const h = model.getObjectByName("Hips");
    return h ? new THREE.Vector3().setFromMatrixPosition(h.matrixWorld).y * scale : 0.5;
  }, [model, scale]);
  const gait = useRef(gaitState());
  const mats = useMemo(() => {
    const out: THREE.Material[] = [];
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) out.push(...(Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
    });
    return out;
  }, [model]);

  useLayoutEffect(() => {
    const sit = actions[HERO_CLIPS.sit];
    if (sit) {
      sit.setLoop(THREE.LoopOnce, 1);
      sit.clampWhenFinished = true;
    }
  }, [actions]);

  const play = (name: string, ts: number) => {
    const a = actions[name];
    if (!a) return;
    if (clip.current !== name) {
      actions[clip.current]?.fadeOut(0.25);
      a.reset().fadeIn(0.25).play();
      clip.current = name;
    }
    a.timeScale = ts;
  };

  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const t = clock.elapsedTime;
    const st = useGame.getState();
    const g = group.current;
    const body = inner.current;
    if (!g || !body) return;
    const S = sway.current;
    const ride = st.riding ? RIDES[st.riding] : null;
    const now = performance.now();
    // walking off ends the pat
    if (player.petAt && player.speed > 0.8) player.petAt = 0;
    const petW = ride || player.pose !== "stand" || !player.petAt ? 0 : petHand(now - player.petAt);

    g.position.copy(player.position);
    g.rotation.set(0, player.facing, 0);
    g.visible = !ride || !!ride.seat;
    let sx = 1;
    let sy = 1;
    let tilt = 0;
    let lift = 0;
    let back = 0;
    let walkW = 0;
    let flip = 0;
    let runW = 0;
    const emote = EMOTES[hero.id];
    const emoting = !ride && st.emoteAt > 0 && now - st.emoteAt < emote.seconds * 1000 && player.grounded;
    const celebrating = now - st.celebrating < 9000 && player.speed < 0.4 && !ride;
    if (ride?.seat) {
      // ride along with the vehicle's pitch and roll
      euler.set(player.pitch, player.facing, player.roll, "YXZ");
      seat.set(ride.seat.x, ride.seat.y, ride.seat.z).applyEuler(euler);
      g.position.add(seat);
      g.rotation.copy(euler);
      if (ride.seat.pose === "sit") play(HERO_CLIPS.sit, 1.6);
      else play(HERO_CLIPS.idle, 1);
    } else if (player.pose === "sit" && player.chillAt && player.chillKind === "lounger") {
      // stretched out on a sun lounger: hips in the crease, back on the backrest, legs along the seat
      play(HERO_CLIPS.idle, 0.6);
      const B = LOUNGER.back;
      const fx = Math.sin(player.facing);
      const fz = Math.cos(player.facing);
      g.rotation.set(-Math.PI / 2 + B, player.facing, 0, "YXZ");
      // body axis (feet → head) and the point the hips rest on, a body's thickness above the cushions
      const dx = -fx * Math.cos(B);
      const dy = Math.sin(B);
      const dz = -fz * Math.cos(B);
      const off = 0.13;
      const hx = player.position.x + fx * Math.sin(B) * off;
      const hy = player.position.y + LOUNGER.seat + Math.cos(B) * off;
      const hz = player.position.z + fz * Math.sin(B) * off;
      g.position.set(hx - dx * hipH, hy - dy * hipH, hz - dz * hipH);
    } else if (player.pose === "sit") {
      play(HERO_CLIPS.sit, 1.6);
      g.position.y -= SIT_POSE.drop;
      if (player.chillAt && player.chillKind === "swing") {
        // riding the rope swing: carried along the pendulum, leaning into each swing
        const ang = swingAngle(now, player.chillAt);
        const o = swingOffset(ang);
        g.position.x += Math.sin(player.facing) * o.along;
        g.position.z += Math.cos(player.facing) * o.along;
        g.position.y += o.up;
        g.rotation.set(-ang * 0.8, player.facing, 0, "YXZ");
      }
      g.position.x -= Math.sin(player.facing) * SIT_POSE.back;
      g.position.z -= Math.cos(player.facing) * SIT_POSE.back;
    } else if (player.pose === "lie") {
      // on your back, head on the pillow, gently breathing
      play(HERO_CLIPS.idle, 0.5);
      g.rotation.set(-Math.PI / 2, player.facing, 0, "YXZ");
      g.position.y += 0.17 + Math.sin(t * 1.4) * 0.006;
    } else if (petW > 0) {
      play(HERO_CLIPS.idle, 1);
      // lean down a little for small animals
      tilt = THREE.MathUtils.clamp((1.2 - player.petH) * 0.28, 0, 0.3) * petW;
    } else if (emoting) {
      play(HERO_CLIPS[emote.clip], emote.clip === "punch" ? 1.4 : 1);
      const m = heroMove(emote.move, (now - st.emoteAt) / (emote.seconds * 1000));
      S.spin = emote.spin ? ((now - st.emoteAt) / 1000 / 1.2) * Math.PI * 2 : m.spin;
      // flips turn round the hips, not the feet
      flip = m.flip;
      lift = m.lift - m.crouch + HIP * (1 - Math.cos(flip));
      back = m.lunge - HIP * Math.sin(flip);
    } else if (celebrating) {
      play(HERO_CLIPS.dance, 1);
    } else if (player.swimming) {
      // front crawl: lie forward with the head above the water
      play(HERO_CLIPS.walk, player.speed > 0.5 ? 0.8 : 0.35);
      tilt = player.speed > 0.5 ? 1.2 : 0.55;
      lift = player.speed > 0.5 ? 0.8 : 0.35;
      back = player.speed > 0.5 ? -0.55 : -0.1;
    } else if (player.flying) {
      play(HERO_CLIPS.walk, player.speed > 1 ? 0.35 : 0.22);
      tilt = player.speed > 1 ? 0.62 : 0.06;
    } else if (!player.grounded) {
      play(HERO_CLIPS.walk, 0.55);
      const up = THREE.MathUtils.clamp(player.vy / 9, -1, 1);
      sy = 1 + up * 0.07;
      sx = 1 - up * 0.035;
      tilt = 0.12 + Math.min(0.12, player.speed * 0.012);
    } else if (player.speed < 0.35) play(HERO_CLIPS.idle, 1);
    else {
      // walk → run: longer, faster stride with a forward lean and a little bounce
      runW = THREE.MathUtils.clamp((player.speed - 5.6) / 3.2, 0, 1);
      walkW = THREE.MathUtils.clamp(player.speed / 1.2, 0, 1);
      const ts = runW > 0 ? 1.55 + runW * 0.55 : THREE.MathUtils.clamp(player.speed / 3.6, 0.7, 1.55);
      play(HERO_CLIPS.walk, ts * (player.wade > 0.3 ? 0.8 : 1));
      tilt = 0.03 + runW * 0.16;
      const cycle = actions[HERO_CLIPS.walk];
      if (cycle && runW > 0) lift = Math.abs(Math.sin((cycle.time / cycle.getClip().duration) * Math.PI * 2)) * 0.07 * runW;
    }
    if (!emoting) {
      // a finished spin ends a full turn round: unwrap so it doesn't spin back
      S.spin = Math.atan2(Math.sin(S.spin), Math.cos(S.spin)) * Math.exp(-10 * dt);
    }
    const since = (now - player.landedAt) / 1000;
    if (player.grounded && since < 0.22 && !ride) {
      const k = Math.sin((since / 0.22) * Math.PI);
      sy *= 1 - 0.1 * k;
      sx *= 1 + 0.05 * k;
    }
    body.scale.set(scale * sx, scale * sy, scale * sx);
    body.rotation.order = "YXZ"; // flips and leans follow the spin
    if (emoting) body.rotation.x = flip;
    else {
      body.rotation.x = Math.atan2(Math.sin(body.rotation.x), Math.cos(body.rotation.x));
      body.rotation.x += (tilt - body.rotation.x) * 0.2;
    }
    body.rotation.y = S.spin;
    const follow = emoting ? 1 : runW > 0 ? 0.55 : 0.2;
    body.position.y += (lift - body.position.y) * follow;
    body.position.z += (back - body.position.z) * follow;

    // secondary motion: hair and cloth lag behind speed changes, turns and jumps
    const accel = (player.speed - S.lastSpeed) / Math.max(dt, 1e-3);
    S.lastSpeed = player.speed;
    let dyaw = player.facing - S.lastYaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    S.lastYaw = player.facing;
    const turn = THREE.MathUtils.clamp(dyaw / Math.max(dt, 1e-3), -4, 4);
    const fast = Math.min(1, player.speed / 10);
    const breeze = Math.sin(t * 1.7) * 0.03 + Math.sin(t * 3.1) * 0.015;
    const air = !player.grounded && !player.swimming ? THREE.MathUtils.clamp(player.vy * 0.01, -0.08, 0.08) : 0;
    if (rig.hair) {
      rig.hair.rotation.x = spring(S.hx, -fast * 0.1 - THREE.MathUtils.clamp(accel * 0.006, -0.08, 0.08) + air, 70, 7, dt);
      rig.hair.rotation.z = spring(S.hz, turn * 0.025 + breeze, 60, 6, dt);
    }
    const tx = spring(S.tx, 0.25 + fast * 0.9 + (player.flying ? 0.5 : 0) + THREE.MathUtils.clamp(-player.vy * 0.04, -0.4, 0.4), 30, 4, dt);
    const tz = spring(S.tz, turn * 0.12 + breeze * 4, 25, 3.5, dt);
    for (const tail of rig.tails) {
      const b = tail.userData.base as { x: number; z: number; side: number };
      tail.rotation.x = b.x + tx + Math.sin(t * 9 + b.side) * 0.05 * fast;
      tail.rotation.z = b.z + tz + Math.sin(t * 7 + b.side * 2) * 0.06 * fast;
    }
    // blink every few seconds
    if (t > S.blinkAt + 0.13) S.blinkAt = t + 2.2 + Math.random() * 3.2;
    const closed = t > S.blinkAt && t < S.blinkAt + 0.13;
    for (const l of rig.lids) l.visible = closed;
    const powered = !!st.powerKind && now < st.powerUntil;
    animateGear(rig, t, emoting || powered ? 1 : 0, player.speed);
    moveGear(rig, emoting, emoting ? (now - st.emoteAt) / (emote.seconds * 1000) : 0, t, player.flying);

    // limbs on top of the clip: real walk/run swing, signature-move kicks, petting hand
    if (limbs) {
      beginPose(limbs);
      body.updateWorldMatrix(true, false);
      body.getWorldQuaternion(qBody);
      if (emoting) applyMove(limbs, qBody, heroMove(emote.move, (now - st.emoteAt) / (emote.seconds * 1000)));
      else if (walkW > 0) applyGait(limbs, qBody, runW, walkW, dt, gait.current);
      if (petW > 0) {
        limbs.armR.b.getWorldPosition(shoulder);
        limbs.foreR.tip.getWorldPosition(hand);
        const reach = Math.max(0.3, shoulder.distanceTo(hand));
        const target = player.position.y + player.petH;
        const down = THREE.MathUtils.clamp((shoulder.y - target) / reach, 0.1, 0.8);
        dir.set(0, -down, Math.sqrt(1 - down * down)).applyQuaternion(qBody);
        aim(limbs.armR, dir, petW);
        // forearm: palm dips over the head and sweeps side to side
        dir2.set(0, -down, Math.sqrt(1 - down * down)).applyAxisAngle(SIDE, 0.4).applyAxisAngle(UP, Math.sin(t * Math.PI * 2 * 1.6) * 0.5).applyQuaternion(qBody);
        aim(limbs.foreR, dir2, petW);
      }
      // bro dap: reach out and clasp, shake, pull in for a shoulder bump, snap on the way out
      if (player.dapAt) {
        const d = dapPose(now - player.dapAt);
        if (d.reach > 0 || d.snap > 0) {
          dir.set(0.25, -0.25 + d.shake, 1).normalize().applyQuaternion(qBody);
          aim(limbs.armR, dir, d.reach);
          dir2.set(0.15, 0.2 + d.shake, 1).normalize().applyQuaternion(qBody);
          aim(limbs.foreR, dir2, d.reach);
          dir.set(-0.55, 0.05, 1).normalize().applyQuaternion(qBody);
          aim(limbs.armL, dir, d.bump);
          dir2.set(-0.2, 0.7, 0.4).normalize().applyQuaternion(qBody);
          aim(limbs.foreR, dir2, d.snap);
        }
      }
      // trophy overhead: both arms up, hands meeting above the head
      const lw = player.liftAt ? carryWeight(now - player.liftAt) : 0;
      if (lw > 0) {
        const pump = Math.sin(t * 5) * 0.08;
        dir.set(-0.28, 0.95, 0.12 + pump).normalize().applyQuaternion(qBody);
        aim(limbs.armR, dir, lw);
        dir.set(0.28, 0.95, 0.12 + pump).normalize().applyQuaternion(qBody);
        aim(limbs.armL, dir, lw);
        dir2.set(0.5, 0.85, 0.1).normalize().applyQuaternion(qBody);
        aim(limbs.foreR, dir2, lw);
        dir2.set(-0.5, 0.85, 0.1).normalize().applyQuaternion(qBody);
        aim(limbs.foreL, dir2, lw);
      }
      // on a lounger the legs fold forward at the hips to lie flat along the seat
      if (player.chillAt && player.pose === "sit" && player.chillKind === "lounger") {
        loungePose.legR = loungePose.legL = LOUNGER.back;
        applyMove(limbs, qBody, loungePose);
      }
      // on the swing: both hands up on the ropes
      if (player.chillAt && player.pose === "sit" && player.chillKind === "swing") {
        for (const [arm, fore, side] of [[limbs.armR, limbs.foreR, -1], [limbs.armL, limbs.foreL, 1]] as const) {
          dir.set(side * 0.32, 0.9, 0.12).normalize().applyQuaternion(qBody);
          aim(arm, dir, 1);
          dir2.set(side * 0.18, 1, 0.05).normalize().applyQuaternion(qBody);
          aim(fore, dir2, 1);
        }
      }
      // chilling with a juice: glass resting at the chest, raised to the lips for a slow sip now and then
      else if (player.chillAt && player.pose === "sit") {
        const sip = sipWeight((now - player.chillAt) / 1000);
        dir.set(-0.12, -0.55 + sip * 0.25, 0.82).normalize().applyQuaternion(qBody);
        aim(limbs.armR, dir, 1);
        dir2.set(0.35 + sip * 0.25, 0.25 + sip * 0.7, 0.85 - sip * 0.55).normalize().applyQuaternion(qBody);
        aim(limbs.foreR, dir2, 1);
      }
      endPose(limbs);
    }
    // where the held trophy sits: just above the two fists
    if (limbs && player.liftAt && carryWeight(now - player.liftAt) > 0) {
      limbs.foreR.tip.getWorldPosition(hand);
      limbs.foreL.tip.getWorldPosition(shoulder);
      player.handsAt.copy(hand).add(shoulder).multiplyScalar(0.5);
      player.handsAt.y += 0.08;
    } else if (player.liftAt && now - player.liftAt > 8000) player.liftAt = 0;
    if (juice.current) {
      const j = juice.current;
      j.visible = !!player.chillAt && player.pose === "sit" && player.chillKind !== "swing" && !ride;
      if (j.visible && limbs) {
        limbs.foreR.tip.getWorldPosition(hand);
        g.updateWorldMatrix(true, false);
        j.position.copy(g.worldToLocal(hand));
        // stay upright in the world, tipping toward the lips while sipping
        g.getWorldQuaternion(qInv).invert();
        j.quaternion.copy(qInv);
        j.rotateY(player.facing);
        j.rotateX(-sipWeight((now - player.chillAt) / 1000) * 0.5);
      }
    }

    if (shadow.current) shadow.current.visible = player.pose === "stand" && !ride;
    // tucked in under a bedsheet while lying in bed, breathing softly
    if (blanket.current) {
      blanket.current.visible = player.pose === "lie" && !ride;
      if (blanket.current.visible) blanket.current.scale.z = 1 + Math.sin(t * 1.4) * 0.04;
    }
    if (aura.current) {
      aura.current.visible = player.flying || (st.powerKind === "speed" && now < st.powerUntil && player.speed > 1);
      aura.current.rotation.z += dt * 4;
      const k = 1 + Math.sin(t * 6) * 0.08;
      aura.current.scale.set(k, k, k);
    }
    if (ripple.current) {
      const r = ripple.current;
      r.visible = player.swimming || (player.wade > 0.25 && !ride);
      if (r.visible) {
        const surf = player.position.y + (player.swimming ? 1.15 : player.wade);
        r.position.set(0, surf - player.position.y + 0.02, 0);
        const k = 1 + ((t * 0.9) % 1) * 0.8;
        r.scale.set(k, k, k);
        (r.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - ((t * 0.9) % 1));
      }
    }
    const inv = st.powerKind === "invisible" && now < st.powerUntil;
    fade.current += ((inv ? 0.14 : 1) - fade.current) * (1 - Math.exp(-6 * dt));
    const o = fade.current + (inv ? Math.sin(t * 7) * 0.04 : 0);
    for (const m of mats) {
      if (fade.current < 0.99) {
        if (!m.transparent) {
          m.transparent = true;
          m.needsUpdate = true;
        }
        m.opacity = o;
        m.depthWrite = fade.current > 0.6;
      } else if (m.transparent) {
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
        m.needsUpdate = true;
      }
    }
  });

  return (
    <group ref={group}>
      <group ref={inner} scale={scale}>
        <primitive object={model} />
      </group>
      <mesh ref={aura} position={[0, 0.25, 0]} rotation-x={-Math.PI / 2} visible={false}>
        <torusGeometry args={[0.7, 0.05, 6, 28, Math.PI * 1.6]} />
        <meshBasicMaterial color="#fff6e3" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh ref={ripple} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.55, 0.75, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      {/* duvet: in the body's own frame (+y toward the head, +z up when lying) — a soft rounded drape tucked into the mattress */}
      <group ref={blanket} visible={false}>
        <group position={[0, 0.54, -0.1]} scale={[1.45, 1, 1.4]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.3, 0.3, 1.52, 18, 1, false, -Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color="#efe4d2" roughness={0.95} />
          </mesh>
          {[-0.4, -0.05, 0.3].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <cylinderGeometry args={[0.304, 0.304, 0.06, 18, 1, true, -Math.PI / 2, Math.PI]} />
              <meshStandardMaterial color="#9fb7d6" roughness={0.95} side={THREE.DoubleSide} />
            </mesh>
          ))}
          {/* tented over the toes */}
          <mesh position={[0, -0.6, 0]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.36, 18, 1, false, -Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color="#efe4d2" roughness={0.95} />
          </mesh>
          {/* folded-over top edge at the chest */}
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.315, 0.315, 0.14, 18, 1, false, -Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color="#fffaf0" roughness={0.9} />
          </mesh>
        </group>
      </group>
      {/* chill-spot juice: glass, orange juice, striped straw and a lime wheel */}
      <group ref={juice} visible={false}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.055, 0.042, 0.16, 14, 1, true]} />
          <meshStandardMaterial color="#eaf6ff" transparent opacity={0.4} roughness={0.1} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.0, 0]}>
          <cylinderGeometry args={[0.05, 0.04, 0.12, 14]} />
          <meshStandardMaterial color="#ff9a1f" roughness={0.35} />
        </mesh>
        <mesh position={[0.018, 0.1, 0]} rotation-z={-0.25}>
          <cylinderGeometry args={[0.007, 0.007, 0.2, 6]} />
          <meshStandardMaterial color="#ff5c8a" roughness={0.5} />
        </mesh>
        <mesh position={[-0.05, 0.09, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.032, 0.032, 0.01, 12]} />
          <meshStandardMaterial color="#9ed64a" roughness={0.5} />
        </mesh>
      </group>
      <mesh ref={shadow} position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.55, 20]} />
        <meshBasicMaterial color="#1b2a1a" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A soft flash where Blink leaves and where it lands. */
export function BlinkFx() {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  const seq = useRef(0);
  const t0 = useRef(-10);
  useFrame(({ clock }) => {
    const st = useGame.getState();
    const t = clock.elapsedTime;
    if (st.blink && st.blink.seq !== seq.current) {
      seq.current = st.blink.seq;
      t0.current = t;
      a.current?.position.set(st.blink.from.x, st.blink.from.y + 1, st.blink.from.z);
      b.current?.position.set(st.blink.to.x, st.blink.to.y + 1, st.blink.to.z);
    }
    const k = (t - t0.current) / 0.6;
    for (const m of [a.current, b.current]) {
      if (!m) continue;
      m.visible = k < 1;
      if (k >= 1) continue;
      const s = 0.4 + k * 2.2;
      m.scale.set(s, s, s);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k);
    }
  });
  return (
    <>
      {[a, b].map((r, i) => (
        <mesh key={i} ref={r} visible={false}>
          <sphereGeometry args={[1, 18, 12]} />
          <meshBasicMaterial color="#efe8ff" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

useGLTF.preload(HEROES[0].url);
