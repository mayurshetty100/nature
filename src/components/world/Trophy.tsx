import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { player } from "@/game/store";
import { carryWeight, LIFT } from "@/game/trophy";

const v = new THREE.Vector3();
const home = new THREE.Vector3(0, 2.45, 0);

/**
 * The trophy: a curvy hourglass cup on a slim waist with a jewelled knot,
 * swirling S-handles, a laurel wreath, a ring of gems on the lip and a star on
 * top, polished gold. Sits on the pedestal; floats into the explorer's hands
 * when lifted (see game/trophy.ts).
 */
export function Trophy() {
  const g = useRef<THREE.Group>(null);
  const parts = useMemo(() => {
    const profile = [
      [0.0, 0],
      [1.05, 0],
      [1.08, 0.12],
      [0.95, 0.22],
      [0.7, 0.3],
      [0.42, 0.42],
      [0.24, 0.7],
      [0.2, 1.0],
      [0.3, 1.18],
      [0.2, 1.36],
      [0.24, 1.55],
      [0.46, 1.74],
      [0.92, 2.0],
      [1.26, 2.36],
      [1.38, 2.78],
      [1.3, 3.15],
      [1.42, 3.42],
      [1.5, 3.5],
      [1.36, 3.5],
      [1.24, 3.36],
      [0.0, 3.05],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const cup = new THREE.LatheGeometry(profile, 48);
    const handle = (side: number) =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 1.25, 3.2, 0),
          new THREE.Vector3(side * 1.95, 3.35, 0),
          new THREE.Vector3(side * 2.15, 2.8, 0),
          new THREE.Vector3(side * 1.7, 2.35, 0),
          new THREE.Vector3(side * 1.35, 2.25, 0),
          new THREE.Vector3(side * 1.55, 1.95, 0),
          new THREE.Vector3(side * 1.9, 2.05, 0),
        ]),
        40,
        0.09,
        10,
        false,
      );
    const star = new THREE.Shape();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + Math.PI / 2;
      const r = k % 2 ? 0.2 : 0.48;
      if (k === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const starGeo = new THREE.ExtrudeGeometry(star, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
    starGeo.center();
    return { cup, h1: handle(1), h2: handle(-1), starGeo };
  }, []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffc53d", emissive: "#ff9f1a", emissiveIntensity: 0.25, metalness: 0.8, roughness: 0.24, side: THREE.DoubleSide }), []);
  const roseGold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f3b38f", metalness: 0.75, roughness: 0.3 }), []);
  const leaf = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e8b13a", metalness: 0.7, roughness: 0.35 }), []);
  const gems = ["#ff3b6b", "#5fe3ff", "#9a7bff", "#ff3b6b", "#5fe3ff", "#9a7bff", "#ff3b6b", "#5fe3ff"];

  useFrame(({ clock }) => {
    const o = g.current;
    if (!o?.parent) return;
    const w = player.liftAt ? carryWeight(performance.now() - player.liftAt) : 0;
    o.rotation.y = clock.elapsedTime * (0.35 + w * 1.2);
    if (w <= 0) {
      o.position.copy(home);
      o.scale.setScalar(1);
      return;
    }
    // glide from the pedestal into the hands held overhead
    v.copy(player.handsAt);
    o.parent.worldToLocal(v);
    o.position.copy(home).lerp(v, w);
    o.scale.setScalar(1 + (LIFT.handScale - 1) * w);
  });

  return (
    <group ref={g} position={home.toArray()} userData={{ keep: true }}>
      <mesh geometry={parts.cup} material={gold} castShadow />
      <mesh geometry={parts.h1} material={gold} castShadow />
      <mesh geometry={parts.h2} material={gold} castShadow />
      {/* jewelled knot on the waist */}
      <mesh position={[0, 1.18, 0]} material={roseGold}>
        <torusGeometry args={[0.32, 0.07, 10, 28]} />
      </mesh>
      <mesh position={[0, 1.18, 0.33]}>
        <octahedronGeometry args={[0.1, 0]} />
        <meshStandardMaterial color="#ff3b6b" emissive="#ff3b6b" emissiveIntensity={0.6} roughness={0.15} />
      </mesh>
      {/* laurel wreath round the stem */}
      {Array.from({ length: 14 }, (_, k) => {
        const a = (k / 14) * Math.PI * 2;
        return (
          <mesh key={k} material={leaf} position={[Math.cos(a) * 0.5, 1.62 + (k % 2) * 0.06, Math.sin(a) * 0.5]} rotation={[0.4, -a, 0.6]} scale={[0.08, 0.2, 0.04]}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        );
      })}
      {/* gems round the lip */}
      {gems.map((c, k) => {
        const a = (k / gems.length) * Math.PI * 2;
        return (
          <mesh key={k} position={[Math.cos(a) * 1.4, 3.05, Math.sin(a) * 1.4]} rotation-y={-a}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.55} roughness={0.12} metalness={0.2} />
          </mesh>
        );
      })}
      {/* rose-gold belt on the cup */}
      <mesh position={[0, 2.62, 0]} material={roseGold}>
        <torusGeometry args={[1.34, 0.045, 8, 48]} />
      </mesh>
      {/* star on top, on a little spire */}
      <mesh position={[0, 3.35, 0]} material={gold}>
        <cylinderGeometry args={[0.05, 0.09, 0.6, 10]} />
      </mesh>
      <mesh position={[0, 3.95, 0]} geometry={parts.starGeo} material={gold} />
    </group>
  );
}
