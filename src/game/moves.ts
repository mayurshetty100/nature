/**
 * Signature moves as pure motion curves (no rendering): pets get a whole-body
 * stunt; explorers get a limb timeline layered on top of their emote clip.
 * The picker previews and the world both read these, so a move looks the
 * same everywhere.
 */

export type PetMoveKind = "orbit" | "roll" | "twirl" | "backflip" | "loop" | "pounce" | "zoomies" | "cartwheel";

/** Whole-body offsets for a pet stunt (metres / radians). */
export type PetPose = { y: number; z: number; rx: number; ry: number; rz: number; sy: number };

const TAU = Math.PI * 2;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x: number) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};
/** 0 → 1 → 0 bump over [a, b]. */
const bump = (k: number, a: number, b: number) => (k <= a || k >= b ? 0 : Math.sin(((k - a) / (b - a)) * Math.PI));

/** How long each pet stunt lasts (seconds). */
export const PET_MOVE_SECS: Record<PetMoveKind, number> = {
  orbit: 2.2,
  roll: 1.8,
  twirl: 2,
  backflip: 1.5,
  loop: 2.2,
  pounce: 1.6,
  zoomies: 2.4,
  cartwheel: 1.6,
};

/** The pet's body pose `k` (0‥1) of the way through its signature stunt. */
export function petMove(kind: PetMoveKind, k: number): PetPose {
  const p: PetPose = { y: 0, z: 0, rx: 0, ry: 0, rz: 0, sy: 1 };
  if (k <= 0 || k >= 1) return p;
  // a little crouch before every take-off, a squash on landing
  const crouch = bump(k, 0, 0.18) * 0.12;
  const land = bump(k, 0.82, 1) * 0.1;
  switch (kind) {
    case "orbit":
      p.y = bump(k, 0, 1) * 0.45;
      p.ry = ease(k) * TAU * 3;
      p.rz = bump(k, 0.1, 0.9) * 0.3;
      break;
    case "roll":
      p.y = bump(k, 0.15, 0.85) * 0.35;
      p.rx = ease((k - 0.15) / 0.7) * TAU;
      p.sy = 1 - crouch - land;
      break;
    case "twirl":
      p.rx = bump(k, 0, 1) * 1.1;
      p.ry = ease(k) * TAU * 2;
      p.y = bump(k, 0, 1) * 0.08;
      break;
    case "backflip":
      p.y = bump(k, 0.15, 0.85) * 0.9;
      p.rx = -ease((k - 0.18) / 0.62) * TAU;
      p.sy = 1 - crouch - land;
      break;
    case "loop": {
      const a = ease(k) * TAU;
      p.y = (1 - Math.cos(a)) * 0.45;
      p.z = Math.sin(a) * 0.45;
      p.rx = -a;
      break;
    }
    case "pounce":
      p.y = bump(k, 0.25, 0.75) * 0.5;
      p.z = ease((k - 0.25) / 0.5) * 0.7 - ease((k - 0.8) / 0.2) * 0.7;
      p.rx = k < 0.25 ? -crouch * 2 : bump(k, 0.25, 0.75) * -0.35;
      p.sy = 1 - crouch * 1.5 - land;
      break;
    case "zoomies":
      p.ry = ease(k) * TAU * 3;
      p.y = Math.abs(Math.sin(k * Math.PI * 8)) * 0.16 * bump(k, 0, 1);
      p.rz = bump(k, 0, 1) * 0.25;
      break;
    case "cartwheel":
      p.y = bump(k, 0.15, 0.85) * 0.6;
      p.rz = ease((k - 0.15) / 0.7) * TAU;
      p.sy = 1 - crouch - land;
      break;
  }
  return p;
}

/** A pet in the world shows off its stunt about this often (seconds, min + random range). */
export const PET_MOVE_EVERY = { min: 14, range: 10 };

/* ---------------- explorers ---------------- */

/**
 * Extra limb angles (radians, about the character's sideways axis unless
 * noted) for an explorer's signature move `k` (0‥1) of the way through.
 * Positive leg/arm angles swing forward; `sweep*` swings a raised arm
 * sideways (horizontal slash, + = toward the body's left). `flip` tips the
 * whole body forward (+) / back (−) round the hips, `spin` turns it, `lift`
 * raises it, `lunge` slides it forward.
 */
export type HeroMovePose = {
  legR: number;
  legL: number;
  shinR: number;
  shinL: number;
  /** sideways leg raise for round kicks */
  legOutR: number;
  armR: number;
  armL: number;
  foreR: number;
  foreL: number;
  sweepR: number;
  sweepL: number;
  flip: number;
  spin: number;
  lift: number;
  lunge: number;
  crouch: number;
};

export type HeroMoveKind = "jetpack" | "kungfu" | "voidflip" | "blossomkick" | "thunderflip";

const zero = (): HeroMovePose => ({ legR: 0, legL: 0, shinR: 0, shinL: 0, legOutR: 0, armR: 0, armL: 0, foreR: 0, foreL: 0, sweepR: 0, sweepL: 0, flip: 0, spin: 0, lift: 0, lunge: 0, crouch: 0 });
/** 0 → 1 ramp over [a, b], eased. */
const ramp = (k: number, a: number, b: number) => ease((k - a) / (b - a));

/** Tuck the legs mid-air (flips, jumps). */
function tuck(p: HeroMovePose, w: number) {
  p.legR += w * 1.4;
  p.legL += w * 1.4;
  p.shinR += w * 1.9;
  p.shinL += w * 1.9;
}

export function heroMove(kind: HeroMoveKind, k: number): HeroMovePose {
  const p = zero();
  if (k <= 0 || k >= 1) return p;
  switch (kind) {
    case "jetpack": {
      // crouch → blast off → superman flight loop, fist to the sky → soft landing
      p.crouch = bump(k, 0, 0.14) * 0.22 + bump(k, 0.86, 1) * 0.16;
      const up = ramp(k, 0.1, 0.3) * (1 - ramp(k, 0.78, 0.92));
      p.lift = up * 3.2 + Math.sin(k * Math.PI * 6) * 0.12 * up;
      p.flip = up * 0.55; // lean into the flight
      p.spin = ramp(k, 0.3, 0.78) * TAU; // one victory lap
      p.armL = up * 2.9; // fist punched to the sky
      p.armR = up * 1.6; // other fist pointing ahead
      p.sweepR = -up * 0.35;
      p.legR = -up * 0.35;
      p.legL = -up * 0.1;
      p.shinR = up * 0.7;
      p.shinL = up * 0.4;
      break;
    }
    case "kungfu": {
      // horse stance → front snap kick → jumping spin kick → bow
      const stance = bump(k, 0, 0.3);
      p.crouch = stance * 0.14 + bump(k, 0.86, 1) * 0.06;
      p.legL = -stance * 0.35;
      p.legR = stance * 0.35 + bump(k, 0.28, 0.5) * 1.55;
      p.shinR = bump(k, 0.28, 0.36) * 0.9;
      const sp = (k - 0.52) / 0.3;
      p.spin = ease(sp) * TAU;
      p.lift = bump(k, 0.52, 0.82) * 0.45;
      p.legOutR = bump(k, 0.54, 0.8) * 1.3;
      p.armL = bump(k, 0.52, 0.82) * 0.6;
      p.foreL = -bump(k, 0.52, 0.82) * 1.2;
      break;
    }
    case "voidflip": {
      // crouch → high backflip → lands floating with both palms out, orbs blazing
      p.crouch = bump(k, 0, 0.16) * 0.24 + bump(k, 0.52, 0.62) * 0.14;
      const air = bump(k, 0.14, 0.56);
      p.lift = air * 1.5 + bump(k, 0.62, 0.98) * 0.35;
      p.flip = -ramp(k, 0.17, 0.53) * TAU;
      tuck(p, bump(k, 0.2, 0.5));
      p.armR = -bump(k, 0.12, 0.22) * 0.8 + bump(k, 0.62, 0.97) * 1.5;
      p.armL = -bump(k, 0.12, 0.22) * 0.8 + bump(k, 0.62, 0.97) * 1.5;
      p.sweepR = bump(k, 0.62, 0.97) * 0.35;
      p.sweepL = -bump(k, 0.62, 0.97) * 0.35;
      break;
    }
    case "blossomkick": {
      // two high roundhouse kicks → spinning crescent kick → front flip landing in a pose
      const k1 = bump(k, 0.02, 0.2);
      const k2 = bump(k, 0.2, 0.36);
      p.legR = k1 * 1.7;
      p.legOutR = k1 * 0.6;
      p.legL = k2 * 1.6;
      p.shinR = k1 * 0.35;
      p.shinL = k2 * 0.35;
      p.armR = (k1 + k2) * 0.9; // guard up
      p.armL = (k1 + k2) * 1.3;
      p.foreR = -(k1 + k2) * 1.1;
      p.foreL = -(k1 + k2) * 1.2;
      p.crouch = (k1 + k2) * 0.06;
      const spinKick = bump(k, 0.38, 0.62);
      p.spin = ramp(k, 0.38, 0.62) * TAU;
      p.lift = spinKick * 0.6 + bump(k, 0.64, 0.9) * 1.25;
      p.legOutR += spinKick * 1.3;
      p.armL += spinKick * 0.8;
      p.sweepL = spinKick * 0.8;
      p.flip = ramp(k, 0.66, 0.88) * TAU;
      tuck(p, bump(k, 0.68, 0.86));
      p.armL += bump(k, 0.9, 1) * 1.2; // finishing pose, palm forward
      p.armR += bump(k, 0.9, 1) * 2.4;
      p.crouch += bump(k, 0.88, 1) * 0.12;
      break;
    }
    case "thunderflip": {
      // dash lunge → crossed lightning-palm strike → backflip away
      const dash = bump(k, 0.02, 0.4);
      p.lunge = dash * 0.9;
      p.crouch = dash * 0.2;
      p.legL = dash * 0.9;
      p.shinL = dash * 0.7;
      p.legR = -dash * 0.7;
      const raise = bump(k, 0.05, 0.5);
      const cut = ramp(k, 0.25, 0.4);
      p.armR = raise * (2.5 - cut * 1.6);
      p.armL = raise * (2.5 - cut * 1.6);
      p.sweepR = raise * (-0.6 + cut * 1.4);
      p.sweepL = raise * (0.6 - cut * 1.4);
      const air = bump(k, 0.5, 0.92);
      p.lift = air * 1.3;
      p.lunge -= ramp(k, 0.5, 0.92) * 0.6 * (1 - ramp(k, 0.92, 1));
      p.flip = -ramp(k, 0.53, 0.88) * TAU;
      tuck(p, bump(k, 0.56, 0.86));
      p.crouch += bump(k, 0.88, 1) * 0.15;
      break;
    }
  }
  return p;
}
