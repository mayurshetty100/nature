import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { player, rides, useGame, type RideId } from "@/game/store";
import { MOUNT_REACH, YACHT_REACH } from "@/game/ride";
import { nearestDoor } from "@/game/buildings";
import { getWorld } from "@/game/world";
import { guide } from "./cameraState";
import { allVisited, nextStop, STOPS, STOP_BY_ID, type StopId } from "@/game/stops";

/** Direction of travel toward the target stop along the road. */
function routeDirection(out: THREE.Vector2) {
  const w = getWorld();
  const st = useGame.getState();
  const p = player.position;
  const near = w.nearestRoad(p.x, p.z, 80);
  if (near.index < 0 || !st.targetStop) return null;
  const target = w.stopRoadIndex[st.targetStop];
  if (near.dist > 6) {
    out.set(w.road.xs[near.index] - p.x, w.road.zs[near.index] - p.z).normalize();
    return { index: near.index, target, sign: Math.sign(target - near.index) || 1, offRoad: true };
  }
  const sign = Math.sign(target - near.index) || 1;
  const j = Math.min(w.road.count - 1, Math.max(0, near.index + sign * 10));
  out.set(w.road.xs[j] - p.x, w.road.zs[j] - p.z);
  if (out.lengthSq() < 0.01) out.set(Math.sin(player.facing), Math.cos(player.facing));
  out.normalize();
  return { index: near.index, target, sign, offRoad: false };
}

/** A soft chevron at the explorer's feet pointing along the road to the next key point. */
export function Guidance() {
  const arrow = useRef<THREE.Group>(null);
  const dir = useMemo(() => new THREE.Vector2(), []);
  const w = getWorld();
  const yaw = useRef(0);

  const chevron = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.55);
    s.lineTo(0.5, -0.05);
    s.lineTo(0.28, -0.05);
    s.lineTo(0, 0.28);
    s.lineTo(-0.28, -0.05);
    s.lineTo(-0.5, -0.05);
    s.closePath();
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    g.scale(1, 1, -1);
    return g;
  }, []);

  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const st = useGame.getState();
    const t = clock.elapsedTime;
    const info = st.phase === "playing" && st.targetStop ? routeDirection(dir) : null;
    guide.active = !!info;
    if (!arrow.current) return;
    arrow.current.visible = !!info && !st.riding && st.distToTarget > 8;
    if (!info) return;
    const target = Math.atan2(dir.x, dir.y);
    let dd = target - yaw.current;
    dd = Math.atan2(Math.sin(dd), Math.cos(dd));
    yaw.current += dd * Math.min(1, dt * 8);
    guide.yaw = yaw.current;
    const p = player.position;
    const ax = p.x + Math.sin(yaw.current) * 2.2;
    const az = p.z + Math.cos(yaw.current) * 2.2;
    arrow.current.position.set(ax, w.groundAt(ax, az) + 0.12 + Math.sin(t * 3) * 0.03, az);
    arrow.current.rotation.y = yaw.current;
  });

  return (
    <group ref={arrow} visible={false} scale={0.8}>
      <mesh geometry={chevron} position={[0, 0, 0.2]}>
        <meshBasicMaterial color="#fffaf0" transparent opacity={0.7} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={chevron} position={[0, 0, -0.45]} scale={0.75}>
        <meshBasicMaterial color="#fffaf0" transparent opacity={0.35} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/**
 * Tracks the journey ~5x/sec. Hotspots can be visited in any order; the arrow
 * points to the nearest one you haven't seen yet.
 */
export function NavTracker() {
  const acc = useRef(0);
  const w = getWorld();
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.2) return;
    acc.current = 0;
    const st = useGame.getState();
    if (st.phase !== "playing") return;
    const p = player.position;
    if (st.inside) {
      st.setNear(null);
      return;
    }
    let current: StopId | null = null;
    let best = Infinity;
    for (const s of STOPS) {
      const d = Math.min(Math.hypot(p.x - s.x, p.z - s.z), Math.hypot(p.x - s.lx, p.z - s.lz));
      if (d < s.radius && !st.visited.includes(s.id)) {
        // any order: every hotspot tells its story the first time you arrive
        st.visit(s.id);
        st.showStory(s.id);
        if (allVisited(useGame.getState().visited)) st.celebrate();
      }
      if (d < s.radius * 2 && d < best) {
        best = d;
        current = s.id;
      }
    }
    let nearVehicle: RideId | null = null;
    if (!st.riding && !player.flying) {
      const y = rides.yacht;
      const l = rides.land;
      if (y.placed && Math.hypot(p.x - y.x, p.z - y.z) < YACHT_REACH) nearVehicle = "yacht";
      else if (l.placed && Math.hypot(p.x - l.x, p.z - l.z) < MOUNT_REACH) nearVehicle = st.vehicleId;
    }
    st.setNearDoor(!st.riding && !player.flying ? (nearestDoor(p.x, p.y, p.z, 3)?.id ?? null) : null);
    st.setNear(nearVehicle);
    const vis = useGame.getState().visited;
    let next = nextStop(vis, p);
    // stick with the current suggestion unless another hotspot is clearly closer (no flip-flopping)
    const cur = st.targetStop;
    if (next && cur && cur !== next && !vis.includes(cur)) {
      const dc = Math.hypot(p.x - STOP_BY_ID[cur].x, p.z - STOP_BY_ID[cur].z);
      const dn = Math.hypot(p.x - STOP_BY_ID[next].x, p.z - STOP_BY_ID[next].z);
      if (dc < dn * 1.35 + 12) next = cur;
    }
    let dist = 0;
    if (next) {
      const near = w.nearestRoad(p.x, p.z, 80);
      const ts = STOP_BY_ID[next];
      dist = near.index >= 0 ? Math.abs(w.stopRoadIndex[next] - near.index) * 0.5 + near.dist : Math.hypot(p.x - ts.x, p.z - ts.z);
    }
    st.setNav(current, next, dist);
  });
  return null;
}
