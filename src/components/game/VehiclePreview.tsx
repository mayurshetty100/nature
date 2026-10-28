import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { RIDES, type VehicleId } from "@/game/vehicles";
import type { Wheel } from "@/components/world/vehicleModel";
import { buildRide } from "@/components/world/supercarModel";

function Turntable({ children, wheels }: { children: React.ReactNode; wheels?: Wheel[] }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (g.current) g.current.rotation.y += Math.min(dt, 0.05) * 0.5;
    const steer = Math.sin(clock.elapsedTime * 0.8) * 0.35;
    for (const w of wheels ?? []) w.node.rotation.set(0, w.front ? steer : 0, 0, "YXZ");
  });
  return (
    <group ref={g} rotation-y={0.9}>
      {children}
    </group>
  );
}

type Fit = { reach: number; height: number };

/** Frames the whole ride in the box whatever its shape — narrow phone tiles included — so nothing is cut off while it turns. */
function FitCamera({ fit }: { fit: Fit }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  useLayoutEffect(() => {
    const aspect = width / Math.max(1, height);
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    const tilt = 0.34; // ~19° look-down
    const { reach, height: h } = fit;
    // widest the ride gets while turning is its half-diagonal; its nearest corner sits ~reach closer to the lens
    const dW = (reach * 1.06) / Math.tan(hHalf) + reach * 0.55;
    const halfH = (h / 2) * Math.cos(tilt) + reach * Math.sin(tilt);
    const dH = (halfH * 1.1) / Math.tan(vHalf) + reach * 0.55;
    const dist = Math.max(dW, dH);
    const target = new THREE.Vector3(0, h * 0.45, 0);
    camera.position.set(0, target.y + Math.sin(tilt) * dist, Math.cos(tilt) * dist);
    camera.near = Math.max(0.05, dist - reach * 2);
    camera.far = dist + reach * 3;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, width, height, fit]);
  return null;
}

function Ride({ id }: { id: VehicleId }) {
  const { model, wheels } = useMemo(() => buildRide(id, RIDES[id]), [id]);
  const { fit, offset } = useMemo(() => {
    model.updateMatrixWorld(true);
    // measure the body only — nitro plumes trail far behind but are hidden while parked
    const skip = new Set<THREE.Object3D>();
    const plumes = (model.userData.nitro ?? []) as THREE.Object3D[];
    for (const p of plumes) p.traverse((o) => skip.add(o));
    const box = new THREE.Box3();
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !skip.has(o)) box.expandByObject(o);
    });
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    return {
      fit: { reach: Math.hypot(size.x, size.z) / 2, height: size.y } satisfies Fit,
      // spin about the ride's own middle so it stays centred in the box
      offset: [-c.x, -box.min.y, -c.z] as [number, number, number],
    };
  }, [model]);
  return (
    <>
      <FitCamera fit={fit} />
      <Turntable wheels={wheels}>
        <group position={offset}>
          <primitive object={model} />
        </group>
      </Turntable>
    </>
  );
}

/** Slowly turning 3D preview of the chosen ride. */
export default function VehiclePreview({ vehicleId }: { vehicleId: VehicleId }) {
  const def = RIDES[vehicleId];
  return (
    <Canvas dpr={[1, 1.75]} camera={{ fov: 30, position: [0, 4, 10] }} gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}>
      <ambientLight intensity={0.8} color="#ffe9d2" />
      <hemisphereLight args={["#fff4e0", "#5d7a4a", 0.8]} />
      <directionalLight position={[3, 5, 4]} intensity={2.4} color="#ffd9a8" />
      <directionalLight position={[-4, 2, -3]} intensity={1} color="#9fc4ff" />
      <Environment resolution={64} environmentIntensity={0.7}>
        <Lightformer intensity={2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} color="#fff1dc" />
        <Lightformer intensity={1.2} position={[6, 1.5, -3]} rotation-y={-Math.PI / 2} scale={[12, 2, 1]} color="#ffc48a" />
        <Lightformer intensity={0.9} position={[-6, 1.5, 3]} rotation-y={Math.PI / 2} scale={[12, 2, 1]} color="#9fc4ff" />
      </Environment>
      <Suspense fallback={null}>
        <Ride key={vehicleId} id={vehicleId} />
      </Suspense>
      <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={def.kind === "bike" ? 4 : 8} blur={2.4} far={2} />
    </Canvas>
  );
}
