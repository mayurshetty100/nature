import * as THREE from "three";

/**
 * Bright, friendly eyes for rigged animal models: finds the head bone, the
 * vertices it drives, and sits a pair of glossy eyes (white, dark iris, a
 * sparkle, a soft lid) on the front-upper sides of that head — parented to the
 * bone so they follow every nod, graze and blink of the animation.
 */
const sclera = new THREE.MeshStandardMaterial({ color: "#fbfaf6", roughness: 0.25 });
const iris = new THREE.MeshStandardMaterial({ color: "#2a1a10", roughness: 0.2 });
const shine = new THREE.MeshBasicMaterial({ color: "#ffffff" });
const geoS = new THREE.SphereGeometry(1, 14, 10);
const geoI = new THREE.SphereGeometry(1, 12, 8);
const geoH = new THREE.SphereGeometry(1, 6, 4);

export function addEyes(model: THREE.Object3D, opts: { lid?: string; scale?: number } = {}) {
  model.updateMatrixWorld(true);
  let skinned: THREE.SkinnedMesh | null = null;
  model.traverse((o) => {
    if (!skinned && (o as THREE.SkinnedMesh).isSkinnedMesh) skinned = o as THREE.SkinnedMesh;
  });
  const sm = skinned as THREE.SkinnedMesh | null;
  if (!sm) return null;
  const bones = sm.skeleton.bones;
  const hi = bones.findIndex((b) => /head/i.test(b.name) && !/end|top/i.test(b.name));
  if (hi < 0) return null;
  const head = bones[hi];
  const g = sm.geometry;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const si = g.attributes.skinIndex as THREE.BufferAttribute;
  const sw = g.attributes.skinWeight as THREE.BufferAttribute;
  if (!si || !sw) return null;
  // head vertices in the model's space (bind pose)
  const pts: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    let w = 0;
    for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === hi) w += sw.getComponent(i, k);
    if (w < 0.6) continue;
    v.fromBufferAttribute(pos, i).applyMatrix4(sm.matrixWorld);
    pts.push(v.clone());
  }
  if (pts.length < 8) return null;
  const box = new THREE.Box3().setFromPoints(pts);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.min(size.x, size.y, size.z) * 0.13 * (opts.scale ?? 1);
  const out: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    // the head-surface point furthest toward front / this side / up
    const dir = new THREE.Vector3(side * 0.55, 0.45, 0.7).normalize();
    let best = pts[0];
    let bd = -Infinity;
    for (const p of pts) {
      const d = (p.x - c.x) / size.x * dir.x + (p.y - c.y) / size.y * dir.y + (p.z - c.z) / size.z * dir.z;
      if (d > bd) {
        bd = d;
        best = p;
      }
    }
    // sit the eye just into the surface, looking forward and a little out
    const at = best.clone().lerp(c, 0.12);
    const eye = new THREE.Group();
    const s = new THREE.Mesh(geoS, sclera);
    s.scale.setScalar(r);
    const ir = new THREE.Mesh(geoI, iris);
    ir.scale.setScalar(r * 0.68);
    ir.position.set(side * r * 0.12, 0, r * 0.45);
    const h = new THREE.Mesh(geoH, shine);
    h.scale.setScalar(r * 0.2);
    h.position.set(side * r * 0.05 + r * 0.18, r * 0.3, r * 0.98);
    eye.add(s, ir, h);
    if (opts.lid) {
      const lid = new THREE.Mesh(new THREE.SphereGeometry(r * 1.06, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.4), new THREE.MeshStandardMaterial({ color: opts.lid, roughness: 0.8 }));
      lid.rotation.x = -0.35;
      eye.add(lid);
    }
    // place in the head bone's frame so it rides the animation
    head.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(head.matrixWorld).invert();
    eye.position.copy(at.applyMatrix4(inv));
    const q = new THREE.Quaternion();
    head.getWorldQuaternion(q);
    eye.quaternion.copy(q.invert()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side * 0.35, 0)));
    // undo the bone's scale so eyes keep their size
    const ws = new THREE.Vector3();
    head.getWorldScale(ws);
    eye.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
    head.add(eye);
    out.push(eye);
  }
  return out;
}
