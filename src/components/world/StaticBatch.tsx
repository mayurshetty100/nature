import { useEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { bakeStatic } from "./bakeStatic";

const SNAP_AT = 3;
const BAKE_AT = 24;

/**
 * Wraps still scenery and, a moment after it appears, merges its meshes into a
 * few draw calls. Anything that moved during that moment, or sits under a
 * `userData.keep` node, is left alone so animations keep running.
 */
export function StaticBatch({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const frame = useRef(0);
  const snap = useRef(new Map<THREE.Object3D, THREE.Matrix4>());
  const undo = useRef<(() => void) | null>(null);

  useFrame(() => {
    const g = ref.current;
    if (!g || undo.current || frame.current > BAKE_AT) return;
    frame.current++;
    if (frame.current === SNAP_AT) {
      g.updateMatrixWorld(true);
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) snap.current.set(o, o.matrixWorld.clone());
      });
    } else if (frame.current === BAKE_AT) {
      g.updateMatrixWorld(true);
      const moved = new Set<THREE.Object3D>();
      g.traverse((o) => {
        if (!(o as THREE.Mesh).isMesh) return;
        const before = snap.current.get(o);
        if (!before || !before.equals(o.matrixWorld)) moved.add(o);
      });
      snap.current.clear();
      undo.current = bakeStatic(g, moved);
    }
  });

  useEffect(
    () => () => {
      undo.current?.();
      undo.current = null;
    },
    [],
  );

  return <group ref={ref}>{children}</group>;
}
