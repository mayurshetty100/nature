import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { paint } from "./boatGeometry";
import { timeUniform } from "@/game/store";

/**
 * Luxury motor yacht "Sea-duction" (bow +z, waterline y≈0, ~12 m):
 * a lofted, flared hull with boot stripe; teak main deck; an aft infinity
 * pool with loungers and an umbrella; a glass-walled saloon; the upper deck
 * with a dining table under the hardtop; the enclosed bridge (control room)
 * with helm, screens and the captain; a radar arch; bow sun pads; guests and
 * a waiter on board. Returned as a few meshes (solid, glass, glow, pool).
 */
export const YACHT_DECK = { main: 1.05, upper: 2.6, roof: 3.85, len: 12 };

function hullGeometry() {
  // cross-sections along z: half-width, sheer (top) height and keel depth
  const N = 28;
  const M = 12;
  const L = YACHT_DECK.len;
  const verts: number[] = [];
  const idx: number[] = [];
  const sec = (t: number) => {
    // t: 0 stern → 1 bow
    const bow = Math.max(0, (t - 0.62) / 0.38);
    const half = 2.15 * (1 - Math.pow(bow, 1.8) * 0.97) * (t < 0.05 ? 0.94 + t * 1.2 : 1);
    const top = YACHT_DECK.main - 0.02 + Math.pow(bow, 2) * 0.55;
    const keel = -0.55 + Math.pow(bow, 1.5) * 0.6 + (t < 0.08 ? (0.08 - t) * 2 : 0);
    return { half, top, keel };
  };
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const z = -L / 2 + t * L;
    const { half, top, keel } = sec(t);
    for (let j = 0; j <= M; j++) {
      // round the bilge: from the keel up the side to the sheer, mirrored for the other side
      const u = j / M; // 0 = keel centre, 1 = sheer
      const a = u * Math.PI * 0.5;
      const x = Math.sin(a) * half * (1 + 0.06 * Math.sin(u * Math.PI)); // a touch of flare
      const y = keel + (1 - Math.cos(a)) * (top - keel);
      verts.push(x, y, z);
    }
  }
  const row = M + 1;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < M; j++) {
      const a = i * row + j;
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  const right = new THREE.BufferGeometry();
  right.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  right.setIndex(idx);
  const left = right.clone();
  left.scale(-1, 1, 1);
  const li = left.index!.array as Uint16Array | Uint32Array;
  for (let k = 0; k < li.length; k += 3) {
    const tmp = li[k];
    li[k] = li[k + 1];
    li[k + 1] = tmp;
  }
  // transom (flat stern)
  const st = sec(0);
  const tr = new THREE.Shape();
  tr.moveTo(0, st.keel);
  for (let j = 0; j <= M; j++) {
    const a = (j / M) * Math.PI * 0.5;
    tr.lineTo(Math.sin(a) * st.half, st.keel + (1 - Math.cos(a)) * (st.top - st.keel));
  }
  tr.lineTo(-st.half, st.top);
  for (let j = M; j >= 0; j--) {
    const a = (j / M) * Math.PI * 0.5;
    tr.lineTo(-Math.sin(a) * st.half, st.keel + (1 - Math.cos(a)) * (st.top - st.keel));
  }
  const transom = new THREE.ShapeGeometry(tr);
  transom.rotateY(Math.PI);
  transom.translate(0, 0, -L / 2);
  const g = mergeGeometries([right.toNonIndexed(), left.toNonIndexed(), transom.toNonIndexed()].map((x) => { x.deleteAttribute("uv"); x.deleteAttribute("normal"); return x; }))!;
  g.computeVertexNormals();
  // colour: navy below the waterline, a gold pinstripe, white topsides
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const navy = new THREE.Color("#1b2b44");
  const gold = new THREE.Color("#d9b45a");
  const white = new THREE.Color("#fbfbf8");
  const blue = new THREE.Color("#22508f");
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const sweep = 0.62 + (z / L) * 0.25;
    const c = y < 0.08 ? navy : Math.abs(y - sweep) < 0.05 ? gold : y > sweep && y < sweep + 0.22 && z < L * 0.3 ? blue : white;
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return { g, sec };
}

/** A stylised guest / crew figure (feet at 0, facing +z). */
function person(P: THREE.BufferGeometry[], x: number, y: number, z: number, yaw: number, o: { top: string; bottom: string; skin: string; hair: string; sit?: boolean; lie?: boolean; hat?: string }) {
  const parts: THREE.BufferGeometry[] = [];
  const put = (g: THREE.BufferGeometry, px: number, py: number, pz: number, c: string, rx = 0) => {
    g.rotateX(rx);
    g.translate(px, py, pz);
    parts.push(paint(g, c));
  };
  const hip = o.sit ? 0.48 : 0.9;
  if (o.sit) {
    for (const s of [-1, 1]) {
      put(new THREE.CapsuleGeometry(0.075, 0.34, 4, 8), s * 0.1, hip, 0.2, o.bottom, Math.PI / 2);
      put(new THREE.CapsuleGeometry(0.065, 0.32, 4, 8), s * 0.1, 0.22, 0.4, o.bottom);
    }
  } else for (const s of [-1, 1]) put(new THREE.CapsuleGeometry(0.075, 0.68, 4, 8), s * 0.1, 0.44, 0, o.bottom);
  put(new THREE.CapsuleGeometry(0.17, 0.34, 4, 10), 0, hip + 0.32, 0, o.top);
  for (const s of [-1, 1]) put(new THREE.CapsuleGeometry(0.055, 0.4, 4, 8), s * 0.24, hip + 0.3, o.sit ? 0.08 : 0, o.top, o.sit ? -0.5 : 0);
  put(new THREE.SphereGeometry(0.15, 14, 10), 0, hip + 0.78, 0, o.skin);
  put(new THREE.SphereGeometry(0.155, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, hip + 0.8, -0.015, o.hair);
  for (const s of [-1, 1]) put(new THREE.SphereGeometry(0.018, 6, 5), s * 0.055, hip + 0.8, 0.135, "#2a1d14");
  if (o.hat) {
    put(new THREE.CylinderGeometry(0.17, 0.17, 0.09, 14), 0, hip + 0.93, 0, o.hat);
    put(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 14), 0, hip + 0.89, 0.04, "#1b2b44");
  }
  const g = mergeGeometries(parts)!;
  if (o.lie) {
    g.rotateX(-Math.PI / 2 + 0.35);
    g.translate(0, 0.25, 0);
  }
  g.rotateY(yaw);
  g.translate(x, y, z);
  P.push(g);
}

export function buildYacht() {
  const D = YACHT_DECK;
  const L = D.len;
  const solid: THREE.BufferGeometry[] = [];
  const glass: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const add = (arr: THREE.BufferGeometry[], g: THREE.BufferGeometry, x: number, y: number, z: number, c: string, rx = 0, ry = 0) => {
    g.rotateX(rx);
    g.rotateY(ry);
    g.translate(x, y, z);
    arr.push(paint(g, c));
  };
  const rb = (w: number, h: number, d: number, r = 0.08) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, Math.min(w, h, d) / 2 - 0.001));
  const { g: hull, sec } = hullGeometry();
  solid.push(hull);
  const halfAt = (z: number) => sec((z + L / 2) / L).half;
  const TEAK = "#c99e6a";
  const WHITE = "#fbfbf8";
  const CHROME = "#d9dde2";
  // teak main deck following the hull outline
  const deckShape = new THREE.Shape();
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const z = -L / 2 + 0.05 + (i / steps) * (L * 0.98);
    const x = halfAt(z) - 0.06;
    if (i === 0) deckShape.moveTo(x, z);
    else deckShape.lineTo(x, z);
  }
  for (let i = steps; i >= 0; i--) {
    const z = -L / 2 + 0.05 + (i / steps) * (L * 0.98);
    deckShape.lineTo(-(halfAt(z) - 0.06), z);
  }
  const deck = new THREE.ExtrudeGeometry(deckShape, { depth: 0.08, bevelEnabled: false });
  deck.rotateX(Math.PI / 2);
  deck.translate(0, D.main + 0.06, 0);
  solid.push(paint(deck, TEAK));
  // the bow deck rises with the sheer: a raised foredeck pad
  add(solid, rb(2.2, 0.3, 2.6, 0.12), 0, D.main + 0.25, L / 2 - 2.6, WHITE);
  // swim platform + steps at the stern
  add(solid, rb(4.0, 0.12, 1.0, 0.05), 0, 0.32, -L / 2 - 0.45, TEAK);
  for (let k = 0; k < 3; k++) add(solid, rb(1.2, 0.08, 0.3, 0.03), 0, 0.5 + k * 0.18, -L / 2 + 0.1 + k * 0.28, TEAK);

  // ---- aft deck: infinity pool, loungers, umbrella ----
  const poolZ = -L / 2 + 2.0;
  add(solid, rb(3.0, 0.5, 2.3, 0.1), 0, D.main + 0.25, poolZ, WHITE); // pool tub
  add(solid, rb(2.6, 0.06, 1.9, 0.03), 0, D.main + 0.52, poolZ, "#e9f6f8"); // tiled rim
  for (const s of [-1, 1]) {
    add(solid, rb(0.7, 0.18, 1.6, 0.08), s * 1.55, D.main + 0.2, poolZ - 0.1, "#f2f2ee"); // loungers
    add(solid, rb(0.68, 0.12, 0.6, 0.06), s * 1.55, D.main + 0.38, poolZ - 0.75, "#f2f2ee", -0.5);
    add(solid, rb(0.6, 0.06, 1.4, 0.03), s * 1.55, D.main + 0.31, poolZ - 0.05, "#2f9fb5");
  }
  add(solid, new THREE.CylinderGeometry(0.03, 0.03, 2.0, 8), 1.55, D.main + 1.0, poolZ + 1.0, CHROME);
  add(solid, new THREE.ConeGeometry(1.1, 0.4, 16, 1, true), 1.55, D.main + 2.05, poolZ + 1.0, "#f7f2e8");
  // ---- saloon: glass walls under the upper deck ----
  const sz0 = -L / 2 + 3.6;
  const sz1 = L / 2 - 4.0;
  const sl = sz1 - sz0;
  const sc = (sz0 + sz1) / 2;
  add(solid, rb(3.5, 0.3, sl, 0.1), 0, D.main + 0.15, sc, WHITE); // saloon floor plinth
  add(glass, rb(3.4, 1.2, sl - 0.1, 0.12), 0, D.main + 0.9, sc, "#203a52");
  for (let k = 0; k <= 4; k++) add(solid, new THREE.BoxGeometry(3.46, 1.22, 0.06), 0, D.main + 0.9, sz0 + (sl * k) / 4, WHITE);
  // upper deck slab
  add(solid, rb(3.8, 0.16, sl + 0.6, 0.08), 0, D.upper - 0.08, sc - 0.2, WHITE);
  // ---- upper deck: dining under the hardtop ----
  const dz = sc - 1.6;
  const table = new THREE.CylinderGeometry(0.55, 0.55, 0.06, 24);
  table.scale(1.6, 1, 1);
  add(solid, table, 0, D.upper + 0.72, dz, "#7a4a2c");
  add(solid, new THREE.CylinderGeometry(0.06, 0.12, 0.7, 10), 0, D.upper + 0.36, dz, CHROME);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const cx = Math.cos(a) * 1.2;
    const cz = Math.sin(a) * 0.82;
    add(solid, rb(0.42, 0.08, 0.42, 0.04), cx, D.upper + 0.45, dz + cz, "#f2f2ee");
    add(solid, rb(0.42, 0.5, 0.06, 0.03), cx * 1.18, D.upper + 0.7, dz + cz * 1.18, "#f2f2ee", 0, -a + Math.PI / 2);
    // place settings: plate + wine glass
    add(solid, new THREE.CylinderGeometry(0.11, 0.11, 0.015, 14), cx * 0.55, D.upper + 0.76, dz + cz * 0.55, "#ffffff");
    add(glass, new THREE.CylinderGeometry(0.035, 0.02, 0.12, 8), cx * 0.45, D.upper + 0.82, dz + cz * 0.4, "#c8e6f2");
  }
  add(glow, new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), 0, D.upper + 0.82, dz, "#ffd98a"); // candle
  add(solid, rb(0.5, 0.2, 0.3, 0.05), 0.5, D.upper + 0.85, dz + 0.1, "#e86a7a"); // flowers
  // hardtop on slim posts
  add(solid, rb(3.6, 0.12, 4.6, 0.12), 0, D.roof, sc, WHITE);
  for (const sx of [-1, 1]) for (const z of [sc - 2.1, sc + 1.0]) add(solid, new THREE.CylinderGeometry(0.05, 0.05, D.roof - D.upper, 10), sx * 1.6, (D.roof + D.upper) / 2, z, CHROME);
  // ---- the bridge (control room): enclosed, sloped windscreen, helm, screens, captain ----
  const bz = sc + 1.8;
  // low bulkheads either side, glass above (open at the back so you can step to the helm)
  for (const s of [-1, 1]) add(solid, rb(0.1, 0.55, 1.5, 0.04), s * 1.5, D.upper + 0.28, bz - 0.1, WHITE);
  const ws = rb(2.8, 0.9, 0.06, 0.03);
  add(glass, ws, 0, D.upper + 0.95, bz + 0.75, "#203a52", -0.55);
  for (const s of [-1, 1]) add(glass, rb(0.06, 0.6, 1.2, 0.03), s * 1.51, D.upper + 0.95, bz - 0.1, "#203a52");
  add(solid, rb(2.2, 0.55, 0.45, 0.06), 0, D.upper + 0.5, bz + 0.35, "#2a2d33"); // console
  add(glow, rb(0.55, 0.3, 0.04, 0.02), -0.6, D.upper + 0.85, bz + 0.48, "#5fe3ff", -0.6);
  add(glow, rb(0.55, 0.3, 0.04, 0.02), 0.6, D.upper + 0.85, bz + 0.48, "#7cf0b0", -0.6);
  const wheel = new THREE.TorusGeometry(0.2, 0.025, 6, 18);
  add(solid, wheel, 0, D.upper + 0.95, bz + 0.2, "#7a4a2c", -0.7);
  add(solid, rb(0.5, 0.5, 0.5, 0.1), 0.8, D.upper + 0.3, bz - 0.5, "#e8e2d4"); // captain's chair
  // radar arch + dome, antennas, nav lights
  for (const s of [-1, 1]) add(solid, rb(0.18, 1.1, 0.5, 0.08), s * 1.2, D.roof + 0.55, sc - 1.6, WHITE, 0.25 * s * 0);
  add(solid, rb(2.6, 0.2, 0.55, 0.08), 0, D.roof + 1.1, sc - 1.6, WHITE);
  add(solid, new THREE.SphereGeometry(0.28, 14, 10), 0, D.roof + 1.42, sc - 1.6, "#f4f4f0");
  for (const s of [-1, 1]) add(solid, new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), s * 0.9, D.roof + 1.7, sc - 1.6, CHROME);
  add(glow, new THREE.SphereGeometry(0.07, 8, 6), -halfAt(L / 2 - 3) + 0.05, D.main + 0.55, L / 2 - 3, "#ff3a3a");
  add(glow, new THREE.SphereGeometry(0.07, 8, 6), halfAt(L / 2 - 3) - 0.05, D.main + 0.55, L / 2 - 3, "#3aff6a");
  add(glow, new THREE.SphereGeometry(0.06, 8, 6), 0, D.roof + 1.95, sc - 1.6, "#ffffff");
  // ---- bow sun pads ----
  for (const s of [-0.55, 0.55]) add(solid, rb(1.0, 0.18, 1.9, 0.09), s, D.main + 0.48, L / 2 - 2.7, "#eef3f6", -0.1);
  // ---- chrome rails round the main deck ----
  const railPts = (side: number) => {
    const pts: THREE.Vector3[] = [];
    for (let z = -L / 2 + 0.2; z <= L / 2 - 0.6; z += 0.5) pts.push(new THREE.Vector3(side * (halfAt(z) - 0.12), sec((z + L / 2) / L).top + 0.62, z));
    return pts;
  };
  for (const s of [-1, 1]) {
    const pts = railPts(s);
    solid.push(paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.025, 6, false), CHROME));
    pts.forEach((p, i) => i % 2 === 0 && add(solid, new THREE.CylinderGeometry(0.018, 0.018, 0.6, 6), p.x, p.y - 0.3, p.z, CHROME));
  }
  // ---- people on board: captain at the helm, guests by the pool and at dinner, a waiter ----
  person(solid, 0.8, D.upper, bz - 0.55, Math.PI, { top: "#ffffff", bottom: "#1b2b44", skin: "#c58c62", hair: "#2a1d14", sit: true, hat: "#ffffff" });
  person(solid, -1.55, D.main + 0.3, poolZ - 0.05, Math.PI, { top: "#ff7a9a", bottom: "#ff7a9a", skin: "#e6b48a", hair: "#6b3a1f", lie: true });
  person(solid, 1.55, D.main + 0.3, poolZ - 0.05, Math.PI, { top: "#2f9fb5", bottom: "#2f9fb5", skin: "#8d5a3a", hair: "#1a120c", lie: true });
  person(solid, -1.2 * 0.98, D.upper, dz, Math.PI / 2, { top: "#e9d8a6", bottom: "#3a3a44", skin: "#e6b48a", hair: "#2a1d14", sit: true });
  person(solid, 1.2 * 0.98, D.upper, dz, -Math.PI / 2, { top: "#b03a5b", bottom: "#b03a5b", skin: "#c58c62", hair: "#111111", sit: true });
  person(solid, 0.4, D.upper, dz - 1.4, 0.3, { top: "#ffffff", bottom: "#111111", skin: "#e0aa82", hair: "#3a2a1a" });
  add(solid, new THREE.CylinderGeometry(0.2, 0.2, 0.02, 14), 0.62, D.upper + 1.15, dz - 1.32, CHROME); // waiter's tray

  // pool water (animated)
  const water = new THREE.PlaneGeometry(2.5, 1.8, 1, 1);
  water.rotateX(-Math.PI / 2);
  water.translate(0, D.main + 0.48, poolZ);

  return {
    solid: mergeGeometries(solid, false)!,
    glass: mergeGeometries(glass, false)!,
    glow: mergeGeometries(glow, false)!,
    water,
  };
}

/** Shimmering turquoise pool water with drifting caustics. */
export function makePoolMaterial() {
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: timeUniform },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 p = vUv * vec2(9.0, 6.5);
        float c = sin(p.x + uTime * 1.3 + sin(p.y * 1.7 + uTime)) * sin(p.y * 1.3 - uTime * 1.1 + sin(p.x * 1.2));
        float caust = smoothstep(0.55, 1.0, abs(c));
        vec3 col = mix(vec3(0.12, 0.62, 0.74), vec3(0.45, 0.9, 0.95), vUv.y * 0.4 + 0.2) + caust * 0.35;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return m;
}
