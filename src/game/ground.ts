import { player, useGame } from "./store";
import { floorAt, getInterior, INTERIOR_ORIGIN } from "./interiors";
import { getWorld } from "./world";

/**
 * Where a companion (pet / Byte) should stand: the interior floor on the
 * explorer's storey when indoors, otherwise the ground — or floating on the
 * water surface when it's deep.
 */
export function companionGround(x: number, z: number) {
  const st = useGame.getState();
  if (st.inside) {
    const I = getInterior(st.inside);
    if (I) return floorAt(I, x - INTERIOR_ORIGIN.x, z - INTERIOR_ORIGIN.z, player.position.y + 0.3);
  }
  const w = getWorld();
  const g = w.groundAt(x, z);
  const s = w.waterSurface(x, z);
  return s !== null && s - g > 0.5 ? s - 0.3 : g;
}
