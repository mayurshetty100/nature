import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PET_CLIPS, PETS, type Pet, type PetId } from "@/game/characters";
import { PET_MOVE_SECS, petMove } from "@/game/moves";
import { dressPet, type PetRig } from "@/game/petModel";
import { measureHeight, stylizeModel } from "@/game/models";
import { ByteModel } from "@/components/world/Companion";
import { DragonModel } from "@/components/world/Dragon";
import { MagicAura } from "@/components/world/MagicAura";

/** The pet's show reel on the picker: its signature stunt on repeat, with a cheer in between. */
type Beat = { clip: string; secs: number; move?: boolean; speed?: number; flare?: boolean };

function reelFor(pet: Pet): Beat[] {
  const secs = pet.move ? PET_MOVE_SECS[pet.move.kind] : 1.5;
  return [
    { clip: PET_CLIPS.idle, secs: 0.9 },
    { clip: PET_CLIPS.run, secs, move: true, speed: 1.3, flare: true },
    { clip: "gesture-positive", secs: 1.1 },
  ];
}

/** Puts a pet stunt pose on the stage group, flipping round the belly rather than the feet. */
function poseStage(g: THREE.Group, pet: Pet, k: number) {
  const m = pet.move ? petMove(pet.move.kind, k) : null;
  const c = 0.42;
  const rx = m?.rx ?? 0;
  const rz = m?.rz ?? 0;
  g.rotation.set(rx, m?.ry ?? 0, rz, "YXZ");
  g.position.set(c * Math.sin(rz), (m?.y ?? 0) + c * (2 - Math.cos(rx) - Math.cos(rz)), (m?.z ?? 0) * 0.6 - c * Math.sin(rx));
  g.scale.set(1, m?.sy ?? 1, 1);
}

/** Runs the reel: picks the clip and moves the stage group through the stunt. */
function useReel(pet: Pet, actions: Record<string, THREE.AnimationAction | null> | null, stage: React.RefObject<THREE.Group | null>, flare: React.MutableRefObject<number>, rig?: PetRig) {
  const st = useRef({ beat: -1, until: 0, start: 0, clip: "" });
  const REEL = useMemo(() => reelFor(pet), [pet]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const s = st.current;
    if (t >= s.until) {
      s.beat = (s.beat + 1) % REEL.length;
      const b = REEL[s.beat];
      s.start = t;
      s.until = t + b.secs;
      const next = actions?.[b.clip] ?? actions?.[PET_CLIPS.idle];
      if (next && b.clip !== s.clip) {
        actions?.[s.clip]?.fadeOut(0.2);
        next.reset().fadeIn(0.2).play();
        s.clip = b.clip;
      }
      if (next) next.timeScale = b.speed ?? 1;
    }
    const b = REEL[s.beat];
    const k = Math.min(1, (t - s.start) / b.secs);
    const g = stage.current;
    if (g) poseStage(g, pet, b.move ? k : -1);
    if (rig?.cape) rig.cape.rotation.x = -0.4 - Math.sin(t * 7) * 0.15 - (b.move ? 0.5 : 0);
    flare.current += ((b.flare ? 1 : 0.15) - flare.current) * 0.08;
  });
}

function Animal({ pet, url, height, flare }: { pet: Pet; url: string; height: number; flare: React.MutableRefObject<number> }) {
  const { scene, animations } = useGLTF(url);
  const { model, scale, rig } = useMemo(() => {
    const m = scene.clone(true);
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
    });
    stylizeModel(m, url);
    const rig = dressPet(m, pet);
    const h = measureHeight(m, 4);
    // centre the animal on the stage
    const c = new THREE.Box3().setFromObject(m, true).getCenter(new THREE.Vector3());
    m.position.x -= c.x;
    m.position.z -= c.z;
    return { model: m, scale: height / h, rig };
  }, [scene, url, height, pet]);
  const inner = useRef<THREE.Group>(null);
  const stage = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, inner);
  useEffect(
    () => () => {
      Object.values(actions).forEach((a) => a?.stop());
    },
    [actions],
  );
  useReel(pet, actions, stage, flare, rig);
  return (
    <group ref={stage}>
      <group ref={inner} scale={scale}>
        <primitive object={model} />
      </group>
    </group>
  );
}

/** Byte and Ember have no clips — they bob, spin and loop instead. */
function Floaty({ pet, children }: { pet: Pet; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  const stunt = useRef<THREE.Group>(null);
  const secs = pet.move ? PET_MOVE_SECS[pet.move.kind] : 1.5;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!g.current || !stunt.current) return;
    // gentle hover, then the signature stunt on repeat
    g.current.position.y = Math.sin(t * 2.2) * 0.06;
    g.current.rotation.z = Math.sin(t * 1.6) * 0.06;
    const cycle = secs + 1.4;
    poseStage(stunt.current, pet, ((t % cycle) - 1.4) / secs);
  });
  return (
    <group ref={g}>
      <group ref={stunt}>{children}</group>
    </group>
  );
}

function Stage({ pet }: { pet: Pet }) {
  const flare = useRef(0.2);
  const sway = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (sway.current) sway.current.rotation.y = 0.5 + Math.sin(clock.elapsedTime * 0.4) * 0.5;
  });
  return (
    <group ref={sway} rotation-y={0.5}>
      {pet.id === "byte" && (
        <Floaty pet={pet}>
          <group position={[0, 0.22, 0]} scale={0.9}>
            <ByteModel />
          </group>
        </Floaty>
      )}
      {pet.id === "dragon" && (
        <Floaty pet={pet}>
          <group position={[0, 0.15, 0]} scale={0.85}>
            <DragonModel />
          </group>
        </Floaty>
      )}
      {pet.url && <Animal key={pet.id} pet={pet} url={pet.url} height={0.85} flare={flare} />}
      {pet.magic && <MagicAura key={`m-${pet.id}`} colors={pet.magic.colors} radius={0.55} height={1.1} count={34} size={0.08} boost={flare} />}
    </group>
  );
}

/** Live 3D preview of the chosen pet showing off its moves, outfit and magic. */
export default function PetPreview({ petId }: { petId: PetId }) {
  const pet = PETS.find((p) => p.id === petId) ?? PETS[0];
  return (
    <Canvas dpr={[1, 1.75]} camera={{ fov: 30, position: [0, 0.75, 3.2] }} onCreated={({ camera }) => camera.lookAt(0, 0.42, 0)} gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}>
      <ambientLight intensity={0.9} color="#ffe9d2" />
      <hemisphereLight args={["#fff4e0", "#5d7a4a", 0.8]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.2} color="#ffd9a8" />
      <directionalLight position={[-3, 2, -2]} intensity={0.8} color="#9fc4ff" />
      <Suspense fallback={null}>
        <Stage pet={pet} />
      </Suspense>
      <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={3} blur={2.4} far={1.5} />
    </Canvas>
  );
}
