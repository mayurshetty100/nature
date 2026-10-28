import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getWorld, ROAD_HALF } from "@/game/world";
import { makeAsphaltTexture, makeCobbleTexture, makePlankTexture } from "./materials";
import { lanternMaterial } from "./constants";
import { getLamps } from "@/game/layout";

export function Road() {
  const w = getWorld();
  const { geom, rails, lamps, posts } = useMemo(() => {
    const r = w.road;
    const verts: number[] = [];
    const uvs: number[] = [];
    const roadIdx: number[] = [];
    const deckIdx: number[] = [];
    const cityIdx: number[] = [];
    const wood = (i: number) => w.deck[i] > 0.04 || w.pier[i] === 1;
    // the harbor promenade is a boardwalk over the sand
    const boardwalk = (i: number) => wood(i) || w.roadRegion[i] === 6;
    const across = [
      { o: -ROAD_HALF - 0.45, u: 0, drop: 0.25 },
      { o: -ROAD_HALF, u: 0.03, drop: 0 },
      { o: ROAD_HALF, u: 0.97, drop: 0 },
      { o: ROAD_HALF + 0.45, u: 1, drop: 0.25 },
    ];
    const normals: [number, number][] = [];
    for (let i = 0; i < r.count; i++) {
      const j = Math.min(r.count - 1, i + 1);
      const k = Math.max(0, i - 1);
      const tx = r.xs[j] - r.xs[k];
      const tz = r.zs[j] - r.zs[k];
      const len = Math.hypot(tx, tz) || 1;
      const nx = -tz / len;
      const nz = tx / len;
      normals.push([nx, nz]);
      const y = r.ys[i] + w.deck[i] + 0.05;
      const isDeck = wood(i);
      for (const a of across) {
        const drop = isDeck ? (a.drop > 0 ? 0.7 : 0) : a.drop;
        verts.push(r.xs[i] + nx * a.o, y - drop, r.zs[i] + nz * a.o);
        uvs.push(a.u, r.cum[i] / 4.2);
      }
      if (i > 0) {
        const base = (i - 1) * 4;
        const deck = boardwalk(i) || boardwalk(i - 1);
        const target = deck ? deckIdx : w.roadRegion[i] === 4 ? cityIdx : roadIdx;
        for (let q = 0; q < 3; q++) {
          const a = base + q;
          target.push(a, a + 4, a + 1, a + 1, a + 4, a + 5);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex([...roadIdx, ...deckIdx, ...cityIdx]);
    g.addGroup(0, roadIdx.length, 0);
    g.addGroup(roadIdx.length, deckIdx.length, 1);
    g.addGroup(roadIdx.length + deckIdx.length, cityIdx.length, 2);
    g.computeVertexNormals();

    // Bridge railings
    const rails: { x: number; y: number; z: number; ry: number; len: number; post: boolean }[] = [];
    let prev: Record<number, THREE.Vector3> = {};
    for (let i = 0; i < r.count; i += 3) {
      if (w.deck[i] < 0.12 && !w.pier[i]) {
        prev = {};
        continue;
      }
      const [nx, nz] = normals[i];
      const y = r.ys[i] + w.deck[i] + 0.05;
      for (const side of [-1, 1]) {
        const p = new THREE.Vector3(r.xs[i] + nx * (ROAD_HALF + 0.1) * side, y, r.zs[i] + nz * (ROAD_HALF + 0.1) * side);
        rails.push({ x: p.x, y: p.y + 0.5, z: p.z, ry: 0, len: 0, post: true });
        const q = prev[side];
        if (q) {
          const dx = p.x - q.x;
          const dz = p.z - q.z;
          rails.push({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 + 0.95, z: (p.z + q.z) / 2, ry: Math.atan2(-dz, dx), len: Math.hypot(dx, dz) + 0.1, post: false });
        }
        prev[side] = p;
      }
    }

    // Pier stilts
    const posts: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < r.count; i += 6) {
      if (!w.pier[i]) continue;
      const [nx, nz] = normals[i];
      for (const side of [-1, 1]) posts.push({ x: r.xs[i] + nx * (ROAD_HALF - 0.2) * side, y: r.ys[i], z: r.zs[i] + nz * (ROAD_HALF - 0.2) * side });
    }

    const lamps = getLamps();
    return { geom: g, rails, lamps, posts };
  }, [w]);

  const mats = useMemo(() => {
    const cobble = makeCobbleTexture();
    const plank = makePlankTexture();
    const asphalt = makeAsphaltTexture("#2e3035");
    return [
      new THREE.MeshStandardMaterial({ map: cobble, roughness: 0.92 }),
      new THREE.MeshStandardMaterial({ map: plank, roughness: 0.85, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.9 }),
    ];
  }, []);

  return (
    <group>
      <mesh geometry={geom} material={mats} receiveShadow />
      <Rails rails={rails} />
      <Lamps lamps={lamps} />
      <PierPosts posts={posts} />
    </group>
  );
}

function Rails({ rails }: { rails: { x: number; y: number; z: number; ry: number; len: number; post: boolean }[] }) {
  const posts = rails.filter((r) => r.post);
  const bars = rails.filter((r) => !r.post);
  const pRef = useRef<THREE.InstancedMesh>(null);
  const bRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    posts.forEach((p, i) => {
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      pRef.current?.setMatrixAt(i, d.matrix);
    });
    bars.forEach((b, i) => {
      d.position.set(b.x, b.y, b.z);
      d.rotation.set(0, b.ry, 0);
      d.scale.set(b.len, 1, 1);
      d.updateMatrix();
      bRef.current?.setMatrixAt(i, d.matrix);
    });
    if (pRef.current) pRef.current.instanceMatrix.needsUpdate = true;
    if (bRef.current) bRef.current.instanceMatrix.needsUpdate = true;
  }, [posts, bars]);
  if (!posts.length) return null;
  return (
    <group>
      <instancedMesh ref={pRef} args={[undefined, undefined, posts.length]} castShadow frustumCulled={false}>
        <boxGeometry args={[0.24, 1.2, 0.24]} />
        <meshStandardMaterial color="#7a4b2a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={bRef} args={[undefined, undefined, Math.max(1, bars.length)]} castShadow frustumCulled={false}>
        <boxGeometry args={[1, 0.14, 0.16]} />
        <meshStandardMaterial color="#8b5a33" roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

function Lamps({ lamps }: { lamps: { x: number; y: number; z: number }[] }) {
  const poleRef = useRef<THREE.InstancedMesh>(null);
  const lanternRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    lamps.forEach((l, i) => {
      d.position.set(l.x, l.y + 1.3, l.z);
      d.updateMatrix();
      poleRef.current?.setMatrixAt(i, d.matrix);
      d.position.set(l.x, l.y + 2.75, l.z);
      d.updateMatrix();
      lanternRef.current?.setMatrixAt(i, d.matrix);
      d.position.set(l.x, l.y + 3.15, l.z);
      d.updateMatrix();
      capRef.current?.setMatrixAt(i, d.matrix);
    });
    [poleRef, lanternRef, capRef].forEach((r) => r.current && (r.current.instanceMatrix.needsUpdate = true));
  }, [lamps]);
  return (
    <group>
      <instancedMesh ref={poleRef} args={[undefined, undefined, lamps.length]} castShadow frustumCulled={false}>
        <cylinderGeometry args={[0.09, 0.13, 2.6, 6]} />
        <meshStandardMaterial color="#4a3324" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={lanternRef} args={[undefined, lanternMaterial, lamps.length]} frustumCulled={false}>
        <boxGeometry args={[0.42, 0.55, 0.42]} />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[undefined, undefined, lamps.length]} castShadow frustumCulled={false}>
        <coneGeometry args={[0.38, 0.32, 4]} />
        <meshStandardMaterial color="#3b2a1e" roughness={0.8} />
      </instancedMesh>
    </group>
  );
}

function PierPosts({ posts }: { posts: { x: number; y: number; z: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    posts.forEach((p, i) => {
      d.position.set(p.x, (p.y - 3) / 2, p.z);
      d.scale.set(1, p.y + 3, 1);
      d.updateMatrix();
      ref.current?.setMatrixAt(i, d.matrix);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [posts]);
  if (!posts.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, posts.length]} castShadow frustumCulled={false}>
      <cylinderGeometry args={[0.22, 0.26, 1, 7]} />
      <meshStandardMaterial color="#6b4428" roughness={0.9} />
    </instancedMesh>
  );
}
