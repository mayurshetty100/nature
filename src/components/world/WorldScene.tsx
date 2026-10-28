import { Suspense, useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer } from "@react-three/drei";
import { timeUniform, useGame } from "@/game/store";
import { STOPS } from "@/game/stops";
import { getWorld } from "@/game/world";
import { registerExtraColliders } from "@/game/scatter";
import { fallColliders } from "@/game/falls";
import { interact } from "@/game/interact";
import { CliffFalls, MountainFalls, Ocean, River, SkyDome, Terrain } from "./Environment";
import { FOG_COLOR } from "./constants";
import { Road } from "./Road";
import { Vegetation } from "./Vegetation";
import { Birds, Butterflies, Clouds } from "./Nature";
import { Landmarks } from "./Landmarks";
import { landmarkColliders } from "@/game/landmarkColliders";
import { cityColliders } from "@/game/cityColliders";
import { coastColliders } from "@/game/coast";
import { PlayerController } from "./Player";
import { BlinkFx, HeroModel } from "./Hero";
import { EmoteFx } from "./EmoteFx";
import { HeartBursts } from "./HeartBursts";
import { Forest } from "./Forest";
import { Foundations } from "./Foundations";
import { TreeLife } from "./TreeLife";
import { InteriorScene, PreloadInteriors, RoomLights } from "./Interior";
import { Pet } from "./Pets";
import { CameraRig } from "./CameraRig";
import { Guidance, NavTracker } from "./Guidance";
import { DayNight } from "./DayNight";
import { RideLamp, Vehicles } from "./Vehicles";
import { Village } from "./Village";
import { City } from "./City";
import { Farm } from "./Farm";
import { Coast } from "./Coast";
import { Seaside } from "./Seaside";
import { Wildlife } from "./Wildlife";
import { AudioDriver, Fireworks, RevealBurst } from "./Effects";

function Clock() {
  useFrame((_, dt) => {
    timeUniform.value += Math.min(dt, 0.05);
  });
  return null;
}

/** Prepares every shader up front (once the scenery has loaded) so new areas never stutter on first sight. */
function Precompile() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const id = window.setTimeout(() => {
      gl.compileAsync(scene, camera).catch(() => {});
    }, 300);
    return () => window.clearTimeout(id);
  }, [gl, scene, camera]);
  return null;
}

/** Dev-only: exposes renderer stats to automated play-tests. */
function DevProbe() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __mw3: unknown }).__mw3 = { gl, scene };
  }, [gl, scene]);
  return null;
}

/** The island, hidden (but kept loaded) while you're inside a building. */
function Outdoors({ children }: { children: ReactNode }) {
  const inside = useGame((s) => s.inside);
  return <group visible={!inside}>{children}</group>;
}

/** Dev-only: expose the scene and camera on window.__game for scripted checks. */
function DevHook() {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const g = (window as unknown as { __game?: Record<string, unknown> }).__game;
    if (g) Object.assign(g, { scene, camera, THREE, interact });
  }, [scene, camera]);
  return null;
}

function Ready() {
  const setReady = useGame((s) => s.setSceneReady);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady());
    return () => cancelAnimationFrame(id);
  }, [setReady]);
  return null;
}

/** Floating chapter labels over each landmark during the opening overview. */
function OverviewLabels() {
  const phase = useGame((s) => s.phase);
  const step = useGame((s) => s.introStep);
  const w = getWorld();
  if (phase !== "intro" || step !== "world") return null;
  return (
    <group>
      {STOPS.map((s) => {
        const y = w.gridHeight(s.lx, s.lz) + (s.id === "city" ? 38 : s.id === "academy" ? 20 : s.id === "cove" ? 17 : s.id === "forest" ? 12 : 10);
        return (
          <Html key={s.id} position={[s.lx, y, s.lz]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
            <div className="glass-panel animate-rise hidden whitespace-nowrap rounded-xl px-3 py-1.5 text-left lg:block">
              <div className="font-heading text-sm font-semibold leading-tight text-cream">
                {s.name}
              </div>
              <div className="text-[11px] leading-tight text-muted-foreground">{s.subtitle}</div>
            </div>
          </Html>
        );
      })}
    </group>
  );
}

export function WorldScene({ quality }: { quality: "high" | "low" }) {
  useMemo(() => {
    getWorld();
    registerExtraColliders([...landmarkColliders(), ...cityColliders(), ...coastColliders(), ...fallColliders()]);
  }, []);
  const butterflyAnchors = useMemo(
    () => [
      { x: -136, z: 58 },
      { x: -122, z: 66 },
      { x: -146, z: 40 },
      { x: -112, z: 30 },
      { x: -104, z: 8 },
      { x: -88, z: 10 },
      { x: -78, z: -40 },
      { x: -10, z: 22 },
      { x: 4, z: 40 },
      { x: 30, z: 30 },
      { x: 54, z: -18 },
      { x: 140, z: -40 },
    ],
    [],
  );
  return (
    <>
      <color attach="background" args={[FOG_COLOR]} />
      <fog attach="fog" args={[FOG_COLOR, 170, 700]} />
      <Clock />
      <DevProbe />
      <DayNight shadowSize={quality === "high" ? 2048 : 1024} />
      <Environment resolution={64} environmentIntensity={0.4}>
        <Lightformer intensity={2} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} color="#fff1dc" />
        <Lightformer intensity={1.2} position={[10, 2, -6]} rotation-y={-Math.PI / 2} scale={[20, 3, 1]} color="#ffc48a" />
        <Lightformer intensity={0.8} position={[-10, 2, 6]} rotation-y={Math.PI / 2} scale={[20, 3, 1]} color="#9fc4ff" />
      </Environment>

      <Outdoors>
        <SkyDome />
        <Ocean />
        <Terrain />
        <River />
        <CliffFalls />
        <MountainFalls />
        <Road />
        <Clouds />
        <Birds />
        <Butterflies anchors={butterflyAnchors} />
        <Guidance />
        <Suspense fallback={null}>
          <Vegetation />
          <Landmarks />
          <OverviewLabels />
          <Ready />
        </Suspense>
        {/* secondary life loads after the island is visible */}
        <Suspense fallback={null}>
          <Vehicles />
          <Village />
          <Farm />
          <City />
          <Coast />
          <Seaside />
          <Forest />
          <Foundations />
          <TreeLife />
          <Wildlife />
          <Precompile />
        </Suspense>
      </Outdoors>
      <PlayerController />
      <DevHook />
      <CameraRig />
      <NavTracker />
      <RevealBurst />
      <BlinkFx />
      <EmoteFx />
      <HeartBursts />
      <Fireworks />
      <AudioDriver />
      <InteriorScene />
      <RoomLights />
      <RideLamp />
      <PreloadInteriors />
      <Suspense fallback={null}>
        <HeroModel />
        <Pet />
      </Suspense>
    </>
  );
}
