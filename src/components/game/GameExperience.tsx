import { STOP_BY_ID } from "@/game/stops";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { attachKeyboard, attachPointer, clearInput } from "@/game/input";
import { player, rides, useGame } from "@/game/store";
import { getWorld } from "@/game/world";
import { collidersNear } from "@/game/scatter";
import { WorldScene } from "@/components/world/WorldScene";
import { LoadingScreen } from "./LoadingScreen";
import { OpeningScreen } from "./OpeningScreen";
import { Hud } from "./Hud";
import { MobileControls } from "./MobileControls";
import { WorldMap } from "./WorldMap";
import { ControlGuide } from "./ControlGuide";
import { StoryCard } from "./StoryCard";
import { CharacterPicker } from "./CharacterPicker";
import { Celebration } from "./Celebration";
import { sound } from "@/game/audio";
import { toggleRide } from "@/game/ride";
import { doEmote, enterBuilding, interact } from "@/game/interact";
import { getBuildings } from "@/game/buildings";
import { getLayout } from "@/game/layout";
import { getInterior } from "@/game/interiors";
import { creatures } from "@/game/creatures";
import { cameraDebug, cameraSnap } from "@/components/world/cameraState";
import { VEHICLES, type VehicleId } from "@/game/vehicles";
import { activatePower } from "@/game/powers";
import { HEROES, PETS, type HeroId, type PetId } from "@/game/characters";
import { worldButton } from "./WorldButton";

class SceneBoundary extends Component<{ onError: (e: Error) => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error) {
    console.error("3D world failed", error);
    this.props.onError(error);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

function WorldUnavailable({ reason }: { reason: string }) {
  return (
    <div className="bg-sky-gradient fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="glass-strong max-w-md rounded-3xl p-7 text-center">
        <p className="font-display text-4xl text-cream">Mayur's World</p>
        <p className="mt-4 text-cream/90">{reason}</p>
        <Link to="/portfolio" className={worldButton({ variant: "hero", size: "lg", className: "mt-6" })}>
          <BookOpen className="h-5 w-5" /> Open the classic portfolio
        </Link>
      </div>
    </div>
  );
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Soft veil while stepping through a doorway (covers the swap between island and room). */
function DoorFade() {
  const on = useGame((s) => s.doorFade);
  return <div aria-hidden className={`pointer-events-none fixed inset-0 z-[15] bg-scrim transition-opacity ease-out ${on ? "opacity-100 duration-200" : "opacity-0 duration-500"}`} />;
}

export default function GameExperience() {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [crashed, setCrashed] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const isTouch = useGame((s) => s.isTouch);
  const [dprScale, setDprScale] = useState(1);
  const dprMax = (isTouch ? 1.5 : 1.75) * dprScale;
  const dpr: [number, number] = [Math.min(1, dprMax), Math.max(1, dprMax)];

  useEffect(() => {
    setWebgl(hasWebGL());
    const touch = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    useGame.getState().setEnv({ isTouch: touch, reducedMotion: reduced });
    // remembered choices
    try {
      const saved = JSON.parse(localStorage.getItem("mw-prefs-v2") || "{}") as { hero?: HeroId; pet?: PetId; vehicle?: VehicleId; muted?: boolean };
      const st = useGame.getState();
      // older saves may name explorers / pets that no longer exist
      if (saved.hero && HEROES.some((h) => h.id === saved.hero)) st.setHero(saved.hero);
      if (saved.pet && PETS.some((p) => p.id === saved.pet)) st.setPet(saved.pet);
      if (saved.vehicle && VEHICLES.some((v) => v.id === saved.vehicle)) st.setVehicle(saved.vehicle);
      if (saved.muted) st.toggleMuted();
    } catch {
      /* ignore */
    }
    const unsub = useGame.subscribe((s, p) => {
      if (s.heroId !== p.heroId || s.petId !== p.petId || s.vehicleId !== p.vehicleId || s.muted !== p.muted)
        localStorage.setItem("mw-prefs-v2", JSON.stringify({ hero: s.heroId, pet: s.petId, vehicle: s.vehicleId, muted: s.muted }));
    });
    // dev-only hook for automated play-testing
    if (import.meta.env.DEV) (window as unknown as { __mw: unknown }).__mw = { useGame, player, rides, getWorld, collidersNear, interact, cameraSnap, cameraDebug, enterBuilding, getBuildings, getLayout, getInterior, creatures, STOP_BY_ID };
    // sound needs a user gesture to start
    const startAudio = () => sound.start();
    window.addEventListener("pointerdown", startAudio);
    window.addEventListener("keydown", startAudio);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      unsub();
      window.removeEventListener("pointerdown", startAudio);
      window.removeEventListener("keydown", startAudio);
      document.body.style.overflow = prev;
      clearInput();
      sound.dispose();
    };
  }, []);

  useEffect(
    () =>
      attachKeyboard({
        onKey: (code) => {
          const st = useGame.getState();
          if (code === "Escape") {
            if (st.mapOpen) st.setMapOpen(false);
            if (st.controlsOpen) st.setControlsOpen(false);
            if (st.pickerOpen) st.setPickerOpen(false);
            if (st.story) st.hideStory();
            else if (st.hint) st.dismissHint();
          } else if (code === "KeyQ" && st.phase === "playing" && !st.mapOpen && !st.pickerOpen) {
            activatePower();
          } else if (code === "KeyF" && st.phase === "playing" && !st.mapOpen && !st.pickerOpen) {
            toggleRide();
          } else if (code === "KeyE" && st.phase === "playing" && !st.mapOpen && !st.pickerOpen) {
            interact();
          } else if (code === "KeyG" && st.phase === "playing" && !st.mapOpen && !st.pickerOpen) {
            doEmote();
          } else if (code === "KeyM" && st.phase === "playing") {
            st.setMapOpen(!st.mapOpen);
            clearInput();
          } else if (code === "KeyH" && st.phase === "playing") {
            st.setControlsOpen(!st.controlsOpen);
            clearInput();
          }
        },
      }),
    [],
  );

  useEffect(() => {
    if (!wrap.current || !webgl) return;
    return attachPointer(wrap.current);
  }, [webgl]);

  if (webgl === null) return <div className="bg-sky-gradient fixed inset-0" />;
  if (!webgl) return <WorldUnavailable reason="Your browser can't display 3D graphics, so the world can't open here. You can still read everything in the classic portfolio." />;
  if (crashed) return <WorldUnavailable reason="The 3D world hit a problem while loading on this device. Everything is still available in the classic portfolio." />;

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <div ref={wrap} className="absolute inset-0 touch-none select-none" aria-label="Mayur's World — explorable 3D island">
        <SceneBoundary onError={() => setCrashed(true)}>
          <Canvas
            shadows={{ type: THREE.PCFShadowMap }}
            dpr={dpr}
            camera={{ fov: 50, near: 0.5, far: 1400, position: [-24, 178, 262] }}
            gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}
          >
            {/* drops resolution a notch when the device can't keep up, and lifts it back when it can */}
            <PerformanceMonitor flipflops={3} onDecline={() => setDprScale((v) => Math.max(0.6, v - 0.2))} onIncline={() => setDprScale((v) => Math.min(1, v + 0.2))} onFallback={() => setDprScale(0.6)} />
            <WorldScene quality={isTouch ? "low" : "high"} />
          </Canvas>
        </SceneBoundary>
      </div>
      <DoorFade />
      <LoadingScreen />
      <OpeningScreen />
      <Hud />
      <MobileControls />
      <WorldMap />
      <ControlGuide />
      <CharacterPicker />
      <StoryCard />
      <Celebration />
    </div>
  );
}
