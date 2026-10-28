import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A pet's magic: sparkles spiralling up around it in its two colours.
 * `boost` (0..1 ref) makes it flare, e.g. while pampered or showing off.
 */
export function MagicAura({ colors, radius = 0.45, height = 0.9, count = 26, size = 0.07, boost }: { colors: [string, string]; radius?: number; height?: number; count?: number; size?: number; boost?: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null);
  const { geo, seeds } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = [new THREE.Color(colors[0]), new THREE.Color(colors[1])];
    const sd: number[] = [];
    for (let i = 0; i < count; i++) {
      sd.push(i / count);
      c[i % 2].toArray(col, i * 3);
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return { geo: g, seeds: sd };
  }, [colors, count]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const b = boost?.current ?? 0;
    const arr = geo.attributes.position.array as Float32Array;
    seeds.forEach((s, i) => {
      const life = (t * (0.35 + b * 0.5) + s * 3.7) % 1;
      const a = s * Math.PI * 2 * 3 + t * (1.2 + b * 2);
      const r = radius * (0.75 + 0.35 * Math.sin(s * 17 + t)) * (1 + b * 0.4);
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = life * height * (1 + b * 0.5);
      arr[i * 3 + 2] = Math.sin(a) * r;
    });
    geo.attributes.position.needsUpdate = true;
    const m = ref.current?.material as THREE.PointsMaterial | undefined;
    if (m) {
      m.size = size * (1 + b * 0.8) * (0.85 + 0.15 * Math.sin(t * 6));
      m.opacity = 0.75 + b * 0.25;
    }
  });
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial size={size} vertexColors transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}
