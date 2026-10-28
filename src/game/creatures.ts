/**
 * Animals you can pet (pasture, glade and woodland creatures) plus your own
 * companion. Each animal component registers one mutable entry and keeps its
 * x/z up to date every frame; petting stamps `petAt` and the animal reacts.
 */

export type AnimalVoice = "moo" | "neigh" | "baa" | "oink" | "purr" | "trumpet" | "yip" | "coo";

export type Creature = {
  name: string;
  x: number;
  z: number;
  y: number;
  /** body radius (also its collision radius) */
  r: number;
  /** height of the animal, for the hearts */
  height: number;
  voice: AnimalVoice;
  /** performance.now() of the last pat (0 = never) */
  petAt: number;
  /** true for the explorer's own companion */
  own?: boolean;
  /** a person (villager, farmer, city local): you dap them up instead of petting */
  person?: boolean;
};

/** How long an animal stays still and happy after a pat. */
export const PET_REACT_MS = 3200;

export const creatures: Creature[] = [];

export function addCreature(c: Creature) {
  creatures.push(c);
  return () => {
    const i = creatures.indexOf(c);
    if (i >= 0) creatures.splice(i, 1);
  };
}

/** Reach for a pat: a little beyond the animal's body. */
export const petReach = (c: Creature) => c.r + 1.6;

/** Closest creature within petting reach of (x, z), or null. */
export function nearestCreature(x: number, z: number, y: number, accept?: (c: Creature) => boolean) {
  let best: Creature | null = null;
  let bd = Infinity;
  for (const c of creatures) {
    if (Math.abs(c.y - y) > 2.5) continue;
    if (accept && !accept(c)) continue;
    const d = Math.hypot(c.x - x, c.z - z) - petReach(c);
    if (d < 0 && d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

/** 0‥1 progress through the happy reaction, or -1 when not reacting. */
export function reaction(c: Creature, now: number) {
  if (!c.petAt) return -1;
  const k = (now - c.petAt) / PET_REACT_MS;
  return k >= 0 && k < 1 ? k : -1;
}

const ease = (x: number) => x * x * (3 - 2 * x);

/**
 * How far a patted animal leans into your hand (0‥1) for a reaction progress
 * `k` from `reaction()`: bends in softly, stays nuzzling while the hand
 * waves, then straightens up.
 */
export function nuzzle(k: number) {
  if (k < 0 || k >= 1) return 0;
  if (k < 0.15) return ease(k / 0.15);
  if (k < 0.7) return 1;
  return 1 - ease((k - 0.7) / 0.3);
}

/** How long the explorer holds a hand out and waves it over the animal. */
export const PET_WAVE_MS = 2200;

/** 0‥1 weight of the explorer's petting hand `ms` after the pat started. */
export function petHand(ms: number) {
  if (ms < 0 || ms >= PET_WAVE_MS) return 0;
  const k = ms / PET_WAVE_MS;
  if (k < 0.12) return ease(k / 0.12);
  if (k < 0.85) return 1;
  return 1 - ease((k - 0.85) / 0.15);
}

/** Floating heart bursts (rendered by HeartBursts in the world). */
export const heartQueue: { x: number; y: number; z: number; at: number }[] = [];

export function heartBurst(x: number, y: number, z: number) {
  heartQueue.push({ x, y, z, at: performance.now() });
  if (heartQueue.length > 6) heartQueue.shift();
}
