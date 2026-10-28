import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { input } from "@/game/input";
import { player, useGame } from "@/game/store";
import { getWorld } from "@/game/world";
import { colliderTop, collidersNear, overlaps } from "@/game/scatter";
import { cameraDebug, cameraSnap, cameraView } from "./cameraState";
import { dampAngle } from "@/game/math";
import { RIDES } from "@/game/vehicles";
import { getInterior, INTERIOR_ORIGIN, levelOf } from "@/game/interiors";

const INTRO_POS = new THREE.Vector3(-24, 178, 262);
const INTRO_LOOK = new THREE.Vector3(2, 0, -6);
const DIST = 9.5;
const ENTER_DURATION = 3.2;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function CameraRig() {
  const world = getWorld();
  const s = useRef({
    yaw: 0,
    pitch: 0.34,
    dist: DIST,
    init: false,
    enterT: 0,
    from: new THREE.Vector3(),
    fromLook: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    look: new THREE.Vector3(),
    followPos: new THREE.Vector3(),
    followLook: new THREE.Vector3(),
    introPos: new THREE.Vector3(),
    lastPhase: "intro",
  });

  useFrame(({ camera, clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const st = useGame.getState();
    const c = s.current;
    const t = clock.elapsedTime;
    const p = player.position;

    if (!c.init) {
      c.yaw = player.facing;
      c.pos.copy(INTRO_POS);
      c.look.copy(INTRO_LOOK);
      c.init = true;
    }

    // intro: slow cinematic drift over the island
    const sway = st.reducedMotion ? 0 : Math.sin(t * 0.07) * 0.09;
    c.introPos.copy(INTRO_POS).applyAxisAngle(THREE.Object3D.DEFAULT_UP, sway);
    c.introPos.y += st.reducedMotion ? 0 : Math.sin(t * 0.11) * 3;
    // tall phone screens see less across: pull back so the whole island fits, and follow the pinch zoom
    const aspect = (camera as THREE.PerspectiveCamera).aspect || 1;
    const fit = aspect < 1 ? Math.min(2.5, 1 / aspect) : 1;
    c.introPos.sub(INTRO_LOOK).multiplyScalar(fit * input.zoom).add(INTRO_LOOK);

    // follow pose
    if (input.dragX || input.dragY) {
      c.yaw -= input.dragX * 0.0055;
      c.pitch = THREE.MathUtils.clamp(c.pitch + input.dragY * 0.003, 0.12, 0.9);
      input.dragX = 0;
      input.dragY = 0;
    }
    const now = performance.now();
    const chilling = !!player.chillAt && player.pose === "sit" && !st.inside;
    // chilling: drift round behind the explorer so the view opens up ahead
    if (chilling && now - input.lastDragAt > 2500) c.yaw = dampAngle(c.yaw, player.facing + Math.sin(t * 0.08) * 0.35, 0.6 * dt);
    else if (st.phase === "playing" && player.speed > 0.5 && now - input.lastDragAt > 1600) {
      const rate = (player.scrolling ? 2.4 : 1.15) * Math.min(1, player.speed / 5);
      c.yaw = dampAngle(c.yaw, player.facing, rate * dt);
    }
    const snap = cameraSnap.pending;
    if (snap) c.yaw = player.facing;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    // keep the camera out of rocks / tree crowns between it and the explorer
    const I = st.inside ? getInterior(st.inside) : null;
    const ride = st.riding ? RIDES[st.riding] : null;
    const base = (ride ? ride.cam : I ? 6.5 : chilling ? DIST * 1.45 : DIST) * (I ? Math.min(1, input.zoom) : input.zoom);
    const pitch = I ? Math.max(c.pitch, 0.6) : chilling ? Math.min(c.pitch, 0.24) : c.pitch;
    // never pull inside the vehicle itself
    const minDist = ride ? ride.length * 0.75 + 1.2 : 2.6;
    let allowed = base;
    for (let k = 2; k <= 10 && !I; k++) {
      const d = (base * k) / 10;
      const qx = p.x - fx * d * Math.cos(pitch);
      const qz = p.z - fz * d * Math.cos(pitch);
      const qy = p.y + d * Math.sin(pitch) + 1.4;
      let hit = qy < world.gridHeight(qx, qz) + 0.8;
      if (!hit) {
        for (const col of collidersNear(qx, qz)) {
          const top = col.h != null ? colliderTop(col) + 0.6 : world.gridHeight(col.x, col.z) + 7;
          if (qy < top && overlaps(col, qx, qz, 0.9)) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        allowed = Math.max(minDist, d - base / 10);
        break;
      }
    }
    if (snap) c.dist = allowed;
    else c.dist += (allowed - c.dist) * (1 - Math.exp(-(allowed < c.dist ? 14 : 2.5) * dt));
    const horiz = c.dist * Math.cos(pitch);
    c.followPos.set(p.x - fx * horiz, p.y + c.dist * Math.sin(pitch) + 1.4, p.z - fz * horiz);
    if (I) {
      // stay inside the room, below the ceiling of the storey you're on
      const ox = INTERIOR_ORIGIN.x;
      const oz = INTERIOR_ORIGIN.z;
      c.followPos.x = THREE.MathUtils.clamp(c.followPos.x, ox - I.w / 2 + 0.5, ox + I.w / 2 - 0.5);
      c.followPos.z = THREE.MathUtils.clamp(c.followPos.z, oz - I.d / 2 + 0.5, oz + I.d / 2 + 0.2);
      const ceil = (levelOf(I, p.y) + 1) * I.storey - 0.35;
      c.followPos.y = Math.min(c.followPos.y, ceil);
    } else {
      const surf = world.waterSurface(c.followPos.x, c.followPos.z);
      const floor = Math.max(world.gridHeight(c.followPos.x, c.followPos.z), surf ?? -Infinity) + 1.3;
      if (c.followPos.y < floor) c.followPos.y = floor;
    }
    c.followLook.set(p.x + fx * 2.5, p.y + 1.5, p.z + fz * 2.5);

    if (st.phase !== c.lastPhase) {
      if (st.phase === "entering") {
        c.enterT = 0;
        c.from.copy(c.pos);
        c.fromLook.copy(c.look);
        c.yaw = player.facing;
      }
      c.lastPhase = st.phase;
    }

    if (snap) {
      cameraSnap.pending = false;
      if (st.phase === "playing") {
        c.pos.copy(c.followPos);
        c.look.copy(c.followLook);
      }
    }

    if (st.phase === "intro") {
      c.pos.lerp(c.introPos, 1 - Math.exp(-2 * dt));
      c.look.lerp(INTRO_LOOK, 1 - Math.exp(-2 * dt));
    } else if (st.phase === "entering") {
      c.enterT += Math.min(raw, 0.25) / (st.reducedMotion ? 0.8 : ENTER_DURATION);
      const e = ease(Math.min(1, c.enterT));
      // arc: rise slightly mid-flight for a graceful swoop
      c.pos.lerpVectors(c.from, c.followPos, e);
      c.pos.y += Math.sin(e * Math.PI) * 6;
      c.look.lerpVectors(c.fromLook, c.followLook, e);
      if (c.enterT >= 1) st.setPhase("playing");
    } else {
      c.pos.lerp(c.followPos, 1 - Math.exp(-6 * dt));
      c.look.lerp(c.followLook, 1 - Math.exp(-10 * dt));
    }

    if (cameraDebug.pos) {
      camera.position.set(...cameraDebug.pos);
      camera.lookAt(...cameraDebug.look);
    } else {
      camera.position.copy(c.pos);
      camera.lookAt(c.look);
    }
    cameraView.yaw = Math.atan2(c.look.x - c.pos.x, c.look.z - c.pos.z);

    const cam = camera as THREE.PerspectiveCamera;
    if (cam.view?.enabled) cam.clearViewOffset();
  });

  return null;
}
