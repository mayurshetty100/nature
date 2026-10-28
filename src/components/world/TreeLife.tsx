import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getScatter } from "@/game/scatter";
import { player, useGame } from "@/game/store";
import { sound } from "@/game/audio";
import { getWorld } from "@/game/world";
import { paint } from "./boatGeometry";
import { crownTopOf, hollowOf } from "./treeModels";
import { gustAt, leafTree, nearTrees, type TreeSpot } from "./treeSpots";

/* ------------------------------------------------------------------ */
/* falling leaves                                                       */
/* ------------------------------------------------------------------ */

const LEAVES = 56;
/** Leaves let go of nearby crowns when the wind gusts, flutter down on the breeze and settle. */
function FallingLeaves({ trees }: { trees: () => TreeSpot[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const L = useMemo(
    () =>
      Array.from({ length: LEAVES }, (_, i) => ({ x: 0, y: -999, z: 0, vy: 0, age: 99 + i, rest: 0, spin: Math.random() * 6, seed: Math.random() * 100 })),
    [],
  );
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.07);
    s.quadraticCurveTo(0.05, 0, 0, 0.07);
    s.quadraticCurveTo(-0.05, 0, 0, -0.07);
    const g = new THREE.ShapeGeometry(s, 4);
    g.scale(1.6, 1.6, 1.6);
    return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8, vertexColors: false }), []);
  const d = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const palette = useMemo(() => ["#7cb342", "#9ccc65", "#c0ca33", "#ffb300", "#f4511e", "#8bc34a", "#e6a23c"].map((c) => new THREE.Color(c)), []);
  useFrame(({ clock }, raw) => {
    const im = ref.current;
    if (!im) return;
    const dt = Math.min(raw, 0.05);
    const t = clock.elapsedTime;
    const gust = gustAt(t);
    const w = getWorld();
    const near = trees();
    L.forEach((l, i) => {
      l.age += dt;
      // let go of a crown: more often in a strong gust
      if (l.y < -900 || l.rest > 3.5) {
        if (near.length && Math.random() < dt * (0.15 + gust * gust * 2.2)) {
          const tr = near[Math.floor(Math.random() * near.length)];
          const top = crownTopOf(tr.key) * tr.s;
          const a = Math.random() * Math.PI * 2;
          const rr = Math.random() * tr.s * 0.35;
          l.x = tr.x + Math.cos(a) * rr;
          l.z = tr.z + Math.sin(a) * rr;
          l.y = tr.y + top * (0.55 + Math.random() * 0.35);
          l.vy = -0.4 - Math.random() * 0.3;
          l.age = 0;
          l.rest = 0;
          im.setColorAt(i, col.copy(palette[i % palette.length]));
          if (im.instanceColor) im.instanceColor.needsUpdate = true;
        } else if (l.y < -900) {
          d.position.set(0, -999, 0);
          d.updateMatrix();
          im.setMatrixAt(i, d.matrix);
          return;
        }
      }
      const g = w.groundAt(l.x, l.z) + 0.03;
      if (l.y > g) {
        // flutter: drift with the wind, swing side to side, tumble
        const sw = Math.sin(t * 2.6 + l.seed) * 0.7;
        l.x += (0.9 + gust * 2.2) * dt + sw * dt * 0.6;
        l.z += (0.4 + gust * 1.1) * dt + Math.cos(t * 2.1 + l.seed) * dt * 0.5;
        l.y = Math.max(g, l.y + l.vy * dt * (0.8 + Math.sin(t * 3 + l.seed) * 0.35));
        l.spin += dt * (2 + gust * 3);
        d.rotation.set(l.spin, l.spin * 0.7 + l.seed, Math.sin(t * 2.6 + l.seed) * 0.8);
      } else {
        l.rest += dt;
        d.rotation.set(-Math.PI / 2, l.seed, 0);
      }
      const fade = l.rest > 2.5 ? Math.max(0, 1 - (l.rest - 2.5)) : 1;
      d.position.set(l.x, l.y, l.z);
      d.scale.setScalar(fade);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, LEAVES]} frustumCulled={false} castShadow={false} />;
}

/* ------------------------------------------------------------------ */
/* perching songbirds                                                   */
/* ------------------------------------------------------------------ */

const BIRD_LOOKS = [
  { body: "#3f7fd6", belly: "#e8f1ff", head: "#2b5fae" }, // blue jay-ish
  { body: "#7a5a3a", belly: "#e2552c", head: "#4a3626" }, // robin
  { body: "#f2c230", belly: "#fff2a8", head: "#1d1d1d" }, // finch
  { body: "#d23b3b", belly: "#f07a6a", head: "#b02a2a" }, // cardinal
  { body: "#5b8f4a", belly: "#d9e8b0", head: "#3e6b33" }, // warbler
];

function birdParts(look: (typeof BIRD_LOOKS)[number]) {
  const P: THREE.BufferGeometry[] = [];
  const put = (g: THREE.BufferGeometry, x: number, y: number, z: number, c: string) => {
    g.translate(x, y, z);
    P.push(paint(g, c));
  };
  const body = new THREE.SphereGeometry(0.09, 12, 9);
  body.scale(0.8, 0.75, 1.25);
  put(body, 0, 0, 0, look.body);
  const belly = new THREE.SphereGeometry(0.075, 10, 8);
  belly.scale(0.75, 0.7, 1.1);
  put(belly, 0, -0.022, 0.02, look.belly);
  put(new THREE.SphereGeometry(0.06, 12, 9), 0, 0.05, 0.1, look.head);
  const beak = new THREE.ConeGeometry(0.018, 0.05, 6);
  beak.rotateX(Math.PI / 2);
  put(beak, 0, 0.045, 0.17, "#f0a830");
  for (const s of [-1, 1]) {
    put(new THREE.SphereGeometry(0.012, 6, 5), s * 0.035, 0.065, 0.145, "#111111");
    put(new THREE.SphereGeometry(0.004, 4, 3), s * 0.038, 0.07, 0.155, "#ffffff");
  }
  const tail = new THREE.BoxGeometry(0.07, 0.012, 0.12);
  tail.rotateX(-0.35);
  put(tail, 0, 0.01, -0.15, look.head);
  for (const s of [-1, 1]) put(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 4), s * 0.025, -0.08, 0.01, "#c98a3a");
  const wing = new THREE.SphereGeometry(0.07, 8, 6);
  wing.scale(1.1, 0.18, 0.75);
  wing.translate(0.06, 0, 0);
  return { body: mergeGeometries(P)!, wing: paint(wing, look.body) };
}

type Bird = { x: number; y: number; z: number; tx: number; ty: number; tz: number; fx: number; fy: number; fz: number; state: "perch" | "fly" | "away"; leaving?: boolean; t: number; dur: number; until: number; yaw: number; hop: number };

/** Little songbirds that flutter in, perch on top of nearby trees, hop and chirp, and dart off when you come close. */
function PerchBirds({ trees }: { trees: () => TreeSpot[] }) {
  const N = BIRD_LOOKS.length;
  const meshes = useMemo(() => BIRD_LOOKS.map(birdParts), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), []);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const wings = useRef<(THREE.Group | null)[][]>(BIRD_LOOKS.map(() => []));
  const B = useRef<Bird[]>(Array.from({ length: N }, (_, i) => ({ x: 0, y: -999, z: 0, tx: 0, ty: 0, tz: 0, fx: 0, fy: 0, fz: 0, state: "away", t: 0, dur: 1, until: 2 + i * 3, yaw: 0, hop: 0 })));
  const landOn = (b: Bird, list: TreeSpot[], i: number) => {
    const tr = list[(i * 7 + Math.floor(Math.random() * list.length)) % list.length];
    const a = Math.random() * Math.PI * 2;
    b.fx = b.x;
    b.fy = b.y;
    b.fz = b.z;
    b.tx = tr.x + Math.cos(a) * tr.s * 0.12;
    b.tz = tr.z + Math.sin(a) * tr.s * 0.12;
    b.ty = tr.y + crownTopOf(tr.key) * tr.s - 0.05;
    b.state = "fly";
    b.t = 0;
    b.dur = Math.max(1.5, Math.hypot(b.tx - b.x, b.tz - b.z) / 7);
  };
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const now = clock.elapsedTime;
    const list = trees();
    const p = player.position;
    const inside = !!useGame.getState().inside;
    B.current.forEach((b, i) => {
      const g = groups.current[i];
      if (!g) return;
      g.visible = !inside && b.y > -900;
      if (b.state === "away") {
        g.visible = false;
        if (now > b.until && list.length) {
          // swoop in from somewhere off to the side, high up
          const a = Math.random() * Math.PI * 2;
          b.x = p.x + Math.cos(a) * 45;
          b.z = p.z + Math.sin(a) * 45;
          b.y = p.y + 22;
          landOn(b, list, i);
        }
        return;
      }
      if (b.state === "fly") {
        b.t += dt / b.dur;
        const k = Math.min(1, b.t);
        const e = k * k * (3 - 2 * k);
        const nx = b.fx + (b.tx - b.fx) * e;
        const nz = b.fz + (b.tz - b.fz) * e;
        // arc over and glide down onto the branch
        const ny = b.fy + (b.ty - b.fy) * e + Math.sin(k * Math.PI) * 3;
        b.yaw = Math.atan2(nx - b.x, nz - b.z) || b.yaw;
        b.x = nx;
        b.y = ny;
        b.z = nz;
        const flap = Math.sin(now * 40 + i) * (k > 0.85 ? 1.2 : 0.9);
        wings.current[i].forEach((w, s) => w && (w.rotation.z = (s ? -1 : 1) * flap));
        if (k >= 1 && b.leaving) {
          // flew off over the horizon: gone for a while
          b.leaving = false;
          b.state = "away";
          b.y = -999;
          g.visible = false;
          return;
        }
        if (k >= 1) {
          b.state = "perch";
          b.until = now + 8 + Math.random() * 14;
          if (Math.hypot(p.x - b.x, p.z - b.z) < 30) sound.songbird(0.9 + Math.random() * 0.4);
        }
      } else {
        // perched: tuck wings, hop, look about, chirp now and then
        wings.current[i].forEach((w, s) => w && (w.rotation.z = (s ? -1 : 1) * 0.08));
        b.hop = Math.max(0, b.hop - dt * 4);
        if (Math.random() < dt * 0.4) {
          b.hop = 1;
          b.yaw += (Math.random() - 0.5) * 1.6;
        }
        if (Math.random() < dt * 0.12 && Math.hypot(p.x - b.x, p.z - b.z) < 25) sound.songbird(0.9 + Math.random() * 0.5);
        const scared = Math.hypot(p.x - b.x, p.z - b.z) < 7 && Math.abs(p.y - b.y) < 9;
        if (scared || now > b.until) {
          if (scared || Math.random() < 0.35) {
            // dart away into the sky, come back later
            b.fx = b.x;
            b.fy = b.y;
            b.fz = b.z;
            const a = Math.atan2(b.x - p.x, b.z - p.z) + (Math.random() - 0.5);
            b.tx = b.x + Math.sin(a) * 50;
            b.tz = b.z + Math.cos(a) * 50;
            b.ty = b.y + 25;
            b.state = "fly";
            b.t = 0;
            b.dur = 3.2;
            b.until = now + 3.2 + 6 + Math.random() * 10;
            b.leaving = true;
          } else landOn(b, list, i + 1);
        }
      }
      g.position.set(b.x, b.y + Math.sin(b.hop * Math.PI) * 0.06, b.z);
      g.rotation.set(b.state === "fly" ? -0.15 : 0, b.yaw, 0);
    });
  });
  return (
    <group>
      {meshes.map((m, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)} visible={false} scale={1.3}>
          <mesh geometry={m.body} material={mat} castShadow />
          {[0, 1].map((s) => (
            <group key={s} ref={(el) => (wings.current[i][s] = el)} position={[s ? -0.04 : 0.04, 0.02, 0]} scale={[s ? -1 : 1, 1, 1]}>
              <mesh geometry={m.wing} material={mat} />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* squirrels                                                            */
/* ------------------------------------------------------------------ */

function squirrelParts() {
  const P: THREE.BufferGeometry[] = [];
  const put = (g: THREE.BufferGeometry, x: number, y: number, z: number, c: string) => {
    g.translate(x, y, z);
    P.push(paint(g, c));
  };
  const fur = "#b5652a";
  const body = new THREE.SphereGeometry(0.1, 12, 9);
  body.scale(0.8, 0.8, 1.35);
  put(body, 0, 0.1, 0, fur);
  const belly = new THREE.SphereGeometry(0.07, 10, 8);
  belly.scale(0.8, 0.8, 1.2);
  put(belly, 0, 0.075, 0.03, "#efd2a8");
  put(new THREE.SphereGeometry(0.07, 12, 9), 0, 0.17, 0.13, fur);
  put(new THREE.SphereGeometry(0.03, 8, 6), 0, 0.155, 0.19, "#efd2a8");
  put(new THREE.SphereGeometry(0.012, 6, 5), 0, 0.165, 0.215, "#2a1a10");
  for (const s of [-1, 1]) {
    put(new THREE.SphereGeometry(0.014, 6, 5), s * 0.035, 0.19, 0.18, "#111111");
    put(new THREE.SphereGeometry(0.005, 4, 3), s * 0.038, 0.195, 0.192, "#ffffff");
    const ear = new THREE.ConeGeometry(0.022, 0.05, 6);
    put(ear, s * 0.035, 0.245, 0.11, fur);
    for (const z of [0.09, -0.07]) put(new THREE.CapsuleGeometry(0.018, 0.06, 3, 6), s * 0.06, 0.04, z, fur);
  }
  // big bushy tail curling up over the back
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    const r = 0.05 + Math.sin(t * Math.PI) * 0.035;
    put(new THREE.SphereGeometry(r, 9, 7), 0, 0.1 + Math.sin(t * 2.4) * 0.22, -0.12 - Math.sin(t * 1.6) * 0.12 + t * t * 0.1, k % 2 ? fur : "#c47634");
  }
  return mergeGeometries(P)!;
}

type Sq = { tree: TreeSpot | null; phase: "up" | "peek" | "down" | "run"; t: number; dur: number; from: { x: number; z: number }; to: { x: number; z: number } };

/** Squirrels that scamper between trees, spiral up the trunks to their hollows, peek out and come back down. */
function Squirrels({ trees }: { trees: () => TreeSpot[] }) {
  const N = 4;
  const geo = useMemo(() => squirrelParts(), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const S = useRef<Sq[]>(Array.from({ length: N }, () => ({ tree: null, phase: "run", t: 1, dur: 1, from: { x: 0, z: 0 }, to: { x: 0, z: 0 } })));
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const now = clock.elapsedTime;
    const list = trees().filter((tr) => hollowOf(tr.key));
    const w = getWorld();
    const inside = !!useGame.getState().inside;
    S.current.forEach((q, i) => {
      const g = refs.current[i];
      if (!g) return;
      if (!list.length || inside) {
        g.visible = false;
        return;
      }
      g.visible = true;
      q.t += dt / q.dur;
      if (q.t >= 1) {
        q.t = 0;
        if (!q.tree || !list.includes(q.tree)) {
          q.tree = list[i % list.length];
          q.phase = "run";
          q.from = { x: q.tree.x + 3, z: q.tree.z + 2 };
          q.to = { x: q.tree.x, z: q.tree.z };
          q.dur = 2;
        } else if (q.phase === "run") {
          q.phase = "up";
          q.dur = 3.5 + Math.random();
        } else if (q.phase === "up") {
          q.phase = "peek";
          q.dur = 2.5 + Math.random() * 3;
        } else if (q.phase === "peek") {
          q.phase = "down";
          q.dur = 3;
        } else {
          const next = list[(list.indexOf(q.tree) + 1 + Math.floor(Math.random() * 3)) % list.length];
          q.phase = "run";
          q.from = { x: q.tree.x, z: q.tree.z };
          q.to = { x: next.x, z: next.z };
          q.tree = next;
          q.dur = Math.max(1.5, Math.hypot(q.to.x - q.from.x, q.to.z - q.from.z) / 3.5);
        }
      }
      const tr = q.tree!;
      const hollow = hollowOf(tr.key)!;
      const trunkR = 0.06 * tr.s + 0.06;
      const holeY = tr.y + hollow.y * tr.s;
      const holeA = Math.atan2(Math.sin(tr.rot), Math.cos(tr.rot)); // the hollow faces the tree's local +z
      if (q.phase === "run") {
        // bounding gallop across the ground
        const k = q.t;
        const x = q.from.x + (q.to.x - q.from.x) * k;
        const z = q.from.z + (q.to.z - q.from.z) * k;
        // stop at the foot of the trunk, not inside it
        const dx = q.to.x - q.from.x;
        const dz = q.to.z - q.from.z;
        const l = Math.hypot(dx, dz) || 1;
        const stop = Math.min(1, Math.max(0, (Math.hypot(x - q.to.x, z - q.to.z) - trunkR) / l));
        const px = k > 0.5 && stop <= 0 ? q.to.x - (dx / l) * trunkR : x;
        const pz = k > 0.5 && stop <= 0 ? q.to.z - (dz / l) * trunkR : z;
        g.position.set(px, w.groundAt(px, pz) + Math.abs(Math.sin(now * 14 + i)) * 0.08, pz);
        g.rotation.set(0, Math.atan2(dx, dz), 0);
      } else {
        // spiral round the trunk, head up (or head down on the way back)
        const up = q.phase === "up" ? q.t : q.phase === "peek" ? 1 : 1 - q.t;
        const turns = 1.5;
        const a = holeA - (1 - up) * turns * Math.PI * 2;
        const x = tr.x + Math.sin(a) * trunkR;
        const z = tr.z + Math.cos(a) * trunkR;
        const y = tr.y + 0.1 + (holeY - tr.y - 0.25) * up;
        g.position.set(x, y + (q.phase === "peek" ? Math.sin(now * 3) * 0.01 : 0), z);
        // face along the spiral, belly against the bark
        const tangent = q.phase === "down" ? -1 : 1;
        g.rotation.set(tangent * -Math.PI / 2 + (q.phase === "peek" ? 0.3 : 0), a + Math.PI, 0, "YXZ");
      }
    });
  });
  return (
    <group>
      {Array.from({ length: N }, (_, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} scale={1.6}>
          <mesh geometry={geo} material={mat} castShadow />
        </group>
      ))}
    </group>
  );
}

/** Life in the trees around the explorer: falling leaves, songbirds and squirrels. */
export function TreeLife() {
  const all = useMemo(() => leafTree(getScatter().items), []);
  // the few trees nearest the explorer, refreshed a couple of times a second
  const cache = useRef<{ at: number; list: TreeSpot[] }>({ at: -1, list: [] });
  const near = () => {
    const t = performance.now();
    if (t - cache.current.at > 500) cache.current = { at: t, list: nearTrees(all, player.position.x, player.position.z, 38, 14) };
    return cache.current.list;
  };
  return (
    <group>
      <FallingLeaves trees={near} />
      <PerchBirds trees={near} />
      <Squirrels trees={near} />
    </group>
  );
}
