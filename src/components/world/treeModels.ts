import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "@/game/world";
import { addWind } from "./materials";

/**
 * Procedural trees (unit scale, like the Kenney models they replace: ~1.25 tall,
 * base at y=0): a tapered, ridged trunk with root flare, real branches that fork
 * into twigs, and crowns built from hundreds of tiny leaves on clustered cards
 * (normals point out of the crown so it shades like a soft volume). Some trunks
 * carry a squirrel's hollow. Pines get drooping whorls of needle sprays.
 * Each kind returns { bark, leaves } geometry + materials for instancing.
 */
export type TreePart = { g: THREE.BufferGeometry; m: THREE.Material; leaf: boolean };

let leafTex: THREE.Texture | null = null;
let needleTex: THREE.Texture | null = null;

/** A card of many small leaves (neutral light greens, so the per-tree tint shows through). */
function leafTexture() {
  if (leafTex) return leafTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const r = rng(91);
  for (let i = 0; i < 95; i++) {
    const x = 28 + r() * 200;
    const y = 28 + r() * 200;
    // fewer leaves near the card edges → organic silhouette
    if (Math.hypot(x - 128, y - 128) > 100 + r() * 24) continue;
    const a = r() * Math.PI * 2;
    const len = 16 + r() * 14;
    const wid = len * (0.42 + r() * 0.12);
    const l = 62 + r() * 32;
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = `hsl(${88 + r() * 22}, ${18 + r() * 14}%, ${l}%)`;
    g.beginPath();
    g.moveTo(0, -len / 2);
    g.quadraticCurveTo(wid, 0, 0, len / 2);
    g.quadraticCurveTo(-wid, 0, 0, -len / 2);
    g.fill();
    // midrib + a darker half for depth
    g.strokeStyle = `hsla(90, 20%, ${l - 22}%, 0.55)`;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(0, -len / 2 + 2);
    g.lineTo(0, len / 2 - 1);
    g.stroke();
    g.fillStyle = `hsla(95, 25%, ${l - 18}%, 0.35)`;
    g.beginPath();
    g.moveTo(0, -len / 2);
    g.quadraticCurveTo(-wid, 0, 0, len / 2);
    g.lineTo(0, -len / 2);
    g.fill();
    g.restore();
  }
  // a few twigs threading through the cluster
  g.strokeStyle = "rgba(90,70,50,0.8)";
  g.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    g.moveTo(128, 236);
    g.quadraticCurveTo(128 + (r() - 0.5) * 80, 150, 60 + r() * 136, 50 + r() * 60);
    g.stroke();
  }
  leafTex = new THREE.CanvasTexture(c);
  leafTex.colorSpace = THREE.SRGBColorSpace;
  leafTex.anisotropy = 4;
  return leafTex;
}

/** A spray of pine needles fanning off a twig. */
function needleTexture() {
  if (needleTex) return needleTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = rng(17);
  g.lineCap = "round";
  for (let s = 0; s < 3; s++) {
    const x0 = 64 + (s - 1) * 26;
    g.strokeStyle = "rgba(95,75,55,0.9)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0, 124);
    g.lineTo(x0 + (s - 1) * 8, 12);
    g.stroke();
    for (let i = 0; i < 70; i++) {
      const t = i / 70;
      const bx = x0 + (s - 1) * 8 * t;
      const by = 124 - t * 112;
      const side = i % 2 ? 1 : -1;
      const len = 18 + r() * 12 - t * 8;
      g.strokeStyle = `hsl(${120 + r() * 20}, ${14 + r() * 10}%, ${56 + r() * 28}%)`;
      g.lineWidth = 3.2;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + side * len * 0.8, by - len * 0.6);
      g.stroke();
    }
  }
  needleTex = new THREE.CanvasTexture(c);
  needleTex.colorSpace = THREE.SRGBColorSpace;
  return needleTex;
}

const tmpColor = new THREE.Color();
function colorize(g: THREE.BufferGeometry, fn: (x: number, y: number, z: number) => string | THREE.Color) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = fn(p.getX(i), p.getY(i), p.getZ(i));
    tmpColor.set(v as THREE.ColorRepresentation);
    col.set([tmpColor.r, tmpColor.g, tmpColor.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/** A tapered limb from a to b (radius ra → rb), slightly bent, with bark ridges. */
function limb(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, seg = 7, ridges = 0) {
  const v = new THREE.Vector3().subVectors(b, a);
  const len = v.length();
  const g = new THREE.CylinderGeometry(rb, ra, len, seg, 4, false);
  if (ridges) {
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const ang = Math.atan2(z, x);
      const k = 1 + Math.sin(ang * ridges) * 0.09 + Math.sin(ang * 3 + p.getY(i) * 9) * 0.04;
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
  }
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()));
  g.translate(a.x, a.y, a.z);
  g.deleteAttribute("uv");
  return g;
}

/** Crossed leaf cards around p, with normals pointing out of the crown centre c. */
function leafCluster(out: THREE.BufferGeometry[], p: THREE.Vector3, c: THREE.Vector3, size: number, r: () => number, cards = 3) {
  for (let k = 0; k < cards; k++) {
    const q = new THREE.PlaneGeometry(size, size);
    q.rotateY(r() * Math.PI);
    q.rotateX((r() - 0.5) * 1.4);
    q.rotateZ((r() - 0.5) * 1.0);
    q.translate(p.x + (r() - 0.5) * size * 0.4, p.y + (r() - 0.5) * size * 0.3, p.z + (r() - 0.5) * size * 0.4);
    const pos = q.attributes.position as THREE.BufferAttribute;
    const nor = q.attributes.normal as THREE.BufferAttribute;
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      n.set(pos.getX(i) - c.x, (pos.getY(i) - c.y) * 1.3 + 0.15, pos.getZ(i) - c.z).normalize();
      nor.setXYZ(i, n.x, n.y, n.z);
    }
    // inner leaves a touch darker (self-shadowing)
    const d = Math.min(1, p.distanceTo(c) / (size * 2.6));
    colorize(q, () => tmpColor.setScalar(0.62 + d * 0.38).clone());
    out.push(q);
  }
}

type Broad = { h: number; crownY: number; crown: [number, number, number]; branches: number; lean: number; hollow: boolean; seed: number; clusters: number };
const BROAD: Record<string, Broad> = {
  oak: { h: 0.55, crownY: 0.78, crown: [0.42, 0.34, 0.42], branches: 6, lean: 0.03, hollow: true, seed: 11, clusters: 46 },
  default: { h: 0.5, crownY: 0.72, crown: [0.34, 0.36, 0.34], branches: 5, lean: 0.02, hollow: false, seed: 12, clusters: 38 },
  detailed: { h: 0.6, crownY: 0.82, crown: [0.38, 0.38, 0.38], branches: 7, lean: 0.05, hollow: true, seed: 13, clusters: 50 },
  fat: { h: 0.45, crownY: 0.7, crown: [0.46, 0.32, 0.46], branches: 6, lean: 0.0, hollow: false, seed: 14, clusters: 48 },
  tall: { h: 0.75, crownY: 0.98, crown: [0.26, 0.42, 0.26], branches: 5, lean: 0.02, hollow: true, seed: 15, clusters: 36 },
};

function broadleaf(kind: keyof typeof BROAD) {
  const T = BROAD[kind];
  const r = rng(T.seed);
  const bark: THREE.BufferGeometry[] = [];
  const leaves: THREE.BufferGeometry[] = [];
  const top = new THREE.Vector3(T.lean, T.h, 0);
  // trunk in two bends + root flare
  const mid = new THREE.Vector3(T.lean * 0.4 + 0.01, T.h * 0.5, 0.01);
  bark.push(limb(new THREE.Vector3(0, -0.05, 0), mid, 0.062, 0.05, 9, 7));
  bark.push(limb(mid, top, 0.05, 0.036, 9, 7));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + r();
    bark.push(limb(new THREE.Vector3(Math.cos(a) * 0.03, 0.08, Math.sin(a) * 0.03), new THREE.Vector3(Math.cos(a) * 0.12, -0.02, Math.sin(a) * 0.12), 0.03, 0.012, 5));
  }
  const c = new THREE.Vector3(T.lean, T.crownY, 0);
  const [rx, ry, rz] = T.crown;
  // branches fork out from the upper trunk into the crown, each tipped with leaf clusters
  for (let b = 0; b < T.branches; b++) {
    const a = (b / T.branches) * Math.PI * 2 + r() * 0.6;
    const y0 = T.h * (0.62 + r() * 0.35);
    const base = new THREE.Vector3(T.lean * (y0 / T.h), y0, 0);
    const end = new THREE.Vector3(c.x + Math.cos(a) * rx * 0.75, c.y + (r() - 0.3) * ry * 0.7, c.z + Math.sin(a) * rz * 0.75);
    bark.push(limb(base, end, 0.024, 0.01, 6));
    for (let t = 0; t < 2; t++) {
      const a2 = a + (t ? 0.7 : -0.7);
      const tip = new THREE.Vector3(end.x + Math.cos(a2) * rx * 0.3, end.y + 0.06 + r() * 0.1, end.z + Math.sin(a2) * rz * 0.3);
      bark.push(limb(end, tip, 0.01, 0.004, 4));
      leafCluster(leaves, tip, c, 0.2 + r() * 0.06, r, 3);
    }
  }
  // fill the crown volume with clusters (more toward the outside)
  for (let i = 0; i < T.clusters; i++) {
    const u = r() * Math.PI * 2;
    const v = Math.acos(2 * r() - 1);
    const k = 0.55 + Math.sqrt(r()) * 0.45;
    const p = new THREE.Vector3(c.x + Math.sin(v) * Math.cos(u) * rx * k, c.y + Math.cos(v) * ry * k * 0.95, c.z + Math.sin(v) * Math.sin(u) * rz * k);
    if (p.y < T.h * 0.62) continue;
    leafCluster(leaves, p, c, 0.17 + r() * 0.08, r, 2);
  }
  // a squirrel hollow: dark hole with a swollen bark lip
  if (T.hollow) {
    const hy = T.h * 0.55;
    const hole = new THREE.CircleGeometry(0.022, 10);
    hole.scale(1, 1.35, 1);
    hole.translate(0, hy, 0.047);
    hole.deleteAttribute("uv");
    colorize(hole, () => "#1d120a");
    const lip = new THREE.TorusGeometry(0.024, 0.008, 5, 12);
    lip.scale(1, 1.35, 1);
    lip.translate(0, hy, 0.045);
    lip.deleteAttribute("uv");
    colorize(lip, () => "#5a3b22");
    bark.push(hole, lip);
  }
  for (const g of bark) if (!g.attributes.color) colorize(g, (x, y, z) => {
    const n = Math.sin(x * 120 + y * 40) * Math.sin(z * 110 - y * 25);
    return tmpColor.setRGB(0.36 + n * 0.05, 0.25 + n * 0.035, 0.16 + n * 0.02).clone();
  });
  return { bark: mergeGeometries(bark.map((g) => (g.index ? g.toNonIndexed() : g)))!, leaves: mergeGeometries(leaves.map((g) => (g.index ? g.toNonIndexed() : g)))! };
}

type Pine = { h: number; whorls: number; spread: number; seed: number; round: boolean };
const PINES: Record<string, Pine> = {
  pineTall: { h: 1.55, whorls: 9, spread: 0.36, seed: 21, round: false },
  pineRound: { h: 1.2, whorls: 7, spread: 0.4, seed: 22, round: true },
  cone: { h: 1.35, whorls: 8, spread: 0.32, seed: 23, round: false },
};

function conifer(kind: keyof typeof PINES) {
  const T = PINES[kind];
  const r = rng(T.seed);
  const bark: THREE.BufferGeometry[] = [];
  const leaves: THREE.BufferGeometry[] = [];
  bark.push(limb(new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0, T.h, 0), 0.05, 0.008, 8, 9));
  const c = new THREE.Vector3(0, T.h * 0.55, 0);
  for (let w = 0; w < T.whorls; w++) {
    const t = w / (T.whorls - 1);
    const y = T.h * (0.22 + t * 0.74);
    const reach = T.spread * (T.round ? Math.sin((1 - t * 0.85) * Math.PI * 0.62) : 1 - t * 0.85) + 0.03;
    const n = 6 + Math.round((1 - t) * 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + w * 0.5 + r() * 0.3;
      const base = new THREE.Vector3(0, y, 0);
      const tip = new THREE.Vector3(Math.cos(a) * reach, y - reach * 0.28, Math.sin(a) * reach);
      bark.push(limb(base, tip, 0.01, 0.003, 4));
      // needle sprays along the drooping bough
      for (let s = 0; s <= 2; s++) {
        const p = base.clone().lerp(tip, 0.35 + s * 0.27);
        // each spray is a crossed pair: a drooping frond and an upright one, so the bough reads from any angle
        for (const upright of [false, true]) {
          const q = new THREE.PlaneGeometry(reach * 1.25, reach * 0.95);
          if (upright) q.rotateZ(Math.PI / 2 * 0 + (r() - 0.5) * 0.4);
          else q.rotateX(-Math.PI / 2 + 0.45);
          q.rotateY(-a + Math.PI / 2);
          q.translate(p.x, p.y + (upright ? reach * 0.12 : 0.01), p.z);
          const nor = q.attributes.normal as THREE.BufferAttribute;
          const pos = q.attributes.position as THREE.BufferAttribute;
          const v = new THREE.Vector3();
          for (let i = 0; i < pos.count; i++) {
            v.set(pos.getX(i) - c.x, (pos.getY(i) - c.y) * 0.6 + 0.35, pos.getZ(i) - c.z).normalize();
            nor.setXYZ(i, v.x, v.y, v.z);
          }
          colorize(q, () => tmpColor.setScalar(0.7 + t * 0.3).clone());
          leaves.push(q);
        }
      }
    }
  }
  // a leader tuft at the very top
  const tuft = new THREE.PlaneGeometry(0.12, 0.2);
  tuft.translate(0, T.h + 0.06, 0);
  colorize(tuft, () => "#ffffff");
  leaves.push(tuft, tuft.clone().rotateY(Math.PI / 2));
  for (const g of bark) colorize(g, (x, y, z) => {
    const n = Math.sin(x * 140 + y * 30) * Math.sin(z * 120 - y * 20);
    return tmpColor.setRGB(0.33 + n * 0.05, 0.22 + n * 0.03, 0.15 + n * 0.02).clone();
  });
  return { bark: mergeGeometries(bark.map((g) => (g.index ? g.toNonIndexed() : g)))!, leaves: mergeGeometries(leaves.map((g) => (g.index ? g.toNonIndexed() : g)))! };
}

const partCache = new Map<string, TreePart[]>();
let barkMat: THREE.MeshStandardMaterial | null = null;

/** Instancing parts for a procedural tree kind (null if the key isn't a procedural tree). */
export function treeParts(key: string, wind: number): TreePart[] | null {
  const isBroad = key in BROAD;
  const isPine = key in PINES;
  if (!isBroad && !isPine) return null;
  const hit = partCache.get(key);
  if (hit) return hit;
  barkMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const geo = isBroad ? broadleaf(key as keyof typeof BROAD) : conifer(key as keyof typeof PINES);
  const leafMat = new THREE.MeshStandardMaterial({
    map: isBroad ? leafTexture() : needleTexture(),
    vertexColors: true,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.85,
    // a hint of light passing through the leaves
    emissive: new THREE.Color("#1d2a10"),
  });
  addWind(leafMat, wind);
  const bm = barkMat.clone();
  addWind(bm, wind * 0.6);
  const parts: TreePart[] = [
    { g: geo.bark, m: bm, leaf: false },
    { g: geo.leaves, m: leafMat, leaf: true },
  ];
  partCache.set(key, parts);
  return parts;
}

/** Where a squirrel's hollow sits on a tree of this kind (unit scale), if it has one. */
export function hollowOf(key: string): { y: number; out: number } | null {
  const T = BROAD[key];
  return T?.hollow ? { y: T.h * 0.55, out: 0.05 } : null;
}

/** Trunk height (unit scale) — where perching birds land is on top of the crown. */
export function crownTopOf(key: string): number {
  if (key in BROAD) return BROAD[key].crownY + BROAD[key].crown[1] * 0.85;
  if (key in PINES) return PINES[key].h;
  return 1;
}
