import type { PowerId } from "./characters";

/** What a pet's ability does for you while it travels with you. */
export type PetPerk = "cooldown" | "duration" | "swim" | "jump" | "glide" | "climb" | "speed" | "ride";

/** Multipliers on the explorer's on-foot movement (1 = unchanged). */
export type FootBoost = {
  /** walk / run speed on land */
  walk: number;
  /** swim speed */
  swim: number;
  /** jump take-off speed */
  jump: number;
  /** gravity while airborne */
  gravity: number;
  /** extra gravity factor while falling (glide < 1) */
  fall: number;
  /** tallest ledge you can pull yourself onto mid-jump */
  mantle: number;
  /** ride top speed */
  ride: number;
};

/** Hero super powers that change how you move while they run. */
export const POWER_BOOST: Partial<Record<PowerId, Partial<FootBoost>>> = {
  speed: { walk: 2.1, swim: 1.6 },
  leap: { jump: 1.45, gravity: 0.55, mantle: 3 },
};

/** Pet abilities that work all the time. */
export const PERK_BOOST: Partial<Record<PetPerk, Partial<FootBoost>>> = {
  swim: { swim: 1.8 },
  jump: { jump: 1.25 },
  glide: { fall: 0.35 },
  climb: { mantle: 2 },
  speed: { walk: 1.25 },
  ride: { ride: 1.15 },
};

/** Combined movement boost from the running hero power (if any) and the pet's ability. */
export function footBoost(power: PowerId | null, perk: PetPerk | undefined): FootBoost {
  const b: FootBoost = { walk: 1, swim: 1, jump: 1, gravity: 1, fall: 1, mantle: 1, ride: 1 };
  for (const part of [power ? POWER_BOOST[power] : undefined, perk ? PERK_BOOST[perk] : undefined]) {
    if (!part) continue;
    for (const k of Object.keys(part) as (keyof FootBoost)[]) b[k] *= part[k] ?? 1;
  }
  return b;
}

/** A power's run time and recharge after the pet's ability (Byte recharges, Bao stretches it). */
export function powerTiming(def: { seconds: number; cooldown: number }, perk: PetPerk | undefined) {
  return {
    seconds: def.seconds * (perk === "duration" ? 1.5 : 1),
    cooldown: def.cooldown * (perk === "cooldown" ? 0.5 : 1),
  };
}
