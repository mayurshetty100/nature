import { HEROES, PETS, POWERS, type PowerId } from "./characters";
import { powerTiming } from "./abilities";
import { player, useGame } from "./store";
import { getWorld } from "./world";
import { collidersNear, overlaps } from "./scatter";
import { sound } from "./audio";

/** How far Blink carries the explorer. */
export const BLINK_DIST = 18;

export function heroPower(): PowerId {
  const id = useGame.getState().heroId;
  return (HEROES.find((h) => h.id === id) ?? HEROES[0]).power;
}

/** Is a timed power (flight / invisibility) running right now? */
export function powerActive(kind: PowerId, now = performance.now()) {
  const st = useGame.getState();
  return st.powerKind === kind && now < st.powerUntil;
}

/** Dry ground with nothing solid standing on it. */
export function clearSpot(x: number, z: number) {
  const w = getWorld();
  if (!w.walkable(x, z)) return false;
  for (const c of collidersNear(x, z)) if (overlaps(c, x, z, 0.6)) return false;
  return true;
}

/**
 * Use the chosen explorer's super power (Q / the power button).
 * Pressing again while flying or invisible ends it early.
 */
export function activatePower() {
  const st = useGame.getState();
  if (st.phase !== "playing" || st.riding) return;
  const now = performance.now();
  const kind = heroPower();
  const def = powerTiming(POWERS[kind], PETS.find((p) => p.id === st.petId)?.magic?.perk);
  if (st.powerKind === kind && now < st.powerUntil) {
    st.setPower(kind, now, now + def.cooldown * 1000);
    return;
  }
  if (now < st.powerReadyAt) return;
  if (kind === "teleport") {
    const w = getWorld();
    const p = player.position;
    const fx = Math.sin(player.facing);
    const fz = Math.cos(player.facing);
    for (let d = BLINK_DIST; d > 2; d -= 1) {
      const x = p.x + fx * d;
      const z = p.z + fz * d;
      if (!clearSpot(x, z)) continue;
      const from = { x: p.x, y: p.y, z: p.z };
      p.set(x, w.groundAt(x, z), z);
      player.vy = 0;
      player.grounded = true;
      st.blinked(from, { x, y: p.y, z });
      sound.chime();
      break;
    }
    st.setPower(kind, now, now + def.cooldown * 1000);
    return;
  }
  st.setPower(kind, now + def.seconds * 1000, now + (def.seconds + def.cooldown) * 1000);
  if (kind === "fly") {
    player.flyAlt = 6;
    player.grounded = false;
    player.vy = 6;
    sound.hop();
  } else if (kind === "leap" || kind === "speed") sound.hop();
  else sound.chime();
}
