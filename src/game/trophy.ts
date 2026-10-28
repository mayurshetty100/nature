/**
 * The Main Character Peak trophy: walk up to its pedestal, press the action
 * button, and it floats down into the explorer's hands to be lifted overhead
 * while the celebration goes off — then it glides back home.
 */
import { STOP_BY_ID } from "./stops";

export const LIFT = {
  /** whole lift-and-celebrate, ms */
  ms: 7500,
  /** float down into the hands */
  flyIn: 800,
  /** float back up onto the pedestal */
  flyOut: 1000,
  /** how close you must stand to the pedestal centre */
  reach: 4.6,
  /** trophy size in the hands (vs on the pedestal) */
  handScale: 0.34,
};

/** 0 = resting on the pedestal, 1 = held overhead. `ms` since the lift started. */
export function carryWeight(ms: number) {
  if (ms < 0 || ms >= LIFT.ms) return 0;
  const ease = (k: number) => k * k * (3 - 2 * k);
  if (ms < LIFT.flyIn) return ease(ms / LIFT.flyIn);
  if (ms > LIFT.ms - LIFT.flyOut) return ease((LIFT.ms - ms) / LIFT.flyOut);
  return 1;
}

export function trophySpot() {
  const s = STOP_BY_ID.peak;
  return { x: s.lx, z: s.lz };
}

/** Standing close enough to the pedestal to lift the trophy. */
export function nearTrophy(x: number, z: number) {
  const t = trophySpot();
  return Math.hypot(x - t.x, z - t.z) < LIFT.reach;
}
