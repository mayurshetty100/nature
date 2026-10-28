import * as THREE from "three";
import type { HeroMovePose } from "./moves";

/**
 * Procedural limb posing layered on top of the explorer's animation clips:
 * petting hand, running arm/leg swing and signature-move kicks. Every bone
 * change is undone next frame when the clip didn't rewrite the bone itself,
 * so poses never pile up.
 */

export type PoseBone = { b: THREE.Object3D; tip: THREE.Object3D; base: THREE.Quaternion; set: THREE.Quaternion; on: boolean; touched: boolean };
export type Limbs = {
  armR: PoseBone;
  armL: PoseBone;
  foreR: PoseBone;
  foreL: PoseBone;
  legR: PoseBone;
  legL: PoseBone;
  shinR: PoseBone;
  shinL: PoseBone;
};

function poseBone(m: THREE.Object3D, name: string, tip: string): PoseBone | null {
  // the model loader drops the dots from bone names ("UpperArm.R" → "UpperArmR")
  const b = m.getObjectByName(name.replace(".", ""));
  const t = m.getObjectByName(tip.replace(".", ""));
  return b && t && b.parent ? { b, tip: t, base: new THREE.Quaternion(), set: new THREE.Quaternion(), on: false, touched: false } : null;
}

/** Find the arm and leg bones of a rigged explorer (null when the rig differs). */
export function rigLimbs(model: THREE.Object3D): Limbs | null {
  const l = {
    armR: poseBone(model, "UpperArm.R", "LowerArm.R"),
    armL: poseBone(model, "UpperArm.L", "LowerArm.L"),
    foreR: poseBone(model, "LowerArm.R", "Fist.R"),
    foreL: poseBone(model, "LowerArm.L", "Fist.L"),
    legR: poseBone(model, "UpperLeg.R", "LowerLeg.R"),
    legL: poseBone(model, "UpperLeg.L", "LowerLeg.L"),
    shinR: poseBone(model, "LowerLeg.R", "Foot.R"),
    shinL: poseBone(model, "LowerLeg.L", "Foot.L"),
  };
  return Object.values(l).every(Boolean) ? (l as Limbs) : null;
}

const ORDER: (keyof Limbs)[] = ["armR", "armL", "legR", "legL", "foreR", "foreL", "shinR", "shinL"];

/** Start of frame: undo last frame's pose where the clip left the bone alone. */
export function beginPose(l: Limbs) {
  for (const k of ORDER) {
    const p = l[k];
    if (p.on && p.b.quaternion.equals(p.set)) p.b.quaternion.copy(p.base);
    p.on = false;
    p.touched = false;
  }
}

/** End of frame: remember what we wrote so it can be undone next frame. */
export function endPose(l: Limbs) {
  for (const k of ORDER) {
    const p = l[k];
    if (!p.touched) continue;
    p.set.copy(p.b.quaternion);
    p.on = true;
  }
}

function touch(p: PoseBone) {
  if (!p.touched) {
    p.base.copy(p.b.quaternion);
    p.touched = true;
  }
}

const pa = new THREE.Vector3();
const pb = new THREE.Vector3();
const axisW = new THREE.Vector3();
const qPar = new THREE.Quaternion();
const qInv = new THREE.Quaternion();
const qD = new THREE.Quaternion();
const qW = new THREE.Quaternion();
const qBodyInv = new THREE.Quaternion();

/** Apply a world-space rotation to a bone (keeps its parent chain intact). */
function rotateWorld(p: PoseBone, q: THREE.Quaternion) {
  touch(p);
  p.b.parent!.getWorldQuaternion(qPar);
  qInv.copy(qPar).invert();
  p.b.quaternion.premultiply(qPar).premultiply(q).premultiply(qInv);
}

/** Turn a bone by `angle` about an axis given in the character's own frame. */
export function turn(p: PoseBone, axis: THREE.Vector3, angle: number, qBody: THREE.Quaternion) {
  if (Math.abs(angle) < 1e-4) return;
  axisW.copy(axis).applyQuaternion(qBody);
  qD.setFromAxisAngle(axisW, angle);
  rotateWorld(p, qD);
}

/** Point a bone (weight w) along a world direction. */
export function aim(p: PoseBone, to: THREE.Vector3, w: number) {
  p.b.getWorldPosition(pa);
  p.tip.getWorldPosition(pb);
  pb.sub(pa).normalize();
  qD.setFromUnitVectors(pb, to);
  qW.identity().slerp(qD, w);
  rotateWorld(p, qW);
}

/** How far a bone swings forward (+) or back (−) from hanging straight down, in the character frame. */
export function swingOf(p: PoseBone, qBody: THREE.Quaternion) {
  p.b.getWorldPosition(pa);
  p.tip.getWorldPosition(pb);
  pb.sub(pa);
  qBodyInv.copy(qBody).invert();
  pb.applyQuaternion(qBodyInv);
  return Math.atan2(pb.z, -pb.y);
}

export const SIDE = new THREE.Vector3(1, 0, 0);
export const FWD = new THREE.Vector3(0, 0, 1);
export const UP = new THREE.Vector3(0, 1, 0);

/** Forward swing about the sideways axis: positive = limb swings forward. */
const swing = (p: PoseBone, a: number, q: THREE.Quaternion) => turn(p, SIDE, -a, q);
/** Knee / elbow bend: positive = lower part folds back (knee) — use negative for elbows forward. */
const fold = (p: PoseBone, a: number, q: THREE.Quaternion) => turn(p, SIDE, a, q);

export type GaitState = { lastR: number; lastL: number; tuckR: number; tuckL: number };
export const gaitState = (): GaitState => ({ lastR: 0, lastL: 0, tuckR: 0, tuckL: 0 });

/**
 * Turns the walk clip into a believable walk → run: bigger opposite arm/leg
 * swing, bent elbows, knees that tuck on the forward swing. `run` 0 = walk,
 * 1 = full sprint.
 */
export function applyGait(l: Limbs, q: THREE.Quaternion, run: number, walking: number, dt: number, s: GaitState) {
  if (walking <= 0) return;
  const gainLeg = (0.12 + run * 0.55) * walking;
  const gainArm = (0.35 + run * 0.9) * walking;
  const aR = swingOf(l.legR, q);
  const aL = swingOf(l.legL, q);
  swing(l.legR, aR * gainLeg, q);
  swing(l.legL, aL * gainLeg, q);
  // knees tuck while that leg swings forward (foot clears the ground)
  const vR = (aR - s.lastR) / Math.max(dt, 1e-3);
  const vL = (aL - s.lastL) / Math.max(dt, 1e-3);
  s.lastR = aR;
  s.lastL = aL;
  const k = 1 - Math.exp(-14 * dt);
  s.tuckR += (Math.max(0, Math.min(1, vR * 0.35)) - s.tuckR) * k;
  s.tuckL += (Math.max(0, Math.min(1, vL * 0.35)) - s.tuckL) * k;
  fold(l.shinR, (0.12 + s.tuckR * (0.45 + run * 0.9)) * walking, q);
  fold(l.shinL, (0.12 + s.tuckL * (0.45 + run * 0.9)) * walking, q);
  // arms counter-swing the legs; elbows bend more as you speed up
  const armR = swingOf(l.armR, q);
  const armL = swingOf(l.armL, q);
  swing(l.armR, (armR * gainArm - aR * 0.25 * run) * 1, q);
  swing(l.armL, (armL * gainArm - aL * 0.25 * run) * 1, q);
  fold(l.foreR, -(0.25 + run * 1.05) * walking, q);
  fold(l.foreL, -(0.25 + run * 1.05) * walking, q);
}

/** Layer a signature-move pose (from `heroMove`) over the emote clip. */
export function applyMove(l: Limbs, q: THREE.Quaternion, m: HeroMovePose) {
  swing(l.legR, m.legR, q);
  swing(l.legL, m.legL, q);
  if (m.legOutR) {
    // raise the leg out to its own side, whichever side the rig puts it on
    l.legR.b.getWorldPosition(pa);
    l.legL.b.getWorldPosition(pb);
    pa.sub(pb).applyQuaternion(qBodyInv.copy(q).invert());
    turn(l.legR, FWD, Math.sign(pa.x || 1) * m.legOutR, q);
  }
  fold(l.shinR, m.shinR, q);
  fold(l.shinL, m.shinL, q);
  swing(l.armR, m.armR, q);
  swing(l.armL, m.armL, q);
  // horizontal arc of a raised arm (applied after the raise)
  if (m.sweepR) turn(l.armR, UP, m.sweepR, q);
  if (m.sweepL) turn(l.armL, UP, m.sweepL, q);
  fold(l.foreR, m.foreR, q);
  fold(l.foreL, m.foreL, q);
}
