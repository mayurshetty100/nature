import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { EMOTES, HERO_CLIPS, HEROES, type HeroId } from "@/game/characters";
import { animateGear, buildHero, moveGear, type HeroRig } from "@/game/heroModel";
import { heroMove } from "@/game/moves";
import { applyMove, beginPose, endPose, rigLimbs } from "@/game/heroPose";

const qBody = new THREE.Quaternion();

/** The picker loops each explorer's signature move with a short breather in between. */
type Beat = { clip: keyof typeof HERO_CLIPS; secs: number; sig?: boolean; speed?: number; burst?: boolean };

function reelFor(id: HeroId): Beat[] {
  const e = EMOTES[id];
  return [
    { clip: "idle", secs: 0.9 },
    { clip: e.clip, secs: e.seconds, sig: true, speed: e.clip === "punch" ? 1.4 : 1, burst: true },
  ];
}

/** Sparks that burst outward in the explorer's colours on every big move. */
function Burst({ colors, at }: { colors: [string, string]; at: React.MutableRefObject<number> }) {
  const N = 48;
  const ref = useRef<THREE.Points>(null);
  const { geo, dirs } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const d: THREE.Vector3[] = [];
    const c = [new THREE.Color(colors[0]), new THREE.Color(colors[1])];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      d.push(new THREE.Vector3(Math.cos(a), 0.4 + ((i * 7) % 10) / 10, Math.sin(a)).normalize());
      c[i % 2].toArray(col, i * 3);
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return { geo: g, dirs: d };
  }, [colors]);
  useFrame(({ clock }) => {
    const p = ref.current;
    if (!p) return;
    const k = clock.elapsedTime - at.current;
    p.visible = k >= 0 && k < 1.1;
    if (!p.visible) return;
    const arr = geo.attributes.position.array as Float32Array;
    const r = 0.25 + k * 1.6;
    dirs.forEach((d, i) => {
      arr[i * 3] = d.x * r;
      arr[i * 3 + 1] = 0.9 + d.y * r * 0.8 - k * k * 0.6;
      arr[i * 3 + 2] = d.z * r;
    });
    geo.attributes.position.needsUpdate = true;
    (p.material as THREE.PointsMaterial).opacity = 1 - k / 1.1;
  });
  return (
    <points ref={ref} geometry={geo} visible={false}>
      <pointsMaterial size={0.09} vertexColors transparent depthWrite={false} toneMapped={false} />
    </points>
  );
}

function Performer({ heroId, close }: { heroId: HeroId; close: boolean }) {
  const hero = HEROES.find((h) => h.id === heroId) ?? HEROES[0];
  const { scene, animations } = useGLTF(hero.url);
  const { model, scale } = useMemo(() => buildHero(scene, hero.url, hero.look), [scene, hero]);
  const rig = model.userData.rig as HeroRig | undefined;
  const limbs = useMemo(() => rigLimbs(model), [model]);
  const spin = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, inner);
  const reel = useMemo(() => reelFor(hero.id), [hero.id]);
  const st = useRef({ beat: -1, until: 0, start: 0, clip: "" });
  const burstAt = useRef(-10);
  const camLift = useRef(0);
  const camLook = useRef(0.95);

  useEffect(() => {
    st.current = { beat: -1, until: 0, start: 0, clip: "" };
    return () => {
      Object.values(actions).forEach((a) => a?.stop());
    };
  }, [actions]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const s = st.current;
    if (t >= s.until) {
      // the close-up (face view) just idles; otherwise run the reel
      s.beat = close ? 0 : (s.beat + 1) % reel.length;
      const b = close ? reel[0] : reel[s.beat];
      s.start = t;
      s.until = t + b.secs;
      const name = HERO_CLIPS[b.clip];
      const next = actions[name];
      if (next && name !== s.clip) {
        const prev = s.clip ? actions[s.clip] : null;
        next.reset().setEffectiveTimeScale(b.speed ?? 1).play();
        if (prev) next.crossFadeFrom(prev, 0.25, false);
        s.clip = name;
      } else next?.setEffectiveTimeScale(b.speed ?? 1);
      if (b.burst && !close) burstAt.current = t;
    }
    const b = close ? reel[0] : reel[s.beat];
    const k = Math.min(1, (t - s.start) / b.secs);
    const g = inner.current;
    const e = EMOTES[hero.id];
    const m = heroMove(e.move, b.sig && !close ? k : -1);
    if (g) {
      // high flights are scaled down so the explorer stays in frame
      const lift = m.lift > 1 ? 1 + (m.lift - 1) * 0.4 : m.lift;
      g.position.y = lift - m.crouch + 0.9 * (1 - Math.cos(m.flip));
      // the camera follows the whole body up (flights and flips alike)
      camLift.current = Math.max(0, g.position.y - 0.05);
      g.position.z = m.lunge - 0.9 * Math.sin(m.flip);
      g.rotation.set(m.flip, b.sig && !close && e.spin ? THREE.MathUtils.smoothstep(k, 0.05, 0.8) * Math.PI * 2 : m.spin, 0, "YXZ");
    }
    moveGear(rig, !!b.sig && !close, k, t);
    if (limbs && g) {
      beginPose(limbs);
      g.updateWorldMatrix(true, false);
      g.getWorldQuaternion(qBody);
      applyMove(limbs, qBody, m);
      endPose(limbs);
    }
    if (spin.current && !close) spin.current.rotation.y = 0.35 + Math.sin(t * 0.45) * 0.55;
    animateGear(rig, t, b.burst ? 0.8 : 0);
    // the camera rises with big jumps and flights so the move stays in frame
    camTarget.copy(close ? CLOSE_POS : FAR_POS);
    camTarget.y += camLift.current;
    camTarget.z += camLift.current * 1.2;
    state.camera.position.lerp(camTarget, Math.min(1, dt * 7));
    camLook.current += ((close ? 1.5 : 0.95) + camLift.current - camLook.current) * Math.min(1, dt * 7);
    state.camera.lookAt(0, camLook.current, 0);
  });
  return (
    <group ref={spin} rotation-y={close ? 0 : 0.35}>
      <group ref={inner}>
        <group scale={scale}>
          <primitive object={model} />
        </group>
      </group>
      <Burst colors={EMOTES[hero.id].colors} at={burstAt} />
    </group>
  );
}

const FAR_POS = new THREE.Vector3(0, 1.25, 4.2);
const camTarget = new THREE.Vector3();
const CLOSE_POS = new THREE.Vector3(0, 1.58, 1.35);

/** Live 3D preview of the chosen explorer showing off their moves, gear and glow. */
export default function HeroPreview({ heroId, close = false }: { heroId: HeroId; close?: boolean }) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ fov: 32, position: [0, 1.25, 4.2] }} gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}>
      <ambientLight intensity={0.9} color="#ffe9d2" />
      <hemisphereLight args={["#fff4e0", "#5d7a4a", 0.8]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.2} color="#ffd9a8" />
      <directionalLight position={[-3, 2, -2]} intensity={0.8} color="#9fc4ff" />
      <Suspense fallback={null}>
        <Performer heroId={heroId} close={close} />
      </Suspense>
      <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={4} blur={2.4} far={2} />
    </Canvas>
  );
}
