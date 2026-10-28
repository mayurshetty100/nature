import * as THREE from "three";

export const SUN_DIR = new THREE.Vector3(0.75, 0.3, -0.6).normalize();
export const FOG_COLOR = "#f3c6a5";
export const SIGN_FONT = "/fonts/LobsterTwo-Bold.ttf";
/** Render layer only the sun's shadow camera sees (shadow-only proxies). */
export const SHADOW_LAYER = 1;

/** Shared glowing lantern material — DayNight brightens it after dusk. */
export const lanternMaterial = new THREE.MeshStandardMaterial({ color: "#ffd27e", emissive: "#ffa940", emissiveIntensity: 1.6, roughness: 0.4 });
/** Shared warm window glow for houses and buildings. */
export const windowMaterial = new THREE.MeshStandardMaterial({ color: "#ffd58a", emissive: "#ffb04a", emissiveIntensity: 0.8 });

/** Storybook city palettes: wall tint, trim, shop front, awning, glass tint. */
export const CITY_PALETTES = [
  { wall: "#f6e3c4", trim: "#ffffff", shop: "#3f6a8a", awning: "#e0604a", glass: "#a9d4ef" },
  { wall: "#f7c9a8", trim: "#fff4e6", shop: "#5a4a7a", awning: "#3e9f7f", glass: "#9fc9e8" },
  { wall: "#cfe5f2", trim: "#ffffff", shop: "#6b4b3a", awning: "#f2b440", glass: "#b5dcf2" },
  { wall: "#d8ecd0", trim: "#f9fff4", shop: "#36536b", awning: "#e8746a", glass: "#a3d0e6" },
  { wall: "#f3d2d6", trim: "#ffffff", shop: "#44606e", awning: "#5b8fd6", glass: "#b0d6ee" },
  { wall: "#e9dcf3", trim: "#ffffff", shop: "#4d5a3a", awning: "#f08f3c", glass: "#a6cfe9" },
];

export const CAR_COLORS = ["#3f7fd1", "#e2574c", "#f4f1ea", "#57b38a", "#2f3b4c", "#f29a4a"];

/** Tree kinds drawn as procedural, leafy trees (see treeModels.ts) instead of their low-poly GLBs. */
export const PROCEDURAL_TREES = new Set<string>(["oak", "default", "detailed", "fat", "tall", "pineTall", "pineRound", "cone"]);
