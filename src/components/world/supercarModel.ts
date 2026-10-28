import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { RideSkin, VehicleDef, VehicleId } from "@/game/vehicles";
import type { Wheel } from "./vehicleModel";

/**
 * Procedural hypercars and race bikes: solid, bevelled, sculpted bodies
 * (side silhouettes extruded and tapered — tumblehome, pinched nose, crowned
 * hood), tinted canopies, wheel arches cut into the body, spoked rims with
 * calipers, slim LED lamps, intakes, diffusers, wings and nitro flames.
 * Unbranded "vibes": hyper (rounded, two-tone), wedge (sharp), bubble (quad
 * pipes), gt (long hood), rally (raised, light bar). +z forward, wheels on y=0.
 */
export type CarStyle = "hyper" | "wedge" | "bubble" | "gt" | "rally";

type P = [number, number];

const nitroCore = new THREE.MeshBasicMaterial({ color: "#e8f6ff", transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
function nitro(root: THREE.Object3D, x: number, y: number, z: number, color: string, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  g.userData.base = scale;
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide } as const;
  // wide, soft gas plume around a hot flame and a white core
  const gas = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.9, 14, 1, true), new THREE.MeshBasicMaterial({ color, opacity: 0.22, ...additive }));
  gas.rotation.x = -Math.PI / 2;
  gas.position.z = -0.95;
  gas.name = "gas";
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1.25, 12, 1, true), new THREE.MeshBasicMaterial({ color, opacity: 0.8, ...additive }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.z = -0.62;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.65, 10), nitroCore);
  core.rotation.x = -Math.PI / 2;
  core.position.z = -0.32;
  g.add(gas, outer, core);
  g.visible = false;
  root.add(g);
  ((root.userData.nitro ??= []) as THREE.Object3D[]).push(g);
}

/** Side silhouette (u forward, v up) extruded across the width, centred, then sculpted. */
function sculpt(shape: THREE.Shape, width: number, bevel: number, taper: (x: number, y: number, z: number) => number) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.7, bevelSegments: 5, curveSegments: 18 });
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setX(i, x * taper(x, y, z));
  }
  geo.computeVertexNormals();
  // glossy, flowing panels: smooth the shading across every gentle fold, keep only real creases
  return toCreasedNormals(geo, 1.0);
}

const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

type CarSpec = {
  len: number;
  width: number;
  wheelR: number;
  wheelF: number;
  wheelB: number;
  /** ride height added to everything */
  lift: number;
  /** body side silhouette above the arches: from nose (front) round the top to the tail */
  top: P[];
  /** canopy silhouette (tinted glass) */
  glass: P[];
  wing?: boolean;
  quad?: boolean;
  lightBar?: boolean;
  twoTone?: boolean;
  /** how far the wheel-arch fenders bulge out (curvy hips) */
  flare: number;
  /** pinch of the waist between the wheels (cab-forward bubble look) */
  waist: number;
};

const SPECS: Record<CarStyle, CarSpec> = {
  // rounded hypercar, horseshoe nose, two-tone sweep
  hyper: { len: 4.6, width: 1.86, wheelR: 0.37, wheelF: 1.42, wheelB: -1.4, lift: 0, top: [[2.32, 0.34], [2.2, 0.58], [1.3, 0.76], [0.6, 0.84], [-0.9, 0.9], [-1.9, 0.86], [-2.28, 0.72]], glass: [[0.75, 0.8], [0.05, 1.14], [-0.6, 1.14], [-1.45, 0.9], [-1.45, 0.82]], twoTone: true, flare: 0.07, waist: 0.03 },
  // sharp wedge with a big rear wing
  wedge: { len: 4.6, width: 1.9, wheelR: 0.36, wheelF: 1.45, wheelB: -1.38, lift: 0, top: [[2.34, 0.3], [2.1, 0.48], [0.9, 0.74], [-1.2, 0.86], [-2.25, 0.84]], glass: [[0.85, 0.74], [0.0, 1.08], [-0.75, 1.06], [-1.55, 0.88], [-1.55, 0.8]], wing: true, flare: 0.04, waist: 0 },
  // bubble canopy, quad centre pipes, little ducktail
  bubble: { len: 4.5, width: 1.84, wheelR: 0.36, wheelF: 1.38, wheelB: -1.36, lift: 0, top: [[2.26, 0.36], [2.05, 0.62], [1.1, 0.78], [-1.0, 0.86], [-2.0, 0.9], [-2.26, 0.8]], glass: [[0.7, 0.8], [0.15, 1.12], [-0.45, 1.2], [-1.2, 1.02], [-1.5, 0.86], [-1.5, 0.8]], quad: true, flare: 0.09, waist: 0.07 },
  // long-hood grand tourer, fastback
  gt: { len: 4.7, width: 1.86, wheelR: 0.37, wheelF: 1.52, wheelB: -1.36, lift: 0, top: [[2.36, 0.36], [2.15, 0.6], [0.3, 0.8], [-1.6, 0.84], [-2.32, 0.78]], glass: [[0.3, 0.8], [-0.35, 1.12], [-1.0, 1.1], [-2.05, 0.84], [-2.05, 0.8]], flare: 0.06, waist: 0.02 },
  // raised rally hypercar with a roof light bar
  rally: { len: 4.3, width: 1.9, wheelR: 0.44, wheelF: 1.35, wheelB: -1.3, lift: 0.18, top: [[2.18, 0.4], [2.0, 0.66], [1.0, 0.82], [-1.0, 0.88], [-2.1, 0.86]], glass: [[0.7, 0.84], [0.05, 1.2], [-0.8, 1.2], [-1.5, 0.94], [-1.5, 0.86]], wing: true, lightBar: true, flare: 0.13, waist: 0 },
};

/** A hypercar body in the given style and paint. */
export function buildSupercar(style: CarStyle, length: number, skin?: RideSkin) {
  const S = SPECS[style];
  const k = length / S.len;
  const paint = new THREE.MeshPhysicalMaterial({ color: skin?.body ?? "#1546d6", metalness: 0.5, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const bodyPaint = S.twoTone ? new THREE.MeshPhysicalMaterial({ color: "#ffffff", metalness: 0.5, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, vertexColors: true }) : paint;
  const carbon = new THREE.MeshStandardMaterial({ color: "#121318", roughness: 0.5, metalness: 0.4 });
  const glass = new THREE.MeshPhysicalMaterial({ color: "#0d1422", metalness: 0.2, roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.88 });
  const rimMat = new THREE.MeshStandardMaterial({ color: skin?.rim ?? "#d9dde6", metalness: 0.85, roughness: 0.25 });
  const tyre = new THREE.MeshStandardMaterial({ color: "#16171b", roughness: 0.9 });
  const head = new THREE.MeshStandardMaterial({ color: "#fff6dc", emissive: "#fff6dc", emissiveIntensity: 2.6, toneMapped: false });
  const tail = new THREE.MeshStandardMaterial({ color: "#ff2d3d", emissive: "#ff2d3d", emissiveIntensity: 2.4, toneMapped: false });
  const accent = new THREE.MeshStandardMaterial({ color: skin?.accent ?? "#0b0d14", roughness: 0.4, metalness: 0.5 });
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = S.lift;
  root.add(body);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const R = S.wheelR;
  const yW = R - S.lift; // wheel centre in body space
  const half = S.len / 2;

  // ---- body: bottom runs round both wheel arches, then the top silhouette from nose to tail ----
  const sh = new THREE.Shape();
  const sill = 0.16;
  const ar = R + 0.07;
  sh.moveTo(half - 0.06, sill + 0.04);
  sh.lineTo(S.wheelF + ar, sill + 0.02);
  sh.lineTo(S.wheelF + ar, yW);
  sh.absarc(S.wheelF, yW, ar, 0, Math.PI, false);
  sh.lineTo(S.wheelF - ar, sill);
  sh.lineTo(S.wheelB + ar, sill);
  sh.lineTo(S.wheelB + ar, yW);
  sh.absarc(S.wheelB, yW, ar, 0, Math.PI, false);
  sh.lineTo(S.wheelB - ar, sill + 0.03);
  sh.lineTo(-half + 0.04, sill + 0.06);
  // tail, then the top from back to front
  const top = [...S.top].reverse();
  for (const [u, v] of top) sh.lineTo(u, v);
  sh.lineTo(half, sill + 0.14);
  sh.closePath();
  const W = S.width - 0.2;
  const bodyGeo = sculpt(sh, W, 0.14, (x, y, z) => {
    // tumblehome toward the top, pinched nose and tail
    const t = 1 - 0.2 * clamp01((y - 0.55) / 0.5);
    const n = 1 - 0.16 * clamp01((z - (half - 0.7)) / 0.7) - 0.08 * clamp01((-z - (half - 0.5)) / 0.5);
    // muscular hips: the body swells out over each wheel and nips in at the waist
    const band = Math.max(0, 1 - Math.abs(y - (yW + 0.12)) / 0.42);
    const hips = S.flare * band * (Math.exp(-(((z - S.wheelF) / 0.62) ** 2)) + Math.exp(-(((z - S.wheelB) / 0.66) ** 2)) * 1.15);
    const mid = (S.wheelF + S.wheelB) / 2;
    const waist = S.waist * Math.exp(-(((z - mid) / 0.9) ** 2)) * clamp01((y - 0.3) / 0.4);
    void x;
    return t * n * (1 + hips - waist);
  });
  // crown the hood / deck a touch
  {
    const pos = bodyGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0.5) pos.setY(i, y + 0.035 * (1 - (pos.getX(i) / (W / 2 + 0.1)) ** 2));
    }
    toCreasedNormals(bodyGeo, 1.0);
    if (S.twoTone) {
      // two-tone sweep: accent colour low and toward the nose, body colour above a flowing line
      const col = new Float32Array(pos.count * 3);
      const a = new THREE.Color(skin?.accent ?? "#0b0d14");
      const b = new THREE.Color(skin?.body ?? "#1546d6");
      for (let i = 0; i < pos.count; i++) {
        const line = 0.5 + 0.16 * Math.cos(pos.getZ(i) * 1.15 + 0.6);
        const c = pos.getY(i) < line && Math.abs(pos.getX(i)) > W * 0.3 ? a : b;
        col[i * 3] = Math.min(1, c.r);
        col[i * 3 + 1] = Math.min(1, c.g);
        col[i * 3 + 2] = Math.min(1, c.b);
      }
      bodyGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    }
  }
  add(bodyGeo, bodyPaint, 0, 0, 0);
  bodyGeo.computeBoundingBox();
  const bb = bodyGeo.boundingBox!;
  const zFront = bb.max.z;
  const zBack = bb.min.z;
  const xSide = bb.max.x;

  // ---- canopy (tinted glass, two-tone roof) ----
  const gs = new THREE.Shape();
  S.glass.forEach(([u, v], i) => (i ? gs.lineTo(u, v) : gs.moveTo(u, v)));
  gs.closePath();
  const GW = W * 0.78;
  add(sculpt(gs, GW, 0.08, (_x, y) => 1 - 0.28 * clamp01((y - 0.8) / 0.35)), glass, 0, -0.02, 0);

  // ---- lamps, intakes, splitter, diffuser ----
  for (const s of [-1, 1]) {
    // slim LED headlights swept back along the nose
    const hl = add(new THREE.BoxGeometry(0.42, 0.05, 0.12), head, s * W * 0.3, S.top[0][1] + 0.1, zFront - 0.12);
    hl.rotation.set(0, s * 0.35, s * -0.12);
    // front intakes
    add(new THREE.BoxGeometry(0.42, 0.16, 0.08), carbon, s * W * 0.3, sill + 0.16, zFront - 0.02);
    // side intake behind the door
    const si = add(new THREE.BoxGeometry(0.06, 0.2, 0.7), carbon, s * (xSide - 0.01), 0.46, S.wheelB + ar + 0.45);
    si.rotation.y = s * 0.06;
    // mirrors
    add(new THREE.BoxGeometry(0.2, 0.08, 0.12), paint, s * (GW / 2 + 0.16), 0.88, S.glass[0][0] - 0.2);
    // tail-light blades
    const tl = add(new THREE.BoxGeometry(0.5, 0.05, 0.05), tail, s * W * 0.3, S.top[S.top.length - 1][1] - 0.06, zBack + 0.01);
    tl.rotation.z = s * 0.12;
    // side skirt
    add(new THREE.BoxGeometry(0.08, 0.07, (S.wheelF - ar) - (S.wheelB + ar)), carbon, s * (xSide - 0.02), sill + 0.02, (S.wheelF + S.wheelB) / 2);
  }
  // full-width light bar across the tail
  add(new THREE.BoxGeometry(W * 0.5, 0.025, 0.04), tail, 0, S.top[S.top.length - 1][1] - 0.04, zBack + 0.01);
  // splitter + diffuser fins
  add(new THREE.BoxGeometry(W * 0.95, 0.04, 0.3), carbon, 0, sill - 0.02, zFront - 0.1);
  add(new THREE.BoxGeometry(W * 0.85, 0.12, 0.3), carbon, 0, sill + 0.04, zBack + 0.12);
  for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.03, 0.16, 0.32), carbon, i * W * 0.15, sill + 0.08, zBack + 0.08);
  if (style === "hyper") {
    // horseshoe grille
    const hs = add(new THREE.TorusGeometry(0.16, 0.035, 8, 20, Math.PI * 1.3), accent, 0, sill + 0.26, zFront + 0.01);
    hs.rotation.z = Math.PI * 1.35;
  }
  // exhausts + nitro
  const pipe = new THREE.MeshStandardMaterial({ color: "#c8ccd4", metalness: 0.9, roughness: 0.25 });
  const pipes: P[] = S.quad
    ? [[-0.07, 0.07], [0.07, 0.07], [-0.07, -0.07], [0.07, -0.07]]
    : [[-W * 0.18, 0], [W * 0.18, 0]];
  const py = sill + 0.22;
  for (const [x, y] of pipes) {
    const p = add(new THREE.CylinderGeometry(0.055, 0.06, 0.16, 14), pipe, x, py + y, zBack - 0.02);
    p.rotation.x = Math.PI / 2;
    nitro(body, x, py + y, zBack - 0.08, skin?.glow ?? "#5fe3ff", S.quad ? 0.7 : 1);
  }
  if (S.wing) {
    const ty = S.top[S.top.length - 1][1] + 0.08;
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.3, 0.12), carbon, s * W * 0.3, ty + 0.12, zBack + 0.36);
    const wing = add(new THREE.BoxGeometry(W * 0.98, 0.04, 0.38), accent, 0, ty + 0.28, zBack + 0.3);
    wing.rotation.x = -0.12;
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.03, 0.16, 0.42), accent, s * W * 0.49, ty + 0.28, zBack + 0.3);
  } else add(new THREE.BoxGeometry(W * 0.7, 0.03, 0.14), accent, 0, S.top[S.top.length - 1][1] + 0.1, zBack + 0.14);
  // ---- signature details that make each ride its own thing ----
  const roofY = Math.max(...S.glass.map((q) => q[1]));
  if (style === "hyper") {
    // a spine fin running from the roof down the tail
    const fin = new THREE.Shape();
    fin.moveTo(-0.3, roofY - 0.02);
    fin.quadraticCurveTo(-1.4, roofY + 0.12, -2.0, S.top[S.top.length - 2][1] + 0.02);
    fin.lineTo(-1.9, S.top[S.top.length - 2][1] - 0.06);
    fin.quadraticCurveTo(-1.3, roofY - 0.04, -0.3, roofY - 0.1);
    fin.closePath();
    add(sculpt(fin, 0.05, 0.02, () => 1).translate(-0.025 + 0.025, 0, 0), accent, 0, 0, 0);
  }
  if (style === "wedge") {
    // Y-shaped headlights, a roof scoop and big side blades
    for (const s2 of [-1, 1]) {
      const y2 = add(new THREE.BoxGeometry(0.34, 0.04, 0.08), head, s2 * W * 0.3, S.top[0][1] + 0.06, zFront - 0.24);
      y2.rotation.set(0, s2 * 0.35, s2 * 0.55);
      add(new RoundedBoxGeometry(0.1, 0.32, 0.9, 2, 0.04), carbon, s2 * (xSide + 0.02), 0.5, S.wheelB + ar + 0.5).rotation.y = s2 * 0.08;
    }
    add(new RoundedBoxGeometry(0.5, 0.14, 0.7, 2, 0.06), carbon, 0, roofY + 0.05, -0.55);
  }
  if (style === "bubble") {
    // round headlight pods, round mirrors on stalks
    for (const s2 of [-1, 1]) {
      add(new THREE.SphereGeometry(0.11, 14, 10), head, s2 * W * 0.33, S.top[0][1] + 0.1, zFront - 0.3);
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6), carbon, s2 * (GW / 2 + 0.08), 0.92, S.glass[0][0] - 0.25).rotation.z = s2 * 1.1;
      add(new THREE.SphereGeometry(0.075, 12, 8), paint, s2 * (GW / 2 + 0.2), 0.98, S.glass[0][0] - 0.25);
    }
  }
  if (style === "gt") {
    // power bulge on the long hood, four round tail lamps, side vents behind the front wheels
    add(new RoundedBoxGeometry(0.7, 0.1, 1.6, 2, 0.05), paint, 0, S.top[2][1] - 0.02, 1.25);
    for (const x2 of [-0.62, -0.38, 0.38, 0.62]) add(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 16).rotateX(Math.PI / 2), tail, x2 * (W / 1.66), S.top[S.top.length - 1][1] - 0.12, zBack - 0.01);
    for (const s2 of [-1, 1]) for (let k = 0; k < 3; k++) add(new RoundedBoxGeometry(0.04, 0.05, 0.42, 1, 0.02), carbon, s2 * (xSide - 0.01), 0.55 - k * 0.08, S.wheelF - ar - 0.3);
  }
  if (style === "rally") {
    // roof scoop, skid plate, tow hooks and chunky knobbly tyres
    add(new RoundedBoxGeometry(0.42, 0.16, 0.5, 2, 0.06), carbon, 0, roofY + 0.06, 0.1);
    add(new RoundedBoxGeometry(W * 0.7, 0.06, 0.5, 2, 0.02), new THREE.MeshStandardMaterial({ color: "#c8ccd4", metalness: 0.8, roughness: 0.35 }), 0, sill - 0.04, zFront - 0.25);
    for (const s2 of [-1, 1]) add(new THREE.TorusGeometry(0.05, 0.015, 6, 12), new THREE.MeshStandardMaterial({ color: "#ff3a3a" }), s2 * 0.35, sill + 0.08, zFront + 0.03);
  }
  if (S.lightBar) {
    add(new THREE.BoxGeometry(GW * 0.7, 0.08, 0.1), carbon, 0, 1.24, S.glass[1][0]);
    for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.14, 0.06, 0.03), head, i * GW * 0.13, 1.24, S.glass[1][0] + 0.06);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.24, 0.28), carbon, s * W * 0.36, sill + 0.02, S.wheelB - ar - 0.1);
  }

  // ---- wheels: tyre, spoked rim, centre cap; calipers stay put ----
  const wheels: Wheel[] = [];
  const caliper = new THREE.MeshStandardMaterial({ color: skin?.glow ?? "#ff8a1f", roughness: 0.4, metalness: 0.3 });
  for (const s of [-1, 1])
    for (const z of [S.wheelF, S.wheelB]) {
      const holder = new THREE.Group();
      holder.position.set(s * (W / 2 - 0.08), R, z);
      const spin = new THREE.Group();
      const t = new THREE.Mesh(style === "rally" ? new THREE.TorusGeometry(R - 0.1, 0.12, 10, 24).rotateY(Math.PI / 2) : new THREE.CylinderGeometry(R, R, 0.3, 28), tyre);
      if (style !== "rally") t.rotation.z = Math.PI / 2;
      t.castShadow = true;
      spin.add(t);
      const face = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.72, R * 0.72, 0.02, 24), carbon);
      face.rotation.z = Math.PI / 2;
      face.position.x = s * 0.15;
      spin.add(face);
      for (let i = 0; i < 5; i++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, R * 1.3, 0.07), rimMat);
        sp.position.x = s * 0.165;
        sp.rotation.x = (i / 5) * Math.PI;
        spin.add(sp);
      }
      const lip = new THREE.Mesh(new THREE.TorusGeometry(R * 0.72, 0.025, 6, 28), rimMat);
      lip.rotation.y = Math.PI / 2;
      lip.position.x = s * 0.16;
      spin.add(lip);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), rimMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.x = s * 0.17;
      spin.add(cap);
      holder.add(spin);
      root.add(holder);
      wheels.push({ node: holder, front: z > 0 });
      // brake caliper (doesn't spin)
      add(new THREE.BoxGeometry(0.06, 0.18, 0.12), caliper, s * (W / 2 + 0.02), R + 0.12, z - 0.12, root);
    }
  root.scale.setScalar(k);
  const wrap = new THREE.Group();
  wrap.add(root);
  wrap.userData.nitro = [...(body.userData.nitro ?? []), ...(root.userData.nitro ?? [])];
  return { model: wrap, wheels };
}

/** A race bike (sport fairing, tinted screen, tank, tail, disc brakes, under-tail pipe). */
export function buildRaceBike(length: number, skin?: RideSkin, naked = false) {
  const L = 2.2;
  const k = length / L;
  const paint = new THREE.MeshPhysicalMaterial({ color: skin?.body ?? "#c9ced6", metalness: 0.45, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const accent = new THREE.MeshStandardMaterial({ color: skin?.accent ?? "#15171c", roughness: 0.45, metalness: 0.4 });
  const metal = new THREE.MeshStandardMaterial({ color: "#c8ccd4", metalness: 0.9, roughness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: "#16171b", roughness: 0.85 });
  const glass = new THREE.MeshPhysicalMaterial({ color: "#0d1422", roughness: 0.06, transparent: true, opacity: 0.8, clearcoat: 1 });
  const head = new THREE.MeshStandardMaterial({ color: "#fff6dc", emissive: "#fff6dc", emissiveIntensity: 2.6, toneMapped: false });
  const tail = new THREE.MeshStandardMaterial({ color: "#ff2d3d", emissive: "#ff2d3d", emissiveIntensity: 2.4, toneMapped: false });
  const root = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const R = 0.31;
  const zF = 0.74;
  const zB = -0.72;
  // fairing + tank + tail as one sculpted silhouette
  const sh = new THREE.Shape();
  const pts: P[] = naked
    ? [[0.62, 0.62], [0.55, 0.86], [0.32, 0.98], [0.0, 1.0], [-0.22, 0.86], [-0.5, 0.9], [-0.86, 1.0], [-0.92, 0.94], [-0.55, 0.74], [-0.15, 0.5], [0.35, 0.46]]
    : [[0.98, 0.6], [0.9, 0.78], [0.62, 0.95], [0.3, 0.98], [0.0, 1.0], [-0.22, 0.86], [-0.5, 0.9], [-0.86, 1.02], [-0.92, 0.96], [-0.55, 0.74], [-0.15, 0.42], [0.45, 0.38], [0.85, 0.46]];
  pts.forEach(([u, v], i) => (i ? sh.lineTo(u, v) : sh.moveTo(u, v)));
  sh.closePath();
  add(sculpt(sh, 0.34, 0.07, (_x, y, z) => 1 - 0.35 * clamp01((y - 0.85) / 0.2) - 0.25 * clamp01((z - 0.7) / 0.3) - 0.3 * clamp01((-z - 0.6) / 0.35)), paint, 0, 0, 0);
  // seat
  add(new THREE.BoxGeometry(0.28, 0.06, 0.42), dark, 0, 0.88, -0.3);
  // tinted screen
  if (!naked) {
    const sc = new THREE.Shape();
    sc.moveTo(0.86, 0.8);
    sc.lineTo(0.55, 1.08);
    sc.lineTo(0.5, 1.02);
    sc.lineTo(0.72, 0.84);
    sc.closePath();
    add(sculpt(sc, 0.26, 0.03, () => 1), glass, 0, 0, 0);
  }
  // headlight slits + tail light
  for (const s of [-1, 1]) {
    const hl = add(new THREE.BoxGeometry(0.06, 0.04, 0.16), head, s * 0.09, naked ? 0.82 : 0.68, naked ? 0.62 : 0.94);
    hl.rotation.y = s * 0.4;
  }
  if (naked) add(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 18), head, 0, 0.8, 0.66).rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.16, 0.04, 0.04), tail, 0, 0.98, -0.94);
  // forks, clip-ons, swingarm, engine block, under-tail exhaust
  for (const s of [-1, 1]) {
    const f = add(new THREE.CylinderGeometry(0.025, 0.03, 0.72, 10), metal, s * 0.1, 0.62, zF - 0.12);
    f.rotation.x = 0.4;
    add(new THREE.BoxGeometry(0.22, 0.03, 0.03), dark, s * 0.2, 0.96, 0.46);
    const arm = add(new THREE.BoxGeometry(0.04, 0.06, 0.62), accent, s * 0.1, 0.4, zB + 0.32);
    arm.rotation.x = -0.12;
  }
  add(new THREE.BoxGeometry(0.3, 0.28, 0.4), accent, 0, 0.42, 0.05);
  const ex = add(new THREE.CylinderGeometry(0.06, 0.07, 0.42, 14), metal, 0.14, 0.5, -0.55);
  ex.rotation.x = Math.PI / 2 - 0.3;
  nitro(root, 0.14, 0.56, -0.78, skin?.glow ?? "#5fe3ff", 0.8);
  // wheels with disc brakes
  const wheels: Wheel[] = [];
  const rim = new THREE.MeshStandardMaterial({ color: skin?.rim ?? "#d9dde6", metalness: 0.85, roughness: 0.25 });
  for (const z of [zF, zB]) {
    const holder = new THREE.Group();
    holder.position.set(0, R, z);
    const spin = new THREE.Group();
    const t = new THREE.Mesh(new THREE.TorusGeometry(R - 0.06, 0.07, 10, 28), dark);
    t.rotation.y = Math.PI / 2;
    t.castShadow = true;
    spin.add(t);
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, (R - 0.06) * 2, 0.05), rim);
      sp.rotation.x = (i / 3) * Math.PI;
      spin.add(sp);
    }
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.55, R * 0.55, 0.012, 22), metal);
    disc.rotation.z = Math.PI / 2;
    disc.position.x = 0.05;
    spin.add(disc);
    holder.add(spin);
    root.add(holder);
    wheels.push({ node: holder, front: z > 0 });
  }
  root.scale.setScalar(k);
  const wrap = new THREE.Group();
  wrap.add(root);
  wrap.userData.nitro = root.userData.nitro ?? [];
  return { model: wrap, wheels };
}

/** Body style per ride. */
const CAR_STYLE: Partial<Record<VehicleId, CarStyle>> = { supercar: "hyper", coupe: "wedge", luxury: "bubble", suv: "gt", jeep: "rally" };

/** Build any land ride: a hypercar or a race bike. `roll` is the rolling radius for the wheel spin. */
export function buildRide(id: VehicleId, def: VehicleDef) {
  if (def.kind === "bike") {
    const r = buildRaceBike(def.length, def.skin, id === "scrambler");
    return { ...r, roll: 0.31 * (def.length / 2.2) };
  }
  const style = CAR_STYLE[id] ?? "hyper";
  const r = buildSupercar(style, def.length, def.skin);
  return { ...r, roll: SPECS[style].wheelR * (def.length / SPECS[style].len) };
}
