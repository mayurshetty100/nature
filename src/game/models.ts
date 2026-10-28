import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Soft, rounded shading: normals are averaged across edges gentler than the
 * crease angle, so low-poly bodies, rocks and leaves read as smooth clay while
 * real corners (box edges, roof ridges) stay crisp. Cached per source geometry.
 */
const smoothCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
export function smoothGeometry(g: THREE.BufferGeometry, crease = Math.PI / 3) {
  let out = smoothCache.get(g);
  if (!out) {
    if (!g.attributes.position || g.attributes.position.count > 60000) return g;
    out = toCreasedNormals(g, crease);
    smoothCache.set(g, out);
    smoothCache.set(out, out);
  }
  return out;
}
export function smoothModel(obj: THREE.Object3D, crease = Math.PI / 3) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    mesh.geometry = smoothGeometry(mesh.geometry, crease);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) if ((m as THREE.MeshStandardMaterial).flatShading) {
      (m as THREE.MeshStandardMaterial).flatShading = false;
      m.needsUpdate = true;
    }
  });
}

/**
 * Height of a (possibly skinned) model in its bind pose. Skinned meshes need
 * world matrices + skeleton updated first, otherwise Box3 returns garbage.
 */
export function measureHeight(obj: THREE.Object3D, fallback = 1) {
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    const s = o as THREE.SkinnedMesh;
    if (s.isSkinnedMesh) s.skeleton.update();
  });
  const box = new THREE.Box3().setFromObject(obj, true);
  const h = box.max.y - box.min.y;
  return Number.isFinite(h) && h > 1e-4 ? h : fallback;
}

/**
 * The CC0 FBX → GLB conversion lost a few colours (skin came out near-black,
 * some single-material animals came out plain white). Repaint those by
 * material name / model file, and make everything matte so it reads warm and
 * storybook-like under the sun instead of dark and metallic.
 */
const SKIN = "#c68a62";
const SINGLE_COLOUR: Record<string, string> = {
  Dog: "#c9955f",
  Cat: "#e4a35c",
  RedFox: "#d8652c",
  Chick: "#f5d04e",
  Whale: "#4f7fae",
};

export function stylizeModel(obj: THREE.Object3D, url: string) {
  const file = url.split("/").pop()?.replace(".glb", "") ?? "";
  stripLights(obj);
  smoothModel(obj);
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const m = mat as THREE.MeshStandardMaterial;
      if (!m.isMeshStandardMaterial || m.userData.stylized) continue;
      m.userData.stylized = true;
      m.metalness = 0;
      m.roughness = 0.82;
      if (m.name === "Skin") m.color.set(SKIN);
      else if (SINGLE_COLOUR[file] && mats.length === 1) m.color.set(SINGLE_COLOUR[file]);
    }
  });
}

/**
 * Some CC0 animal files ship with their own sun/lamp lights baked in. Each copy
 * would add lights to the whole world (slower everywhere) and, as animals come
 * in and out of view, force every shader to rebuild — so they are removed.
 */
export function stripLights(obj: THREE.Object3D) {
  const lights: THREE.Object3D[] = [];
  obj.traverse((o) => {
    if ((o as THREE.Light).isLight) lights.push(o);
  });
  for (const l of lights) l.removeFromParent();
  return lights.length;
}
