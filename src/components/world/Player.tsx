import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { input, readMoveAxes } from "@/game/input";
import { overlayOpen, player, rides, useGame } from "@/game/store";
import { getWorld, OCEAN_LIMIT, islandDist, ROAD_HALF } from "@/game/world";
import { colliderTop, collidersNear, footprintDist, overlaps, pushOut, STEP_UP, supportAt, surfaceAt } from "@/game/scatter";
import { START_POSITION, STOP_BY_ID } from "@/game/stops";
import { dampAngle } from "@/game/math";
import { sound } from "@/game/audio";
import { FLOAT_DEPTH, RIDES, WADE_SPEED, WATER_SPEED, type VehicleDef } from "@/game/vehicles";
import { atExit, collideInterior, floorAt, getInterior, INTERIOR_ORIGIN, nearestSpot, type Interior } from "@/game/interiors";
import { goOutside, spotLabel, standUp, target } from "@/game/interact";
import { nearestHatch } from "@/game/roofs";
import { nearestChill } from "@/game/chill";
import { nearTrophy } from "@/game/trophy";
import { clearSpot } from "@/game/powers";
import { nearestCreature } from "@/game/creatures";
import { cityLoopDist, CITY_ROAD_HALF } from "@/game/layout";
import { cameraSnap } from "./cameraState";
import { footBoost, type FootBoost } from "@/game/abilities";
import { PETS } from "@/game/characters";

/** Movement boost this frame from the running super power and the pet's ability. */
let boost: FootBoost = footBoost(null, undefined);

// feel constants
const WALK = 5.2;
const RUN = 9.5;
const SWIM = 3.4;
const SWIM_FAST = 5.4;
const ACCEL = 9;
const DECEL = 12;
const TURN = 12;
const BODY_R = 0.45;
const GRAVITY = 24;
const JUMP_V = 8.6;
const JUMP_BUFFER_MS = 160;
const FLY = 12;
const FLY_FAST = 19;
const FLY_MAX = 28;
/** steepest ground you can walk straight up (rise / run) */
const MAX_GRADE = 1.7;
/** water deeper than this and you swim */
export const SWIM_DEPTH = 1.25;
/** how far the feet hang below the surface while swimming */
const SWIM_SINK = 1.15;
/** extra ledge reach while jumping (grab & pull up) */
const MANTLE = 1.15;

type Axes = { dx: number; dz: number; mag: number; run: boolean; jump: boolean };

/** Movement for every mode: walking, swimming, flying, driving, sailing and indoors. */
export function PlayerController() {
  const world = getWorld();
  const vel = useRef(new THREE.Vector3());
  const lastTeleport = useRef(0);
  const lastWarp = useRef(0);
  const air = useRef(false);
  const splashAt = useRef(0);
  const lastYaw = useRef(0);
  const lastDrive = useRef(0);
  const fwd = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const g = STOP_BY_ID.gate;
    player.position.set(START_POSITION.x, world.groundAt(START_POSITION.x, START_POSITION.z), START_POSITION.z);
    player.facing = Math.atan2(g.x - START_POSITION.x, g.z - START_POSITION.z);
    player.vy = 0;
    player.grounded = true;
    // the yacht waits moored beside the harbor pier
    let last = world.road.count - 1;
    for (let i = world.road.count - 1; i > 0; i--)
      if (world.pier[i]) {
        last = i;
        break;
      }
    // moor at the deep end of the pier, on whichever side has deep water
    let best = { x: 0, z: 0, yaw: 0, depth: -1 };
    for (let k = last; k > Math.max(1, last - 40); k -= 2) {
      const j = Math.max(0, k - 6);
      const tx = world.road.xs[k] - world.road.xs[j];
      const tz = world.road.zs[k] - world.road.zs[j];
      const l = Math.hypot(tx, tz) || 1;
      for (const side of [1, -1]) {
        const x = world.road.xs[k] + (-tz / l) * 5.2 * side;
        const z = world.road.zs[k] + (tx / l) * 5.2 * side;
        let d = Infinity;
        for (let a = 0; a < 8; a++) d = Math.min(d, world.depthAt(x + Math.cos(a * 0.785) * 3.5, z + Math.sin(a * 0.785) * 3.5));
        if (d > best.depth) best = { x, z, yaw: Math.atan2(tx / l, tz / l), depth: d };
      }
      if (best.depth > 3) break;
    }
    rides.yacht.x = best.x;
    rides.yacht.z = best.z;
    rides.yacht.y = 0;
    rides.yacht.yaw = best.yaw;
    rides.yacht.placed = true;
  }, [world]);

  /* ---------------- on foot (land, water, sky) ---------------- */
  const stepFoot = (a: Axes, dt: number, raw: number, playing: boolean, flying: boolean, t: number) => {
    const p = player.position;
    const surf = world.waterSurface(p.x, p.z);
    const depth = surf === null ? 0 : surf - world.groundAt(p.x, p.z);
    const swimming = !flying && surf !== null && depth > SWIM_DEPTH && p.y <= surf - 0.3;
    if (swimming && !player.swimming && performance.now() - splashAt.current > 400) {
      splashAt.current = performance.now();
      sound.splash(Math.min(1, Math.abs(player.vy) / 10 + 0.3));
    }
    player.swimming = swimming;
    player.wade = surf === null ? 0 : Math.max(0, surf - p.y);
    const wading = !swimming && !flying && player.wade > 0.3;

    const dl = Math.hypot(a.dx, a.dz);
    const base = flying ? (a.run ? FLY_FAST : FLY) : swimming ? (a.run ? SWIM_FAST : SWIM) * boost.swim : (a.run ? RUN : WALK) * boost.walk;
    const speedTarget = a.mag * base * (wading ? 0.62 : 1);
    const tx = dl > 0 ? (a.dx / dl) * speedTarget : 0;
    const tz = dl > 0 ? (a.dz / dl) * speedTarget : 0;
    const grip = swimming ? 0.35 : player.grounded ? 1 : 0.45;
    const k = 1 - Math.exp(-(speedTarget > 0.01 ? ACCEL : DECEL) * grip * dt);
    vel.current.x += (tx - vel.current.x) * k;
    vel.current.z += (tz - vel.current.z) * k;

    let nx = p.x;
    let nz = p.z;
    const aloft = flying && p.y - world.groundAt(p.x, p.z) > 2.5;
    // move in short sub-steps so fast runs, flights and dropped frames can't tunnel through thin things
    const stepX = vel.current.x * dt;
    const stepZ = vel.current.z * dt;
    const subs = Math.min(8, Math.max(1, Math.ceil(Math.hypot(stepX, stepZ) / 0.3)));
    let mantled = false;
    for (let si = 0; si < subs; si++) {
      nx += stepX / subs;
      nz += stepZ / subs;
      const near = collidersNear(nx, nz);
      // two passes so being squeezed between two solids resolves cleanly
      for (let pass = 0; pass < 2; pass++)
        for (const c of near) {
          if (c.h !== undefined) {
            // the surface height right where we'd touch it (roofs slope)
            const top = surfaceAt(c, nx, nz);
            // climbable things below the feet don't block — you stand on them
            if (p.y >= top - STEP_UP) continue;
            // mid-jump against a ledge within reach: pull yourself up onto it
            if (!mantled && !player.grounded && !flying && !swimming && top - p.y <= MANTLE * boost.mantle && player.vy < 4 && speedTarget > 0.5 && overlaps(c, nx, nz, BODY_R + 0.05)) {
              player.vy = Math.max(player.vy, Math.sqrt(2 * GRAVITY * boost.gravity * (top - p.y + 0.22)));
              mantled = true;
            }
          } else if (aloft) continue; // flying high: pass over houses and trees, still bump into tall towers
          const o = pushOut(c, nx, nz, BODY_R, -stepX, -stepZ);
          if (o.hit) {
            nx = o.x;
            nz = o.z;
          }
        }
    }
    // terrain: you can't walk up cliffs (unless you jump high enough), but you can step off them
    const blocked = (x: number, z: number) => {
      if (!world.inBounds(x, z)) return true;
      if (flying) return false;
      const gN = world.groundAt(x, z);
      if (gN <= p.y + 0.12) return false;
      const run = Math.hypot(x - p.x, z - p.z);
      return (gN - world.groundAt(p.x, p.z)) / Math.max(run, 0.05) > MAX_GRADE || gN > p.y + 0.9;
    };
    if (blocked(nx, nz)) {
      if (!blocked(nx, p.z)) nz = p.z;
      else if (!blocked(p.x, nz)) nx = p.x;
      else {
        nx = p.x;
        nz = p.z;
        vel.current.set(0, 0, 0);
        if (swimming && playing) useGame.getState().say("swim-out", "Too steep to climb out here — swim to a beach or the harbor pier, then press jump to climb out.", { once: true });
      }
    }
    const moved = Math.hypot(nx - p.x, nz - p.z) / Math.max(dt, 1e-4);
    p.x = nx;
    p.z = nz;

    const now = performance.now();
    const wantsJump = playing && now - input.jumpAt < Math.max(JUMP_BUFFER_MS, raw * 2000);
    const sup = supportAt(p.x, p.z, p.y);
    if (swimming) {
      if (wantsJump) {
        input.jumpAt = 0;
        // climb out onto a low bank / pier ahead, or a playful dolphin hop
        const ax = p.x + Math.sin(player.facing) * 1.3;
        const az = p.z + Math.cos(player.facing) * 1.3;
        const ga = supportAt(ax, az, (surf ?? 0) + 2);
        if (ga > p.y + 0.3 && ga <= (surf ?? 0) + 2.2 && world.depthAt(ax, az) < 0.4) {
          p.set(ax, ga, az);
          player.grounded = true;
          player.vy = 0;
          player.landedAt = now;
          player.swimming = false;
          sound.splash(0.4);
        } else {
          player.vy = 6.5;
          p.y = (surf ?? 0) - 0.25;
          player.grounded = false;
          sound.splash(0.5);
        }
      } else {
        const want = (surf ?? 0) - SWIM_SINK + Math.sin(t * 2.2) * 0.05;
        p.y += (want - p.y) * (1 - Math.exp(-5 * dt));
        player.vy = 0;
        player.grounded = false;
      }
    } else if (flying) {
      if (playing) {
        if (input.keys.has("Space")) player.flyAlt += 9 * dt;
        if (input.keys.has("KeyC")) player.flyAlt -= 9 * dt;
        if (now - input.jumpAt < 300) {
          input.jumpAt = 0;
          player.flyAlt += 3;
        }
      }
      player.flyAlt = THREE.MathUtils.clamp(player.flyAlt, 1.5, FLY_MAX);
      const want = Math.max(sup, surf ?? -Infinity) + player.flyAlt;
      const prevY = p.y;
      p.y += (want - p.y) * (1 - Math.exp(-2.6 * dt));
      player.vy = (p.y - prevY) / Math.max(dt, 1e-4);
      player.grounded = false;
    } else {
      if (wantsJump && player.grounded) {
        input.jumpAt = 0;
        player.vy = JUMP_V * (wading ? 0.8 : 1) * boost.jump;
        player.grounded = false;
        player.jumpedAt = now;
        sound.hop();
      }
      if (player.grounded) {
        if (sup < p.y - 0.7) {
          player.grounded = false;
          player.vy = 0;
        } else {
          p.y += (sup - p.y) * (1 - Math.exp(-18 * dt));
          if (Math.abs(sup - p.y) > 2) p.y = sup;
        }
      }
      if (!player.grounded) {
        player.vy -= GRAVITY * boost.gravity * (player.vy < 0 ? boost.fall : 1) * dt;
        // gliding: a gentle, capped fall
        if (boost.fall < 1) player.vy = Math.max(player.vy, -6);
        p.y += player.vy * dt;
        if (player.vy <= 0 && p.y <= sup) {
          p.y = sup;
          player.vy = 0;
          player.grounded = true;
          player.landedAt = now;
          sound.step(false);
        }
      }
    }
    return moved;
  };

  /* ---------------- vehicles (land + yacht) ---------------- */
  const stepRide = (def: VehicleDef, a: Axes, dt: number) => {
    const p = player.position;
    const boat = def.kind === "boat";
    const surf = world.waterSurface(p.x, p.z);
    const gHere = world.groundAt(p.x, p.z);
    const depth = surf === null ? 0 : surf - gHere;
    const afloat = boat || depth > FLOAT_DEPTH;
    const wading = !afloat && depth > 0.3;
    if (afloat && !player.afloat && !boat) sound.splash(0.9);
    player.afloat = afloat;
    player.wade = depth;
    const offRoad = !boat && world.nearestRoad(p.x, p.z, ROAD_HALF + 1).dist > ROAD_HALF + 0.4 && cityLoopDist(p.x, p.z) > CITY_ROAD_HALF;
    const top = def.topSpeed * boost.ride * (a.run ? 1.15 : 1) * (offRoad ? def.offroad : 1) * (afloat && !boat ? WATER_SPEED : wading ? WADE_SPEED : 1);

    // steering & throttle (camera-relative: push where you want to go; pull back to reverse)
    let throttle = 0;
    const dl = Math.hypot(a.dx, a.dz);
    if (dl > 0.01) {
      const want = Math.atan2(a.dx, a.dz);
      const diff = Math.atan2(Math.sin(want - player.facing), Math.cos(want - player.facing));
      const grip = THREE.MathUtils.clamp(Math.abs(player.drive) / 5, boat ? 0.35 : 0.22, 1);
      if (Math.abs(diff) > 2.35 && !boat) {
        if (player.drive < 3.5) {
          throttle = -0.42 * a.mag;
          // reversing swings the nose the opposite way
          player.facing = dampAngle(player.facing, want + Math.PI, def.turn * 0.5 * grip * dt);
        }
      } else {
        throttle = a.mag * (Math.abs(diff) > 1.2 ? 0.55 : 1);
        player.facing = dampAngle(player.facing, want, def.turn * grip * dt);
      }
    }
    const targetV = throttle * top;
    const speeding = Math.abs(targetV) > Math.abs(player.drive) && Math.sign(targetV || 1) === Math.sign(player.drive || targetV || 1);
    const rate = throttle === 0 ? (boat ? 0.35 : 0.9) : speeding ? def.accel : 3.4;
    player.drive += (targetV - player.drive) * (1 - Math.exp(-rate * dt));

    // hills slow you down; too steep and the wheels just spin
    if (!afloat) {
      const dir = Math.sign(player.drive) || 1;
      const ax = p.x + Math.sin(player.facing) * 1.8 * dir;
      const az = p.z + Math.cos(player.facing) * 1.8 * dir;
      const grade = (world.groundAt(ax, az) - gHere) / 1.8;
      if (grade > 0.05) player.drive *= Math.exp((-grade / def.slope) * 1.6 * dt);
      if (grade > def.slope && Math.abs(player.drive) > 0.5) player.drive *= Math.exp(-6 * dt);
      // wheelspin: on a steep pull (or a hard launch) the tyres turn faster than the ride moves
      const pull = throttle !== 0 ? THREE.MathUtils.clamp((grade / def.slope - 0.35) / 0.65, 0, 1) : 0;
      const launch = throttle > 0.8 && player.drive < top * 0.25 ? 0.45 : 0;
      const slipT = Math.max(pull, launch);
      player.slip += (slipT - player.slip) * (1 - Math.exp(-(slipT > player.slip ? 8 : 3) * dt));
      // the ride squirms a little as the rubber fights for grip
      if (player.slip > 0.3 && def.kind !== "bike") player.facing += Math.sin(performance.now() / 70) * 0.004 * player.slip;
    } else player.slip *= Math.exp(-4 * dt);

    // velocity: heading + a sideways slide that grip removes (drift)
    const hx = Math.sin(player.facing);
    const hz = Math.cos(player.facing);
    const nX = hz;
    const nZ = -hx;
    let lat = vel.current.x * nX + vel.current.z * nZ;
    lat *= Math.exp(-def.grip * (afloat ? 2.5 : 9) * dt);
    vel.current.set(hx * player.drive + nX * lat, 0, hz * player.drive + nZ * lat);

    let nx = p.x + vel.current.x * dt;
    let nz = p.z + vel.current.z * dt;
    if (!boat) {
      const sx = nx - p.x;
      const sz = nz - p.z;
      const subs = Math.min(8, Math.max(1, Math.ceil(Math.hypot(sx, sz) / 0.4)));
      nx = p.x;
      nz = p.z;
      let bumped = false;
      for (let si = 0; si < subs; si++) {
        nx += sx / subs;
        nz += sz / subs;
        for (const c of collidersNear(nx, nz)) {
          // rocks, logs and kerbs low enough to roll over
          if (c.h !== undefined && colliderTop(c) - gHere <= def.climb) continue;
          if (c.h !== undefined && p.y >= colliderTop(c) - 0.3) continue;
          const o = pushOut(c, nx, nz, def.radius, -sx, -sz);
          if (!o.hit) continue;
          nx = o.x;
          nz = o.z;
          bumped = true;
        }
      }
      if (bumped) {
        if (Math.abs(player.drive) > 6) sound.bump(Math.min(1, Math.abs(player.drive) / 25));
        player.drive *= 0.55;
      }
    }
    const ok = (x: number, z: number) => {
      if (!world.inBounds(x, z)) return false;
      // the hull needs deep water — but can always head toward deeper water
      if (boat) return world.depthAt(x, z) > 1.5 || world.depthAt(x, z) > world.depthAt(p.x, p.z) + 0.01;
      const g = world.groundAt(x, z);
      // walls of rock (cliff faces) stop you; slopes are handled above
      return g - Math.max(p.y, gHere) < 1.2 + def.climb * 0.5;
    };
    if (!ok(nx, nz)) {
      if (ok(nx, p.z)) nz = p.z;
      else if (ok(p.x, nz)) nx = p.x;
      else {
        nx = p.x;
        nz = p.z;
        if (Math.abs(player.drive) > 5) sound.bump(0.6);
        player.drive *= boat ? -0.3 : -0.2;
        vel.current.multiplyScalar(0.2);
      }
    }
    const moved = Math.hypot(nx - p.x, nz - p.z) / Math.max(dt, 1e-4);
    p.x = nx;
    p.z = nz;

    // vertical: suspension follows the ground (or floats); crests can launch you
    const s2 = world.waterSurface(p.x, p.z);
    const g2 = world.groundAt(p.x, p.z);
    // sit on the wheels, not the centre: in a dip or at the foot of a slope the
    // ground under the tyres is higher than under the middle
    let target = g2;
    if (!boat && !afloat) {
      const L = def.length * 0.42;
      const W = def.radius * 0.85;
      const fx = Math.sin(player.facing);
      const fz = Math.cos(player.facing);
      const gF = world.groundAt(p.x + fx * L, p.z + fz * L);
      const gB = world.groundAt(p.x - fx * L, p.z - fz * L);
      const gR = world.groundAt(p.x + fz * W, p.z - fx * W);
      const gL = world.groundAt(p.x - fz * W, p.z + fx * W);
      target = Math.max(g2, (gF + gB) / 2, (gL + gR) / 2, Math.max(gF, gB, gL, gR) - 0.22);
    }
    if (!boat)
      for (const c of collidersNear(p.x, p.z)) {
        if (c.h === undefined || footprintDist(c, p.x, p.z) > 0) continue;
        const top = colliderTop(c);
        // roll up onto low rocks and kerbs; anything taller blocked us above
        if (top - g2 <= def.climb + 0.05 || p.y >= top - 0.3) target = Math.max(target, top);
      }
    const floatY = s2 === null ? -Infinity : s2 - (boat ? 0 : def.kind === "bike" ? 0.55 : 0.45);
    if (afloat || floatY > target) target = Math.max(target, floatY);
    const now = performance.now();
    if (air.current) {
      player.vy -= GRAVITY * dt;
      p.y += player.vy * dt;
      if (p.y <= target) {
        if (player.vy < -6) sound.bump(Math.min(1, -player.vy / 18));
        if (s2 !== null && player.vy < -4) sound.splash(0.8);
        p.y = target;
        player.vy = 0;
        air.current = false;
        player.landedAt = now;
      }
    } else {
      const prev = p.y;
      const follow = 1 - Math.exp(-(afloat ? 4 : 16) * dt);
      const next = p.y + (target - p.y) * follow;
      const vy = (next - prev) / Math.max(dt, 1e-4);
      // ground falls away faster than gravity → airborne
      if (!afloat && player.vy > 1.5 && target < p.y - 0.35) {
        air.current = true;
      } else {
        p.y = next;
        player.vy = vy;
      }
    }
    player.grounded = !air.current;
    player.swimming = false;

    // body attitude: follow the ground under the wheels, bob on water, bikes lean into turns
    const t = now / 1000;
    let pitchT = 0;
    let rollT = 0;
    if (afloat) {
      pitchT = Math.sin(t * 1.3) * 0.035 - Math.min(0.12, Math.abs(player.drive) * 0.004);
      rollT = Math.sin(t * 0.9) * (boat ? 0.035 : 0.05);
    } else if (!air.current) {
      const L = def.length * 0.42;
      const W = def.radius * 0.85;
      const fx = Math.sin(player.facing);
      const fz = Math.cos(player.facing);
      const rx = Math.cos(player.facing);
      const rz = -Math.sin(player.facing);
      const gF = world.groundAt(p.x + fx * L, p.z + fz * L);
      const gB = world.groundAt(p.x - fx * L, p.z - fz * L);
      const gR = world.groundAt(p.x + rx * W, p.z + rz * W);
      const gL = world.groundAt(p.x - rx * W, p.z - rz * W);
      pitchT = -Math.atan2(gF - gB, 2 * L);
      rollT = def.kind === "bike" ? 0 : Math.atan2(gR - gL, 2 * W) * 0.8;
      // a little dive under braking, squat on throttle
      pitchT += THREE.MathUtils.clamp((player.drive - lastDrive.current) / Math.max(dt, 1e-3), -12, 12) * -0.004;
    }
    let dyaw = player.facing - lastYaw.current;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    if (def.kind === "bike") rollT += THREE.MathUtils.clamp((-dyaw / Math.max(dt, 1e-3)) * 0.12 * Math.min(1, Math.abs(player.drive) / 6), -0.55, 0.55);
    else if (!afloat) rollT += THREE.MathUtils.clamp((dyaw / Math.max(dt, 1e-3)) * 0.02 * Math.min(1, Math.abs(player.drive) / 10), -0.06, 0.06);
    lastYaw.current = player.facing;
    lastDrive.current = player.drive;
    // slipping tyres: the nose shimmies as the rear digs in
    if (player.slip > 0.2 && !afloat) pitchT += Math.sin(t * 31) * 0.012 * player.slip;
    player.pitch += (THREE.MathUtils.clamp(pitchT, -0.85, 0.85) - player.pitch) * (1 - Math.exp(-14 * dt));
    player.roll += (THREE.MathUtils.clamp(rollT, -0.7, 0.7) - player.roll) * (1 - Math.exp(-10 * dt));
    return moved;
  };

  /* ---------------- inside a building ---------------- */
  const stepInside = (I: Interior, a: Axes, dt: number, raw: number, playing: boolean) => {
    const p = player.position;
    const O = INTERIOR_ORIGIN;
    const st = useGame.getState();
    if (player.pose !== "stand") {
      // resting: any move or jump gets you up again
      vel.current.set(0, 0, 0);
      if (playing && (a.mag > 0.3 || performance.now() - input.jumpAt < 250)) {
        input.jumpAt = 0;
        standUp();
      }
      target.spot = -1;
      st.setNearAction(player.pose === "lie" ? { kind: "stand", label: "Get up" } : player.pose === "sit" ? { kind: "stand", label: "Stand up" } : null);
      return 0;
    }
    const dl = Math.hypot(a.dx, a.dz);
    const speedTarget = a.mag * (a.run ? RUN * 0.8 : WALK * 0.85);
    const tx = dl > 0 ? (a.dx / dl) * speedTarget : 0;
    const tz = dl > 0 ? (a.dz / dl) * speedTarget : 0;
    const k = 1 - Math.exp(-(speedTarget > 0.01 ? ACCEL : DECEL) * (player.grounded ? 1 : 0.45) * dt);
    vel.current.x += (tx - vel.current.x) * k;
    vel.current.z += (tz - vel.current.z) * k;
    const lx = p.x - O.x;
    const lz = p.z - O.z;
    const c = collideInterior(I, lx + vel.current.x * dt, lz + vel.current.z * dt, p.y, BODY_R);
    const moved = Math.hypot(c.x - lx, c.z - lz) / Math.max(dt, 1e-4);
    p.x = O.x + c.x;
    p.z = O.z + c.z;
    const now = performance.now();
    if (playing && player.grounded && now - input.jumpAt < Math.max(JUMP_BUFFER_MS, raw * 2000)) {
      input.jumpAt = 0;
      player.vy = JUMP_V * 0.85;
      player.grounded = false;
      player.jumpedAt = now;
      sound.hop();
    }
    const sup = floorAt(I, c.x, c.z, p.y);
    if (player.grounded) {
      if (sup < p.y - 0.7) {
        player.grounded = false;
        player.vy = 0;
      } else p.y += (sup - p.y) * (1 - Math.exp(-18 * dt));
    }
    if (!player.grounded) {
      player.vy -= GRAVITY * dt;
      p.y += player.vy * dt;
      if (player.vy <= 0 && p.y <= sup) {
        p.y = sup;
        player.vy = 0;
        player.grounded = true;
        player.landedAt = now;
        sound.step(true);
      }
    }
    player.swimming = false;
    player.wade = 0;
    // seats, beds and lifts in reach
    target.spot = player.grounded ? nearestSpot(I, c.x, c.z, p.y) : -1;
    const spot = target.spot >= 0 ? I.spots[target.spot] : null;
    const spotText = spot ? spotLabel(I, spot) : "";
    st.setNearAction(spot && spotText ? { kind: spot.kind, label: spotText } : null);
    // walking out through the doorway takes you back outside
    if (playing && atExit(I, c.x, c.z, p.y) && vel.current.z > 0.8) goOutside();
    return moved;
  };

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const st = useGame.getState();
    const p = player.position;

    if (st.teleport && st.teleport.seq !== lastTeleport.current) {
      lastTeleport.current = st.teleport.seq;
      if (st.inside) st.setInside(null);
      if (st.riding) {
        const v = st.riding === "yacht" ? rides.yacht : rides.land;
        v.x = p.x;
        v.z = p.z;
        v.yaw = player.facing;
        st.setRiding(null);
      }
      const idx = Math.max(0, world.stopRoadIndex[st.teleport.id] - 10);
      const j = Math.min(world.road.count - 1, idx + 6);
      p.set(world.road.xs[idx], world.groundAt(world.road.xs[idx], world.road.zs[idx]), world.road.zs[idx]);
      player.facing = Math.atan2(world.road.xs[j] - p.x, world.road.zs[j] - p.z);
      vel.current.set(0, 0, 0);
      player.vy = 0;
      player.grounded = true;
      player.swimming = false;
      player.pose = "stand";
      cameraSnap.pending = true;
    }

    // tap-to-teleport from the map: land on the nearest clear ground (or in open water to swim)
    if (st.warp && st.warp.seq !== lastWarp.current) {
      lastWarp.current = st.warp.seq;
      if (st.inside) st.setInside(null);
      if (st.riding) {
        const v = st.riding === "yacht" ? rides.yacht : rides.land;
        v.x = p.x;
        v.z = p.z;
        v.yaw = player.facing;
        st.setRiding(null);
      }
      const from = { x: p.x, y: p.y, z: p.z };
      const { x, z } = st.warp;
      let spot: { x: number; z: number } | null = clearSpot(x, z) ? { x, z } : null;
      for (let r = 1.5; !spot && r <= 24; r += 1.5)
        for (let k = 0; k < 16 && !spot; k++) {
          const a = (k / 16) * Math.PI * 2;
          if (clearSpot(x + Math.cos(a) * r, z + Math.sin(a) * r)) spot = { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r };
        }
      if (!spot && world.inBounds(x, z) && world.depthAt(x, z) > SWIM_DEPTH) spot = { x, z };
      if (spot) {
        const surf = world.waterSurface(spot.x, spot.z);
        const g = world.groundAt(spot.x, spot.z);
        p.set(spot.x, surf !== null && surf - g > SWIM_DEPTH ? surf - SWIM_SINK : g, spot.z);
        vel.current.set(0, 0, 0);
        player.vy = 0;
        player.grounded = true;
        player.pose = "stand";
        player.chillAt = 0;
        cameraSnap.pending = true;
        st.blinked(from, { x: p.x, y: p.y, z: p.z });
        sound.chime();
      }
    }

    const playing = st.phase === "playing" && !overlayOpen();
    input.enabled = playing;
    const inside = st.inside ? getInterior(st.inside) : null;
    const def = st.riding ? RIDES[st.riding] : null;
    const now0 = performance.now();
    const flying = !def && !inside && st.powerKind === "fly" && now0 < st.powerUntil;
    if (player.flying && !flying) {
      player.grounded = false;
      player.vy = 0;
    }
    player.flying = flying;
    boost = footBoost(st.powerKind && now0 < st.powerUntil ? st.powerKind : null, PETS.find((p) => p.id === st.petId)?.magic?.perk);

    const a: Axes = { dx: 0, dz: 0, mag: 0, run: false, jump: false };
    let scrolling = false;
    if (playing) {
      const m = readMoveAxes();
      state.camera.getWorldDirection(fwd);
      const fl = Math.hypot(fwd.x, fwd.z) || 1;
      const ux = fwd.x / fl;
      const uz = fwd.z / fl;
      a.dx = -uz * m.x + ux * m.y;
      a.dz = ux * m.x + uz * m.y;
      a.mag = m.mag;
      a.run = m.run;
      if (!inside && a.mag < 0.05 && Math.abs(input.scroll) > 0.05) {
        const near = world.nearestRoad(p.x, p.z, 80);
        if (near.index >= 0) {
          const dir = Math.sign(input.scroll);
          const ti = Math.min(world.road.count - 1, Math.max(0, near.index + dir * (def ? 24 : 14)));
          let tx = world.road.xs[ti] - p.x;
          let tz = world.road.zs[ti] - p.z;
          const tl = Math.hypot(tx, tz);
          if (tl > 0.3) {
            tx /= tl;
            tz /= tl;
            a.dx = tx;
            a.dz = tz;
            a.mag = Math.min(1, Math.abs(input.scroll) * 1.1);
            a.run = Math.abs(input.scroll) > 1.15;
            scrolling = true;
          }
        }
      }
    }
    input.scroll *= Math.exp(-2.6 * dt);
    if (Math.abs(input.scroll) < 0.03) input.scroll = 0;
    // a new move interrupts an emote
    if (a.mag > 0.2 && st.emoteAt && now0 - st.emoteAt < 6000 && now0 - st.emoteAt > 400) useGame.setState({ emoteAt: 0 });

    let moved: number;
    if (inside) moved = stepInside(inside, a, dt, raw, playing);
    else if (def) moved = stepRide(def, a, dt);
    else if (player.pose !== "stand") {
      // chilling outdoors with a juice: any move or jump gets you up again
      moved = 0;
      vel.current.set(0, 0, 0);
      if (playing && (a.mag > 0.3 || now0 - input.jumpAt < 250)) {
        input.jumpAt = 0;
        standUp();
      }
    } else moved = stepFoot(a, dt, raw, playing, flying, state.clock.elapsedTime);
    // animals (and your own pet) close enough to pat
    if (!inside) {
      // your own pet is always close by: only offer a cuddle when you stop and look at it
      const lookingAt = (q: { x: number; z: number; own?: boolean }) => {
        if (!q.own) return true;
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const l = Math.hypot(dx, dz) || 1;
        return player.speed < 0.4 && (dx * Math.sin(player.facing) + dz * Math.cos(player.facing)) / l > 0.55;
      };
      const free = !def && !flying && !player.swimming && (player.grounded || player.pose !== "stand");
      // up on a rooftop terrace: the hatch takes you back downstairs
      const hatch = free && p.y > 4 ? nearestHatch(p.x, p.y, p.z) : null;
      target.roof = hatch;
      const trophy = free && !hatch && player.pose === "stand" && nearTrophy(p.x, p.z);
      target.trophy = trophy;
      const chill = free && !hatch && !trophy && player.pose === "stand" ? nearestChill(p.x, p.y, p.z) : null;
      target.chill = chill;
      const c = free && !hatch && !chill && player.pose === "stand" ? nearestCreature(p.x, p.z, p.y, lookingAt) : null;
      target.creature = c;
      st.setNearAction(
        player.pose !== "stand"
          ? { kind: "stand", label: "Stand up" }
          : hatch
            ? { kind: "roof", label: "Head back downstairs" }
            : trophy
              ? { kind: "trophy", label: "Lift the trophy & celebrate" }
              : chill
              ? { kind: "chill", label: chill.kind === "swing" ? "Hop on the swing" : "Sip a juice & soak in the view" }
              : c
                ? c.person
                  ? { kind: "dap", label: "Bro dap — say wassup" }
                  : { kind: "pet", label: c.own ? `Pamper ${c.name}` : `Pet the ${c.name}` }
                : null,
      );
    } else {
      target.creature = null;
      target.roof = null;
      target.chill = null;
      target.trophy = false;
    }
    if (!def) {
      player.pitch *= Math.exp(-8 * dt);
      player.roll *= Math.exp(-8 * dt);
      player.afloat = false;
      air.current = false;
      lastYaw.current = player.facing;
    }
    st.setSwimming(player.swimming);

    const speed = def ? Math.abs(player.drive) : Math.min(moved, Math.hypot(vel.current.x, vel.current.z));
    if (!def && speed > 0.25) player.facing = dampAngle(player.facing, Math.atan2(vel.current.x, vel.current.z), TURN * dt);
    player.speed = speed;
    player.moving = speed > 0.3;
    player.scrolling = scrolling;
    if (player.moving || !player.grounded) player.lastMoveAt = state.clock.elapsedTime;
    if (def) {
      const v = st.riding === "yacht" ? rides.yacht : rides.land;
      v.x = p.x;
      v.y = p.y;
      v.z = p.z;
      v.yaw = player.facing;
    }
    if (!inside && islandDist(p.x, p.z) < OCEAN_LIMIT) {
      const near = world.nearestRoad(p.x, p.z, 40);
      if (near.index >= 0) player.progress = near.index / (world.road.count - 1);
    }
  });

  return null;
}
