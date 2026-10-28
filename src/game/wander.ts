import { rng } from "./world";

export type Area = { x: number; z: number; r?: number; w?: number; d?: number };

export type WanderState = {
  x: number;
  z: number;
  yaw: number;
  tx: number;
  tz: number;
  wait: number;
  moving: boolean;
  /** current walking speed — eases up from a standstill and down on arrival (no snapping) */
  v: number;
  rand: () => number;
};

function pick(area: Area, rand: () => number) {
  if (area.w && area.d) return { x: area.x + (rand() - 0.5) * area.w, z: area.z + (rand() - 0.5) * area.d };
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(rand()) * (area.r ?? 5);
  return { x: area.x + Math.cos(a) * r, z: area.z + Math.sin(a) * r };
}

export function makeWander(area: Area, seed: number): WanderState {
  const rand = rng(seed);
  const p = pick(area, rand);
  const t = pick(area, rand);
  return { x: p.x, z: p.z, yaw: rand() * 6.28, tx: t.x, tz: t.z, wait: rand() * 4, moving: false, v: 0, rand };
}

/** Idle → stroll to a random spot → idle… Eases in and out of every walk and turns gently. Returns current speed. */
export function wanderStep(s: WanderState, area: Area, speed: number, dt: number, blocked?: (x: number, z: number) => boolean) {
  if (s.wait > 0) {
    s.wait -= dt;
    // coast to a gentle stop rather than freezing mid-stride
    s.v *= Math.exp(-6 * dt);
    if (s.v > 0.02) {
      s.x += Math.sin(s.yaw) * s.v * dt;
      s.z += Math.cos(s.yaw) * s.v * dt;
    } else s.v = 0;
    s.moving = s.v > 0.05;
    return s.v;
  }
  const dx = s.tx - s.x;
  const dz = s.tz - s.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.4) {
    s.wait = 2 + s.rand() * 6;
    const t = pick(area, s.rand);
    s.tx = t.x;
    s.tz = t.z;
    s.moving = s.v > 0.05;
    return s.v;
  }
  const want = Math.atan2(dx, dz);
  let dy = want - s.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  // turn smoothly, a little faster while standing
  s.yaw += dy * Math.min(1, dt * (s.v > 0.3 ? 1.8 : 2.6));
  // accelerate toward cruising speed, slow while turning hard and when nearly there
  const target = speed * Math.max(0, Math.cos(dy)) * Math.min(1, 0.35 + d / 2.2);
  s.v += (target - s.v) * (1 - Math.exp(-(target > s.v ? 1.8 : 4) * dt));
  const step = s.v * dt;
  const nx = s.x + Math.sin(s.yaw) * step;
  const nz = s.z + Math.cos(s.yaw) * step;
  if (blocked?.(nx, nz)) {
    const t = pick(area, s.rand);
    s.tx = t.x;
    s.tz = t.z;
    s.wait = 0.5;
    s.v *= 0.3;
    return 0;
  }
  s.x = nx;
  s.z = nz;
  s.moving = step > 0;
  return s.v;
}
