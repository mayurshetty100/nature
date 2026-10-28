import { useMemo } from "react";
import { getFoundations } from "@/game/foundations";
import { plinthGeometry } from "./plinthGeometry";

/** Stone foundations under every village house and the barn, so none float on the slopes. */
export function Foundations() {
  const geo = useMemo(() => plinthGeometry(getFoundations()), []);
  if (!geo) return null;
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
  );
}
