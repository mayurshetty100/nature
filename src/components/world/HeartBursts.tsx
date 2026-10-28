import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { heartQueue } from "@/game/creatures";

const PER = 5;
const MAX = 6;
const LIFE = 1.8;

/** Little pink hearts that float up from an animal you just patted. */
export function HeartBursts() {
  const ref = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.12);
    s.bezierCurveTo(-0.02, -0.06, -0.16, -0.02, -0.16, 0.06);
    s.bezierCurveTo(-0.16, 0.16, -0.04, 0.17, 0, 0.09);
    s.bezierCurveTo(0.04, 0.17, 0.16, 0.16, 0.16, 0.06);
    s.bezierCurveTo(0.16, -0.02, 0.02, -0.06, 0, -0.12);
    return new THREE.ShapeGeometry(s);
  }, []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ff6f91", side: THREE.DoubleSide, toneMapped: false }), []);

  useFrame(({ camera }) => {
    const grp = ref.current;
    if (!grp) return;
    const now = performance.now();
    let any = false;
    for (let b = 0; b < MAX; b++) {
      const h = heartQueue[b];
      for (let i = 0; i < PER; i++) {
        const k = h ? (now - h.at) / 1000 / LIFE - i * 0.08 : 2;
        const m = grp.children[b * PER + i];
        if (!m) continue;
        m.visible = !!h && k >= 0 && k <= 1;
        if (!m.visible || !h) continue;
        any = true;
        const a = (i / PER) * Math.PI * 2 + h.at * 0.001;
        m.position.set(h.x + Math.cos(a) * (0.25 + k * 0.5), h.y + k * 1.6, h.z + Math.sin(a) * (0.25 + k * 0.5));
        m.quaternion.copy(camera.quaternion);
        m.scale.setScalar((0.9 + Math.sin(k * Math.PI) * 0.6) * (1 - k * 0.5));
      }
    }
    grp.visible = any;
    // drop finished bursts
    while (heartQueue.length && now - heartQueue[0].at > (LIFE + PER * 0.08 * LIFE) * 1000) heartQueue.shift();
  });

  return (
    <group ref={ref} visible={false}>
      {Array.from({ length: MAX * PER }, (_, i) => (
        <mesh key={i} geometry={geo} material={mat} visible={false} frustumCulled={false} />
      ))}
    </group>
  );
}
