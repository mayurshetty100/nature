import { player, rides, useGame } from "./store";
import { sound } from "./audio";
import { RIDES } from "./vehicles";
import { getWorld } from "./world";
import { collidersNear, overlaps } from "./scatter";

/** Reach for hopping on your own vehicle (beyond it, F calls the vehicle over). */
export const MOUNT_REACH = 6.5;
/** Reach for boarding the yacht (from the pier or while swimming). */
export const YACHT_REACH = 7;

function clearSpot(x: number, z: number, r: number) {
  for (const c of collidersNear(x, z)) if (overlaps(c, x, z, r)) return false;
  return true;
}

/** Bring the chosen vehicle to the explorer's side (a free spot left or right). */
export function summonVehicle() {
  const st = useGame.getState();
  const def = RIDES[st.vehicleId];
  const p = player.position;
  const f = player.facing;
  const rx = Math.cos(f);
  const rz = -Math.sin(f);
  const w = getWorld();
  const off = def.radius + 1.4;
  let best = { x: p.x + rx * off, z: p.z + rz * off };
  for (const side of [1, -1, 2, -2]) {
    const x = p.x + rx * off * side;
    const z = p.z + rz * off * side;
    if (clearSpot(x, z, def.radius) && w.inBounds(x, z)) {
      best = { x, z };
      break;
    }
  }
  const v = rides.land;
  v.x = best.x;
  v.z = best.z;
  v.y = w.groundAt(best.x, best.z);
  v.yaw = f;
  v.placed = true;
  sound.whoosh();
}

/** One button: get off · board the yacht · hop on your vehicle (calling it over if it's far away). */
export function toggleRide() {
  const st = useGame.getState();
  if (st.phase !== "playing" || st.inside) return;
  if (st.riding) {
    dismount();
    return;
  }
  if (player.flying) return;
  if (st.nearVehicle === "yacht") {
    const y = rides.yacht;
    player.position.set(y.x, y.y, y.z);
    player.facing = y.yaw;
    player.drive = 0;
    st.setRiding("yacht");
    sound.horn(0.6);
    return;
  }
  const v = rides.land;
  const p = player.position;
  if (!v.placed || Math.hypot(v.x - p.x, v.z - p.z) > MOUNT_REACH) summonVehicle();
  player.position.x = v.x;
  player.position.z = v.z;
  player.facing = v.yaw;
  player.drive = 0;
  st.setRiding(st.vehicleId);
  sound.engineStart(st.vehicleId);
}

function dismount() {
  const st = useGame.getState();
  const id = st.riding!;
  const def = RIDES[id];
  const w = getWorld();
  const p = player.position;
  const v = id === "yacht" ? rides.yacht : rides.land;
  v.x = p.x;
  v.z = p.z;
  v.y = p.y;
  v.yaw = player.facing;
  if (id !== "yacht") v.placed = true;
  player.drive = 0;
  st.setRiding(null);
  // step off onto dry land if there's any nearby, otherwise into the water for a swim
  const f = player.facing;
  const rx = Math.cos(f);
  const rz = -Math.sin(f);
  const tries: [number, number][] = [];
  for (const r of id === "yacht" ? [3.5, 5, 6.5, 8.5, 10] : [def.radius + 0.9, def.radius + 1.8]) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      tries.push([p.x + Math.cos(a) * r, p.z + Math.sin(a) * r]);
    }
  }
  // prefer the explorer's left side for cars and bikes
  tries.unshift([p.x - rx * (def.radius + 0.9), p.z - rz * (def.radius + 0.9)]);
  for (const [x, z] of tries) {
    if (w.depthAt(x, z) > 0.3 || !w.inBounds(x, z) || !clearSpot(x, z, 0.5)) continue;
    const g = w.groundAt(x, z);
    if (id !== "yacht" && Math.abs(g - p.y) > 1.2) continue;
    p.set(x, g, z);
    player.vy = 0;
    player.grounded = true;
    return;
  }
  // nowhere dry: slip into the water beside the ride
  p.x -= rx * (def.radius + 0.8);
  p.z -= rz * (def.radius + 0.8);
  player.grounded = false;
  player.vy = 0;
  sound.splash(0.6);
}
