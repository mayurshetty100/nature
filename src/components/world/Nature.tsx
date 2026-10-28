import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ISLAND_RX, ISLAND_RZ, rng, getWorld } from "@/game/world";
import { timeUniform } from "@/game/store";
import { daylight } from "@/game/dayCycle";

/** Low clouds hugging the cliffs + high clouds drifting across the sky. */
export function Clouds() {
  const lowRef = useRef<THREE.InstancedMesh>(null);
  const highRef = useRef<THREE.InstancedMesh>(null);
  const { low, high } = useMemo(() => {
    const r = rng(42);
    const makeCloud = (cx: number, cy: number, cz: number, size: number, out: THREE.Matrix4[]) => {
      const puffs = 5 + Math.floor(r() * 5);
      for (let i = 0; i < puffs; i++) {
        const t = (i / (puffs - 1)) * 2 - 1;
        const s = size * (0.55 + (1 - Math.abs(t)) * 0.6 + r() * 0.25);
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(cx + t * size * 1.6 + (r() - 0.5) * size * 0.4, cy + (r() - 0.3) * size * 0.35, cz + (r() - 0.5) * size * 0.8),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r())),
          new THREE.Vector3(s, s * 0.72, s),
        );
        out.push(m);
      }
    };
    const low: THREE.Matrix4[] = [];
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2 + r() * 0.1;
      const k = 1.22 + r() * 0.3;
      // keep the sandy harbor coast open
      if (Math.cos(a) > 0.3) continue;
      const x = Math.cos(a) * ISLAND_RX * k;
      const z = Math.sin(a) * ISLAND_RZ * k;
      makeCloud(x, -1.5 + r() * 2.2, z, 3 + r() * 3, low);
    }
    const high: THREE.Matrix4[] = [];
    for (let i = 0; i < 24; i++) {
      const a = r() * Math.PI * 2;
      const d = 120 + r() * 260;
      makeCloud(Math.cos(a) * d, 195 + r() * 40, Math.sin(a) * d, 9 + r() * 10, high);
    }
    return { low, high };
  }, []);

  useLayoutEffect(() => {
    low.forEach((m, i) => lowRef.current?.setMatrixAt(i, m));
    high.forEach((m, i) => highRef.current?.setMatrixAt(i, m));
    if (lowRef.current) lowRef.current.instanceMatrix.needsUpdate = true;
    if (highRef.current) highRef.current.instanceMatrix.needsUpdate = true;
  }, [low, high]);

  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fff6ee", emissive: "#ffd9c0", emissiveIntensity: 0.28, roughness: 1 }),
    [],
  );
  useFrame((_, dt) => {
    if (lowRef.current) lowRef.current.rotation.y += dt * 0.004;
    if (highRef.current) highRef.current.rotation.y -= dt * 0.006;
    mat.color.copy(daylight.cloud);
    mat.emissive.copy(daylight.cloudGlow);
  });
  return (
    <group>
      <instancedMesh ref={lowRef} args={[geo, mat, low.length]} frustumCulled={false} />
      <instancedMesh ref={highRef} args={[geo, mat, high.length]} frustumCulled={false} />
    </group>
  );
}

/** Wing-flapping instanced bird geometry (flap animated in the vertex shader). */
function makeBirdGeometry() {
  const g = new THREE.BufferGeometry();
  // body + two wings (x = span, z = forward)
  const v = [
    // left wing
    0, 0, 0.25, -1.1, 0.05, -0.15, 0, 0, -0.25,
    // right wing
    0, 0, 0.25, 0, 0, -0.25, 1.1, 0.05, -0.15,
    // body
    0, 0.05, 0.45, -0.12, 0, -0.35, 0.12, 0, -0.35,
  ];
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

function flapMaterial(color: string, speed: number, amp: number) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: true });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader =
      "uniform float uTime;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float ph = float(gl_InstanceID) * 1.37;
        float f = sin(uTime * ${speed.toFixed(2)} + ph);
        transformed.y += f * abs(position.x) * ${amp.toFixed(2)};
        transformed.x *= 1.0 - abs(f) * 0.15;`,
      );
  };
  m.customProgramCacheKey = () => `flap-${color}-${speed}`;
  return m;
}

export function Birds() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const flocks = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 7 }, (_, f) => ({
      radius: 40 + r() * 70,
      height: 22 + r() * 18,
      speed: (0.05 + r() * 0.04) * (f % 2 ? 1 : -1),
      phase: r() * Math.PI * 2,
      cx: -150 + (f / 6) * 300 + (r() - 0.5) * 30,
      cz: (r() - 0.5) * 60,
      birds: Array.from({ length: 6 + Math.floor(r() * 4) }, () => ({
        ox: (r() - 0.5) * 9,
        oy: (r() - 0.5) * 3,
        oz: (r() - 0.5) * 9,
        bob: r() * 6,
      })),
    }));
  }, []);
  const count = flocks.reduce((s, f) => s + f.birds.length, 0);
  const geo = useMemo(() => makeBirdGeometry(), []);
  const mat = useMemo(() => flapMaterial("#3f3a4f", 9, 0.55), []);
  const d = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    let i = 0;
    for (const f of flocks) {
      const a = f.phase + t * f.speed;
      const fx = f.cx + Math.cos(a) * f.radius;
      const fz = f.cz + Math.sin(a) * f.radius * 0.8;
      // heading = derivative
      const hx = -Math.sin(a) * f.speed;
      const hz = Math.cos(a) * f.speed * 0.8;
      const yaw = Math.atan2(hx, hz);
      for (const b of f.birds) {
        d.position.set(fx + b.ox, f.height + b.oy + Math.sin(t * 0.8 + b.bob) * 0.8, fz + b.oz);
        d.rotation.set(0, yaw, Math.sin(t * 0.5 + b.bob) * 0.15);
        d.scale.setScalar(0.55);
        d.updateMatrix();
        ref.current?.setMatrixAt(i++, d.matrix);
      }
    }
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  });
  useFrame(() => {
    if (ref.current) ref.current.visible = daylight.night < 0.75;
  });
  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} />;
}

/** Butterflies fluttering around flower meadows near the road. */
export function Butterflies({ anchors }: { anchors: { x: number; z: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const w = getWorld();
  const flies = useMemo(() => {
    const r = rng(9);
    const palette = ["#ffb347", "#ffe066", "#ff8fb1", "#a7d8ff", "#ffffff"];
    const out: { ax: number; az: number; ph: number; rad: number; sp: number; color: THREE.Color }[] = [];
    anchors.forEach((a) => {
      for (let k = 0; k < 4; k++)
        out.push({ ax: a.x + (r() - 0.5) * 6, az: a.z + (r() - 0.5) * 6, ph: r() * 10, rad: 1.2 + r() * 2.2, sp: 0.5 + r() * 0.6, color: new THREE.Color(palette[Math.floor(r() * palette.length)]) });
    });
    return out;
  }, [anchors]);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const v = [0, 0, 0.12, -0.32, 0, 0.2, -0.28, 0, -0.18, 0, 0, 0.12, -0.28, 0, -0.18, 0, 0, -0.1, 0, 0, 0.12, 0, 0, -0.1, 0.28, 0, -0.18, 0, 0, 0.12, 0.28, 0, -0.18, 0.32, 0, 0.2];
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    return g;
  }, []);
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform;
      shader.vertexShader =
        "uniform float uTime;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float a = sin(uTime * 16.0 + float(gl_InstanceID) * 2.1) * 1.1;
          float sx = sign(position.x);
          float ax = abs(position.x);
          transformed.x = sx * ax * cos(a);
          transformed.y = ax * sin(a);`,
        );
    };
    m.customProgramCacheKey = () => "butterfly";
    return m;
  }, []);
  useLayoutEffect(() => {
    flies.forEach((f, i) => ref.current?.setColorAt(i, f.color));
    if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [flies]);
  const d = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    flies.forEach((f, i) => {
      const a = t * f.sp + f.ph;
      const x = f.ax + Math.cos(a) * f.rad + Math.sin(a * 2.3) * 0.5;
      const z = f.az + Math.sin(a * 1.3) * f.rad;
      const y = w.gridHeight(x, z) + 1.1 + Math.sin(a * 3.1) * 0.45;
      d.position.set(x, y, z);
      d.rotation.set(0, Math.atan2(-Math.sin(a) * f.rad, Math.cos(a * 1.3) * f.rad * 1.3), 0);
      d.scale.setScalar(0.9);
      d.updateMatrix();
      ref.current?.setMatrixAt(i, d.matrix);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, flies.length]} frustumCulled={false} />;
}
