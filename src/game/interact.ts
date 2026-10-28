import { player, useGame } from "./store";
import { getBuilding } from "./buildings";
import { atExit, getInterior, INTERIOR_ORIGIN, type Interior, type Spot } from "./interiors";
import { heartBurst, type Creature } from "./creatures";
import { getWorld } from "./world";
import { sound } from "./audio";
import { cameraSnap } from "@/components/world/cameraState";
import { roofFor, type Roof } from "./roofs";
import type { ChillSpot } from "./chill";
import { trophySpot } from "./trophy";
import { DAP } from "./dap";

/** What's in reach right now (kept up to date by the player controller every frame). */
export const target: { spot: number; creature: Creature | null; roof: Roof | null; chill: ChillSpot | null; trophy: boolean } = { spot: -1, creature: null, roof: null, chill: null, trophy: false };

/** Prompt text for a spot (lifts name the floor they go to). */
export function spotLabel(I: Interior, s: Spot) {
  if (s.kind !== "lift") return s.kind === "roof" && !roofFor(I.id) ? "" : s.label;
  const n = (s.level + 1) % I.levels;
  return n === 0 ? "Take the lift down to the lobby" : `Take the lift up to floor ${n}`;
}

/** Get up from a seat or bed and step back beside it. */
export function standUp() {
  if (player.pose === "stand") return;
  // outdoors (chill spots) standAt is already in world space
  const O = useGame.getState().inside ? INTERIOR_ORIGIN : { x: 0, z: 0 };
  player.position.set(O.x + player.standAt.x, player.standAt.y, O.z + player.standAt.z);
  player.pose = "stand";
  player.chillAt = 0;
  player.vy = 0;
  player.grounded = true;
  sound.step(true);
}

function applySpot(I: Interior, s: Spot) {
  const O = INTERIOR_ORIGIN;
  if (s.kind === "roof") {
    const r = roofFor(I.id);
    if (r) throughDoor(() => leaveTo(r.arrive.x, r.y, r.arrive.z, r.arrive.yaw));
    return;
  }
  if (s.kind === "lift") {
    const next = (s.level + 1) % I.levels;
    const to = I.spots.find((q) => q.kind === "lift" && q.level === next);
    if (!to) return;
    player.position.set(O.x + to.standX, to.y, O.z + to.standZ);
    player.facing = 0;
    player.vy = 0;
    player.grounded = true;
    cameraSnap.pending = true;
    sound.door();
    return;
  }
  player.standAt = { x: s.standX, z: s.standZ, y: player.position.y };
  player.position.set(O.x + s.x, s.y, O.z + s.z);
  player.facing = s.yaw;
  player.pose = s.kind;
  player.vy = 0;
  player.grounded = true;
  sound.step(true);
}

/** Sit back at a chill spot with a juice and take in the view. */
export function startChill(s: ChillSpot) {
  player.standAt = { x: s.standX, z: s.standZ, y: s.y };
  player.position.set(s.x, s.y, s.z);
  player.facing = s.yaw;
  player.pose = "sit";
  player.chillAt = performance.now();
  player.chillKind = s.kind;
  player.vy = 0;
  player.grounded = true;
  sound.step(true);
  if (s.kind === "swing")
    useGame.getState().say("swing", "Swing high, crush. Kick your feet, feel the breeze — move or jump to hop off.", { once: true });
  else
    useGame
      .getState()
      .say("chill", "Juice in hand, world at your feet. Main-character moment unlocked — sip slow, the view's not going anywhere.", { once: true });
}

/** Lift the Main Character Peak trophy overhead and celebrate. */
export function liftTrophy() {
  const now = performance.now();
  if (player.liftAt && now - player.liftAt < 7600) return;
  const t = trophySpot();
  // turn your back to the pedestal so the world sees you holding it up
  player.facing = Math.atan2(player.position.x - t.x, player.position.z - t.z);
  player.liftAt = now;
  const st = useGame.getState();
  st.celebrate();
  st.say("trophy", "Hold it higher — the island's watching. This one was always yours.", { once: true });
}

/** Bro dap with a person: step in, clasp, shake, shoulder bump, snap. */
export function dapPerson(c: Creature) {
  const now = performance.now();
  if (now - player.dapAt < DAP.ms) return;
  const dx = player.position.x - c.x;
  const dz = player.position.z - c.z;
  const l = Math.hypot(dx, dz) || 1;
  // stand a handshake apart, face to face
  player.position.x = c.x + (dx / l) * DAP.gap;
  player.position.z = c.z + (dz / l) * DAP.gap;
  player.facing = Math.atan2(-dx, -dz);
  player.dapAt = now;
  player.dapWith = c;
  c.petAt = now;
  sound.emote();
  useGame.getState().say("dap", "Respect. Every stranger here is just a friend you haven't dapped yet.", { once: true });
}

/** Give an animal (or your own pet) a gentle pat — it turns to you, shows its joy, hearts float up. */
export function petCreature(c: Creature) {
  const now = performance.now();
  if (now - c.petAt < 900) return;
  c.petAt = now;
  player.petAt = now;
  player.petH = c.y + c.height * 0.9 - player.position.y;
  player.facing = Math.atan2(c.x - player.position.x, c.z - player.position.z);
  heartBurst(c.x, c.y + c.height * 0.9 + 0.3, c.z);
  if (c.own) sound.chirp(useGame.getState().petId);
  else sound.animal(c.voice);
}

let doorBusy = false;
const FADE_IN_MS = 200;
/** Fade the screen softly, swap worlds while it's covered, then fade back — no pop, no camera swing. */
function throughDoor(fn: () => void) {
  if (doorBusy) return;
  const st = useGame.getState();
  if (st.reducedMotion) return fn();
  doorBusy = true;
  st.setDoorFade(true);
  setTimeout(() => {
    fn();
    // let the camera and scenery settle for two frames before revealing
    setTimeout(() => {
      useGame.getState().setDoorFade(false);
      doorBusy = false;
    }, 120);
  }, FADE_IN_MS);
}

/** Walk in through the door with a soft fade. */
export function goInside(id: string) {
  throughDoor(() => enterBuilding(id));
}

/** Walk out through the door with a soft fade. */
export function goOutside() {
  throughDoor(exitBuilding);
}

/** Step through a building's door into its interior (or down a roof hatch onto a spot inside). */
export function enterBuilding(id: string, at?: Spot) {
  const st = useGame.getState();
  const b = getBuilding(id);
  const I = getInterior(id);
  if (!b || !I || st.riding) return;
  player.outside = { x: b.x, z: b.z, yaw: b.yaw };
  if (at) {
    player.position.set(INTERIOR_ORIGIN.x + at.standX, at.y, INTERIOR_ORIGIN.z + at.standZ);
    player.facing = 0;
  } else {
    player.position.set(INTERIOR_ORIGIN.x + I.spawn.x, 0, INTERIOR_ORIGIN.z + I.spawn.z);
    player.facing = I.spawn.yaw;
  }
  player.vy = 0;
  player.grounded = true;
  player.swimming = false;
  player.pose = "stand";
  target.spot = -1;
  st.setInside(id);
  cameraSnap.pending = true;
  sound.door();
}

/** Leave the room and stand at a point on the island (front door or rooftop). */
function leaveTo(x: number, y: number, z: number, yaw: number) {
  const st = useGame.getState();
  player.pose = "stand";
  target.spot = -1;
  player.position.set(x, y, z);
  player.facing = yaw;
  player.vy = 0;
  player.grounded = true;
  st.setInside(null);
  cameraSnap.pending = true;
  sound.door();
}

/** Walk back out through the door you came in. */
export function exitBuilding() {
  const st = useGame.getState();
  if (!st.inside) return;
  const b = getBuilding(st.inside);
  const o = player.outside;
  // a couple of steps out from the door so the camera has room behind you
  const x = o.x + Math.sin(o.yaw) * 1.2;
  const z = o.z + Math.cos(o.yaw) * 1.2;
  leaveTo(x, b?.kind === "treehouse" ? b.y : getWorld().groundAt(x, z), z, o.yaw);
}

/** Down the roof hatch onto the building's top floor, beside the ladder. */
export function goDownHatch(r: Roof) {
  const I = getInterior(r.id);
  const spot = I?.spots.find((s) => s.kind === "roof");
  if (!I || !spot) return;
  throughDoor(() => enterBuilding(r.id, spot));
}

/** E / the action button: sit, lie down, take the lift, open a door, leave, or pet an animal. */
export function interact() {
  const st = useGame.getState();
  if (st.phase !== "playing") return;
  if (st.inside) {
    const I = getInterior(st.inside);
    if (!I) return;
    if (player.pose !== "stand") return standUp();
    if (target.spot >= 0 && I.spots[target.spot]) return applySpot(I, I.spots[target.spot]);
    const lx = player.position.x - INTERIOR_ORIGIN.x;
    const lz = player.position.z - INTERIOR_ORIGIN.z;
    if (atExit(I, lx, lz, player.position.y) || (Math.abs(lx) < 2.5 && lz > I.d / 2 - 2.5 && player.position.y < 0.6)) goOutside();
    return;
  }
  if (player.pose !== "stand") return standUp();
  if (target.roof && !st.riding && !player.flying) return goDownHatch(target.roof);
  if (target.trophy && !st.riding && !player.flying) return liftTrophy();
  if (target.chill && !st.riding && !player.flying && !player.swimming) return startChill(target.chill);
  if (st.nearDoor && !st.riding && !player.flying) return goInside(st.nearDoor);
  if (target.creature && !st.riding && !player.flying && !player.swimming) return target.creature.person ? dapPerson(target.creature) : petCreature(target.creature);
}

/** G / the emote button: the explorer's signature move (not while driving). */
export function doEmote() {
  const st = useGame.getState();
  if (st.phase !== "playing" || st.riding || player.flying || player.swimming) return;
  st.emote();
  sound.emote();
}
