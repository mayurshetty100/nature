import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { beachRailOpen, getSeawalk, ICEBERGS, icebergPeaks, lookoutDecor, penguinSpot, seawalkDist, spurGap, WALK_HALF, WALK_RAIL } from "@/game/coast";
import { beachWeight, getWorld, rng, ROAD_HALF } from "@/game/world";
import { addCreature, nuzzle, reaction, type Creature } from "@/game/creatures";
import { player } from "@/game/store";
import { measureHeight, stylizeModel } from "@/game/models";
import { StaticBatch } from "./StaticBatch";

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

/** Box placed at (x, y, z) turned to `yaw`. */
function boxAt(w: number, h: number, d: number, x: number, y: number, z: number, yaw: number, color: string) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateY(yaw);
  g.translate(x, y, z);
  return paint(g, color);
}

const PLANK = ["#b98a5b", "#a87a4e", "#c39466", "#b08250"];
const BLOOMS = ["#ff6f91", "#ffd23f", "#b388ff", "#ff8a3d", "#ffffff"];

/** Timber seawalk on stilts along the beach, with rope rails, lanterns, flower boxes, benches and a gazebo lookout. */
function Seawalk() {
  const gazebo = useGLTF("/models/village/Gazebo.glb");
  const { wood, glow } = useMemo(() => {
    const s = getSeawalk();
    const parts: THREE.BufferGeometry[] = [];
    const bulbs: THREE.BufferGeometry[] = [];
    const n = s.points.length;
    const segment = (a: { x: number; z: number; y: number }, b: { x: number; z: number; y: number }, i: number, half: number) => {
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const my = (a.y + b.y) / 2;
      // boards across the walk with tiny gaps
      for (let k = 0; k < 4; k++) {
        const t = (k + 0.5) / 4 - 0.5;
        const ox = Math.sin(yaw) * t * len;
        const oz = Math.cos(yaw) * t * len;
        parts.push(boxAt(half * 2, 0.1, len / 4 - 0.03, mx + ox, my - 0.05, mz + oz, yaw, PLANK[(i * 4 + k) % PLANK.length]));
      }
      // stringers underneath
      for (const sd of [-1, 1]) {
        const ox = Math.cos(yaw) * (half - 0.2) * sd;
        const oz = -Math.sin(yaw) * (half - 0.2) * sd;
        parts.push(boxAt(0.14, 0.18, len + 0.05, mx + ox, my - 0.19, mz + oz, yaw, "#7b5333"));
      }
    };
    for (let i = 0; i < n - 1; i++) segment(s.points[i], s.points[i + 1], i, WALK_HALF);
    for (let i = 0; i < s.lookout.spur.length - 1; i++) segment(s.lookout.spur[i], s.lookout.spur[i + 1], i, 1.15);
    {
      const sp = s.lookout.spur[0];
      const mid = s.points[Math.floor(n * 0.45)];
      segment({ x: mid.x, z: mid.z, y: mid.y }, sp, 1, 1.15);
    }
    // stilts + rails
    s.points.forEach((p, i) => {
      const yaw = Math.atan2(p.nx, p.nz);
      const g = getWorld().gridHeight(p.x, p.z);
      for (const sd of [-1, 1]) {
        const x = p.x + p.nx * (WALK_HALF + 0.05) * sd;
        const z = p.z + p.nz * (WALK_HALF + 0.05) * sd;
        if (i % 3 === 0) {
          const h = p.y - Math.min(g, -0.6) + 0.4;
          const post = new THREE.CylinderGeometry(0.12, 0.14, h, 6);
          post.translate(x, p.y - h / 2 - 0.1, z);
          parts.push(paint(post, "#6b4428"));
        }
        const railHere = sd === 1 ? !spurGap(p) : !beachRailOpen(i, n);
        if (!railHere) continue;
        if (i % 2 === 0) parts.push(boxAt(0.09, WALK_RAIL, 0.09, x, p.y + WALK_RAIL / 2, z, yaw, "#5c3a22"));
        const q = s.points[i + 1];
        const nextRail = q && (sd === 1 ? !spurGap(q) : !beachRailOpen(i + 1, n));
        if (q && nextRail) {
          const qx = q.x + q.nx * (WALK_HALF + 0.05) * sd;
          const qz = q.z + q.nz * (WALK_HALF + 0.05) * sd;
          const ry = Math.atan2(qx - x, qz - z);
          const len = Math.hypot(qx - x, qz - z);
          for (const [ty, th] of [
            [WALK_RAIL, 0.08],
            [WALK_RAIL * 0.5, 0.04],
          ] as const)
            parts.push(boxAt(0.07, th, len + 0.05, (x + qx) / 2, (p.y + q.y) / 2 + ty, (z + qz) / 2, ry, ty === WALK_RAIL ? "#8a5a33" : "#d9c9a3"));
        }
      }
      // lanterns on the sea side
      if (i % 12 === 6 && !spurGap(p)) {
        const x = p.x + p.nx * (WALK_HALF + 0.05);
        const z = p.z + p.nz * (WALK_HALF + 0.05);
        const pole = new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6);
        pole.translate(x, p.y + 1.2, z);
        parts.push(paint(pole, "#3b2a1e"));
        parts.push(boxAt(0.32, 0.08, 0.32, x, p.y + 2.72, z, yaw, "#3b2a1e"));
        const lamp = new THREE.IcosahedronGeometry(0.17, 1);
        lamp.translate(x, p.y + 2.5, z);
        bulbs.push(paint(lamp, "#ffcf7a"));
      }
      // flower boxes on the beach-side rail
      if (i % 9 === 4 && !beachRailOpen(i, n)) {
        const x = p.x - p.nx * (WALK_HALF + 0.12);
        const z = p.z - p.nz * (WALK_HALF + 0.12);
        parts.push(boxAt(0.3, 0.26, 0.9, x, p.y + WALK_RAIL - 0.05, z, yaw, "#7b4a2b"));
        for (let k = 0; k < 5; k++) {
          const f = new THREE.IcosahedronGeometry(0.11, 0);
          f.translate(x + Math.cos(yaw) * (k - 2) * 0.17, p.y + WALK_RAIL + 0.16 + (k % 2) * 0.05, z - Math.sin(yaw) * (k - 2) * 0.17);
          parts.push(paint(f, k % 2 ? "#5f9e3a" : BLOOMS[(i + k) % BLOOMS.length]));
        }
      }
      // benches facing the sea
      if (i % 24 === 12) {
        const bx = p.x - p.nx * 0.55;
        const bz = p.z - p.nz * 0.55;
        parts.push(boxAt(1.7, 0.08, 0.5, bx, p.y + 0.45, bz, yaw + Math.PI / 2, "#a8693d"));
        parts.push(boxAt(1.7, 0.45, 0.08, bx - p.nx * 0.24, p.y + 0.75, bz - p.nz * 0.24, yaw + Math.PI / 2, "#a8693d"));
        for (const sd of [-0.7, 0.7]) parts.push(boxAt(0.08, 0.45, 0.45, bx + Math.cos(yaw) * sd, p.y + 0.22, bz - Math.sin(yaw) * sd, yaw + Math.PI / 2, "#5c3a22"));
      }
    });
    // lookout deck
    const L = s.lookout;
    const deck = new THREE.CylinderGeometry(L.r, L.r, 0.14, 28);
    deck.translate(L.x, L.y - 0.07, L.z);
    parts.push(paint(deck, "#b98a5b"));
    for (let k = 0; k < 14; k++) {
      const ring = new THREE.TorusGeometry(L.r * (k / 14), 0.015, 3, 28);
      ring.rotateX(Math.PI / 2);
      ring.translate(L.x, L.y + 0.005, L.z);
      if (k > 1) parts.push(paint(ring, "#8a5f3c"));
    }
    const end = L.spur[L.spur.length - 1];
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      const x = L.x + Math.cos(a) * (L.r - 0.1);
      const z = L.z + Math.sin(a) * (L.r - 0.1);
      if (Math.hypot(x - end.x, z - end.z) < 2) continue;
      parts.push(boxAt(0.09, WALK_RAIL, 0.09, x, L.y + WALK_RAIL / 2, z, a, "#5c3a22"));
      const a2 = ((k + 1) / 40) * Math.PI * 2;
      const x2 = L.x + Math.cos(a2) * (L.r - 0.1);
      const z2 = L.z + Math.sin(a2) * (L.r - 0.1);
      if (Math.hypot(x2 - end.x, z2 - end.z) < 2) continue;
      parts.push(boxAt(0.07, 0.08, Math.hypot(x2 - x, z2 - z) + 0.04, (x + x2) / 2, L.y + WALK_RAIL, (z + z2) / 2, Math.atan2(x2 - x, z2 - z), "#8a5a33"));
    }
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const h = L.y + 2.5;
      const post = new THREE.CylinderGeometry(0.14, 0.16, h, 6);
      post.translate(L.x + Math.cos(a) * (L.r - 0.3), L.y - 2.5 + h / 2 - 0.1, L.z + Math.sin(a) * (L.r - 0.3));
      parts.push(paint(post, "#6b4428"));
    }
    // chairs round the gazebo, facing the view, with cushions
    const decor = lookoutDecor();
    decor.chairs.forEach((c, i) => {
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      parts.push(boxAt(0.56, 0.07, 0.52, c.x, L.y + 0.44, c.z, c.yaw, "#a8693d"));
      parts.push(boxAt(0.5, 0.06, 0.46, c.x, L.y + 0.5, c.z, c.yaw, ["#f4a7c0", "#8fd8ff", "#ffe08a", "#b6e3a0"][i % 4]));
      parts.push(boxAt(0.56, 0.58, 0.07, c.x - fx * 0.25, L.y + 0.78, c.z - fz * 0.25, c.yaw, "#a8693d"));
      parts.push(boxAt(0.56, 0.06, 0.09, c.x - fx * 0.25, L.y + 1.08, c.z - fz * 0.25, c.yaw, "#7b4a2b"));
      for (const sx of [-0.23, 0.23])
        for (const sz of [-0.21, 0.21]) {
          const lx = c.x + Math.cos(c.yaw) * sx + fx * sz;
          const lz = c.z - Math.sin(c.yaw) * sx + fz * sz;
          parts.push(boxAt(0.06, 0.42, 0.06, lx, L.y + 0.21, lz, c.yaw, "#5c3a22"));
        }
    });
    // flower vases: terracotta pots overflowing with blooms
    for (const v of decor.vases) {
      const s = v.size;
      const pot = new THREE.CylinderGeometry(0.24 * s, 0.17 * s, 0.42 * s, 12);
      pot.translate(v.x, L.y + 0.21 * s, v.z);
      parts.push(paint(pot, "#c0673f"));
      const rim = new THREE.TorusGeometry(0.24 * s, 0.035 * s, 6, 14);
      rim.rotateX(Math.PI / 2);
      rim.translate(v.x, L.y + 0.42 * s, v.z);
      parts.push(paint(rim, "#d98257"));
      const leaves = new THREE.IcosahedronGeometry(0.26 * s, 1);
      leaves.scale(1, 0.75, 1);
      leaves.translate(v.x, L.y + 0.56 * s, v.z);
      parts.push(paint(leaves, "#5f9e3a"));
      for (let k = 0; k < 6; k++) {
        const a = k * 1.05 + v.bloom;
        const f = new THREE.IcosahedronGeometry(0.075 * s, 0);
        f.translate(v.x + Math.cos(a) * 0.17 * s, L.y + (0.62 + (k % 2) * 0.1) * s, v.z + Math.sin(a) * 0.17 * s);
        parts.push(paint(f, BLOOMS[(v.bloom + k) % BLOOMS.length]));
      }
    }
    return { wood: mergeGeometries(parts, false), glow: bulbs.length ? mergeGeometries(bulbs, false) : null };
  }, []);
  const gz = useMemo(() => {
    const o = gazebo.scene.clone(true);
    stylizeModel(o, "/models/village/Gazebo.glb");
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = true;
    });
    // centre the model on its footprint
    const box = new THREE.Box3().setFromObject(o);
    const c = box.getCenter(new THREE.Vector3());
    o.position.set(-c.x, -box.min.y, -c.z);
    const g = new THREE.Group();
    g.add(o);
    return { o: g, s: 3.8 / Math.max(0.01, box.max.y - box.min.y) };
  }, [gazebo]);
  const L = getSeawalk().lookout;
  return (
    <group>
      <mesh geometry={wood} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>
      {glow && (
        <mesh geometry={glow}>
          <meshBasicMaterial vertexColors toneMapped={false} />
        </mesh>
      )}
      <primitive object={gz.o} position={[L.x, L.y, L.z]} scale={gz.s} />
    </group>
  );
}

/** Seashells, starfish, driftwood, dune grass and a sandcastle dotted along the sand. */
function BeachDetails() {
  const geom = useMemo(() => {
    const w = getWorld();
    const r = rng(811);
    const parts: THREE.BufferGeometry[] = [];
    const star = new THREE.Shape();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const rr = k % 2 ? 0.07 : 0.2;
      if (k === 0) star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    let placed = 0;
    let castle = false;
    for (let n = 0; n < 4000 && placed < 140; n++) {
      const a = -0.75 + r() * 1.5;
      const rad = 140 + r() * 50;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (beachWeight(x, z) < 0.75) continue;
      const h = w.gridHeight(x, z);
      if (h < 0.15 || h > 2.4) continue;
      if (w.nearestRoad(x, z, ROAD_HALF + 3).dist < ROAD_HALF + 1.5) continue;
      if (seawalkDist(x, z) < WALK_HALF + 1) continue;
      placed++;
      const k = r();
      const yaw = r() * Math.PI * 2;
      if (!castle && h > 0.6 && h < 1.4 && k < 0.05) {
        castle = true;
        for (const [dx, dz, rr, hh] of [
          [0, 0, 0.7, 0.6],
          [0.75, 0.5, 0.25, 0.75],
          [-0.75, 0.5, 0.25, 0.75],
          [0.75, -0.5, 0.25, 0.75],
          [-0.75, -0.5, 0.25, 0.75],
          [0, 0, 0.32, 1.05],
        ]) {
          const c = new THREE.CylinderGeometry(rr * 0.9, rr, hh, 8);
          c.translate(x + dx, h + hh / 2, z + dz);
          parts.push(paint(c, "#e2c992"));
          const cone = new THREE.ConeGeometry(rr * 1.05, 0.28, 8);
          cone.translate(x + dx, h + hh + 0.14, z + dz);
          parts.push(paint(cone, "#d4b67c"));
        }
        const flag = new THREE.BoxGeometry(0.02, 0.18, 0.28);
        flag.translate(x, h + 1.45, z + 0.14);
        parts.push(paint(flag, "#e8735a"));
        continue;
      }
      if (k < 0.3) {
        const g = new THREE.ExtrudeGeometry(star, { depth: 0.04, bevelEnabled: false });
        g.rotateX(-Math.PI / 2);
        g.rotateY(yaw);
        g.translate(x, h + 0.02, z);
        parts.push(paint(g, ["#ff8a5c", "#f26b6b", "#ffb347", "#c77dff"][Math.floor(r() * 4)]));
      } else if (k < 0.6) {
        const g = new THREE.SphereGeometry(0.12, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
        g.scale(1, 0.55, 1.25);
        g.rotateY(yaw);
        g.translate(x, h, z);
        parts.push(paint(g, ["#fff1e0", "#f7d6c8", "#f2e1b8", "#e9c4d8"][Math.floor(r() * 4)]));
      } else if (k < 0.72) {
        const g = new THREE.CylinderGeometry(0.11, 0.15, 1.6 + r() * 1.4, 6);
        g.rotateZ(Math.PI / 2);
        g.rotateY(yaw);
        g.translate(x, h + 0.1, z);
        parts.push(paint(g, "#b9a48a"));
      } else if (h > 0.9) {
        // dune grass tuft, higher up the beach
        for (let b = 0; b < 7; b++) {
          const blade = new THREE.ConeGeometry(0.035, 0.6 + r() * 0.4, 3);
          blade.translate(0, 0.35, 0);
          blade.rotateZ((r() - 0.5) * 0.7);
          blade.rotateY(r() * Math.PI * 2);
          blade.translate(x + (r() - 0.5) * 0.3, h, z + (r() - 0.5) * 0.3);
          parts.push(paint(blade, r() < 0.5 ? "#b9c36a" : "#d8c77a"));
        }
      }
    }
    return parts.length ? mergeGeometries(parts, false) : null;
  }, []);
  if (!geom) return null;
  return (
    <mesh geometry={geom} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} />
    </mesh>
  );
}

/** Faceted, sun-lit ice with a translucent turquoise skirt below the waterline. */
function Icebergs() {
  const { ice, skirt } = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const under: THREE.BufferGeometry[] = [];
    for (const b of ICEBERGS) {
      const r = rng(b.seed * 97);
      const body = new THREE.DodecahedronGeometry(b.r, 1);
      const pos = body.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const k = 0.85 + ((Math.sin(pos.getX(i) * 1.7 + b.seed) + Math.cos(pos.getZ(i) * 1.3)) * 0.06);
        pos.setXYZ(i, pos.getX(i) * k, y > 0 ? Math.min(y * 0.35, b.top) : y * 0.5, pos.getZ(i) * k);
      }
      body.computeVertexNormals();
      body.translate(b.x, 0, b.z);
      parts.push(paint(body, "#f4fbff"));
      const cap = new THREE.CylinderGeometry(b.r * 0.82, b.r * 0.9, 0.3, 9);
      cap.translate(b.x, b.top - 0.15, b.z);
      parts.push(paint(cap, "#ffffff"));
      // jagged peaks at the back
      void r;
      icebergPeaks(b).forEach((p, k) => {
        const pk = new THREE.ConeGeometry(p.r, p.h, 5);
        pk.translate(p.x, p.y, p.z);
        parts.push(paint(pk, k % 2 ? "#e3f3fb" : "#d2ecf7"));
      });
      const sk = new THREE.CylinderGeometry(b.r * 0.95, b.r * 1.25, 3.5, 9, 1, true);
      sk.translate(b.x, -1.9, b.z);
      under.push(paint(sk, "#7fd3e0"));
    }
    return { ice: mergeGeometries(parts, false), skirt: mergeGeometries(under, false) };
  }, []);
  return (
    <group>
      <mesh geometry={ice} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.35} />
      </mesh>
      <mesh geometry={skirt}>
        <meshStandardMaterial vertexColors transparent opacity={0.45} roughness={0.2} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

const PENGUIN_URL = "/models/pets/animal-penguin.glb";

type PenguinState = { berg: number; ang: number; rad: number; speed: number; dive: number; c: Creature; px: number; pz: number; yaw: number };

const PENGUIN_FAR = 240;

/** Penguins waddling on the icebergs; now and then one belly-slides into the sea and hops back up. Pettable. */
function Penguins() {
  const { scene } = useGLTF(PENGUIN_URL);
  const list = useMemo(() => {
    const r = rng(4242);
    const out: { obj: THREE.Object3D; s: PenguinState }[] = [];
    const h = measureHeight(scene, 1);
    ICEBERGS.forEach((b, bi) => {
      const count = Math.max(2, Math.round(b.r * 0.9));
      for (let k = 0; k < count; k++) {
        const o = SkeletonUtils.clone(scene);
        stylizeModel(o, PENGUIN_URL);
        o.scale.setScalar((0.75 + r() * 0.25) / h);
        o.traverse((m) => {
          if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = true;
        });
        const c: Creature = { name: "penguin", x: b.x, z: b.z, y: b.top, r: 0.35, height: 0.8, voice: "coo", petAt: 0 };
        out.push({ obj: o, s: { berg: bi, ang: r() * Math.PI * 2, rad: 0.8 + r() * b.r * 0.45, speed: (0.15 + r() * 0.2) * (r() < 0.5 ? -1 : 1), dive: 12 + r() * 30, c, px: b.x, pz: b.z, yaw: 0 } });
      }
    });
    return out;
  }, [scene]);
  useEffect(() => {
    const offs = list.map((p) => addCreature(p.s.c));
    return () => offs.forEach((f) => f());
  }, [list]);
  const group = useRef<THREE.Group>(null);
  const centre = useMemo(() => ({ x: ICEBERGS.reduce((a, b) => a + b.x, 0) / ICEBERGS.length, z: ICEBERGS.reduce((a, b) => a + b.z, 0) / ICEBERGS.length }), []);
  useFrame(({ clock, camera }, raw) => {
    // too far to make out: skip drawing and animating the colony
    const away = (camera.position.x - centre.x) ** 2 + (camera.position.z - centre.z) ** 2 > PENGUIN_FAR ** 2;
    if (group.current) group.current.visible = !away;
    if (away) return;
    const dt = Math.min(raw, 0.05);
    const t = clock.elapsedTime;
    const now = performance.now();
    list.forEach(({ obj, s }, i) => {
      const b = ICEBERGS[s.berg];
      const happy = reaction(s.c, now);
      // every so often: waddle to the rim, hop off into the sea, paddle about,
      // then scramble back up the side onto the ice — never through it
      const DIVE = 9;
      const cyc = (t + i * 7.3) % (s.dive + DIVE);
      const diving = cyc > s.dive;
      const ph = diving ? (cyc - s.dive) / DIVE : 0;
      if (happy < 0 && !diving) s.ang += (s.speed / Math.max(0.6, s.rad)) * dt * 1.6;
      const seg = (a0: number, a1: number) => Math.min(1, Math.max(0, (ph - a0) / (a1 - a0)));
      const sm = (k: number) => k * k * (3 - 2 * k);
      const rim = b.r * 0.84;
      const out = b.r * 1.32;
      let rad = s.rad;
      let y = b.top;
      let pitch = 0;
      let inSea = false;
      if (diving) {
        if (ph < 0.14) rad = s.rad + (rim - s.rad) * sm(seg(0, 0.14));
        else if (ph < 0.26) {
          // dive: an arc up and out, then head-first into the water
          const u = seg(0.14, 0.26);
          rad = rim + (out - rim) * u;
          y = b.top + (-0.55 - b.top) * u + Math.sin(u * Math.PI) * 0.7;
          pitch = 0.3 + u * 1.0;
        } else if (ph < 0.72) {
          inSea = true;
          rad = out + Math.sin((ph - 0.26) * 9) * 0.3;
          y = -0.35 + Math.sin(t * 2.2 + i) * 0.06;
          pitch = 1.25;
        } else if (ph < 0.82) {
          inSea = true;
          rad = out + (b.r * 1.08 - out) * sm(seg(0.72, 0.82));
          y = -0.3;
          pitch = 1.25 - seg(0.72, 0.82) * 1.25;
        } else if (ph < 0.9) {
          // scramble up the side: a hop that clears the ice slope, landing on the rim
          const u = seg(0.82, 0.9);
          rad = b.r * 1.08 + (rim - b.r * 1.08) * u;
          y = -0.3 + (b.top + 0.3) * sm(u) + Math.sin(u * Math.PI) * 0.6;
          pitch = -0.35 * Math.sin(u * Math.PI);
        } else rad = rim + (s.rad - rim) * sm(seg(0.9, 1));
      }
      let x = b.x + Math.cos(s.ang) * rad;
      let z = b.z + Math.sin(s.ang) * rad;
      if (!inSea && y >= b.top - 0.01) {
        // walk round the ice peaks, never into them
        const q = penguinSpot(b, x, z);
        x = q.x;
        z = q.z;
      }
      const mx = x - s.px;
      const mz = z - s.pz;
      if (mx * mx + mz * mz > 1e-6) s.yaw = Math.atan2(mx, mz);
      s.px = x;
      s.pz = z;
      const lean = diving ? 0 : nuzzle(happy);
      obj.position.set(x, y + (diving || lean ? 0 : Math.abs(Math.sin(t * 6 + i)) * 0.04), z);
      // face where it's going; patted ones turn and bow into your hand
      const yaw = lean ? Math.atan2(player.position.x - x, player.position.z - z) : s.yaw;
      obj.rotation.set(diving ? pitch : lean * 0.32, yaw, diving ? 0 : lean ? Math.sin(t * 2.4 + i) * 0.1 * lean : Math.sin(t * 6 + i) * 0.12, "YXZ");
      s.c.x = x;
      s.c.z = z;
      s.c.y = y;
    });
  });
  return (
    <group ref={group}>
      {list.map(({ obj }, i) => (
        <primitive key={i} object={obj} />
      ))}
    </group>
  );
}

/** The seaside: seawalk + lookout gazebo, beach details, icebergs and their penguins. */
export function Seaside() {
  return (
    <group>
      <StaticBatch>
        <Seawalk />
        <BeachDetails />
        <Icebergs />
      </StaticBatch>
      <Penguins />
    </group>
  );
}
