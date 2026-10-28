import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Static batching: merges the still meshes under `root` into a few big meshes
 * (one per look), so a landmark made of hundreds of little boxes costs a
 * handful of draw calls instead of hundreds.
 *
 * Plain-coloured materials collapse into one vertex-coloured material; anything
 * glowing, textured, see-through or custom-shaded only merges with meshes that
 * share the exact same material instance (so per-frame material tweaks, like
 * night-time lantern glow, keep working).
 *
 * Skipped (left exactly as they were):
 *  - subtrees tagged `userData.keep` (animated / toggled parts)
 *  - meshes that moved between the two snapshots (`moved`)
 *  - hidden, skinned, instanced, multi-material, see-through and text meshes
 *
 * Returns an undo function that removes the merged meshes and shows the originals.
 */
export function bakeStatic(root: THREE.Object3D, moved: Set<THREE.Object3D> = new Set()): () => void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, { mesh: THREE.Mesh; mat: THREE.Material; colorMode: boolean }[]>();

  const visit = (o: THREE.Object3D) => {
    if (o !== root && (o.userData.keep || !o.visible)) return;
    if (moved.has(o)) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && candidate(mesh)) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const colorMode = plainColour(mat);
      const key = (colorMode ? signature(mat) : `u:${mat.uuid}`) + `|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push({ mesh, mat, colorMode });
    }
    for (const c of o.children) visit(c);
  };
  visit(root);

  const added: THREE.Mesh[] = [];
  const hidden: THREE.Mesh[] = [];
  const ownMats: THREE.Material[] = [];
  const m4 = new THREE.Matrix4();
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const { mat, colorMode } = list[0];
    const needUv = !!(mat as THREE.MeshStandardMaterial).map || !!(mat as THREE.MeshStandardMaterial).emissiveMap;
    const geos: THREE.BufferGeometry[] = [];
    const used: THREE.Mesh[] = [];
    for (const { mesh, mat: mm } of list) {
      m4.multiplyMatrices(inv, mesh.matrixWorld);
      const g = normalise(mesh.geometry, m4, needUv, colorMode ? (mm as THREE.MeshStandardMaterial) : null, !colorMode && mat.vertexColors);
      if (!g) continue;
      geos.push(g);
      used.push(mesh);
    }
    if (geos.length < 2) {
      geos.forEach((g) => g.dispose());
      continue;
    }
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    let material = mat;
    if (colorMode) {
      const m = mat.clone() as THREE.MeshStandardMaterial;
      m.color.setRGB(1, 1, 1);
      m.vertexColors = true;
      ownMats.push(m);
      material = m;
    }
    const out = new THREE.Mesh(merged, material);
    out.castShadow = list[0].mesh.castShadow;
    out.receiveShadow = list[0].mesh.receiveShadow;
    out.matrixAutoUpdate = false;
    out.name = "baked";
    root.add(out);
    added.push(out);
    for (const mesh of used) {
      mesh.visible = false;
      hidden.push(mesh);
    }
  }

  return () => {
    for (const m of added) {
      root.remove(m);
      m.geometry.dispose();
    }
    ownMats.forEach((m) => m.dispose());
    hidden.forEach((m) => (m.visible = true));
  };
}

function candidate(mesh: THREE.Mesh) {
  const anyMesh = mesh as THREE.Mesh & { isSkinnedMesh?: boolean; isInstancedMesh?: boolean };
  if (anyMesh.isSkinnedMesh || anyMesh.isInstancedMesh) return false;
  if (Array.isArray(mesh.material)) return false;
  const g = mesh.geometry;
  if (!g || g instanceof THREE.InstancedBufferGeometry || !g.attributes.position) return false;
  // (geometry groups only matter for multi-material meshes, which are skipped above)
  const m = mesh.material as THREE.Material;
  if (!(m instanceof THREE.MeshStandardMaterial) && !(m instanceof THREE.MeshBasicMaterial) && !(m instanceof THREE.MeshLambertMaterial)) return false;
  if (m.transparent || m.alphaTest > 0) return false;
  // custom shader hooks (wind, etc.) need their own geometry attributes / uniforms
  if (Object.prototype.hasOwnProperty.call(m, "onBeforeCompile")) return false;
  return true;
}

/** Opaque, untextured, non-glowing: its colour can live in vertex colours. */
function plainColour(m: THREE.Material) {
  const s = m as THREE.MeshStandardMaterial;
  if (s.map || s.emissiveMap || s.normalMap || s.roughnessMap || s.aoMap) return false;
  if (s.emissive && s.emissiveIntensity > 0 && (s.emissive.r > 0.01 || s.emissive.g > 0.01 || s.emissive.b > 0.01)) return false;
  return !!s.color;
}

function signature(m: THREE.Material) {
  const s = m as THREE.MeshStandardMaterial;
  const r = (v: number | undefined) => (v === undefined ? "-" : Math.round(v * 20) / 20);
  return [m.type, r(s.roughness), r(s.metalness), s.flatShading ? 1 : 0, m.side, s.fog ? 1 : 0, m.toneMapped ? 1 : 0, r(s.envMapIntensity), s.wireframe ? 1 : 0, m.depthWrite ? 1 : 0, m.vertexColors ? 1 : 0].join(",");
}

/** Float copy in root space with exactly position/normal(/uv)(/color) and an index. */
function normalise(src: THREE.BufferGeometry, m: THREE.Matrix4, needUv: boolean, colour: THREE.MeshStandardMaterial | null, keepColour: boolean) {
  const pos = src.attributes.position;
  const n = pos.count;
  if (!n) return null;
  const g = new THREE.BufferGeometry();
  const copy = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, size: number) => {
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < size; c++) out[i * size + c] = c < a.itemSize ? a.getComponent(i, c) : 1;
    return new THREE.BufferAttribute(out, size);
  };
  g.setAttribute("position", copy(pos, 3));
  if (src.attributes.normal) g.setAttribute("normal", copy(src.attributes.normal, 3));
  if (needUv) {
    if (!src.attributes.uv) return null;
    g.setAttribute("uv", copy(src.attributes.uv, 2));
  }
  if (colour) {
    const c = colour.color;
    const out = new Float32Array(n * 3);
    const vc = colour.vertexColors ? src.attributes.color : undefined;
    for (let i = 0; i < n; i++) {
      out[i * 3] = c.r * (vc ? vc.getComponent(i, 0) : 1);
      out[i * 3 + 1] = c.g * (vc ? vc.getComponent(i, 1) : 1);
      out[i * 3 + 2] = c.b * (vc ? vc.getComponent(i, 2) : 1);
    }
    g.setAttribute("color", new THREE.BufferAttribute(out, 3));
  } else if (keepColour) {
    // shared vertex-coloured material: keep (or default to white) the vertex colours
    if (src.attributes.color) g.setAttribute("color", copy(src.attributes.color, 3));
    else g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  }
  if (src.index) {
    const idx = new Uint32Array(src.index.count);
    for (let i = 0; i < idx.length; i++) idx[i] = src.index.getX(i);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  } else {
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  // honour the source draw range
  const start = src.drawRange.start;
  const count = src.drawRange.count;
  if (start > 0 || (Number.isFinite(count) && count < g.index!.count)) {
    const sub = g.index!.array.slice(start, start + count);
    g.setIndex(new THREE.BufferAttribute(sub, 1));
  }
  g.applyMatrix4(m);
  // mirrored transforms flip the winding — flip it back
  if (m.determinant() < 0) {
    const a = g.index!.array as Uint32Array;
    for (let i = 0; i + 2 < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
