import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { RideSkin, VehicleId } from "@/game/vehicles";

const KIT = "/models/vehicles/kit/";
export const BIKE_URL = "/models/vehicles/motorbike.obj";
export const JEEP_WHEEL_URL = `${KIT}wheel-truck.glb`;

/** CC0 Kenney Car Kit body per car (bikes use the OBJ, the jeep is built here). */
export const CAR_URL: Partial<Record<VehicleId, string>> = {
  supercar: `${KIT}race-future.glb`,
  coupe: `${KIT}sedan-sports.glb`,
  luxury: `${KIT}suv-luxury.glb`,
  suv: `${KIT}suv.glb`,
};

/** City traffic models (same kit). */
export const TRAFFIC_URLS = ["sedan", "taxi", "police", "van", "delivery", "hatchback-sports", "truck", "ambulance", "suv", "sedan-sports"].map((n) => `${KIT}${n}.glb`);

/** Paint per bike model. */
export const BIKE_PAINT: Record<string, { body: string; metal: number }> = {
  superbike: { body: "#c9ced6", metal: 0.75 },
  scrambler: { body: "#76b83f", metal: 0.35 },
};

export type Wheel = { node: THREE.Object3D; front: boolean };

/** Longest horizontal axis along +Z, wheels on y=0, centred, given length. */
export function normalise(obj: THREE.Object3D, length: number, flip = false) {
  const wrap = new THREE.Group();
  wrap.add(obj);
  let box = new THREE.Box3().setFromObject(obj);
  let size = box.getSize(new THREE.Vector3());
  if (size.x > size.z) {
    obj.rotation.y = Math.PI / 2;
    obj.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(obj);
    size = box.getSize(new THREE.Vector3());
  }
  if (flip) obj.rotation.y += Math.PI;
  const s = length / Math.max(size.z, 1e-3);
  obj.scale.multiplyScalar(s);
  obj.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= box.min.y;
  return wrap;
}

/** Read a texture's pixels once (the kit cars share one palette atlas). */
const pixelCache = new WeakMap<object, { data: Uint8ClampedArray; w: number; h: number } | null>();
function texturePixels(tex: THREE.Texture) {
  const img = tex.image as CanvasImageSource & { width: number; height: number };
  if (!img || typeof document === "undefined") return null;
  if (pixelCache.has(img)) return pixelCache.get(img)!;
  let out: { data: Uint8ClampedArray; w: number; h: number } | null = null;
  try {
    const cv = document.createElement("canvas");
    cv.width = img.width;
    cv.height = img.height;
    const ctx = cv.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      out = { data: ctx.getImageData(0, 0, cv.width, cv.height).data, w: cv.width, h: cv.height };
    }
  } catch {
    out = null;
  }
  pixelCache.set(img, out);
  return out;
}

/**
 * Bake the palette texture into vertex colours, then repaint the car's main
 * paint colour with the skin (its other colours — glass, lights, trim — stay).
 */
function repaintKit(o: THREE.Object3D, skin: RideSkin) {
  const meshes: { mesh: THREE.Mesh; col: Float32Array }[] = [];
  const counts = new Map<string, { n: number; c: THREE.Color }>();
  const c = new THREE.Color();
  o.traverse((x) => {
    const mesh = x as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const px = mat.map ? texturePixels(mat.map) : null;
    const uv = mesh.geometry.attributes.uv;
    if (!px || !uv) return;
    const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    mesh.geometry = geo;
    const uv2 = geo.attributes.uv;
    const col = new Float32Array(uv2.count * 3);
    const wheel = /wheel/.test(mesh.name) || /wheel/.test(mesh.parent?.name ?? "");
    for (let i = 0; i < uv2.count; i++) {
      const u = THREE.MathUtils.clamp(uv2.getX(i), 0, 0.9999);
      const v = THREE.MathUtils.clamp(uv2.getY(i), 0, 0.9999);
      const k = (Math.floor(v * px.h) * px.w + Math.floor(u * px.w)) * 4;
      c.setRGB(px.data[k] / 255, px.data[k + 1] / 255, px.data[k + 2] / 255, THREE.SRGBColorSpace);
      col.set([c.r, c.g, c.b], i * 3);
      if (wheel) continue;
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      if (hsl.s < 0.3 || hsl.l < 0.12 || hsl.l > 0.9) continue;
      const key = String(Math.round(hsl.h * 40));
      const e = counts.get(key) ?? { n: 0, c: c.clone() };
      e.n++;
      counts.set(key, e);
    }
    meshes.push({ mesh, col });
  });
  if (!meshes.length) return false;
  // the paint is the most common saturated hue; repaint every shade of it, keeping its light/dark shading
  const top = [...counts.entries()].sort((a, b) => b[1].n - a[1].n)[0];
  const paintHue = top ? Number(top[0]) / 40 : -1;
  const ref = { h: 0, s: 0, l: 0 };
  top?.[1].c.getHSL(ref);
  const body = new THREE.Color(skin.body);
  const bh = { h: 0, s: 0, l: 0 };
  body.getHSL(bh);
  const hsl = { h: 0, s: 0, l: 0 };
  for (const { mesh, col } of meshes) {
    const wheel = /wheel/.test(mesh.name) || /wheel/.test(mesh.parent?.name ?? "");
    if (paintHue >= 0 && !wheel)
      for (let i = 0; i < col.length; i += 3) {
        c.setRGB(col[i], col[i + 1], col[i + 2]);
        c.getHSL(hsl);
        let dh = Math.abs(hsl.h - paintHue);
        dh = Math.min(dh, 1 - dh);
        if (hsl.s < 0.3 || dh > 0.035) continue;
        const l = THREE.MathUtils.clamp(bh.l * (hsl.l / Math.max(ref.l, 0.05)), 0.03, 0.97);
        c.setHSL(bh.h, bh.s, l);
        col.set([c.r, c.g, c.b], i);
      }
    mesh.geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const old = mesh.material as THREE.MeshStandardMaterial;
    mesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.22, name: old.name });
  }
  return true;
}

const glowCache = new Map<string, THREE.MeshStandardMaterial>();
function glowMaterial(color: string, k = 2.2) {
  const key = `${color}-${k}`;
  let m = glowCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4, toneMapped: false });
    glowCache.set(key, m);
  }
  return m;
}
let haloTex: THREE.Texture | null = null;
function underglowTexture() {
  if (haloTex || typeof document === "undefined") return haloTex;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.55, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(cv);
  return haloTex;
}

const nitroCore = new THREE.MeshBasicMaterial({ color: "#e8f6ff", transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
/** A nitro flame pointing out the back (−z) from an exhaust; hidden until you boost (see `nitroFlames`). */
function addNitro(root: THREE.Object3D, x: number, y: number, z: number, color: string) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.9, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.z = -0.45;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 10), nitroCore);
  core.rotation.x = -Math.PI / 2;
  core.position.z = -0.25;
  g.add(outer, core);
  g.visible = false;
  root.add(g);
  ((root.userData.nitro ??= []) as THREE.Object3D[]).push(g);
}

/** Flicker the nitro flames on a ride: `boost` 0‥1 (0 hides them). */
export function nitroFlames(root: THREE.Object3D, boost: number, t: number) {
  for (const [i, f] of ((root.userData.nitro ?? []) as THREE.Object3D[]).entries()) {
    f.visible = boost > 0.02;
    if (!f.visible) continue;
    const k = boost * (0.85 + Math.sin(t * 47 + i * 1.7) * 0.1 + Math.sin(t * 29 + i) * 0.08);
    const b = (f.userData.base as number | undefined) ?? 1;
    f.scale.set(b * (0.85 + k * 0.5), b * (0.85 + k * 0.5), b * k * 2.1);
    const gas = f.getObjectByName("gas");
    if (gas) gas.scale.set(1 + Math.sin(t * 13 + i) * 0.12, 1 + Math.sin(t * 9 + i * 2) * 0.15, 1);
  }
}

/**
 * Custom-shop extras on a normalised ride (+z forward, wheels on y=0):
 * underglow, glowing side wrap strips, LED head/tail lights, glowing exhaust
 * tips and neon rim rings on the wheels (which spin with them).
 */
export function dressRide(root: THREE.Object3D, skin: RideSkin, wheels: Wheel[], opts: { bike?: boolean } = {}) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };
  const glow = glowMaterial(skin.glow);
  const tex = underglowTexture();
  // underglow pool on the ground
  const pool = add(
    new THREE.PlaneGeometry(size.x * (opts.bike ? 2.2 : 1.35), size.z * 1.15),
    new THREE.MeshBasicMaterial({ color: skin.glow, map: tex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    c.x,
    0.04,
    c.z,
  );
  pool.rotation.x = -Math.PI / 2;
  pool.renderOrder = 2;
  if (opts.bike) {
    // glowing tank stripe + light bar under the seat
    add(new THREE.BoxGeometry(0.05, 0.05, size.z * 0.5), glow, c.x, size.y * 0.55, c.z + size.z * 0.05);
    add(new THREE.BoxGeometry(size.x * 0.5, 0.04, size.z * 0.35), glow, c.x, size.y * 0.3, c.z - size.z * 0.05);
    add(new THREE.BoxGeometry(0.16, 0.08, 0.04), glowMaterial("#fff6dc", 3), c.x, size.y * 0.62, box.max.z - 0.08);
    add(new THREE.BoxGeometry(0.14, 0.05, 0.04), glowMaterial("#ff2d3d", 2.5), c.x, size.y * 0.5, box.min.z + 0.06);
    addNitro(root, c.x, size.y * 0.32, box.min.z - 0.02, skin.glow);
    return;
  }
  // body kit: front splitter, side skirts, rear diffuser and (on low cars) a rear wing
  const kit = new THREE.MeshStandardMaterial({ color: skin.accent, roughness: 0.45, metalness: 0.35 });
  add(new THREE.BoxGeometry(size.x * 0.92, 0.045, 0.28), kit, c.x, 0.13, box.max.z - 0.1);
  add(new THREE.BoxGeometry(size.x * 0.86, 0.04, 0.02), glow, c.x, 0.11, box.max.z + 0.04);
  add(new THREE.BoxGeometry(size.x * 0.8, 0.08, 0.22), kit, c.x, 0.15, box.min.z + 0.08);
  for (let k = -2; k <= 2; k++) add(new THREE.BoxGeometry(0.03, 0.1, 0.2), kit, c.x + k * size.x * 0.12, 0.2, box.min.z + 0.06);
  for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.07, 0.07, size.z * 0.5), kit, c.x + side * (size.x / 2 - 0.01), 0.16, c.z);
  if (size.y < 1.45) {
    for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.22, 0.08), kit, c.x + side * size.x * 0.3, size.y * 0.78, box.min.z + 0.2);
    add(new THREE.BoxGeometry(size.x * 0.92, 0.05, 0.3), kit, c.x, size.y * 0.78 + 0.13, box.min.z + 0.16);
    add(new THREE.BoxGeometry(size.x * 0.92, 0.02, 0.03), glow, c.x, size.y * 0.78 + 0.16, box.min.z + 0.02);
  }
  // livery wrap: slanted speed chevrons on both doors
  for (const side of [-1, 1])
    for (let k = 0; k < 3; k++) {
      const chev = add(new THREE.BoxGeometry(0.012, 0.06, size.z * 0.18), k === 1 ? glow : kit, c.x + side * (size.x / 2 + 0.008), size.y * 0.3 + k * 0.07, c.z - size.z * 0.05 + k * 0.08);
      chev.rotation.x = -0.45;
    }
  // side wrap strips (neon piping along the sills and shoulder line)
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.04, 0.05, size.z * 0.62), glow, c.x + side * (size.x / 2 + 0.005), size.y * 0.24, c.z);
    add(new THREE.BoxGeometry(0.03, 0.03, size.z * 0.45), glowMaterial(skin.accent === "#0b0d14" ? skin.glow : skin.accent, 1.2), c.x + side * (size.x / 2 - 0.02), size.y * 0.5, c.z - size.z * 0.04);
    // LED headlight brows and tail-light bars
    add(new THREE.BoxGeometry(size.x * 0.26, 0.05, 0.05), glowMaterial("#fff6dc", 3), c.x + side * size.x * 0.28, size.y * 0.42, box.max.z - 0.02);
    add(new THREE.BoxGeometry(size.x * 0.3, 0.06, 0.04), glowMaterial("#ff2d3d", 2.5), c.x + side * size.x * 0.26, size.y * 0.45, box.min.z + 0.02);
    // twin glowing exhaust tips + nitro flames (lit while boosting)
    const tip = add(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 12), glowMaterial(skin.glow, 1.6), c.x + side * size.x * 0.22, size.y * 0.16, box.min.z + 0.02);
    tip.rotation.x = Math.PI / 2;
    addNitro(root, c.x + side * size.x * 0.22, size.y * 0.16, box.min.z - 0.04, skin.glow);
  }
  // neon rim rings on every wheel (children of the wheel so they spin and steer)
  const rim = glowMaterial(skin.rim, 1.8);
  for (const w of wheels) {
    const n = w.node;
    let mesh: THREE.Mesh | undefined;
    n.traverse((x) => {
      if (!mesh && (x as THREE.Mesh).isMesh) mesh = x as THREE.Mesh;
    });
    if (!mesh) continue;
    mesh.geometry.computeBoundingBox();
    const lb = mesh.geometry.boundingBox!;
    const ctr = lb.getCenter(new THREE.Vector3());
    // the axle is the wheel's thinnest horizontal axis; rings sit on the face pointing away from the car
    const axleX = lb.max.x - lb.min.x < lb.max.z - lb.min.z;
    const lo = ctr.clone();
    const hi = ctr.clone();
    if (axleX) {
      lo.x = lb.min.x;
      hi.x = lb.max.x;
    } else {
      lo.z = lb.min.z;
      hi.z = lb.max.z;
    }
    const outer = Math.abs(mesh.localToWorld(hi.clone()).x - c.x) > Math.abs(mesh.localToWorld(lo.clone()).x - c.x) ? hi : lo;
    const rad = (lb.max.y - lb.min.y) * 0.34;
    for (const k of [0.6, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rad * k, rad * 0.08, 6, 24), rim);
      if (axleX) ring.rotation.y = Math.PI / 2;
      ring.position.copy(outer).lerp(ctr, -0.02);
      mesh.add(ring);
    }
  }
}

/** A Kenney kit car: own materials (satin clay finish), wheel nodes for spin + steer, optional custom skin. */
export function buildCar(scene: THREE.Object3D, length: number, skin?: RideSkin) {
  const o = scene.clone(true);
  const wheels: Wheel[] = [];
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.metalness = 0.15;
      mat.roughness = 0.55;
      m.material = mat;
    }
    // road wheels only — the SUV's spare on the tailgate ("wheel-back") stays put
    if (/^wheel-(front|back)-(left|right)/.test(c.name)) wheels.push({ node: c, front: c.name.includes("front") });
  });
  if (skin) repaintKit(o, skin);
  const model = normalise(o, length);
  if (skin) dressRide(model, skin, wheels);
  return { model, wheels };
}

/** The OBJ motorbike repainted per bike. */
export function buildBike(obj: THREE.Object3D, length: number, paint: { body: string; metal: number }, skin?: RideSkin) {
  const o = obj.clone(true);
  const body = new THREE.MeshStandardMaterial({ color: skin?.body ?? paint.body, metalness: Math.min(0.45, paint.metal), roughness: 0.38 });
  const tire = new THREE.MeshStandardMaterial({ color: "#1b1d22", roughness: 0.85 });
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const mapped = mats.map((mm) => ((mm as THREE.Material).name?.toLowerCase().includes("tire") ? tire : body));
    m.material = Array.isArray(m.material) ? mapped : mapped[0];
  });
  const model = normalise(o, length);
  if (skin) dressRide(model, skin, [], { bike: true });
  return model;
}

const tmp = new THREE.Color();
function paint(g: THREE.BufferGeometry, hex: string) {
  const geo = g.index ? g.toNonIndexed() : g;
  tmp.set(hex);
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([tmp.r, tmp.g, tmp.b], i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
  if (geo.attributes.uv) geo.deleteAttribute("uv");
  return geo;
}

/** Open-top 4x4: boxy tub, flared arches, roll cage, round lamps, spare wheel — on Kenney truck wheels. */
export function buildJeep(wheelScene: THREE.Object3D, skin?: RideSkin) {
  const P: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, color: string, rx = 0) => {
    if (rx) g.rotateX(rx);
    g.translate(x, y, z);
    P.push(paint(g, color));
  };
  const BODY = skin?.body ?? "#7d8b40";
  const DARK = "#26282c";
  const TRIM = "#3a3d42";
  // tub and bonnet
  add(new THREE.BoxGeometry(1.86, 0.62, 2.5), 0, 0.98, -0.45, BODY);
  add(new THREE.BoxGeometry(1.74, 0.5, 1.45), 0, 1.0, 1.4, BODY);
  add(new THREE.BoxGeometry(1.6, 0.06, 1.3), 0, 1.27, 1.42, skin?.accent ?? "#8c9a4a");
  // bonnet racing stripes
  for (const x of [-0.22, 0.22]) add(new THREE.BoxGeometry(0.16, 0.012, 1.32), x, 1.306, 1.42, skin?.glow ?? "#e8c46a");
  // grille with slots + round lamps
  add(new THREE.BoxGeometry(1.5, 0.5, 0.08), 0, 1.0, 2.14, TRIM);
  for (let k = -3; k <= 3; k++) add(new THREE.BoxGeometry(0.07, 0.36, 0.04), k * 0.13, 1.0, 2.19, "#15161a");
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 16), s * 0.62, 1.08, 2.18, "#fff3c4", Math.PI / 2);
    add(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 16), s * 0.62, 1.08, 2.15, "#c9cdd2", Math.PI / 2);
  }
  // bumpers + side steps
  add(new THREE.BoxGeometry(2.1, 0.22, 0.26), 0, 0.62, 2.26, DARK);
  add(new THREE.BoxGeometry(2.0, 0.22, 0.24), 0, 0.62, -1.74, DARK);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.22, 0.08, 1.5), s * 1.02, 0.6, 0.1, DARK);
  // flared wheel arches
  for (const s of [-1, 1])
    for (const z of [-1.2, 1.35]) {
      const arch = new THREE.CylinderGeometry(0.62, 0.62, 0.34, 14, 1, true, -Math.PI / 2, Math.PI);
      arch.rotateZ(Math.PI / 2);
      add(arch, s * 0.98, 0.72, z, DARK);
    }
  // seats, dash, wheel
  for (const x of [-0.42, 0.42]) {
    add(new THREE.BoxGeometry(0.6, 0.18, 0.6), x, 1.38, -0.35, "#4a2d22");
    add(new THREE.BoxGeometry(0.6, 0.62, 0.16), x, 1.66, -0.68, "#4a2d22");
  }
  add(new THREE.BoxGeometry(1.7, 0.3, 0.6), 0, 1.4, -1.25, "#4a2d22");
  add(new THREE.BoxGeometry(1.7, 0.26, 0.3), 0, 1.38, 0.62, TRIM);
  const steer = new THREE.TorusGeometry(0.17, 0.03, 6, 16);
  steer.rotateX(-0.5);
  add(steer, -0.42, 1.62, 0.42, "#15161a");
  // windscreen frame (open, folded up)
  add(new THREE.BoxGeometry(1.72, 0.06, 0.06), 0, 1.98, 0.78, TRIM, -0.2);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.72, 0.06), s * 0.84, 1.62, 0.8, TRIM, -0.2);
  add(new THREE.BoxGeometry(1.62, 0.6, 0.02), 0, 1.64, 0.79, "#cfe6f0", -0.2);
  // roll cage
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.08, 1.0, 0.08), s * 0.84, 1.8, -0.95, TRIM);
    add(new THREE.BoxGeometry(0.08, 0.08, 1.7), s * 0.84, 2.3, -0.12, TRIM);
  }
  add(new THREE.BoxGeometry(1.76, 0.08, 0.08), 0, 2.3, -0.95, TRIM);
  // tail lamps
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.16, 0.2, 0.04), s * 0.78, 1.05, -1.71, "#e2483c");
  const bodyGeo = mergeGeometries(P, false)!;
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 }));
  body.castShadow = true;
  body.receiveShadow = true;
  const root = new THREE.Group();
  root.add(body);

  // wheels (Kenney truck wheel), sized to 1 m diameter
  const proto = wheelScene.clone(true);
  proto.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) m.castShadow = true;
  });
  const box = new THREE.Box3().setFromObject(proto);
  const size = box.getSize(new THREE.Vector3());
  const wscale = 1.0 / Math.max(size.y, 1e-3);
  const center = box.getCenter(new THREE.Vector3());
  const wheels: Wheel[] = [];
  for (const s of [-1, 1])
    for (const z of [-1.2, 1.35]) {
      const holder = new THREE.Group();
      holder.position.set(s * 0.93, 0.5, z);
      const spinner = new THREE.Group();
      const w = proto.clone(true);
      w.scale.setScalar(wscale);
      w.position.copy(center).multiplyScalar(-wscale);
      // wheel axle along x: turn if the model's widest axis isn't x
      if (size.z < size.x) spinner.rotation.y = Math.PI / 2;
      const inner = new THREE.Group();
      inner.add(w);
      if (s < 0) inner.rotation.y = Math.PI;
      spinner.add(inner);
      holder.add(spinner);
      root.add(holder);
      wheels.push({ node: holder, front: z > 0 });
    }
  // spare wheel on the tailgate
  const spare = proto.clone(true);
  spare.scale.setScalar(wscale * 0.9);
  const sp = new THREE.Group();
  spare.position.copy(center).multiplyScalar(-wscale * 0.9);
  sp.add(spare);
  sp.position.set(0, 1.15, -1.95);
  if (size.z < size.x) sp.rotation.y = Math.PI / 2;
  root.add(sp);
  if (skin) {
    // roof light bar on the roll cage
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.14), new THREE.MeshStandardMaterial({ color: "#1b1c20", roughness: 0.6 }));
    bar.position.set(0, 2.4, -0.95 + 1.7 * 0.5 + 0.0);
    root.add(bar);
    for (let k = -3; k <= 3; k++) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.04), glowMaterial(skin.glow, 3));
      led.position.set(k * 0.2, 2.4, -0.95 + 0.85 + 0.08);
      root.add(led);
    }
    dressRide(root, skin, wheels);
  }
  return { model: root, wheels };
}
