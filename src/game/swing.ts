/**
 * The rope swing by the treehouse: hangs from a long low branch. Sit on it
 * (action button) and it builds up a lazy pendulum; empty, it just stirs in
 * the breeze. Pure data + timing so the swing, the rider and tests agree.
 */
import { getWorld } from "./world";
import { TREEHOUSE } from "./trails";

export type Swing = {
  /** pivot on the branch */
  px: number;
  py: number;
  pz: number;
  /** seat top at rest */
  seatY: number;
  /** rope length pivot → seat */
  len: number;
  /** the rider faces this way (away from the trunk); the swing moves along it */
  yaw: number;
  ground: number;
};

let cache: Swing | null = null;

export function getSwing(): Swing {
  if (cache) return cache;
  const T = TREEHOUSE;
  const w = getWorld();
  const px = T.x - 5.4;
  const pz = T.z + 0.4;
  const ty = w.gridHeight(T.x, T.z);
  const ground = w.gridHeight(px, pz);
  const py = ty + 7.62;
  const seatY = ground + 0.58;
  cache = { px, py, pz, seatY, len: py - seatY, yaw: -Math.PI / 2, ground };
  return cache;
}

/** Biggest swing (rad) once it has built up. */
export const SWING_MAX = 0.62;
/** Seconds to pump up to full height. */
export const SWING_BUILD = 4;

/**
 * Swing angle at `now` (ms). `since` = when the rider sat down (0 = empty).
 * Positive = swung forward (along `yaw`).
 */
export function swingAngle(now: number, since: number) {
  const s = getSwing();
  const w = Math.sqrt(9.8 / s.len);
  const t = now / 1000;
  if (!since) return Math.sin(t * 0.9) * 0.035 + Math.sin(t * 2.3) * 0.012;
  const k = Math.min(1, (now - since) / 1000 / SWING_BUILD);
  const amp = SWING_MAX * k * k * (3 - 2 * k);
  return Math.sin(((now - since) / 1000) * w) * amp;
}

/** Seat offset from rest for an angle: forward along yaw, and up. */
export function swingOffset(angle: number) {
  const s = getSwing();
  return { along: s.len * Math.sin(angle), up: s.len * (1 - Math.cos(angle)) };
}
