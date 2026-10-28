import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getLayout, type Tower } from "@/game/layout";
import { getWorld, ROAD_HALF } from "@/game/world";
import { player } from "@/game/store";
import { daylight } from "@/game/dayCycle";
import { AnimatedAgent } from "./Agents";
import { makeFacadeTexture } from "./materials";
import { useGLTF } from "@react-three/drei";
import { buildCar, TRAFFIC_URLS } from "./vehicleModel";
import { CITY_LANE, CITY_ROAD_HALF, getCityLoop, loopPose } from "@/game/layout";
import { CITY_PALETTES } from "./constants";
import { addDynamicBody, type Collider } from "@/game/scatter";
import { clearOfRoads, inTower } from "@/game/layout";
import { getRoofs, RAIL_HEIGHT, towerBase } from "@/game/roofs";
import { LOUNGER } from "@/game/chill";

const tmpColor = new THREE.Color();

function paint(g: THREE.BufferGeometry, hex: string) {
  tmpColor.set(hex);
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = tmpColor.r;
    c[i * 3 + 1] = tmpColor.g;
    c[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return g;
}

/** Box with UVs scaled to world size so facade windows repeat every 3 units. */
function facadeBox(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const faces = [d, d, 0, 0, w, w];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (faces[f] === 0) uv.setXY(i, 0.02, 0.02);
      else uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(faces[f] / 2.6)), uv.getY(i) * Math.max(1, Math.round(h / 3)));
    }
  }
  return g;
}

function place(g: THREE.BufferGeometry, t: Tower, lx: number, ly: number, lz: number, base: number) {
  const m = new THREE.Matrix4().makeRotationY(t.rot);
  m.setPosition(t.x, base, t.z);
  g.translate(lx, ly, lz);
  g.applyMatrix4(m);
  return g;
}

/** All city blocks merged into three draw calls: apartments, glass towers, roofs & details. */
function CityBlocks() {
  const { walls, glass, details } = useMemo(() => {
    const w = getWorld();
    const { towers } = getLayout();
    const walls: THREE.BufferGeometry[] = [];
    const glass: THREE.BufferGeometry[] = [];
    const details: THREE.BufferGeometry[] = [];
    for (const t of towers) {
      const base = Math.min(w.gridHeight(t.x, t.z), w.gridHeight(t.x + t.w / 2, t.z + t.d / 2), w.gridHeight(t.x - t.w / 2, t.z - t.d / 2)) - 0.4;
      const pal = CITY_PALETTES[t.palette];
      const H = t.h + 0.4;
      if (t.kind === 1) {
        glass.push(paint(place(facadeBox(t.w, H, t.d), t, 0, H / 2, 0, base), pal.glass));
        details.push(paint(place(new THREE.BoxGeometry(t.w + 0.3, 0.5, t.d + 0.3), t, 0, H + 0.25, 0, base), "#e9eef2"));
        details.push(paint(place(new THREE.BoxGeometry(t.w * 0.5, 1.6, t.d * 0.5), t, 0, H + 1.3, 0, base), "#cfd8de"));
        details.push(paint(place(new THREE.CylinderGeometry(0.08, 0.1, 3, 5), t, 0, H + 3.4, 0, base), "#dfe5ea"));
        details.push(paint(place(new THREE.BoxGeometry(0.2, 3, 2.4), t, (t.w / 2 + 0.08) * t.side, 0.4 + 1.5, 0, base), "#cfd8de"));
        details.push(paint(place(new THREE.BoxGeometry(0.22, 2.7, 2.0), t, (t.w / 2 + 0.12) * t.side, 0.4 + 1.35, 0, base), "#22303c"));
      } else {
        walls.push(paint(place(facadeBox(t.w, H, t.d), t, 0, H / 2, 0, base), pal.wall));
        // cornice + rooftop
        details.push(paint(place(new THREE.BoxGeometry(t.w + 0.5, 0.45, t.d + 0.5), t, 0, H + 0.2, 0, base), pal.trim));
        if (t.kind === 0) {
          // (the roof is a terrace — see RoofTerraces) balconies on the street face
          for (let fy = 4.6; fy < H - 1.5; fy += 3) {
            details.push(paint(place(new THREE.BoxGeometry(0.9, 0.18, t.d * 0.7), t, (t.w / 2 + 0.42) * t.side, fy, 0, base), pal.trim));
          }
        }
        // entrance door (you can walk in)
        details.push(paint(place(new THREE.BoxGeometry(0.14, 2.6, 1.9), t, (t.w / 2 + 0.06) * t.side, 0.4 + 1.3, 0, base), "#d9d2c4"));
        details.push(paint(place(new THREE.BoxGeometry(0.16, 2.3, 1.5), t, (t.w / 2 + 0.1) * t.side, 0.4 + 1.15, 0, base), "#2c3a48"));
        // ground floor: shop band + awning facing the street
        details.push(paint(place(new THREE.BoxGeometry(0.12, 2.6, t.d * 0.86), t, (t.w / 2 + 0.05) * t.side, 1.6 + 0.4, 0, base), pal.shop));
        const aw = new THREE.BoxGeometry(1.5, 0.16, t.d * 0.8);
        aw.rotateZ(-0.32 * t.side);
        details.push(paint(place(aw, t, (t.w / 2 + 0.7) * t.side, 3.6, 0, base), pal.awning));
      }
    }
    const merge = (list: THREE.BufferGeometry[]) => (list.length ? mergeGeometries(list, false) : null);
    return { walls: merge(walls), glass: merge(glass), details: merge(details) };
  }, []);

  const mats = useMemo(() => {
    const a = makeFacadeTexture("apartment");
    const g = makeFacadeTexture("glass");
    return {
      walls: new THREE.MeshStandardMaterial({ map: a.map, emissiveMap: a.lit, emissive: "#ffd28a", emissiveIntensity: 0, vertexColors: true, roughness: 0.85 }),
      glass: new THREE.MeshStandardMaterial({ map: g.map, emissiveMap: g.lit, emissive: "#ffe1a8", emissiveIntensity: 0, vertexColors: true, roughness: 0.3, metalness: 0.2 }),
      details: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    };
  }, []);
  useFrame(() => {
    const n = daylight.night;
    mats.walls.emissiveIntensity = 0.15 + n * 1.3;
    mats.glass.emissiveIntensity = 0.1 + n * 1.1;
  });

  return (
    <group>
      {walls && <mesh geometry={walls} material={mats.walls} castShadow receiveShadow />}
      {glass && <mesh geometry={glass} material={mats.glass} castShadow receiveShadow />}
      {details && <mesh geometry={details} material={mats.details} castShadow receiveShadow />}
    </group>
  );
}

/** Rooftop terraces: timber deck, railing, hatch kiosk, loungers, parasol, planters and string lights. */
function RoofTerraces() {
  const { solid, bulbs } = useMemo(() => {
    const { towers } = getLayout();
    const parts: THREE.BufferGeometry[] = [];
    const lights: THREE.BufferGeometry[] = [];
    for (const r of getRoofs()) {
      const t = towers[r.tower];
      const base = towerBase(t);
      const y = r.y - base;
      const add = (g: THREE.BufferGeometry, lx: number, ly: number, lz: number, c: string) => parts.push(paint(place(g.index ? g.toNonIndexed() : g, t, lx, y + ly, lz, base), c));
      const hw = t.w / 2;
      const hd = t.d / 2;
      // deck with plank seams
      add(new THREE.BoxGeometry(t.w - 0.3, 0.06, t.d - 0.3), 0, 0.03, 0, "#b8875a");
      for (let x = -hw + 0.6; x < hw - 0.3; x += 0.55) add(new THREE.BoxGeometry(0.03, 0.065, t.d - 0.36), x, 0.035, 0, "#8a5f3c");
      // railing: posts + top and mid rails
      const iw = hw - r.inset;
      const id = hd - r.inset;
      const rail = (x0: number, z0: number, x1: number, z1: number) => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.max(1, Math.round(len / 1.1));
        for (let k = 0; k <= n; k++) add(new THREE.BoxGeometry(0.08, RAIL_HEIGHT, 0.08), x0 + ((x1 - x0) * k) / n, RAIL_HEIGHT / 2, z0 + ((z1 - z0) * k) / n, "#5c3a22");
        const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
        for (const ry of [RAIL_HEIGHT, 0.55]) add(new THREE.BoxGeometry(along ? len : 0.07, 0.07, along ? 0.07 : len), (x0 + x1) / 2, ry, (z0 + z1) / 2, "#6b4428");
        // fairy lights along the top rail
        for (let k = 0; k < Math.floor(len / 0.8); k++) {
          const f = (k + 0.5) / Math.floor(len / 0.8);
          lights.push(paint(place(new THREE.IcosahedronGeometry(0.06, 0), t, x0 + (x1 - x0) * f, y + RAIL_HEIGHT + 0.08 + Math.sin(f * Math.PI * 4) * 0.03, z0 + (z1 - z0) * f, base), ["#ffd27e", "#ffb3c6", "#c7f0a0", "#ffe9b0"][k % 4]));
        }
      };
      rail(-iw, -id, iw, -id);
      rail(iw, -id, iw, id);
      rail(iw, id, -iw, id);
      rail(-iw, id, -iw, -id);
      // hatch kiosk
      add(new THREE.BoxGeometry(1.1, 2.2, 1.1), r.hatchL.x, 1.1, r.hatchL.z, "#e6d7bf");
      add(new THREE.BoxGeometry(1.35, 0.14, 1.35), r.hatchL.x, 2.27, r.hatchL.z, "#7b4a2b");
      add(new THREE.BoxGeometry(0.72, 1.8, 0.06), r.hatchL.x, 0.92, r.hatchL.z + 0.56, "#4f7f5a");
      add(new THREE.BoxGeometry(0.06, 0.06, 0.06), r.hatchL.x + 0.25, 0.95, r.hatchL.z + 0.6, "#ffd27e");
      for (const pr of r.props) {
        if (pr.kind === "lounger") {
          // a proper sun lounger: timber frame on four legs, striped seat cushion, raised backrest and a pillow
          const L = LOUNGER;
          const W = L.width;
          const u0 = pr.lx + L.crease;
          const cb = Math.cos(L.back);
          const sb = Math.sin(L.back);
          const frameY = L.seat - 0.16;
          // seat frame + cushion
          add(new THREE.BoxGeometry(L.seatLen + 0.08, 0.07, W + 0.06), u0 + L.seatLen / 2, frameY, pr.lz, "#7b4a2b");
          add(new THREE.BoxGeometry(L.seatLen, 0.12, W), u0 + L.seatLen / 2, L.seat - 0.06, pr.lz, "#f6ecd8");
          for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.1, 0.122, W + 0.004), u0 + 0.12 + k * 0.26, L.seat - 0.06, pr.lz, "#4fa3a5");
          // legs
          for (const su of [u0 + 0.05, u0 + L.seatLen - 0.05])
            for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.06, frameY, 0.06), su, frameY / 2, pr.lz + sz * (W / 2 - 0.02), "#5c3a22");
          // backrest: rises from the crease toward the head end
          const back = (len: number, thick: number, off: number, c: string, extra = 0) => {
            const g = new THREE.BoxGeometry(len, thick, W + extra);
            g.rotateZ(-L.back);
            add(g, u0 - cb * (len / 2) + sb * off, L.seat + sb * (len / 2) + cb * off, pr.lz, c);
          };
          back(L.backLen, 0.12, -0.06, "#f6ecd8");
          back(L.backLen, 0.06, -0.15, "#7b4a2b", 0.06);
          // strut under the backrest down to the frame
          const strut = new THREE.BoxGeometry(0.05, 0.5, W - 0.1);
          strut.rotateZ(0.35);
          add(strut, u0 - cb * L.backLen * 0.75, frameY + 0.2, pr.lz, "#5c3a22");
          for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.06, frameY, 0.06), u0 - cb * L.backLen * 0.85, frameY / 2, pr.lz + sz * (W / 2 - 0.02), "#5c3a22");
          // soft pillow at the head end
          const pil = new THREE.SphereGeometry(1, 12, 8);
          pil.scale(0.16, 0.08, W * 0.42);
          pil.rotateZ(-L.back);
          add(pil, u0 - cb * (L.backLen - 0.16) + sb * 0.07, L.seat + sb * (L.backLen - 0.16) + cb * 0.07, pr.lz, "#ffffff");
          // folded towel at the foot end
          add(new THREE.BoxGeometry(0.28, 0.05, W * 0.8), u0 + L.seatLen - 0.18, L.seat + 0.02, pr.lz, ["#ff8fb4", "#ffd23f", "#8fd8ff"][r.tower % 3]);
        } else if (pr.kind === "umbrella") {
          add(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), pr.lx, 1.15, pr.lz, "#e9e1d3");
          add(new THREE.ConeGeometry(1.35, 0.55, 10), pr.lx, 2.3, pr.lz, ["#e8735a", "#f2c14e", "#5fa8a0", "#e89ab0"][r.tower % 4]);
        } else if (pr.kind === "planter") {
          add(new THREE.BoxGeometry(0.85, 0.5, 0.85), pr.lx, 0.25, pr.lz, "#8a5a33");
          for (let k = 0; k < 4; k++) {
            const a = k * 1.7 + r.tower;
            add(new THREE.IcosahedronGeometry(0.32 + (k % 2) * 0.08, 1), pr.lx + Math.cos(a) * 0.18, 0.72 + (k % 3) * 0.12, pr.lz + Math.sin(a) * 0.18, ["#5f9e3a", "#7cb342", "#4e8a3a", "#93c24a"][k]);
          }
          add(new THREE.IcosahedronGeometry(0.1, 0), pr.lx + 0.2, 1.0, pr.lz - 0.1, ["#ff6f91", "#ffd23f", "#b388ff"][r.tower % 3]);
        } else {
          add(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 14), pr.lx, 0.74, pr.lz, "#f4efe6");
          add(new THREE.CylinderGeometry(0.05, 0.08, 0.72, 6), pr.lx, 0.36, pr.lz, "#33302c");
          for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.2, 0.2, 0.46, 10), pr.lx + sx * 0.75, 0.23, pr.lz, "#5c3a22");
        }
      }
    }
    const merge = (list: THREE.BufferGeometry[]) => (list.length ? mergeGeometries(list, false) : null);
    return { solid: merge(parts), bulbs: merge(lights) };
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }), []);
  const bulbMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), []);
  return (
    <group>
      {solid && <mesh geometry={solid} material={mat} castShadow receiveShadow />}
      {bulbs && <mesh geometry={bulbs} material={bulbMat} />}
    </group>
  );
}

/* ---------------- ring road + traffic ---------------- */

/** Black asphalt ring road with white edge lines, a dashed centre line and pale sidewalks. */
function RingRoad() {
  const { road, lines, walks } = useMemo(() => {
    const w = getWorld();
    const lp = getCityLoop();
    const H = CITY_ROAD_HALF;
    const rv: number[] = [];
    const ruv: number[] = [];
    const ri: number[] = [];
    const wv: number[] = [];
    const wi: number[] = [];
    const lv: number[] = [];
    const li: number[] = [];
    const y = (x: number, z: number) => w.groundAt(x, z) + 0.07;
    for (let k = 0; k <= lp.count; k++) {
      const i = k % lp.count;
      const j = (i + 1) % lp.count;
      const tx = lp.xs[j] - lp.xs[i];
      const tz = lp.zs[j] - lp.zs[i];
      const l = Math.hypot(tx, tz) || 1;
      const nx = -tz / l;
      const nz = tx / l;
      const cx = lp.xs[i];
      const cz = lp.zs[i];
      for (const o of [-H, H]) {
        const x = cx + nx * o;
        const z = cz + nz * o;
        rv.push(x, y(x, z), z);
        ruv.push(o < 0 ? 0 : 1, (k * 0.5) / 4.2);
      }
      for (const o of [-H - 1.6, -H, H, H + 1.6]) {
        const x = cx + nx * o;
        const z = cz + nz * o;
        wv.push(x, y(x, z) + 0.12, z);
      }
      if (k > 0) {
        const a = (k - 1) * 2;
        ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        const b = (k - 1) * 4;
        wi.push(b, b + 4, b + 1, b + 1, b + 4, b + 5, b + 2, b + 6, b + 3, b + 3, b + 6, b + 7);
      }
      // painted lines: both edges solid, centre dashed (3 m on, 3 m off)
      const marks: [number, number, boolean][] = [
        [-H + 0.35, 0.12, true],
        [H - 0.35, 0.12, true],
        [0, 0.14, Math.floor(k / 6) % 2 === 0],
      ];
      if (k < lp.count)
        for (const [o, hw, on] of marks) {
          if (!on) continue;
          const i2 = (i + 1) % lp.count;
          const pts = [
            [cx + nx * (o - hw), cz + nz * (o - hw)],
            [cx + nx * (o + hw), cz + nz * (o + hw)],
            [lp.xs[i2] + nx * (o - hw), lp.zs[i2] + nz * (o - hw)],
            [lp.xs[i2] + nx * (o + hw), lp.zs[i2] + nz * (o + hw)],
          ];
          const base = lv.length / 3;
          for (const [px, pz] of pts) lv.push(px, y(px, pz) + 0.015, pz);
          li.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        }
    }
    const mk = (v: number[], idx: number[], uv?: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      if (uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    return { road: mk(rv, ri, ruv), lines: mk(lv, li), walks: mk(wv, wi) };
  }, []);
  const mats = useMemo(() => {
    return {
      road: new THREE.MeshStandardMaterial({ color: "#2c2e33", roughness: 0.92, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      line: new THREE.MeshBasicMaterial({ color: "#f4f1e8", side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      walk: new THREE.MeshStandardMaterial({ color: "#cfc9bd", roughness: 0.95, side: THREE.DoubleSide }),
    };
  }, []);
  return (
    <group>
      <mesh geometry={road} material={mats.road} receiveShadow />
      <mesh geometry={lines} material={mats.line} />
      <mesh geometry={walks} material={mats.walk} receiveShadow />
    </group>
  );
}

type TrafficCar = { s: number; dir: 1 | -1; speed: number; v: number; len: number };

/** City traffic: Kenney kit cars driving round the ring road, both directions, braking for you and each other. */
function Traffic() {
  const w = getWorld();
  const scenes = useGLTF(TRAFFIC_URLS) as unknown as { scene: THREE.Object3D }[];
  const N_CARS = 12;
  const lenOf = (k: number) => (k === 6 ? 5.4 : k === 3 || k === 4 ? 4.8 : 4.2);
  const models = useMemo(() => Array.from({ length: N_CARS }, (_, i) => buildCar(scenes[i % scenes.length].scene, lenOf(i % scenes.length))), [scenes]);
  const cars = useMemo<TrafficCar[]>(() => {
    const L = getCityLoop().length;
    return Array.from({ length: N_CARS }, (_, i) => {
      const dir = (i % 2 ? 1 : -1) as 1 | -1;
      return { s: (L * i) / N_CARS + (dir > 0 ? 0 : L / (2 * N_CARS)), dir, speed: 9 + (i % 4) * 1.6, v: 0, len: lenOf(i % scenes.length) + 0.2 };
    });
  }, [scenes.length]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  // each car is solid: two circles along its length
  const bodies = useMemo<Collider[]>(() => cars.flatMap(() => [{ x: 0, z: 1e6, r: 1.05 }, { x: 0, z: 1e6, r: 1.05 }]), [cars]);
  useEffect(() => {
    const offs = bodies.map((b) => addDynamicBody(b));
    return () => offs.forEach((o) => o());
  }, [bodies]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const p = player.position;
    const L = getCityLoop().length;
    cars.forEach((c, i) => {
      const g = refs.current[i];
      if (!g) return;
      const pose = loopPose(c.s, c.dir > 0 ? -CITY_LANE : CITY_LANE);
      const hx = Math.sin(pose.yaw) * c.dir;
      const hz = Math.cos(pose.yaw) * c.dir;
      // brake for the explorer (or their vehicle) ahead, and for the car in front
      const ax = p.x - pose.x;
      const az = p.z - pose.z;
      const ahead = ax * hx + az * hz;
      const side = Math.abs(ax * hz - az * hx);
      let blocked = ahead > 0 && ahead < c.len / 2 + 6 && side < 2.6 && Math.abs(p.y - w.groundAt(pose.x, pose.z)) < 3;
      if (!blocked)
        for (const o of cars) {
          if (o === c || o.dir !== c.dir) continue;
          let gap = (o.s - c.s) * c.dir;
          gap = ((gap % L) + L) % L;
          if (gap < (c.len + o.len) / 2 + 3.5) {
            blocked = true;
            break;
          }
        }
      const want = blocked ? 0 : c.speed;
      c.v += (want - c.v) * (1 - Math.exp(-(blocked ? 5 : 1.1) * dt));
      c.s = (((c.s + c.dir * c.v * dt) % L) + L) % L;
      g.position.set(pose.x, w.groundAt(pose.x, pose.z) + 0.07, pose.z);
      g.rotation.y = pose.yaw + (c.dir > 0 ? 0 : Math.PI);
      const q = c.len * 0.26;
      bodies[i * 2].x = pose.x + hx * q;
      bodies[i * 2].z = pose.z + hz * q;
      bodies[i * 2 + 1].x = pose.x - hx * q;
      bodies[i * 2 + 1].z = pose.z - hz * q;
      for (const wh of models[i].wheels) wh.node.rotation.x += (c.v * dt) / 0.4;
    });
  });

  return (
    <group>
      {cars.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <primitive object={models[i].model} />
        </group>
      ))}
    </group>
  );
}

const PEOPLE = [
  { url: "/models/people/Suit_Male.glb", seed: 71 },
  { url: "/models/people/Casual_Female.glb", seed: 72 },
  { url: "/models/people/Casual2_Male.glb", seed: 73 },
  { url: "/models/people/Casual3_Male.glb", seed: 74 },
  { url: "/models/people/OldClassy_Female.glb", seed: 75 },
  { url: "/models/people/Casual_Male.glb", seed: 76 },
];

/** City of Giants — apartment blocks, glass towers, shops, traffic and people on the sidewalks. */
export function City() {
  const w = getWorld();
  const areas = useMemo(() => {
    const out: { x: number; z: number; r: number }[] = [];
    for (let i = 0; i < w.road.count && out.length < 6; i += 13) {
      if (w.roadRegion[i] !== 4) continue;
      const j = Math.min(w.road.count - 1, i + 1);
      const tx = w.road.xs[j] - w.road.xs[i];
      const tz = w.road.zs[j] - w.road.zs[i];
      const l = Math.hypot(tx, tz) || 1;
      // a little plaza beside the avenue, clear of both roads and the blocks
      for (const side of [1, -1]) {
        let spot: { x: number; z: number } | null = null;
        for (const off of [3.4, 4.6, 6, 7.5]) {
          const x = w.road.xs[i] + (-tz / l) * (ROAD_HALF + off) * side;
          const z = w.road.zs[i] + (tx / l) * (ROAD_HALF + off) * side;
          if (clearOfRoads(x, z, 2.2) && !inTower(x, z, 2.2)) {
            spot = { x, z };
            break;
          }
        }
        if (spot && !out.some((o) => Math.hypot(o.x - spot.x, o.z - spot.z) < 8)) {
          out.push({ ...spot, r: 1.4 });
          break;
        }
      }
    }
    return out;
  }, [w]);
  return (
    <group>
      <CityBlocks />
      <RoofTerraces />
      <RingRoad />
      <Traffic />
      {PEOPLE.map((p, i) =>
        areas[i] ? (
          <AnimatedAgent
            key={p.seed}
            url={p.url}
            idle="CharacterArmature|Idle"
            walk="CharacterArmature|Walk"
            greet="CharacterArmature|Victory"
            height={1.75}
            area={areas[i]}
            speed={1.1}
            seed={p.seed}
            stride={0.8}
          />
        ) : null,
      )}
    </group>
  );
}
