import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { player, useGame } from "@/game/store";
import { STOP_BY_ID } from "@/game/stops";
import { getWorld } from "@/game/world";
import { sound } from "@/game/audio";
import { daylight } from "@/game/dayCycle";

/** Magical burst at a landmark whenever its chapter is revealed. */
export function RevealBurst() {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const motes = useRef<THREE.Points>(null);
  const start = useRef(-10);
  const seq = useRef(0);
  const world = getWorld();
  const geo = useMemo(() => {
    const n = 80;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      seed[i] = i / n;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, []);

  useFrame(({ clock }) => {
    const st = useGame.getState();
    const t = clock.elapsedTime;
    if (st.revealSeq && st.revealSeq.seq !== seq.current) {
      seq.current = st.revealSeq.seq;
      start.current = t;
      const s = STOP_BY_ID[st.revealSeq.id];
      const near = Math.hypot(player.position.x - s.x, player.position.z - s.z) < 30;
      const x = near ? player.position.x : s.x;
      const z = near ? player.position.z : s.z;
      group.current?.position.set(x, world.groundAt(x, z), z);
      sound.chime();
    }
    const k = (t - start.current) / 2.6;
    const g = group.current;
    if (!g) return;
    g.visible = k >= 0 && k < 1;
    if (!g.visible) return;
    const e = 1 - Math.pow(1 - k, 3);
    if (ring.current) {
      ring.current.scale.setScalar(0.5 + e * 9);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
    }
    if (beam.current) {
      beam.current.scale.set(1 - k * 0.6, 0.2 + e, 1 - k * 0.6);
      (beam.current.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * 0.45;
    }
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const a = i * 2.39996 + k * 3;
      const r = 1 + e * 4 * ((i % 7) / 7 + 0.3);
      pos.setXYZ(i, Math.cos(a) * r, 0.4 + e * (3 + (i % 11)), Math.sin(a) * r);
    }
    pos.needsUpdate = true;
    if (motes.current) (motes.current.material as THREE.PointsMaterial).opacity = 1 - k;
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.15}>
        <ringGeometry args={[0.85, 1, 64]} />
        <meshBasicMaterial color="#ffe08a" transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={beam} position-y={6}>
        <cylinderGeometry args={[1.4, 2.2, 12, 24, 1, true]} />
        <meshBasicMaterial color="#bff3ff" transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <points ref={motes} geometry={geo}>
        <pointsMaterial color="#fff1b0" size={0.35} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

const MAX = 2400;
const COLORS = ["#ffd166", "#ef476f", "#06d6a0", "#8ecae6", "#ffffff", "#f78c6b", "#c77dff"];

/** Fireworks over Lighthouse Cove for the finale. */
export function Fireworks() {
  const pts = useRef<THREE.Points>(null);
  const state = useMemo(
    () => ({
      pos: new Float32Array(MAX * 3),
      vel: new Float32Array(MAX * 3),
      col: new Float32Array(MAX * 3),
      life: new Float32Array(MAX),
      next: 0,
      rockets: [] as { x: number; y: number; z: number; vy: number; fuse: number; c: THREE.Color }[],
      spawnAt: 0,
      until: 0,
      seq: 0,
    }),
    [],
  );
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(state.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(state.col, 3));
    return g;
  }, [state]);
  const world = getWorld();

  useEffect(() => {
    state.life.fill(0);
  }, [state]);

  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const t = clock.elapsedTime;
    const st = useGame.getState();
    if (st.celebrating !== state.seq) {
      state.seq = st.celebrating;
      state.until = t + 10;
      state.spawnAt = t + 0.4;
      sound.fanfare();
    }
    if (t < state.until && t > state.spawnAt) {
      state.spawnAt = t + 0.45 + Math.random() * 0.5;
      // fireworks burst wherever the celebration is (the finale or the trophy lift)
      const cx = player.position.x;
      const cz = player.position.z;
      const base = world.gridHeight(cx, cz);
      state.rockets.push({
        x: cx + (Math.random() - 0.5) * 30,
        y: base + 2,
        z: cz + (Math.random() - 0.5) * 30,
        vy: 22 + Math.random() * 8,
        fuse: 0.9 + Math.random() * 0.5,
        c: new THREE.Color(COLORS[Math.floor(Math.random() * COLORS.length)]),
      });
    }
    // rockets
    for (let r = state.rockets.length - 1; r >= 0; r--) {
      const k = state.rockets[r];
      k.y += k.vy * dt;
      k.vy -= 9 * dt;
      k.fuse -= dt;
      // trail spark
      emit(k.x, k.y, k.z, 0, -1, 0, 0.4, k.c);
      if (k.fuse <= 0) {
        const n = 140;
        for (let i = 0; i < n; i++) {
          const u = Math.random() * 2 - 1;
          const th = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(1 - u * u);
          const sp = 9 + Math.random() * 4;
          emit(k.x, k.y, k.z, Math.cos(th) * rr * sp, u * sp, Math.sin(th) * rr * sp, 1.6 + Math.random() * 0.8, i % 9 === 0 ? WHITE : k.c);
        }
        state.rockets.splice(r, 1);
      }
    }
    let alive = 0;
    for (let i = 0; i < MAX; i++) {
      if (state.life[i] <= 0) {
        state.pos[i * 3 + 1] = -999;
        continue;
      }
      alive++;
      state.life[i] -= dt;
      state.vel[i * 3 + 1] -= 6 * dt;
      const drag = Math.exp(-1.6 * dt);
      state.vel[i * 3] *= drag;
      state.vel[i * 3 + 1] *= drag;
      state.vel[i * 3 + 2] *= drag;
      state.pos[i * 3] += state.vel[i * 3] * dt;
      state.pos[i * 3 + 1] += state.vel[i * 3 + 1] * dt;
      state.pos[i * 3 + 2] += state.vel[i * 3 + 2] * dt;
      const fade = Math.min(1, state.life[i]);
      state.col[i * 3] *= 0.995 + fade * 0.005;
    }
    if (pts.current) pts.current.visible = alive > 0;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    (pts.current?.material as THREE.PointsMaterial | undefined)?.setValues({ size: 0.9 + daylight.night * 0.3 });
  });

  const WHITE = useMemo(() => new THREE.Color("#ffffff"), []);
  function emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, c: THREE.Color) {
    const i = state.next;
    state.next = (state.next + 1) % MAX;
    state.pos.set([x, y, z], i * 3);
    state.vel.set([vx, vy, vz], i * 3);
    state.col.set([c.r, c.g, c.b], i * 3);
    state.life[i] = life;
  }

  return (
    <points ref={pts} geometry={geo} frustumCulled={false} visible={false}>
      <pointsMaterial size={0.9} vertexColors transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

/** Feeds the sound engine: footsteps, water, night, engine. */
export function AudioDriver() {
  const world = getWorld();
  const acc = useRef(0);
  const dist = useRef(0);
  const last = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    const st = useGame.getState();
    const p = player.position;
    const moved = Math.hypot(p.x - last.current.x, p.z - last.current.z);
    last.current.copy(p);
    if (st.phase === "playing" && !st.riding && player.grounded && moved < 2) {
      dist.current += moved;
      if (dist.current > 1.15) {
        dist.current = 0;
        sound.step(world.nearestRoad(p.x, p.z, 4).dist > 2.5);
      }
    }
    acc.current += dt;
    if (acc.current < 0.12) return;
    acc.current = 0;
    const rv = world.nearestRiver(p.x, p.z, 20).dist;
    const water = Number.isFinite(rv) ? Math.max(0, 1 - rv / 16) : 0;
    sound.update({ water, night: daylight.night, riding: st.riding, speed: st.riding ? Math.abs(player.drive) : player.speed });
  });
  useEffect(() => {
    const unsub = useGame.subscribe((s, prev) => {
      if (s.muted !== prev.muted) sound.setMuted(s.muted);
    });
    sound.setMuted(useGame.getState().muted);
    return unsub;
  }, []);
  return null;
}
