import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { measureHeight, stylizeModel } from "./models";
import type { HeroLook } from "./characters";
import { addOutfit } from "./heroOutfit";
import { attach, materialPoints, type HeroRig } from "./heroRig";

export type { HeroRig } from "./heroRig";

export const HERO_HEIGHT = 1.8;

/**
 * Clone a rigged explorer, give it its own materials, paint skin / hair /
 * outfit, and sculpt the chosen hairstyle, face details and bands onto the
 * head bone so they follow every animation.
 */
export function buildHero(scene: THREE.Object3D, url: string, look: HeroLook) {
  const m = SkeletonUtils.clone(scene) as THREE.Group;
  m.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((x) => x.clone()) : mesh.material.clone();
  });
  stylizeModel(m, url);
  m.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
    for (const mat of mats) {
      if (!mat.color) continue;
      if (mat.name === "Skin") {
        mat.color.set(look.skin);
        mat.roughness = 0.7;
      } else if (mat.name === "Hair") {
        mat.color.set(look.hair);
        mat.roughness = 0.55;
      } else if (look.outfit?.[mat.name]) {
        mat.color.set(look.outfit[mat.name]);
      }
    }
  });
  const h = measureHeight(m, 3.3);
  if (look.hairStyle) addSculpt(m, look);
  return { model: m, scale: HERO_HEIGHT / h };
}

function addSculpt(m: THREE.Group, look: HeroLook) {
  const head = m.getObjectByName("Head");
  if (!head) return;
  m.updateMatrixWorld(true);
  m.traverse((o) => {
    const s = o as THREE.SkinnedMesh;
    if (s.isSkinnedMesh) s.skeleton.update();
  });
  const box = new THREE.Box3().setFromObject(m, true);
  const hp = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld);
  const top = box.max.y;

  // the "Face" material holds the brows (top bars) and the eyes (ovals below)
  const facePts = materialPoints(m, "Face");
  const fb = new THREE.Box3().setFromPoints(facePts);
  const splitY = fb.max.y - (fb.max.y - fb.min.y) * 0.3;
  const eyes = facePts.filter((p) => p.y < splitY);
  const eyeBox = new THREE.Box3().setFromPoints(eyes.length ? eyes : facePts);
  const ec = eyeBox.getCenter(new THREE.Vector3());
  const left = eyes.filter((p) => p.x > ec.x);
  const right = eyes.filter((p) => p.x <= ec.x);
  const eyeL = new THREE.Box3().setFromPoints(left.length ? left : eyes);
  const eyeR = new THREE.Box3().setFromPoints(right.length ? right : eyes);
  const eyeW = Math.max(1e-3, eyeL.max.x - eyeL.min.x);
  const eyeH = Math.max(1e-3, eyeBox.max.y - eyeBox.min.y);
  const skinPts = materialPoints(m, "Skin").filter((p) => p.y > hp.y);
  /** how far forward the face surface is around (x, y) */
  const frontZ = (x: number, y: number, rad: number) => {
    let z = -Infinity;
    for (const p of skinPts) if (Math.abs(p.x - x) < rad && Math.abs(p.y - y) < rad && p.z > z) z = p.z;
    return Number.isFinite(z) ? z : fb.max.z;
  };
  // dark brows + eyes, like the photo (the conversion left them white)
  m.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) {
      if (mat.name === "Face") {
        mat.color.set("#1c1310");
        mat.roughness = 0.35;
      }
    }
  });
  const headR = Math.max(top - hp.y, 1e-3) * 0.5;
  const R = headR;
  const c = new THREE.Vector3(hp.x, top - R, hp.z);

  const g = new THREE.Group();
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: THREE.Vector3, rot: [number, number, number], scl: [number, number, number]) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.copy(pos);
    o.rotation.set(rot[0], rot[1], rot[2]);
    o.scale.set(scl[0], scl[1], scl[2]);
    o.castShadow = true;
    g.add(o);
    return o;
  };
  const at = (x: number, y: number, z: number) => new THREE.Vector3(c.x + x * R, c.y + y * R, c.z + z * R);

  // neat, smooth, styled hair: soft sculpted volumes (no shaggy facets)
  const hairMat = new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.46, metalness: 0 });
  const fadeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.hair).multiplyScalar(0.75), roughness: 0.6 });
  // sides + back only (open over the forehead) so the fade never shows as a band on the brow
  const fadeCap = new THREE.SphereGeometry(1, 22, 12, Math.PI / 2 + 0.75, Math.PI * 2 - 1.5, 0, Math.PI * 0.55);
  const tuft = new THREE.SphereGeometry(1, 18, 12);
  const cap = new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const spike = new THREE.ConeGeometry(1, 1, 10);
  spike.translate(0, 0.5, 0);
  const browTop = fb.max.y;
  const fy = (browTop - c.y) / R + 0.18;
  /** a cone spike rooted at (x,y,z) on the head, pointing along (dx,dy,dz) */
  const spikeAt = (x: number, y: number, z: number, dx: number, dy: number, dz: number, len: number, w: number) => {
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const o = mesh(spike, hairMat, at(x, y, z), [0, 0, 0], [R * w, R * len, R * w * 0.8]);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return o;
  };
  /** clean skin-fade on the sides and back */
  const fade = (y = 0.05) => mesh(fadeCap, fadeMat, at(0, y, -0.05), [-0.08, 0, 0], [R * 1.05, R * 0.9, R * 1.08]);
  const style = look.hairStyle;
  const hairStart = g.children.length;
  if (style === "swept") {
    // sharp pompadour quiff: faded sides, smooth volume swept up and back with a side part
    fade();
    mesh(cap, hairMat, at(0, 0.26, -0.04), [-0.12, 0, 0], [R * 1.05, R * 0.82, R * 1.08]);
    mesh(tuft, hairMat, at(0.02, 0.6, 0.04), [-0.15, 0, 0], [R * 0.82, R * 0.34, R * 0.96]);
    mesh(tuft, hairMat, at(-0.04, 0.72, 0.52), [0.45, 0, 0.08], [R * 0.66, R * 0.28, R * 0.44]);
    mesh(tuft, hairMat, at(0.16, 0.8, 0.7), [0.8, 0, -0.3], [R * 0.42, R * 0.18, R * 0.3]);
    mesh(tuft, hairMat, at(-0.5, 0.56, 0.34), [0.3, 0, 0.45], [R * 0.34, R * 0.24, R * 0.46]);
    mesh(tuft, hairMat, at(0, 0.3, -0.74), [0.25, 0, 0], [R * 0.84, R * 0.56, R * 0.34]);
    // side part line
    mesh(new THREE.BoxGeometry(1, 1, 1), fadeMat, at(-0.42, 0.76, 0.12), [-0.2, 0, 0.5], [R * 0.03, R * 0.04, R * 0.9]);
    // trimmed sideburns
    for (const side of [-1, 1]) mesh(new THREE.BoxGeometry(1, 1, 1), hairMat, at(side * 0.92, -0.12, 0.2), [0, 0, 0], [R * 0.08, R * 0.32, R * 0.16]);
  } else if (style === "spiky") {
    // tidy anime spikes swept up and back over a fade
    fade();
    mesh(cap, hairMat, at(0, 0.24, -0.04), [-0.1, 0, 0], [R * 1.05, R * 0.86, R * 1.08]);
    const crown: [number, number, number, number, number, number, number][] = [
      [0, 0.75, 0.25, 0.05, 1, -0.15, 1.1],
      [0.36, 0.7, 0.1, 0.5, 1, -0.3, 0.95],
      [-0.36, 0.7, 0.1, -0.5, 1, -0.3, 0.95],
      [0.2, 0.7, -0.35, 0.25, 0.85, -0.75, 1.0],
      [-0.2, 0.7, -0.35, -0.25, 0.85, -0.75, 1.0],
      [0, 0.45, -0.75, 0, 0.4, -1, 0.85],
      [0.6, 0.45, -0.3, 0.85, 0.5, -0.5, 0.7],
      [-0.6, 0.45, -0.3, -0.85, 0.5, -0.5, 0.7],
    ];
    for (const [x, y, z, dx, dy, dz, len] of crown) spikeAt(x, y, z, dx, dy, dz, len, 0.25);
    // two neat fringe spikes
    for (const [x, tilt] of [
      [-0.28, -0.3],
      [0.3, 0.35],
    ] as const)
      spikeAt(x, fy + 0.48, 0.8, tilt, -1, 0.45, 0.42, 0.15);
  } else if (style === "silver") {
    // sleek silver hair pushed up and back over the blindfold
    fade(0.02);
    mesh(cap, hairMat, at(0, 0.28, -0.04), [-0.1, 0, 0], [R * 1.05, R * 0.84, R * 1.08]);
    mesh(tuft, hairMat, at(0, 0.7, 0.18), [-0.3, 0, 0], [R * 0.82, R * 0.42, R * 0.82]);
    for (const [x, z, dx, dz, len] of [
      [0, 0.45, 0.05, -0.2, 0.85],
      [0.38, 0.3, 0.5, -0.4, 0.75],
      [-0.38, 0.3, -0.5, -0.4, 0.75],
      [0.22, -0.2, 0.25, -0.8, 0.8],
      [-0.22, -0.2, -0.25, -0.8, 0.8],
      [0, -0.55, 0, -1, 0.7],
    ] as const)
      spikeAt(x, 0.72, z, dx, 1, dz, len, 0.28);
  } else if (style === "bun") {
    // sleek high ponytail with a top knot, side-swept bangs and face-framing strands
    mesh(cap, hairMat, at(0, 0.18, -0.04), [-0.1, 0, 0], [R * 1.07, R * 0.95, R * 1.1]);
    mesh(tuft, hairMat, at(0, 0.98, -0.42), [0, 0, 0], [R * 0.38, R * 0.34, R * 0.38]);
    mesh(new THREE.TorusGeometry(1, 0.25, 8, 18), new THREE.MeshStandardMaterial({ color: "#c8264a", roughness: 0.5 }), at(0, 0.74, -0.5), [Math.PI / 2 - 0.6, 0, 0], [R * 0.26, R * 0.26, R * 0.26]);
    mesh(tuft, hairMat, at(0, 0.45, -1.05), [0.25, 0, 0], [R * 0.26, R * 0.48, R * 0.22]);
    mesh(tuft, hairMat, at(0, -0.15, -1.12), [0.05, 0, 0], [R * 0.22, R * 0.5, R * 0.18]);
    mesh(tuft, hairMat, at(0, -0.68, -1.06), [-0.1, 0, 0], [R * 0.15, R * 0.36, R * 0.13]);
    mesh(tuft, hairMat, at(-0.12, fy + 0.12, 0.84), [0.95, 0, 0.62], [R * 0.68, R * 0.15, R * 0.3]);
    mesh(tuft, hairMat, at(0.45, fy + 0.02, 0.76), [0.9, 0, -0.35], [R * 0.32, R * 0.12, R * 0.24]);
    for (const side of [-1, 1]) mesh(tuft, hairMat, at(side * 0.84, -0.25, 0.34), [0, 0, side * 0.08], [R * 0.13, R * 0.55, R * 0.16]);
  } else if (style === "shaggy") {
    // wolf cut: layered crown, middle-parted curtain bangs, short mullet at the nape
    mesh(cap, hairMat, at(0, 0.22, -0.04), [-0.1, 0, 0], [R * 1.1, R * 0.96, R * 1.12]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 4 - 0.5) * 2.4;
      mesh(tuft, hairMat, at(Math.sin(a) * 0.7, 0.62 - Math.abs(a) * 0.08, Math.cos(a) * 0.35 - 0.1), [0.2, a, 0], [R * 0.42, R * 0.28, R * 0.5]);
    }
    for (const side of [-1, 1]) {
      mesh(tuft, hairMat, at(side * 0.38, fy + 0.26, 0.82), [0.85, 0, side * 0.75], [R * 0.52, R * 0.15, R * 0.3]);
      mesh(tuft, hairMat, at(side * 0.84, 0.0, 0.18), [0, 0, side * 0.1], [R * 0.18, R * 0.5, R * 0.36]);
      mesh(tuft, hairMat, at(side * 0.3, -0.3, -0.86), [0.15, 0, side * 0.12], [R * 0.3, R * 0.45, R * 0.2]);
    }
    mesh(tuft, hairMat, at(0, -0.36, -0.9), [0.12, 0, 0], [R * 0.32, R * 0.46, R * 0.2]);
  }

  // hair (and anything pinned in it) hangs from a pivot at the crown so it can sway
  const hairG = new THREE.Group();
  hairG.position.copy(c);
  for (const o of g.children.slice(hairStart)) {
    o.position.sub(c);
    hairG.add(o);
  }
  g.add(hairG);
  if (look.flower) {
    const petal = new THREE.MeshStandardMaterial({ color: look.flower, roughness: 0.5 });
    const heart = new THREE.MeshStandardMaterial({ color: "#ffd84a", roughness: 0.5 });
    const fc = new THREE.Vector3(R * 0.78, R * 0.55, R * 0.25);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const o = new THREE.Mesh(tuft, petal);
      o.position.set(fc.x + Math.cos(a) * R * 0.16, fc.y + Math.sin(a) * R * 0.16, fc.z);
      o.scale.set(R * 0.13, R * 0.13, R * 0.05);
      hairG.add(o);
    }
    const o = new THREE.Mesh(tuft, heart);
    o.position.copy(fc).add(new THREE.Vector3(0, 0, R * 0.04));
    o.scale.setScalar(R * 0.07);
    hairG.add(o);
  }

  // ---- face ----
  const dark = new THREE.MeshStandardMaterial({ color: "#1f1512", roughness: 0.7 });
  const shine = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  const skinMat = new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.7 });
  const lip = new THREE.MeshStandardMaterial({ color: "#b8675d", roughness: 0.6 });
  const disc = new THREE.SphereGeometry(1, 10, 8);
  const box1 = new THREE.BoxGeometry(1, 1, 1);
  // catch-light in each eye
  for (const e of look.blindfold ? [] : [eyeL, eyeR]) {
    const cx = (e.min.x + e.max.x) / 2 + eyeW * 0.12;
    const cy = e.max.y - eyeH * 0.28;
    const sr = eyeW * 0.2;
    mesh(disc, shine, new THREE.Vector3(cx, cy, Math.max(e.max.z, frontZ(cx, cy, eyeW * 0.4)) + sr * 0.2), [0, 0, 0], [sr, sr, sr * 0.3]);
  }
  // eyelids (shown for a blink now and then)
  const lids: THREE.Object3D[] = [];
  for (const e of look.blindfold ? [] : [eyeL, eyeR]) {
    const cx = (e.min.x + e.max.x) / 2;
    const cy = (e.min.y + e.max.y) / 2;
    const lid = mesh(disc, skinMat, new THREE.Vector3(cx, cy, Math.max(e.max.z, frontZ(cx, cy, eyeW * 0.4)) + eyeW * 0.06), [0, 0, 0], [eyeW * 0.72, eyeH * 0.68, eyeW * 0.22]);
    lid.visible = false;
    lids.push(lid);
  }
  // sunglasses
  if (look.glasses) {
    const lens = new THREE.MeshStandardMaterial({ color: look.glasses, roughness: 0.08, metalness: 0.6 });
    const frame = new THREE.MeshStandardMaterial({ color: "#111216", roughness: 0.4, metalness: 0.5 });
    const ring = new THREE.CylinderGeometry(1, 1, 1, 16);
    ring.rotateX(Math.PI / 2);
    const lz = Math.max(eyeL.max.z, eyeR.max.z, frontZ(ec.x, ec.y, eyeW)) + eyeW * 0.25;
    for (const e of [eyeL, eyeR]) {
      const cx = (e.min.x + e.max.x) / 2;
      mesh(ring, lens, new THREE.Vector3(cx, ec.y + eyeH * 0.05, lz), [0, 0, 0], [eyeW * 0.85, eyeH * 0.72, R * 0.04]);
    }
    mesh(box1, frame, new THREE.Vector3(ec.x, ec.y + eyeH * 0.32, lz), [0, 0, 0], [Math.abs(eyeL.max.x - eyeR.min.x) * 1.2, eyeH * 0.12, R * 0.04]);
    for (const side of [-1, 1]) {
      const ex = ec.x + side * Math.abs(eyeL.max.x - eyeR.min.x) * 0.62;
      mesh(box1, frame, new THREE.Vector3(ex, ec.y + eyeH * 0.3, (lz + c.z) / 2), [0, 0, 0], [R * 0.035, eyeH * 0.1, Math.abs(lz - c.z)]);
    }
  }

  // small nose
  const noseY = eyeBox.min.y - eyeH * 0.22;
  mesh(new THREE.ConeGeometry(1, 1, 4), skinMat, new THREE.Vector3(ec.x, noseY, frontZ(ec.x, noseY, eyeW * 0.5) + R * 0.03), [-Math.PI / 2 + 0.35, Math.PI / 4, 0], [R * 0.075, R * 0.14, R * 0.075]);
  // light moustache
  const tacheY = noseY - eyeH * 0.42;
  const tz = frontZ(ec.x, tacheY, eyeW * 0.7) + R * 0.02;
  for (const side of look.moustache ? [-1, 1] : [])
    mesh(box1, dark, new THREE.Vector3(ec.x + side * eyeW * 0.55, tacheY - eyeH * 0.04, tz), [0, side * -0.25, side * -0.18], [eyeW * 1.15, eyeH * 0.15, R * 0.05]);
  // gentle smile
  const smileY = tacheY - eyeH * 0.3;
  mesh(new THREE.TorusGeometry(1, 0.32, 4, 14, Math.PI), lip, new THREE.Vector3(ec.x, smileY + eyeH * 0.1, frontZ(ec.x, smileY, eyeW * 0.5) + R * 0.008), [0, 0, Math.PI], [eyeW * 1.1, eyeH * 0.22, R * 0.035]);

  // cloth bands wrapped around the head (blindfold over the eyes / headband on the brow)
  const faceR = Math.max(frontZ(ec.x, ec.y, eyeW) - c.z, R * 0.9) * 1.06;
  const wrap = (color: string, y: number, hgt: number) => {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
    band.position.set(c.x, y, c.z);
    band.scale.set(faceR * 1.04, hgt, faceR);
    g.add(band);
    // little tails at the back
    for (const side of [-1, 1]) mesh(box1, band.material as THREE.Material, new THREE.Vector3(c.x + side * R * 0.18, y - hgt * 0.6, c.z - faceR * 1.02), [0.5, 0, side * 0.35], [R * 0.16, hgt * 1.6, R * 0.04]);
  };
  if (look.blindfold) wrap(look.blindfold, ec.y, eyeH * 2.1);
  if (look.headband) wrap(look.headband, browTop + eyeH * 0.7, eyeH * 0.9);

  head.updateWorldMatrix(true, false);
  g.applyMatrix4(head.matrixWorld.clone().invert());
  head.add(g);
  const rig = (m.userData.rig ??= { hair: null, lids: [], tails: [] }) as HeroRig;
  rig.hair = hairG;
  rig.lids = lids;
  addBodyGear(m, look, R, rig);
}

/**
 * Signature-move / flight gear: fires up the rocket pack's flames while the
 * signature flight plays (`k` 0‥1 = how far into the move) or while Sky Flight
 * is on.
 */
export function moveGear(rig: HeroRig | undefined, active: boolean, k: number, t: number, flying = false) {
  if (!rig?.jet) return;
  // ignite after the crouch, roar while flying, sputter out on landing
  const move = active ? Math.min(1, Math.max(0, (k - 0.1) * 8)) * Math.min(1, Math.max(0, (0.92 - k) * 8)) : 0;
  const thrust = Math.max(move, flying ? 0.85 : 0);
  for (const [i, f] of (rig.flames ?? []).entries()) {
    f.visible = thrust > 0.02;
    const flick = 0.8 + Math.sin(t * 40 + i * 2.3) * 0.12 + Math.sin(t * 23 + i) * 0.08;
    f.scale.set(0.7 + thrust * 0.3, thrust * flick * 1.4, 0.7 + thrust * 0.3);
  }
}

/** Pulse the glowing trims, swing the floating orbs, flutter the wings and swing the coat (call every frame). */
export function animateGear(rig: HeroRig | undefined, t: number, boost = 0, speed = 0) {
  if (!rig) return;
  for (const [i, m] of (rig.glows ?? []).entries()) m.emissiveIntensity = (m.userData.base ?? 1) * (0.7 + 0.3 * Math.sin(t * 3 + i) + boost);
  for (const [i, o] of (rig.orbs ?? []).entries()) {
    o.rotation.y = t * (1.6 + boost * 4) + i * 2.1;
    o.position.y = (o.userData.y ?? 0) + Math.sin(t * 2 + i) * 0.04 * (o.userData.R ?? 1);
  }
  for (const w of rig.wings ?? []) w.rotation.y = w.userData.base + w.userData.side * (Math.sin(t * (2.2 + boost * 6)) * 0.22 + 0.05);
  if (rig.coat) rig.coat.rotation.x = -Math.min(0.32, speed * 0.03) - Math.sin(t * 1.3) * 0.015;
}

/** Scarf / collar at the neck, wrist cuffs and belt sash — each tied to its bone. */
function addBodyGear(m: THREE.Group, look: HeroLook, R: number, rig: HeroRig) {
  const pos = (name: string) => {
    const b = m.getObjectByName(name);
    return b ? new THREE.Vector3().setFromMatrixPosition(b.matrixWorld) : null;
  };
  const neck = m.getObjectByName("Neck") ?? m.getObjectByName("Torso");
  const np = pos("Neck") ?? pos("Torso");
  const hp = pos("Head");
  const cloth = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });
  if (neck && np && hp && (look.scarf || look.collar)) {
    const g = new THREE.Group();
    const y = np.y + (hp.y - np.y) * 0.25;
    if (look.scarf) {
      const mat = cloth(look.scarf);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.62, R * 0.2, 8, 20), mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(np.x, y, np.z + R * 0.04);
      ring.castShadow = true;
      g.add(ring);
      // two tails flowing from the back of the knot
      for (const side of [-1, 1]) {
        const tail = new THREE.Group();
        tail.position.set(np.x + side * R * 0.2, y, np.z - R * 0.6);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(R * 0.28, R * 1.7, R * 0.06), mat);
        strip.position.y = -R * 0.85;
        strip.castShadow = true;
        tail.add(strip);
        tail.rotation.set(0.35, 0, side * 0.12);
        tail.userData.base = { x: 0.35, z: side * 0.12, side };
        g.add(tail);
        rig.tails.push(tail);
      }
    }
    if (look.collar) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.78, R * 0.66, R * 0.75, 18, 1, true, Math.PI * 0.18, Math.PI * 1.64), cloth(look.collar));
      col.position.set(np.x, y + R * 0.1, np.z);
      col.rotation.y = Math.PI;
      col.castShadow = true;
      g.add(col);
    }
    attach(neck, g);
  }
  if (look.wristbands) {
    for (const s of ["L", "R"]) {
      const fist = m.getObjectByName(`Fist${s}`);
      const a = pos(`LowerArm${s}`);
      const b = pos(`Fist${s}`);
      if (!fist || !a || !b) continue;
      const dir = b.clone().sub(a).normalize();
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.2, R * 0.22, R * 0.32, 12), new THREE.MeshStandardMaterial({ color: look.wristbands, roughness: 0.6 }));
      cuff.position.copy(b).addScaledVector(dir, -R * 0.12);
      cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      cuff.castShadow = true;
      const g = new THREE.Group();
      g.add(cuff);
      attach(fist, g);
    }
  }
  const hips = m.getObjectByName("Hips") ?? m.getObjectByName("Abdomen");
  const hipP = pos("Hips") ?? pos("Abdomen");
  if (look.sash && hips && hipP) {
    const g = new THREE.Group();
    const mat = cloth(look.sash);
    for (const side of [-1, 1]) {
      const tail = new THREE.Group();
      tail.position.set(hipP.x + side * R * 0.45, hipP.y + R * 0.15, hipP.z - R * 0.62);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(R * 0.22, R * 1.2, R * 0.05), mat);
      strip.position.y = -R * 0.6;
      strip.castShadow = true;
      tail.add(strip);
      tail.rotation.set(0.15, 0, side * 0.08);
      tail.userData.base = { x: 0.15, z: side * 0.08, side };
      g.add(tail);
      rig.tails.push(tail);
    }
    attach(hips, g);
  }
  addOutfit(m, look, R, rig);
  addShoes(m, look, R);
}

/**
 * Proper shoes on both feet. The base models taper to bare points at the
 * ankle, so each explorer gets a sole, upper and toe cap sized from the lowest
 * leg vertices and tied to the shin bone so it walks with the leg.
 */
function addShoes(m: THREE.Group, look: HeroLook, R: number) {
  const shoes = look.shoes ?? { color: "#2a2a30", sole: "#efe6d6" };
  const all: THREE.Vector3[] = [];
  for (const mat of ["Skin", "Pants", "Black", "Clothes", "Details", "Shirt"]) all.push(...materialPoints(m, mat));
  if (!all.length) return;
  const box = new THREE.Box3().setFromPoints(all);
  const floor = box.min.y;
  const ankle = floor + (box.max.y - floor) * 0.08;
  const hips = m.getObjectByName("Hips") ?? m.getObjectByName("Abdomen");
  const hx = hips ? new THREE.Vector3().setFromMatrixPosition(hips.matrixWorld).x : (box.min.x + box.max.x) / 2;
  const upper = new THREE.MeshStandardMaterial({ color: shoes.color, roughness: 0.62 });
  const sole = new THREE.MeshStandardMaterial({ color: shoes.sole, roughness: 0.85 });
  const trim = shoes.trim ? new THREE.MeshStandardMaterial({ color: shoes.trim, roughness: 0.5 }) : null;
  for (const s of ["L", "R"] as const) {
    const shin = m.getObjectByName(`LowerLeg${s}`);
    if (!shin) continue;
    const side = new THREE.Vector3().setFromMatrixPosition(shin.matrixWorld).x - hx;
    const foot = all.filter((p) => p.y < ankle && Math.sign(p.x - hx) === Math.sign(side || 1));
    if (!foot.length) continue;
    const fb = new THREE.Box3().setFromPoints(foot);
    const c = fb.getCenter(new THREE.Vector3());
    const w = Math.max(fb.max.x - fb.min.x, R * 0.42) * 1.25;
    const len = Math.max(fb.max.z - fb.min.z, R * 0.85) * 1.35;
    const h = Math.max(ankle - floor, R * 0.3) * 1.1;
    const g = new THREE.Group();
    // shoes sit a touch forward of the ankle, like a real foot
    const z = c.z + len * 0.18;
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, h, len * 0.82), upper);
    top.position.set(c.x, floor + h * 0.55, z - len * 0.06);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), upper);
    toe.scale.set(w * 0.5, h * 0.48, len * 0.26);
    toe.position.set(c.x, floor + h * 0.42, z + len * 0.3);
    const base = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, h * 0.22, len * 1.02), sole);
    base.position.set(c.x, floor + h * 0.11, z + len * 0.02);
    g.add(top, toe, base);
    if (trim) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, h * 0.2, len * 0.84), trim);
      band.position.set(c.x, floor + h * 0.98, z - len * 0.06);
      g.add(band);
    }
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    attach(shin, g);
  }
}
