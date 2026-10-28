import { addEyes } from "@/game/eyes";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { player } from "@/game/store";
import { getWorld } from "@/game/world";
import { makeWander, wanderStep, type Area } from "@/game/wander";
import { dampAngle } from "@/game/math";
import { measureHeight, stylizeModel } from "@/game/models";
import { addDynamicBody } from "@/game/scatter";
import { addCreature, nuzzle, reaction, type AnimalVoice, type Creature } from "@/game/creatures";
import { inView } from "./cull";
import { aim, beginPose, endPose, rigLimbs } from "@/game/heroPose";
import { DAP, dapPose } from "@/game/dap";

const qBody = new THREE.Quaternion();
const dir = new THREE.Vector3();

/** villagers and animals beyond this are specks in the haze */
const AGENT_FAR = 190;

type Props = {
  url: string;
  idle: string;
  walk?: string;
  /** clip played when the visitor comes close (e.g. a cheer) */
  greet?: string;
  height: number;
  area: Area;
  speed: number;
  seed: number;
  /** clip timeScale per unit of speed */
  stride?: number;
  hopWalk?: boolean;
  /** solid body radius (people and animals can't be walked or driven through) */
  radius?: number;
  /** pettable animal: its name, voice and the clip it plays when patted */
  pet?: { name: string; voice: AnimalVoice; happy?: string };
};

/** An animated, wandering villager or animal (rigged CC0 GLB). */
export function AnimatedAgent({ url, idle, walk, greet, height, area, speed, seed, stride = 0.5, hopWalk, radius = 0.42, pet }: Props) {
  const root = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const { model, scale } = useMemo(() => {
    const m = SkeletonUtils.clone(scene) as THREE.Group;
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false;
      }
    });
    stylizeModel(m, url);
    // animals get big friendly eyes that ride the head bone (and blink)
    if (url.includes("/animals/")) m.userData.eyes = addEyes(m) ?? [];
    return { model: m, scale: height / measureHeight(m, 3) };
  }, [scene, height, url]);
  const { actions } = useAnimations(animations, inner);
  const clip = useRef("");
  const w = useMemo(() => makeWander(area, seed), [area, seed]);
  const world = getWorld();
  const greetT = useRef(0);
  const acc = useRef(0);
  // people (villagers, farmers, city locals) can be dapped up; animals can be petted
  const person = !pet && url.includes("/people/");
  const body = useMemo<Creature>(
    () => ({ name: pet?.name ?? "local", x: w.x, z: w.z, y: 0, r: radius, height, voice: pet?.voice ?? "coo", petAt: 0, person }),
    [w, radius, height, pet?.name, pet?.voice, person],
  );
  const limbs = useMemo(() => (person ? rigLimbs(model) : null), [person, model]);
  useEffect(() => {
    const off = addDynamicBody(body);
    const off2 = pet || person ? addCreature(body) : null;
    return () => {
      off();
      off2?.();
    };
  }, [body, pet?.name]);

  useFrame(({ camera, clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const g = root.current;
    if (!g) return;
    // skinned meshes can't be frustum-culled by three, so cull the whole agent here
    g.visible = inView(camera, clock.elapsedTime, w.x, g.position.y + height * 0.5, w.z, height, AGENT_FAR);
    const dp = Math.hypot(player.position.x - w.x, player.position.z - w.z);
    // a soft blink every few seconds
    const eyes = model.userData.eyes as THREE.Object3D[] | undefined;
    if (eyes?.length && dp < 40) {
      const bt = (clock.elapsedTime + seed * 1.7) % 4.3;
      const k = bt < 0.14 ? 0.12 : 1;
      for (const e of eyes) e.scale.y = (e.userData.sy ??= e.scale.y) * k;
    }
    // skip animation work when far away
    acc.current += dt;
    if (dp > 120 && acc.current < 0.5) return;
    acc.current = 0;
    let want = idle;
    let ts = 1;
    const happy = reaction(body, performance.now());
    if (happy >= 0) {
      // patted: stop, turn to the explorer and show some joy
      w.yaw = dampAngle(w.yaw, Math.atan2(player.position.x - w.x, player.position.z - w.z), dt * 6);
      want = pet?.happy && happy > 0.12 && happy < 0.75 ? pet.happy : idle;
    } else if (greet && dp < 5.5) {
      w.yaw = dampAngle(w.yaw, Math.atan2(player.position.x - w.x, player.position.z - w.z), dt * 5);
      greetT.current += dt;
      want = greetT.current < 3 ? greet : idle;
    } else {
      if (dp > 8) greetT.current = 0;
      const v = wanderStep(w, area, speed, dt);
      if (v > 0.05 && walk) {
        want = walk;
        ts = hopWalk ? 1.2 : THREE.MathUtils.clamp(v * stride, 0.5, 2);
      }
    }
    g.position.set(w.x, world.gridHeight(w.x, w.z), w.z);
    body.x = w.x;
    body.z = w.z;
    body.y = g.position.y;
    // patted: bend toward the explorer's hand and sway into it
    const lean = person ? 0 : nuzzle(happy);
    const dap = player.dapWith === body ? dapPose(performance.now() - player.dapAt) : null;
    g.rotation.set(lean * 0.16 + (dap ? dap.bump * 0.12 : 0), w.yaw, Math.sin(clock.elapsedTime * 2.2) * 0.05 * lean, "YXZ");
    const a = actions[want];
    if (a && clip.current !== want) {
      actions[clip.current]?.fadeOut(0.45);
      a.reset().fadeIn(0.45).play();
      clip.current = want;
    }
    if (a) a.timeScale = ts;
    // the dap, mirrored from the explorer's side: clasp, shake, bump, snap
    if (limbs) {
      beginPose(limbs);
      if (dap && (dap.reach > 0 || dap.snap > 0)) {
        g.updateWorldMatrix(true, true);
        g.getWorldQuaternion(qBody);
        dir.set(0.25, -0.25 + dap.shake, 1).normalize().applyQuaternion(qBody);
        aim(limbs.armR, dir, dap.reach);
        dir.set(0.15, 0.2 + dap.shake, 1).normalize().applyQuaternion(qBody);
        aim(limbs.foreR, dir, dap.reach);
        dir.set(-0.55, 0.05, 1).normalize().applyQuaternion(qBody);
        aim(limbs.armL, dir, dap.bump);
        dir.set(-0.2, 0.7, 0.4).normalize().applyQuaternion(qBody);
        aim(limbs.foreR, dir, dap.snap);
      } else if (player.dapWith === body && performance.now() - player.dapAt > DAP.ms + 200) player.dapWith = null;
      endPose(limbs);
    }
  });

  return (
    <group ref={root}>
      <group ref={inner} scale={scale}>
        <primitive object={model} />
      </group>
    </group>
  );
}
