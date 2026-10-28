import * as THREE from "three";
import type { Pet } from "./characters";

/** Bits of a pet that animate: eyelids (blink) and the rear end (tail wag). */
export type PetRig = { lids: THREE.Object3D[]; wag: THREE.Object3D | null; cape?: THREE.Object3D };

/**
 * Dress a Kenney cube pet with its accessory (bow, scarf, collar + bell,
 * bandana, leaf). The models already have expressive faces, so only the
 * outfit is added; it's parented to the animated `body` node so it bobs
 * with the walk cycle.
 */
export function dressPet(model: THREE.Object3D, pet: Pet): PetRig {
  const rig: PetRig = { lids: [], wag: null };
  const body = model.getObjectByName("body") ?? model;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(body);
  if (!Number.isFinite(box.min.x)) return rig;
  const size = box.getSize(new THREE.Vector3());
  const g = new THREE.Group();
  const H = size.y;
  const W = size.x;
  const front = box.max.z;
  const at = (fx: number, fy: number, dz = 0) => new THREE.Vector3(box.min.x + W * (0.5 + fx), box.min.y + H * fy, front + dz);
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, p: THREE.Vector3, s: [number, number, number], rot?: [number, number, number]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(p);
    m.scale.set(...s);
    if (rot) m.rotation.set(...rot);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const er = W * 0.085;
  const acc = pet.accessory;
  if (acc) {
    const mat = new THREE.MeshStandardMaterial({ color: acc.color, roughness: 0.6 });
    const neckY = 0.36;
    if (acc.kind === "collar" || acc.kind === "scarf" || acc.kind === "bandana") {
      const ring = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, H * (acc.kind === "collar" ? 0.06 : 0.09), size.z * 0.34), mat);
      ring.position.set(box.min.x + W / 2, box.min.y + H * neckY, front - size.z * 0.3);
      ring.castShadow = true;
      g.add(ring);
      if (acc.kind === "collar" && acc.bell) {
        add(sphere, new THREE.MeshStandardMaterial({ color: "#ffcf3f", metalness: 0.85, roughness: 0.25 }), at(0, neckY - 0.07, -size.z * 0.12), [er * 0.75, er * 0.75, er * 0.75]);
      }
      if (acc.kind === "bandana") {
        const tri = new THREE.ConeGeometry(W * 0.22, H * 0.22, 3);
        tri.rotateZ(Math.PI);
        add(tri, mat, at(0, neckY - 0.1, -size.z * 0.12), [1, 1, 0.35]);
      }
      if (acc.kind === "scarf") {
        const tail = new THREE.Mesh(new THREE.BoxGeometry(W * 0.16, H * 0.26, W * 0.04), mat);
        tail.position.copy(at(0.26, neckY - 0.12, -size.z * 0.12));
        tail.rotation.z = 0.25;
        tail.castShadow = true;
        g.add(tail);
      }
    } else if (acc.kind === "bow") {
      const bow = new THREE.Group();
      for (const s of [-1, 1]) {
        const lobe = new THREE.Mesh(new THREE.ConeGeometry(W * 0.12, W * 0.2, 4), mat);
        lobe.rotation.z = (s * Math.PI) / 2;
        lobe.position.x = s * W * 0.1;
        bow.add(lobe);
      }
      const knot = new THREE.Mesh(sphere, mat);
      knot.scale.setScalar(W * 0.05);
      bow.add(knot);
      bow.position.set(box.min.x + W * 0.5, box.max.y + H * 0.02, front - size.z * 0.35);
      g.add(bow);
    } else if (acc.kind === "leaf") {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mat);
      leaf.scale.set(W * 0.16, W * 0.04, W * 0.08);
      leaf.position.set(box.min.x + W * 0.72, box.max.y + H * 0.03, front - size.z * 0.3);
      leaf.rotation.z = 0.5;
      g.add(leaf);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.01, W * 0.01, W * 0.12, 4), new THREE.MeshStandardMaterial({ color: "#4f8a2f" }));
      stem.position.set(box.min.x + W * 0.6, box.max.y + H * 0.01, front - size.z * 0.3);
      stem.rotation.z = 1.2;
      g.add(stem);
    }
  }
  const o = pet.outfit;
  if (o) {
    const mat = new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.65 });
    const trim = new THREE.MeshStandardMaterial({ color: o.trim, roughness: 0.5, emissive: o.trim, emissiveIntensity: 0.25 });
    // top of the head sits up front on these cube pets
    const head = new THREE.Vector3(box.min.x + W / 2, box.max.y, front - size.z * 0.33);
    const hatAt = (dy: number) => head.clone().add(new THREE.Vector3(0, H * dy, 0));
    if (o.kind === "straw") {
      add(new THREE.CylinderGeometry(1, 1, 1, 20), mat, hatAt(0.02), [W * 0.42, H * 0.025, W * 0.42]);
      add(new THREE.ConeGeometry(1, 1, 16), mat, hatAt(0.1), [W * 0.22, H * 0.16, W * 0.22]);
      add(new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), trim, hatAt(0.05), [W * 0.2, H * 0.035, W * 0.2]);
    } else if (o.kind === "wizard") {
      add(new THREE.CylinderGeometry(1, 1, 1, 18), mat, hatAt(0.015), [W * 0.34, H * 0.02, W * 0.34]);
      const cone = add(new THREE.ConeGeometry(1, 1, 14), mat, hatAt(0.2), [W * 0.2, H * 0.38, W * 0.2], [-0.25, 0, 0.1]);
      cone.castShadow = true;
      add(new THREE.OctahedronGeometry(1, 0), trim, hatAt(0.22).add(new THREE.Vector3(0, 0, W * 0.16)), [W * 0.05, W * 0.05, W * 0.02]);
      add(new THREE.CylinderGeometry(1, 1, 1, 18, 1, true), trim, hatAt(0.06), [W * 0.19, H * 0.03, W * 0.19]);
    } else if (o.kind === "crown") {
      add(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true), mat, hatAt(0.05), [W * 0.18, H * 0.1, W * 0.18]);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        add(new THREE.ConeGeometry(1, 1, 4), mat, hatAt(0.13).add(new THREE.Vector3(Math.sin(a) * W * 0.17, 0, Math.cos(a) * W * 0.17)), [W * 0.04, H * 0.07, W * 0.04]);
      }
      add(sphere, trim, hatAt(0.06).add(new THREE.Vector3(0, 0, W * 0.185)), [W * 0.035, W * 0.035, W * 0.02]);
    } else if (o.kind === "flowers") {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        add(sphere, k % 2 ? trim : mat, hatAt(0.01).add(new THREE.Vector3(Math.sin(a) * W * 0.3, 0, Math.cos(a) * W * 0.3)), [W * 0.065, W * 0.05, W * 0.065]);
      }
    } else if (o.kind === "goggles") {
      for (const sd of [-1, 1]) {
        add(new THREE.TorusGeometry(1, 0.28, 8, 16), mat, hatAt(-0.06).add(new THREE.Vector3(sd * W * 0.14, 0, W * 0.2)), [W * 0.09, W * 0.09, W * 0.09]);
        add(new THREE.CircleGeometry(1, 16), new THREE.MeshStandardMaterial({ color: o.trim, roughness: 0.1, metalness: 0.4, emissive: o.trim, emissiveIntensity: 0.3 }), hatAt(-0.06).add(new THREE.Vector3(sd * W * 0.14, 0, W * 0.21)), [W * 0.08, W * 0.08, 1]);
      }
      add(new THREE.BoxGeometry(1, 1, 1), mat, hatAt(-0.06), [W * 0.95, H * 0.035, size.z * 0.5]);
    } else if (o.kind === "cape") {
      // hero cape hanging from the neck, pivoting so it can flap
      const pivot = new THREE.Group();
      pivot.position.set(box.min.x + W / 2, box.min.y + H * 0.42, front - size.z * 0.5);
      const cape = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, size.z * 0.62), new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.7, side: THREE.DoubleSide }));
      cape.rotation.x = Math.PI / 2;
      cape.position.z = -size.z * 0.31;
      cape.castShadow = true;
      pivot.add(cape);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, H * 0.02, size.z * 0.02), trim);
      edge.position.z = -size.z * 0.62;
      pivot.add(edge);
      pivot.rotation.x = -0.15;
      g.add(pivot);
      rig.cape = pivot;
    }
  }
  // attach in body space
  body.updateWorldMatrix(true, false);
  g.applyMatrix4(body.matrixWorld.clone().invert());
  body.add(g);
  rig.wag = body;
  return rig;
}
