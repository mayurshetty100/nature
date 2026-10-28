import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getForest, CAMPSITE, CAMP_SEATS, CAMP_TENT, TRAIL_HALF } from "@/game/trails";
import { getSwing, swingAngle } from "@/game/swing";
import { player } from "@/game/store";
import { getWorld } from "@/game/world";
import { paint } from "./boatGeometry";
import { StaticBatch } from "./StaticBatch";

/** Soft dirt footpaths winding through Whispering Woods. */
function Trails() {
  const geom = useMemo(() => {
    const w = getWorld();
    const parts: THREE.BufferGeometry[] = [];
    for (const t of getForest().trails) {
      const v: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i < t.xs.length; i++) {
        const j = Math.min(t.xs.length - 1, i + 1);
        const k = Math.max(0, i - 1);
        const tx = t.xs[j] - t.xs[k];
        const tz = t.zs[j] - t.zs[k];
        const l = Math.hypot(tx, tz) || 1;
        const nx = -tz / l;
        const nz = tx / l;
        const wob = TRAIL_HALF * (0.85 + Math.sin(i * 0.7) * 0.15);
        for (const o of [-wob - 0.35, -wob, wob, wob + 0.35]) {
          const x = t.xs[i] + nx * o;
          const z = t.zs[i] + nz * o;
          v.push(x, w.gridHeight(x, z) + (Math.abs(o) > wob + 0.1 ? 0.0 : 0.05), z);
        }
        if (i > 0) {
          const a = (i - 1) * 4;
          for (let q = 0; q < 3; q++) idx.push(a + q, a + q + 4, a + q + 1, a + q + 1, a + q + 4, a + q + 5);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      g.setIndex(idx);
      const n = v.length / 3;
      const c = new Float32Array(n * 3);
      const dirt = new THREE.Color("#a7825a");
      const edge = new THREE.Color("#7f9a52");
      for (let i = 0; i < n; i++) {
        const col = i % 4 === 0 || i % 4 === 3 ? edge : dirt;
        c.set([col.r, col.g, col.b], i * 3);
      }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3));
      g.computeVertexNormals();
      parts.push(g);
    }
    return mergeGeometries(parts, false)!;
  }, []);
  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}

/** A big old tree with a raised deck, a cosy hut and a spiral staircase winding up the trunk. */
function Treehouse() {
  const geom = useMemo(() => {
    const w = getWorld();
    const th = getForest().treehouse;
    const P: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, c: string) => {
      g.translate(x, y, z);
      P.push(paint(g, c));
    };
    /** a box from a to b (for beams, braces and posts) */
    const beam = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, t: number, c: string) => {
      const v = new THREE.Vector3(bx - ax, by - ay, bz - az);
      const g = new THREE.CylinderGeometry(t, t, v.length(), 6);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()));
      add(g, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, c);
    };
    const BARK = "#6e4a2c";
    const BARK2 = "#5a3b22";
    const WOOD = "#b07a45";
    const WOOD2 = "#9a6a3b";
    const DARK = "#6b4428";
    // ---- the great tree: furrowed trunk, flaring roots, real branches, layered crown ----
    const T = th.tree;
    add(new THREE.CylinderGeometry(0.95, 1.35, 12, 14), T.x, T.y + 6, T.z, BARK);
    for (let k = 0; k < 10; k++) {
      // bark ridges running up the trunk
      const a = (k / 10) * Math.PI * 2;
      const ridge = new THREE.BoxGeometry(0.16, 11, 0.18);
      ridge.rotateY(-a);
      add(ridge, T.x + Math.cos(a) * 1.12, T.y + 5.6, T.z + Math.sin(a) * 1.12, BARK2);
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.4;
      beam(T.x + Math.cos(a) * 0.9, T.y + 1.4, T.z + Math.sin(a) * 0.9, T.x + Math.cos(a) * 2.3, T.y - 0.1, T.z + Math.sin(a) * 2.3, 0.32, BARK);
    }
    const crown: [number, number, number, number, string][] = [];
    for (let k = 0; k < 7; k++) {
      // branches fan out from the upper trunk, each carrying leafy clusters
      const a = (k / 7) * Math.PI * 2 + 0.2;
      const y0 = T.y + 8.5 + (k % 3) * 0.9;
      const len = 3.6 + (k % 2) * 1.2;
      const ex = T.x + Math.cos(a) * len;
      const ez = T.z + Math.sin(a) * len;
      const ey = y0 + 2.2;
      beam(T.x + Math.cos(a) * 0.6, y0, T.z + Math.sin(a) * 0.6, ex, ey, ez, 0.26, BARK);
      beam(ex, ey, ez, ex + Math.cos(a + 0.7) * 1.4, ey + 1.1, ez + Math.sin(a + 0.7) * 1.4, 0.13, BARK);
      crown.push([ex, ey + 0.8, ez, 2.3, ["#4f8f3e", "#5fa04a", "#468538", "#6aab52"][k % 4]]);
    }
    crown.push([T.x, T.y + 14.2, T.z, 3.8, "#4f8f3e"], [T.x + 0.8, T.y + 16, T.z - 0.6, 2.6, "#6aab52"]);
    for (const [x, y, z, r, c] of crown) {
      add(new THREE.IcosahedronGeometry(r, 1), x, y, z, c);
      // smaller tufts round each cluster break up the outline
      for (let q = 0; q < 4; q++) {
        const qa = q * 1.6 + x;
        add(new THREE.IcosahedronGeometry(r * 0.45, 0), x + Math.cos(qa) * r * 0.85, y + (q % 2 ? 0.5 : -0.4) * r, z + Math.sin(qa) * r * 0.85, q % 2 ? "#3f7a32" : "#78b85c");
      }
    }
    // ---- deck: planked floor on beams, braced into the trunk, stilts only on the open side ----
    const D = th.deck;
    add(new THREE.CylinderGeometry(D.r, D.r, 0.3, 24), D.x, D.top - 0.15, D.z, WOOD);
    for (let k = 0; k < 9; k++) {
      const off = (k / 8 - 0.5) * 2 * (D.r - 0.25);
      const half = Math.sqrt(Math.max(0, D.r * D.r - off * off)) - 0.05;
      add(new THREE.BoxGeometry(half * 2, 0.02, 0.05), D.x, D.top + 0.005, D.z + off, WOOD2);
    }
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.3;
      const gx = D.x + Math.cos(a) * (D.r - 0.3);
      const gz = D.z + Math.sin(a) * (D.r - 0.3);
      if (Math.hypot(gx - T.x, gz - T.z) < th.spiral.outer + 0.4) continue; // the stairs live there
      const gy = w.gridHeight(gx, gz);
      add(new THREE.CylinderGeometry(0.15, 0.18, D.top - gy, 8), gx, (gy + D.top) / 2, gz, DARK);
      beam(gx, gy + 1.6, gz, D.x, D.top - 0.3, D.z, 0.07, DARK);
    }
    // knee braces from the trunk up under the deck
    for (const dz of [-1.2, 0, 1.2]) beam(T.x + 1.1, D.top - 2.4, T.z + dz * 0.6, D.x + 0.6, D.top - 0.25, D.z + dz, 0.12, DARK);
    // deck railing: posts + rounded top rail, open at the stairs
    const gap = th.deckGap;
    const open = (a: number) => Math.abs(Math.atan2(Math.sin(a - gap.a), Math.cos(a - gap.a))) < gap.half;
    const inTree = (a: number) => Math.hypot(D.x + Math.cos(a) * D.r - T.x, D.z + Math.sin(a) * D.r - T.z) < 1.6;
    const N = 40;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      const a2 = ((k + 1) / N) * Math.PI * 2;
      if (open(a) || inTree(a)) continue;
      const x = D.x + Math.cos(a) * (D.r - 0.08);
      const z = D.z + Math.sin(a) * (D.r - 0.08);
      add(new THREE.CylinderGeometry(k % 4 ? 0.035 : 0.07, k % 4 ? 0.035 : 0.07, 1.05, 6), x, D.top + 0.52, z, DARK);
      if (open(a2) || inTree(a2)) continue;
      const x2 = D.x + Math.cos(a2) * (D.r - 0.08);
      const z2 = D.z + Math.sin(a2) * (D.r - 0.08);
      beam(x, D.top + 1.05, z, x2, D.top + 1.05, z2, 0.055, WOOD2);
      beam(x, D.top + 0.5, z, x2, D.top + 0.5, z2, 0.035, WOOD2);
    }
    // ---- hut: plank walls, framed windows, a shingled roof, chimney, flower box, lanterns ----
    const H = th.hut;
    add(new THREE.BoxGeometry(2.6, 2.2, 2.6), H.x, D.top + 1.1, H.z, "#d9a868");
    for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(2.66, 0.04, 2.66), H.x, D.top + 0.2 + k * 0.36, H.z, "#c08f55");
    for (const [cx, cz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) add(new THREE.BoxGeometry(0.16, 2.3, 0.16), H.x + cx, D.top + 1.15, H.z + cz, DARK);
    for (let k = 0; k < 3; k++) {
      const roof = new THREE.ConeGeometry(2.45 - k * 0.55, 0.75, 4, 1, true);
      roof.rotateY(Math.PI / 4);
      add(roof, H.x, D.top + 2.55 + k * 0.5, H.z, ["#b5523b", "#a44a35", "#c25e44"][k]);
    }
    add(new THREE.ConeGeometry(0.9, 0.7, 4).rotateY(Math.PI / 4), H.x, D.top + 3.85, H.z, "#b5523b");
    add(new THREE.BoxGeometry(0.4, 1.1, 0.4), H.x + 0.7, D.top + 3.4, H.z + 0.6, "#8a7a6a");
    // door with frame + step
    add(new THREE.BoxGeometry(1.15, 1.9, 0.06), H.x, D.top + 0.95, H.z - 1.33, DARK);
    add(new THREE.BoxGeometry(0.95, 1.75, 0.08), H.x, D.top + 0.88, H.z - 1.34, "#8a5432");
    add(new THREE.SphereGeometry(0.05, 6, 6), H.x + 0.33, D.top + 0.9, H.z - 1.4, "#e8c46a");
    // windows (framed, warm glass) on the side walls + a flower box
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.08, 0.8, 0.9), H.x + s * 1.31, D.top + 1.3, H.z, DARK);
      add(new THREE.BoxGeometry(0.09, 0.62, 0.72), H.x + s * 1.32, D.top + 1.3, H.z, "#ffd98a");
      add(new THREE.BoxGeometry(0.1, 0.06, 0.72), H.x + s * 1.33, D.top + 1.3, H.z, DARK);
      add(new THREE.BoxGeometry(0.22, 0.2, 1.0), H.x + s * 1.42, D.top + 0.82, H.z, WOOD2);
      for (let f = 0; f < 4; f++) add(new THREE.SphereGeometry(0.09, 6, 5), H.x + s * 1.44, D.top + 0.98, H.z - 0.36 + f * 0.24, ["#ff7aa2", "#ffd23f", "#ff9a5a", "#ffffff"][f]);
    }
    // hanging lanterns by the door
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.04, 0.4, 0.04), H.x + s * 0.8, D.top + 2.0, H.z - 1.42, DARK);
      add(new THREE.BoxGeometry(0.2, 0.26, 0.2), H.x + s * 0.8, D.top + 1.7, H.z - 1.42, "#ffe2a0");
    }
    // ---- spiral stairs: treads on posts, stringers, balusters and two helical handrails ----
    const SP = th.spiral;
    const at = (a: number, r: number, y: number) => new THREE.Vector3(T.x + Math.cos(a) * r, y, T.z + Math.sin(a) * r);
    const treads = [{ a: SP.landing.a, top: D.top, base: w.gridHeight(SP.landing.x, SP.landing.z) }, ...th.steps];
    treads.forEach((s, i) => {
      const len = SP.outer - SP.inner;
      const g = new THREE.BoxGeometry(len, 0.12, SP.mid * SP.dA * (i === 0 ? 1.7 : 1.08));
      g.rotateY(-s.a);
      const c = at(s.a, SP.mid, s.top - 0.06);
      add(g, c.x, c.y, c.z, i % 2 ? WOOD : WOOD2);
      // nosing strip
      // posts under the outer end down to the ground
      const o = at(s.a, SP.outer - 0.12, 0);
      const gy = w.gridHeight(o.x, o.z);
      add(new THREE.CylinderGeometry(0.07, 0.08, s.top - gy, 6), o.x, (s.top + gy) / 2, o.z, DARK);
      // balusters on both sides
      for (const r of [SP.inner - 0.05, SP.outer + 0.05]) {
        if (r > SP.mid && i >= treads.length - 2) continue;
        const b = at(s.a, r, s.top + 0.52);
        add(new THREE.CylinderGeometry(0.035, 0.035, 1.05, 5), b.x, b.y, b.z, DARK);
      }
    });
    // helical handrails + stringers (smooth tubes through every tread)
    for (const [r, dy, t, skip] of [
      [SP.inner - 0.05, 1.05, 0.06, 0],
      [SP.outer + 0.05, 1.05, 0.06, 2],
      [SP.inner - 0.05, 0.5, 0.035, 0],
      [SP.outer + 0.05, 0.5, 0.035, 2],
      [SP.inner + 0.05, -0.12, 0.09, 0],
      [SP.outer - 0.05, -0.12, 0.09, 0],
    ] as const) {
      const pts = treads.slice(0, treads.length - skip).map((s) => at(s.a, r, s.top + dy));
      if (pts.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(pts);
      add(new THREE.TubeGeometry(curve, pts.length * 6, t, 6, false), 0, 0, 0, dy < 0 ? DARK : WOOD2);
    }
    // the long low branch the rope swing hangs from (the swing itself moves, see <RopeSwing>)
    beam(T.x - 0.8, T.y + 7.5, T.z + 0.4, T.x - 6.2, T.y + 7.95, T.z + 0.4, 0.22, BARK);
    beam(T.x - 6.2, T.y + 7.95, T.z + 0.4, T.x - 7.4, T.y + 8.9, T.z + 1.0, 0.11, BARK);
    add(new THREE.IcosahedronGeometry(1.6, 1), T.x - 7.2, T.y + 9.4, T.z + 1, "#5fa04a");
    return mergeGeometries(P, false)!;
  }, []);
  return (
    <mesh geometry={geom} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} />
    </mesh>
  );
}

/** The rope swing: vine-wrapped ropes, hanging blossoms, a plank seat; swings when you ride it. */
function RopeSwing() {
  const sw = getSwing();
  const pivot = useRef<THREE.Group>(null);
  const geom = useMemo(() => {
    const P: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, c: string) => {
      g.translate(x, y, z);
      P.push(paint(g, c));
    };
    const L = sw.len;
    for (const dz of [-0.32, 0.32]) {
      // rope
      add(new THREE.CylinderGeometry(0.028, 0.028, L, 6), 0, -L / 2, dz, "#d8c49a");
      // a creeper spiralling down the rope
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const a = t * Math.PI * 2 * 7 + dz * 5;
        pts.push(new THREE.Vector3(Math.cos(a) * 0.05, -t * (L - 0.15), dz + Math.sin(a) * 0.05));
      }
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.014, 4, false), 0, 0, 0, "#3f7a32");
      // leaves along the vine + little blossoms hanging off it
      for (let i = 2; i < 30; i++) {
        const t = i / 30;
        const a = t * Math.PI * 2 * 7 + dz * 5;
        const leaf = new THREE.SphereGeometry(0.06, 5, 3);
        leaf.scale(1, 0.35, 1.8);
        leaf.rotateY(a);
        add(leaf, Math.cos(a) * 0.08, -t * (L - 0.15), dz + Math.sin(a) * 0.08, i % 3 ? "#4f8f3e" : "#6aab52");
        if (i % 4 === 1) {
          const hang = 0.08 + (i % 3) * 0.05;
          add(new THREE.CylinderGeometry(0.006, 0.006, hang, 3), Math.cos(a) * 0.1, -t * (L - 0.15) - hang / 2, dz + Math.sin(a) * 0.1, "#3f7a32");
          add(new THREE.SphereGeometry(0.045, 6, 4), Math.cos(a) * 0.1, -t * (L - 0.15) - hang, dz + Math.sin(a) * 0.1, ["#ff7aa2", "#ffd23f", "#ffffff", "#ff9a5a"][i % 4]);
        }
      }
      // rope wrapped round the branch
      add(new THREE.TorusGeometry(0.24, 0.03, 5, 12).rotateY(Math.PI / 2), 0, 0.02, dz, "#cbb689");
    }
    // plank seat with flowers tied at the corners
    add(new THREE.BoxGeometry(0.5, 0.07, 0.86), 0, -L - 0.035, 0, "#a5703f");
    add(new THREE.BoxGeometry(0.52, 0.02, 0.88), 0, -L - 0.075, 0, "#7a5030");
    for (const dz of [-0.32, 0.32])
      for (const dx of [-0.12, 0.12]) add(new THREE.SphereGeometry(0.07, 7, 5), dx, -L + 0.06, dz, dx < 0 ? "#ff7aa2" : "#fff1b8");
    return mergeGeometries(P, false)!;
  }, [sw.len]);
  useFrame(() => {
    const g = pivot.current;
    if (!g) return;
    const on = player.pose === "sit" && player.chillKind === "swing" && !!player.chillAt;
    // swings along the rider's facing (yaw): rotate about the seat's width (z) axis
    g.rotation.z = -swingAngle(performance.now(), on ? player.chillAt : 0) * Math.sign(Math.sin(sw.yaw));
  });
  return (
    <group position={[sw.px, sw.py, sw.pz]}>
      <group ref={pivot} userData={{ keep: true }}>
        <mesh geometry={geom} castShadow>
          <meshStandardMaterial vertexColors roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}

/** Tent cloth: panels whose vertices ripple in the breeze (a few hundred verts, moved on the CPU). */
function TentCloth({ geo }: { geo: THREE.BufferGeometry }) {
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo]);
  const uv = useMemo(() => geo.attributes.uv.array as Float32Array, [geo]);
  const norm = useMemo(() => Float32Array.from(geo.attributes.normal.array as Float32Array), [geo]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const gust = 0.6 + 0.4 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1);
    for (let i = 0; i < pos.count; i++) {
      const u = uv[i * 2];
      const v = uv[i * 2 + 1];
      // pinned at the ridge, poles and pegs; the middle of each panel billows
      const free = Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
      const w = free * gust * (Math.sin(t * 2.1 + u * 5 + v * 3) * 0.05 + Math.sin(t * 3.7 + u * 9) * 0.02);
      pos.setXYZ(i, base[i * 3] + norm[i * 3] * w, base[i * 3 + 1] + norm[i * 3 + 1] * w, base[i * 3 + 2] + norm[i * 3 + 2] * w);
    }
    pos.needsUpdate = true;
  });
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial color="#e7894a" roughness={0.92} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** A flame tongue: additive cone that flickers, stretches and sways. */
function Flames() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const F = useMemo(
    () => [
      { x: 0, z: 0, r: 0.34, h: 1.25, c: "#ff6a1a", o: 0.85 },
      { x: 0.14, z: 0.08, r: 0.22, h: 0.95, c: "#ff9a2a", o: 0.85 },
      { x: -0.12, z: -0.1, r: 0.22, h: 0.9, c: "#ff8a1a", o: 0.85 },
      { x: 0.02, z: -0.02, r: 0.16, h: 0.75, c: "#ffd45a", o: 0.95 },
      { x: -0.05, z: 0.1, r: 0.1, h: 0.5, c: "#fff1b0", o: 1 },
    ],
    [],
  );
  const mats = useMemo(() => F.map((f) => new THREE.MeshBasicMaterial({ color: f.c, transparent: true, opacity: f.o, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })), [F]);
  const geo = useMemo(() => {
    const g = new THREE.ConeGeometry(1, 1, 10, 4, true);
    g.translate(0, 0.5, 0);
    // a lick of a flame: bulge low, pinch to a wavy tip
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = 1 + Math.sin(y * Math.PI) * 0.45;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    F.forEach((f, i) => {
      const m = refs.current[i];
      if (!m) return;
      const fl = 0.82 + Math.sin(t * 13 + i * 2.1) * 0.1 + Math.sin(t * 7.3 + i) * 0.08 + Math.sin(t * 23 + i * 4) * 0.05;
      m.scale.set(f.r * (1 + Math.sin(t * 9 + i) * 0.08), f.h * fl, f.r * (1 + Math.cos(t * 8 + i) * 0.08));
      m.rotation.set(Math.sin(t * 2.3 + i) * 0.12, t * (0.6 + i * 0.2), Math.sin(t * 1.7 + i * 1.3) * 0.15 + 0.06);
      mats[i].opacity = f.o * (0.8 + Math.sin(t * 17 + i * 3) * 0.2);
    });
  });
  return (
    <group userData={{ keep: true }}>
      {F.map((f, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={geo} material={mats[i]} position={[f.x, 0.22, f.z]} renderOrder={6} />
      ))}
      <Sparkles position={[0, 1.4, 0]} count={18} scale={[0.8, 1.8, 0.8]} size={3} speed={1.6} color="#ffb347" opacity={0.9} />
    </group>
  );
}

/** Campsite: a roomy A-frame tent with its door tied open, a stone fire ring with a crackling fire and log seats. */
function Campsite() {
  const w = getWorld();
  const C = CAMPSITE;
  const y = w.gridHeight(C.x, C.z);
  const T = CAMP_TENT;
  // cloth: two roof panels (A-frame) + the back wall, as one segmented geometry with uvs for pinning
  const cloth = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const slant = Math.hypot(T.halfW, T.h);
    const ang = Math.atan2(T.h, T.halfW);
    for (const s of [-1, 1]) {
      const g = new THREE.PlaneGeometry(T.len, slant, 14, 8);
      // plane in XY → lay along z (length) and tilt up to the ridge
      g.rotateY(Math.PI / 2);
      g.translate(0, slant / 2, 0);
      g.rotateZ(s * (Math.PI / 2 - ang));
      g.translate(s * T.halfW, 0, 0);
      parts.push(g);
    }
    // back wall triangle (segmented so it can breathe too)
    const back = new THREE.PlaneGeometry(T.halfW * 2, T.h, 8, 6);
    const p = back.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const yy = p.getY(i) + T.h / 2;
      p.setX(i, p.getX(i) * (1 - yy / T.h));
      p.setY(i, yy);
    }
    back.translate(0, 0, -T.len / 2);
    parts.push(back);
    // door flaps tied back either side of the entrance
    for (const s of [-1, 1]) {
      const f = new THREE.BufferGeometry();
      const v = [0, 0, 0, s * 0.9, 0.05, 0.25, 0, T.h * 0.95, 0];
      f.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      f.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
      f.computeVertexNormals();
      f.translate(s * T.halfW * 0.98, 0, T.len / 2);
      // follow the slope of the side: lean the flap's top inward
      const q = f.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < q.count; i++) q.setX(i, q.getX(i) - s * (q.getY(i) / T.h) * T.halfW);
      parts.push(f);
    }
    const g = mergeGeometries(parts.map((x) => (x.index ? x.toNonIndexed() : x)), false)!;
    g.computeVertexNormals();
    return g;
  }, [T]);
  const solid = useMemo(() => {
    const P: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, x: number, yy: number, z: number, c: string) => {
      g.translate(x, yy, z);
      P.push(paint(g, c));
    };
    // tent poles, ridge, groundsheet, pegs + guy ropes, a bedroll and lantern inside
    for (const z of [-T.len / 2, T.len / 2]) add(new THREE.CylinderGeometry(0.04, 0.04, T.h + 0.25, 6), 0, (T.h + 0.25) / 2, z + (z > 0 ? 0.02 : -0.02), "#6b4428");
    add(new THREE.CylinderGeometry(0.035, 0.035, T.len + 0.2, 6).rotateX(Math.PI / 2), 0, T.h + 0.02, 0, "#6b4428");
    add(new THREE.BoxGeometry(T.halfW * 2 - 0.1, 0.03, T.len - 0.05), 0, 0.02, 0, "#4f6b3f");
    for (const s of [-1, 1])
      for (const z of [-T.len / 2, 0, T.len / 2]) {
        const px = s * (T.halfW + 0.9);
        add(new THREE.CylinderGeometry(0.03, 0.02, 0.3, 4), px, 0.1, z, "#8a7a6a");
        const len = Math.hypot(0.9, T.h * 0.55);
        const rope = new THREE.CylinderGeometry(0.008, 0.008, len, 3);
        rope.rotateZ(s * Math.atan2(0.9, T.h * 0.55));
        add(rope, s * (T.halfW + 0.45) - s * 0.0, T.h * 0.28, z, "#e8ddc0");
      }
    add(new THREE.BoxGeometry(0.75, 0.16, 1.9), -0.45, 0.1, -0.4, "#3b6fb5");
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.75, 10).rotateZ(Math.PI / 2), -0.45, 0.2, 0.62, "#e8e2d4");
    add(new THREE.BoxGeometry(0.75, 0.16, 1.9), 0.45, 0.1, -0.4, "#b5523b");
    add(new THREE.CylinderGeometry(0.1, 0.12, 0.26, 8), 0.95, 0.15, 0.9, "#2a2b31");
    add(new THREE.SphereGeometry(0.1, 8, 6), 0.95, 0.32, 0.9, "#ffd98a");
    return mergeGeometries(P, false)!;
  }, [T]);
  const fire = useMemo(() => {
    const P: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, x: number, yy: number, z: number, c: string) => {
      g.translate(x, yy, z);
      P.push(paint(g, c));
    };
    // ring of rounded river stones
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * Math.PI * 2;
      const st = new THREE.SphereGeometry(0.2, 8, 6);
      st.scale(1.2, 0.7, 0.9);
      st.rotateY(-a);
      add(st, Math.cos(a) * 0.72, 0.1, Math.sin(a) * 0.72, k % 2 ? "#8f8a82" : "#a39d93");
    }
    // ash bed + glowing coals
    add(new THREE.CylinderGeometry(0.6, 0.62, 0.05, 16), 0, 0.03, 0, "#3a3430");
    for (let k = 0; k < 7; k++) add(new THREE.SphereGeometry(0.07, 6, 4), Math.cos(k * 2.3) * 0.28, 0.07, Math.sin(k * 2.3) * 0.28, "#ff6a1a");
    // a teepee of split logs leaning into the centre, bark ends and pale cut faces
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      const lg = new THREE.CylinderGeometry(0.06, 0.08, 0.95, 7);
      lg.translate(0, 0.475, 0);
      lg.rotateZ(0.62);
      lg.rotateY(-a + Math.PI);
      add(lg, Math.cos(a) * 0.48, 0.02, Math.sin(a) * 0.48, k % 2 ? "#6e4a2c" : "#5a3b22");
    }
    // two logs laid across the base
    for (const [a, c] of [[0.4, "#6e4a2c"], [2.0, "#5a3b22"]] as const) {
      const lg = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 7).rotateZ(Math.PI / 2);
      lg.rotateY(a);
      add(lg, 0, 0.1, 0, c);
    }
    // log seats round the fire: lying flat, cut ends showing rings
    for (const a of CAMP_SEATS) {
      const lg = new THREE.CylinderGeometry(0.26, 0.28, 1.6, 10).rotateZ(Math.PI / 2);
      lg.rotateY(-a + Math.PI / 2);
      add(lg, Math.cos(a) * 2.4, 0.27, Math.sin(a) * 2.4, "#7a5030");
      for (const e of [-0.81, 0.81]) {
        const end = new THREE.CylinderGeometry(0.23, 0.23, 0.02, 10).rotateZ(Math.PI / 2);
        end.translate(e, 0, 0);
        end.rotateY(-a + Math.PI / 2);
        add(end, Math.cos(a) * 2.4, 0.27, Math.sin(a) * 2.4, "#d9b98a");
      }
    }
    // a little woodpile
    for (let k = 0; k < 5; k++) add(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 6).rotateX(Math.PI / 2), 1.5 + (k % 3) * 0.15, 0.08 + Math.floor(k / 3) * 0.13, -2.4, "#6e4a2c");
    return mergeGeometries(P, false)!;
  }, []);
  return (
    <group position={[C.x, y, C.z]}>
      <mesh geometry={fire} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>
      <Flames />
      <group position={[T.x, 0, T.z]} rotation-y={T.rot}>
        <group userData={{ keep: true }}>
          <TentCloth geo={cloth} />
        </group>
        <mesh geometry={solid} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}

/** Whispering Woods extras: trails, treehouse and campsite. */
export function Forest() {
  return (
    <group>
      <Trails />
      <StaticBatch>
        <Treehouse />
      </StaticBatch>
      <Campsite />
      <RopeSwing />
    </group>
  );
}
