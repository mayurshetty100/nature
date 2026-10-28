import { create } from "zustand";
import * as THREE from "three";
import type { StopId } from "./stops";
import type { HeroId, PetId, PowerId } from "./characters";
import type { RideId, VehicleId } from "./vehicles";
import type { Creature } from "./creatures";

export type GamePhase = "intro" | "entering" | "playing";
/** Steps of the opening flow: welcome → character → pet → vehicle → world overview. */
export type IntroStep = "welcome" | "hero" | "pet" | "vehicle" | "world";
export type { RideId, VehicleId };

export type Hint = { key: string; text: string };

type GameState = {
  phase: GamePhase;
  introStep: IntroStep;
  sceneReady: boolean;
  mapOpen: boolean;
  controlsOpen: boolean;
  pickerOpen: boolean;
  isTouch: boolean;
  reducedMotion: boolean;
  muted: boolean;
  heroId: HeroId;
  petId: PetId;
  vehicleId: VehicleId;
  visited: StopId[];
  currentStop: StopId | null;
  targetStop: StopId | null;
  distToTarget: number;
  /** chapter currently typing out on screen (never pauses the game) */
  story: { id: StopId; seq: number } | null;
  /** ride in reach: your own vehicle (or a place to call it) / the yacht */
  nearVehicle: RideId | null;
  riding: RideId | null;
  /** building door in reach (building id) */
  nearDoor: string | null;
  /** building the explorer is inside */
  inside: string | null;
  /** context action in reach (sit, lie down, take the lift, pet an animal…) shown as one prompt */
  nearAction: NearAction | null;
  /** bumps on every enter / exit so the screen can fade */
  fadeSeq: number;
  /** a soft fade covers the swap between the island and a room */
  doorFade: boolean;
  setDoorFade: (v: boolean) => void;
  swimming: boolean;
  /** explorer emote (performance.now() ms when it started) */
  emoteAt: number;
  celebrating: number;
  revealSeq: { id: StopId; seq: number } | null;
  hint: Hint | null;
  shownHints: string[];
  teleport: { id: StopId; seq: number } | null;
  /** tap-to-teleport from the map: any world point */
  warp: { x: number; z: number; seq: number } | null;
  arrival: { id: StopId; seq: number } | null;
  /** super power timing (performance.now() ms) */
  powerKind: PowerId | null;
  powerUntil: number;
  powerReadyAt: number;
  blink: { from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number }; seq: number } | null;

  setPhase: (p: GamePhase) => void;
  setIntroStep: (s: IntroStep) => void;
  setSceneReady: () => void;
  setMapOpen: (v: boolean) => void;
  setControlsOpen: (v: boolean) => void;
  setPickerOpen: (v: boolean) => void;
  toggleMuted: () => void;
  setEnv: (v: { isTouch: boolean; reducedMotion: boolean }) => void;
  setHero: (id: HeroId) => void;
  setPet: (id: PetId) => void;
  setVehicle: (id: VehicleId) => void;
  visit: (id: StopId) => void;
  showStory: (id: StopId) => void;
  hideStory: () => void;
  setNear: (vehicle: RideId | null) => void;
  setNearDoor: (id: string | null) => void;
  setInside: (id: string | null) => void;
  setNearAction: (a: NearAction | null) => void;
  setSwimming: (v: boolean) => void;
  setRiding: (v: RideId | null) => void;
  emote: () => void;
  celebrate: () => void;
  setNav: (current: StopId | null, target: StopId | null, dist: number) => void;
  say: (key: string, text: string, opts?: { once?: boolean }) => void;
  dismissHint: () => void;
  travelTo: (id: StopId) => void;
  warpTo: (x: number, z: number) => void;
  setPower: (kind: PowerId, until: number, readyAt: number) => void;
  blinked: (from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }) => void;
};

export type NearAction = { kind: "sit" | "lie" | "lift" | "stand" | "pet" | "roof" | "chill" | "trophy" | "dap"; label: string };

export const useGame = create<GameState>((set, get) => ({
  phase: "intro",
  introStep: "welcome",
  sceneReady: false,
  mapOpen: false,
  controlsOpen: false,
  pickerOpen: false,
  isTouch: false,
  reducedMotion: false,
  muted: false,
  heroId: "mayur",
  petId: "byte",
  vehicleId: "supercar",
  visited: [],
  currentStop: null,
  targetStop: "gate",
  distToTarget: 0,
  story: null,
  nearVehicle: null,
  riding: null,
  nearDoor: null,
  inside: null,
  nearAction: null,
  fadeSeq: 0,
  doorFade: false,
  setDoorFade: (doorFade) => set({ doorFade }),
  swimming: false,
  emoteAt: 0,
  celebrating: 0,
  revealSeq: null,
  hint: null,
  shownHints: [],
  teleport: null,
  warp: null,
  arrival: null,
  powerKind: null,
  powerUntil: 0,
  powerReadyAt: 0,
  blink: null,

  setPhase: (phase) => set({ phase }),
  setIntroStep: (introStep) => set({ introStep }),
  setSceneReady: () => set({ sceneReady: true }),
  setMapOpen: (mapOpen) => set({ mapOpen, controlsOpen: false, pickerOpen: false }),
  setControlsOpen: (controlsOpen) => set({ controlsOpen, mapOpen: false, pickerOpen: false }),
  setPickerOpen: (pickerOpen) => set({ pickerOpen, mapOpen: false, controlsOpen: false }),
  toggleMuted: () => set({ muted: !get().muted }),
  setEnv: (v) => set(v),
  setHero: (heroId) => set({ heroId, powerKind: null, powerUntil: 0, powerReadyAt: 0 }),
  setPet: (petId) => set({ petId }),
  setVehicle: (vehicleId) => {
    if (get().vehicleId === vehicleId) return;
    // a new vehicle arrives fresh next time you call it
    rides.land.placed = false;
    const riding = get().riding;
    set({ vehicleId, riding: riding && riding !== "yacht" ? null : riding });
  },
  visit: (id) => {
    if (get().visited.includes(id)) return;
    set({ visited: [...get().visited, id], arrival: { id, seq: Date.now() } });
  },
  showStory: (id) => {
    const seq = Date.now();
    set({ story: { id, seq }, revealSeq: { id, seq }, hint: null });
  },
  hideStory: () => set({ story: null }),
  setNear: (nearVehicle) => {
    if (get().nearVehicle !== nearVehicle) set({ nearVehicle });
  },
  setNearDoor: (nearDoor) => {
    if (get().nearDoor !== nearDoor) set({ nearDoor });
  },
  setInside: (inside) => set({ inside, nearDoor: null, nearVehicle: null, nearAction: null, fadeSeq: get().fadeSeq + 1 }),
  setNearAction: (a) => {
    const cur = get().nearAction;
    if (cur?.label === a?.label && cur?.kind === a?.kind) return;
    set({ nearAction: a });
  },
  setSwimming: (swimming) => {
    if (get().swimming !== swimming) set({ swimming });
  },
  setRiding: (riding) => set({ riding }),
  emote: () => set({ emoteAt: performance.now() }),
  celebrate: () => set({ celebrating: Date.now() }),
  setNav: (currentStop, targetStop, distToTarget) => {
    const s = get();
    if (s.currentStop === currentStop && s.targetStop === targetStop && Math.abs(s.distToTarget - distToTarget) < 1) return;
    set({ currentStop, targetStop, distToTarget });
  },
  say: (key, text, opts) => {
    const s = get();
    if (opts?.once && s.shownHints.includes(key)) return;
    if (s.hint?.key === key) return;
    set({ hint: { key, text }, shownHints: s.shownHints.includes(key) ? s.shownHints : [...s.shownHints, key] });
  },
  dismissHint: () => set({ hint: null }),
  travelTo: (id) => set({ teleport: { id, seq: Date.now() }, mapOpen: false }),
  warpTo: (x, z) => set({ warp: { x, z, seq: Date.now() }, mapOpen: false }),
  setPower: (powerKind, powerUntil, powerReadyAt) => set({ powerKind, powerUntil, powerReadyAt }),
  blinked: (from, to) => set({ blink: { from, to, seq: Date.now() } }),
}));

/** True when an overlay should take input away from the explorer. */
export function overlayOpen() {
  const s = useGame.getState();
  return s.mapOpen || s.controlsOpen || s.pickerOpen;
}

/** Per-frame mutable player state (never stored in React state). */
export const player = {
  position: new THREE.Vector3(-40, 6, 44),
  facing: Math.PI,
  speed: 0,
  roadIndex: 0,
  progress: 0,
  moving: false,
  scrolling: false,
  lastMoveAt: 0,
  /** vertical speed while jumping / falling */
  vy: 0,
  grounded: true,
  /** performance.now() of the last landing / take-off (for squash & stretch) */
  landedAt: 0,
  jumpedAt: 0,
  /** hover height above the ground while flying */
  flyAlt: 6,
  flying: false,
  swimming: false,
  /** water depth at the feet (0 on dry land) */
  wade: 0,
  /** forward speed along the facing (negative when reversing a vehicle) */
  drive: 0,
  /** wheelspin 0..1: tyres spinning faster than the ride moves (steep climbs, launches) */
  slip: 0,
  /** vehicle body pitch / roll from the terrain and suspension (radians) */
  pitch: 0,
  roll: 0,
  /** vehicle floating on water */
  afloat: false,
  /** where to come back out after visiting a building */
  outside: { x: 0, z: 0, yaw: 0 },
  /** resting indoors: sitting on a seat or lying on a bed */
  pose: "stand" as "stand" | "sit" | "lie",
  /** where you stand back up (interior-local indoors, world outdoors) */
  standAt: { x: 0, z: 0, y: 0 },
  /** sitting back at a chill spot with a juice: performance.now() it started (0 = not chilling) */
  chillAt: 0,
  /** performance.now() a bro dap started, and who with */
  dapAt: 0,
  dapWith: null as Creature | null,
  /** performance.now() the trophy lift started (0 = not lifting) */
  liftAt: 0,
  /** world point between the hands held overhead (written by the hero while lifting) */
  handsAt: new THREE.Vector3(),
  /** lounger (lean right back) or bench */
  chillKind: "bench" as "bench" | "lounger" | "swing",
  /** performance.now() of the last pat (the explorer reaches out and waves a hand over the animal) */
  petAt: 0,
  /** height of the patted animal's head above the explorer's feet (where the hand goes) */
  petH: 1,
};

/** Ride positions (mutable — vehicles stay where you leave them). */
export const rides = {
  /** the vehicle chosen at the start; `placed` once it has been called */
  land: { x: 0, y: 0, z: 0, yaw: 0, placed: false },
  yacht: { x: 0, y: 0, z: 0, yaw: 0, placed: false },
};

/** Shared animated time uniform for wind / water shaders. */
export const timeUniform = { value: 0 };

// dev-only handle for scripted checks: window.__game.{player, useGame}
if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as { __game: unknown }).__game = { player, useGame, rides };
