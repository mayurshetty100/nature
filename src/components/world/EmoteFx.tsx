import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { player, useGame } from "@/game/store";
import { EMOTES, type EmoteFx as Fx } from "@/game/characters";

const N = 260;

/** Signature emote effects: confetti, power aura, orbiting orbs, sakura petals, lightning. */
export function EmoteFx() {
  const pts = useRef<THREE.Points>(null);
  const ring = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const orbs = useRef<THREE.Group>(null);
  const bolts = useRef<THREE.LineSegments>(null);
  const flash = useRef<THREE.PointLight>(null);
  const state = useMemo(
    () => ({
      pos: new Float32Array(N * 3),
      vel: new Float32Array(N * 3),
      col: new Float32Array(N * 3),
      seed: new Float32Array(N),
      seq: 0,
      t0: -10,
      fx: "confetti" as Fx,
      dur: 2.5,
      origin: new THREE.Vector3(),
      boltAt: 0,
    }),
    [],
  );
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(state.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(state.col, 3));
    return g;
  }, [state]);
  const boltGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6 * 8 * 3 * 2), 3));
    return g;
  }, []);
  const c1 = useMemo(() => new THREE.Color(), []);
  const c2 = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const t = clock.elapsedTime;
    const st = useGame.getState();
    const P = player.position;
    if (st.emoteAt && st.emoteAt !== state.seq) {
      state.seq = st.emoteAt;
      state.t0 = t;
      const e = EMOTES[st.heroId];
      state.fx = e.fx;
      state.dur = e.seconds + 0.8;
      state.origin.copy(P);
      c1.set(e.colors[0]);
      c2.set(e.colors[1]);
      for (let i = 0; i < N; i++) {
        const r = Math.random();
        state.seed[i] = r;
        const a = Math.random() * Math.PI * 2;
        const c = i % 2 ? c1 : c2;
        state.col.set([c.r, c.g, c.b], i * 3);
        if (state.fx === "confetti") {
          state.pos.set([0, 1.8, 0], i * 3);
          const sp = 3 + Math.random() * 5;
          state.vel.set([Math.cos(a) * sp * 0.6, 6 + Math.random() * 6, Math.sin(a) * sp * 0.6], i * 3);
        } else {
          state.pos.set([Math.cos(a) * 0.8, Math.random() * 0.4, Math.sin(a) * 0.8], i * 3);
          state.vel.set([0, 0, 0], i * 3);
        }
      }
    }
    const k = (t - state.t0) / state.dur;
    const on = k >= 0 && k < 1;
    const g = pts.current;
    if (g) {
      g.visible = on;
      g.position.copy(state.fx === "confetti" ? state.origin : P);
    }
    if (ring.current) ring.current.visible = on && state.fx === "aura";
    if (shell.current) shell.current.visible = on && state.fx === "orbs";
    if (orbs.current) orbs.current.visible = on && state.fx === "orbs";
    if (bolts.current) bolts.current.visible = on && state.fx === "storm";
    if (flash.current) flash.current.intensity = 0;
    if (!on) return;
    const age = t - state.t0;
    const pos = state.pos;
    for (let i = 0; i < N; i++) {
      const s = state.seed[i];
      const j = i * 3;
      if (state.fx === "confetti") {
        state.vel[j + 1] -= 9 * dt;
        const drag = Math.exp(-1.8 * dt);
        state.vel[j] *= drag;
        state.vel[j + 2] *= drag;
        state.vel[j + 1] = Math.max(state.vel[j + 1], -2.2);
        pos[j] += (state.vel[j] + Math.sin(t * 6 + s * 20) * 0.6) * dt;
        pos[j + 1] += state.vel[j + 1] * dt;
        pos[j + 2] += (state.vel[j + 2] + Math.cos(t * 5 + s * 17) * 0.6) * dt;
      } else if (state.fx === "aura") {
        const a = s * Math.PI * 2 + age * (2 + s);
        const h = ((age * (1.5 + s * 1.5) + s * 2.5) % 2.6) * 1.0;
        const r = 0.7 + Math.sin(h * 2) * 0.15;
        pos[j] = Math.cos(a) * r;
        pos[j + 1] = h;
        pos[j + 2] = Math.sin(a) * r;
      } else if (state.fx === "orbs") {
        const a = s * Math.PI * 2 + age * 1.5;
        const r = 0.6 + age * 1.6 * (0.6 + s * 0.6);
        pos[j] = Math.cos(a) * r;
        pos[j + 1] = 1 + Math.sin(a * 3 + s) * 0.6;
        pos[j + 2] = Math.sin(a) * r;
      } else if (state.fx === "petals") {
        const a = s * Math.PI * 2 + age * (3 - s);
        const h = (s * 3 + age * 1.1) % 3.2;
        const r = 0.8 + h * 0.5;
        pos[j] = Math.cos(a) * r;
        pos[j + 1] = h + Math.sin(t * 4 + s * 9) * 0.1;
        pos[j + 2] = Math.sin(a) * r;
      } else {
        const a = s * Math.PI * 2 + age * 6;
        pos[j] = Math.cos(a) * (0.5 + s);
        pos[j + 1] = ((s * 5 + age * 6) % 2.6) * 1;
        pos[j + 2] = Math.sin(a) * (0.5 + s);
      }
    }
    geo.attributes.position.needsUpdate = true;
    const fadeOut = 1 - Math.max(0, (k - 0.75) / 0.25);
    const m = g?.material as THREE.PointsMaterial | undefined;
    if (m) {
      m.opacity = fadeOut;
      m.size = state.fx === "confetti" ? 0.22 : state.fx === "petals" ? 0.24 : 0.18;
    }
    if (ring.current && state.fx === "aura") {
      ring.current.position.set(P.x, P.y + 0.08, P.z);
      const s = 0.8 + (age % 0.8) * 3;
      ring.current.scale.set(s, s, s);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - (age % 0.8) / 0.8) * fadeOut;
      (ring.current.material as THREE.MeshBasicMaterial).color.copy(c1);
    }
    if (shell.current && orbs.current && state.fx === "orbs") {
      shell.current.position.set(P.x, P.y + 1, P.z);
      const s = 0.4 + Math.min(1, age / 1.2) * 2.6;
      shell.current.scale.set(s, s, s);
      (shell.current.material as THREE.MeshBasicMaterial).opacity = 0.22 * fadeOut;
      orbs.current.position.set(P.x, P.y + 1.2, P.z);
      orbs.current.rotation.y = age * 3;
      orbs.current.children.forEach((o, i) => {
        const a = (i / 3) * Math.PI * 2;
        o.position.set(Math.cos(a) * 1.3, Math.sin(age * 4 + i) * 0.3, Math.sin(a) * 1.3);
      });
    }
    if (bolts.current && state.fx === "storm") {
      bolts.current.position.copy(P);
      if (t - state.boltAt > 0.11) {
        state.boltAt = t;
        const arr = boltGeo.attributes.position as THREE.BufferAttribute;
        let v = 0;
        for (let b = 0; b < 6; b++) {
          const a = Math.random() * Math.PI * 2;
          const r = 1.2 + Math.random() * 1.6;
          let x = Math.cos(a) * r;
          let y = 4 + Math.random() * 2;
          let z = Math.sin(a) * r;
          for (let sgm = 0; sgm < 8; sgm++) {
            const nx = x * 0.82 + (Math.random() - 0.5) * 0.8;
            const ny = y - (4 + Math.random()) / 8;
            const nz = z * 0.82 + (Math.random() - 0.5) * 0.8;
            arr.setXYZ(v++, x, y, z);
            arr.setXYZ(v++, nx, ny, nz);
            x = nx;
            y = ny;
            z = nz;
          }
        }
        arr.needsUpdate = true;
      }
      (bolts.current.material as THREE.LineBasicMaterial).opacity = (0.6 + Math.random() * 0.4) * fadeOut;
      if (flash.current) {
        flash.current.position.set(P.x, P.y + 2.5, P.z);
        flash.current.intensity = (Math.random() < 0.3 ? 30 : 6) * fadeOut;
      }
    }
  });

  return (
    <group>
      <points ref={pts} geometry={geo} frustumCulled={false} visible={false}>
        <pointsMaterial size={0.2} vertexColors transparent depthWrite={false} toneMapped={false} />
      </points>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.85, 1, 48]} />
        <meshBasicMaterial transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={shell} visible={false}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial color="#9fd8ff" transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <group ref={orbs} visible={false}>
        {[0, 1, 2].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.18, 16, 12]} />
            <meshBasicMaterial color={i === 1 ? "#c9a8ff" : "#bfeaff"} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <lineSegments ref={bolts} geometry={boltGeo} frustumCulled={false} visible={false}>
        <lineBasicMaterial color="#e6f8ff" transparent toneMapped={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <pointLight ref={flash} color="#bfe8ff" intensity={0} distance={14} decay={2} />
    </group>
  );
}
