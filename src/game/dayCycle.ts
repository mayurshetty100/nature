/**
 * Time of day follows the journey: morning at the gate, golden afternoon in the
 * middle of the island, sunset on the peak and a starry night at the lighthouse.
 */
import * as THREE from "three";

export type Light = {
  skyTop: string;
  skyMid: string;
  horizon: string;
  sunColor: string;
  sunIntensity: number;
  sunElev: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  ambient: number;
  oceanDeep: string;
  oceanShallow: string;
  cloud: string;
  cloudGlow: string;
  lanterns: number;
  night: number;
};

export const KEYS: { t: number; l: Light }[] = [
  {
    t: 0,
    l: { skyTop: "#5d9fe6", skyMid: "#a7d0f2", horizon: "#f6e6cf", sunColor: "#fff2d8", sunIntensity: 2.9, sunElev: 0.62, hemiSky: "#f4f7ff", hemiGround: "#6a9356", hemiIntensity: 1.1, ambient: 0.22, oceanDeep: "#2a86b0", oceanShallow: "#62d2d2", cloud: "#ffffff", cloudGlow: "#fff3e6", lanterns: 0.6, night: 0 },
  },
  {
    t: 0.4,
    l: { skyTop: "#4f8bd6", skyMid: "#b8c7e8", horizon: "#fbd9b2", sunColor: "#ffe6bd", sunIntensity: 2.8, sunElev: 0.42, hemiSky: "#ffeedd", hemiGround: "#62894f", hemiIntensity: 1.05, ambient: 0.2, oceanDeep: "#2b80a4", oceanShallow: "#5fc9c9", cloud: "#fff8ef", cloudGlow: "#ffe2c8", lanterns: 0.9, night: 0 },
  },
  {
    t: 0.68,
    l: { skyTop: "#4f86cf", skyMid: "#b4a7d8", horizon: "#f3c6a5", sunColor: "#ffd2a0", sunIntensity: 2.5, sunElev: 0.24, hemiSky: "#ffe2c6", hemiGround: "#5f8a4f", hemiIntensity: 1.0, ambient: 0.18, oceanDeep: "#2f7f9e", oceanShallow: "#5fc7c9", cloud: "#fff2ea", cloudGlow: "#ffc9a8", lanterns: 1.6, night: 0.05 },
  },
  {
    t: 0.86,
    l: { skyTop: "#2c3c7c", skyMid: "#8a5f9e", horizon: "#f2967a", sunColor: "#ff9f6e", sunIntensity: 1.5, sunElev: 0.08, hemiSky: "#c9a4c8", hemiGround: "#3e5a44", hemiIntensity: 0.85, ambient: 0.16, oceanDeep: "#244f7a", oceanShallow: "#4a8fa6", cloud: "#f4c6c6", cloudGlow: "#ff9e8a", lanterns: 2.4, night: 0.45 },
  },
  {
    t: 1,
    l: { skyTop: "#0b1433", skyMid: "#1e2b5e", horizon: "#3c4478", sunColor: "#a9bfff", sunIntensity: 0.75, sunElev: 0.5, hemiSky: "#5a6fae", hemiGround: "#1d2a2e", hemiIntensity: 0.65, ambient: 0.14, oceanDeep: "#13284d", oceanShallow: "#2a5a7a", cloud: "#8a93bf", cloudGlow: "#5560a0", lanterns: 3.2, night: 1 },
  },
];

const cA = new THREE.Color();
const cB = new THREE.Color();

/** Live, mutable lighting state read by sky, ocean, lights and lanterns. */
export const daylight = {
  t: 0.68,
  sunDir: new THREE.Vector3(0.75, 0.3, -0.6).normalize(),
  skyTop: new THREE.Color(),
  skyMid: new THREE.Color(),
  horizon: new THREE.Color(),
  sunColor: new THREE.Color(),
  hemiSky: new THREE.Color(),
  hemiGround: new THREE.Color(),
  oceanDeep: new THREE.Color(),
  oceanShallow: new THREE.Color(),
  cloud: new THREE.Color(),
  cloudGlow: new THREE.Color(),
  sunIntensity: 2.5,
  hemiIntensity: 1,
  ambient: 0.18,
  lanterns: 1.6,
  night: 0,
};

const COLOR_KEYS = ["skyTop", "skyMid", "horizon", "sunColor", "hemiSky", "hemiGround", "oceanDeep", "oceanShallow", "cloud", "cloudGlow"] as const;
const NUM_KEYS = ["sunIntensity", "hemiIntensity", "ambient", "lanterns", "night"] as const;

/** Blend the keyframes at time t (0..1) into `daylight`. */
export function applyTime(t: number) {
  const tt = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < KEYS.length - 2 && tt > KEYS[i + 1].t) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const k = (tt - a.t) / (b.t - a.t || 1);
  const s = k * k * (3 - 2 * k);
  for (const key of COLOR_KEYS) {
    cA.set(a.l[key]);
    cB.set(b.l[key]);
    daylight[key].copy(cA).lerp(cB, s);
  }
  for (const key of NUM_KEYS) daylight[key] = a.l[key] + (b.l[key] - a.l[key]) * s;
  const elev = a.l.sunElev + (b.l.sunElev - a.l.sunElev) * s;
  // sun travels east → west across the sky; at night this is the moon, high in the north
  const az = tt < 0.93 ? -0.9 + tt * 1.4 : 2.2;
  daylight.sunDir.set(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev)).normalize();
  daylight.t = tt;
}

applyTime(0.68);

/** Journey progress (0 at start of the road → 1 at the end) mapped to time of day. */
export function timeForProgress(p: number) {
  return Math.min(1, Math.max(0, p)) * 0.98;
}
