import * as THREE from "three";

/** Animated bits of an explorer: hair pivot, eyelids, fluttering tails and gear. */
export type HeroRig = {
  hair: THREE.Group | null;
  lids: THREE.Object3D[];
  tails: THREE.Group[];
  glows?: THREE.MeshStandardMaterial[];
  orbs?: THREE.Group[];
  /** petal wings (flap slowly) */
  wings?: THREE.Group[];
  /** long-coat skirt pivot (swings back when running) */
  coat?: THREE.Group;
  /** rocket pack + its flames */
  jet?: THREE.Object3D;
  flames?: THREE.Object3D[];
};

/** Skinned (posed) positions of every vertex drawn with the given material. */
export function materialPoints(m: THREE.Object3D, name: string) {
  const pts: THREE.Vector3[] = [];
  m.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const geo = mesh.geometry;
    const idx = geo.index;
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: idx ? idx.count : geo.attributes.position.count, materialIndex: 0 }];
    const seen = new Set<number>();
    for (const g of groups) {
      if (mats[g.materialIndex ?? 0]?.name !== name) continue;
      for (let k = g.start; k < g.start + g.count; k++) {
        const vi = idx ? idx.getX(k) : k;
        if (seen.has(vi)) continue;
        seen.add(vi);
        const v = new THREE.Vector3().fromBufferAttribute(geo.attributes.position, vi);
        if (mesh.isSkinnedMesh) mesh.applyBoneTransform(vi, v);
        v.applyMatrix4(mesh.matrixWorld);
        pts.push(v);
      }
    }
  });
  return pts;
}

/** Attach a group built in bind-pose world space to a bone so it follows the animation. */
export function attach(bone: THREE.Object3D, g: THREE.Object3D) {
  bone.updateWorldMatrix(true, false);
  g.applyMatrix4(bone.matrixWorld.clone().invert());
  bone.add(g);
}

/** A softly pulsing emissive ("radium") material registered on the rig. */
export function glowMat(rig: HeroRig, color: string, base = 1.6) {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: base, roughness: 0.4, toneMapped: false });
  mat.userData.base = base;
  (rig.glows ??= []).push(mat);
  return mat;
}

/** World position of a named bone (bind pose). */
export function bonePos(m: THREE.Object3D, name: string) {
  const b = m.getObjectByName(name);
  return b ? new THREE.Vector3().setFromMatrixPosition(b.matrixWorld) : null;
}

const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);

/** Orient a Y-up mesh along a→b and centre it at fraction `at` of the way. */
export function alongY(o: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, at = 0.5) {
  const dir = b.clone().sub(a).normalize();
  o.quaternion.setFromUnitVectors(UP, dir);
  o.position.copy(a).lerp(b, at);
  return o;
}

/** Orient a ring (torus, axis Z) so it wraps round the a→b direction at fraction `at`. */
export function ringAround(o: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, at: number) {
  const dir = b.clone().sub(a).normalize();
  o.quaternion.setFromUnitVectors(FWD, dir);
  o.position.copy(a).lerp(b, at);
  return o;
}
