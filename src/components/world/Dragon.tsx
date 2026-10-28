import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

const BODY = "#4cc276";
const BELLY = "#f7e6a2";
const WING = "#ff9a4d";
const HORN = "#fff3d6";
const EYE = "#ffffff";
const PUPIL = "#1d1f2b";

/**
 * Ember — a chunky little cube dragon in the same toy style as the cube pets.
 * About 1 unit tall, faces +z; wings flap and the tail sways on their own.
 */
export function DragonModel() {
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const flap = Math.sin(t * 9) * 0.55;
    if (wingL.current) wingL.current.rotation.z = 0.55 + flap;
    if (wingR.current) wingR.current.rotation.z = -0.55 - flap;
    if (tail.current) tail.current.rotation.y = Math.sin(t * 2.4) * 0.35;
    if (head.current) head.current.rotation.x = Math.sin(t * 1.7) * 0.06;
  });
  const mat = (color: string) => <meshStandardMaterial color={color} roughness={0.75} />;
  return (
    <group>
      {/* body + belly */}
      <RoundedBox args={[0.62, 0.52, 0.72]} radius={0.12} smoothness={3} position={[0, 0.42, 0]} castShadow>
        {mat(BODY)}
      </RoundedBox>
      <RoundedBox args={[0.46, 0.34, 0.08]} radius={0.04} smoothness={2} position={[0, 0.38, 0.35]}>
        {mat(BELLY)}
      </RoundedBox>
      {/* legs */}
      {[
        [0.2, 0.22],
        [-0.2, 0.22],
        [0.2, -0.22],
        [-0.2, -0.22],
      ].map(([x, z]) => (
        <RoundedBox key={`${x}${z}`} args={[0.16, 0.2, 0.18]} radius={0.05} smoothness={2} position={[x, 0.1, z]} castShadow>
          {mat(BODY)}
        </RoundedBox>
      ))}
      {/* head */}
      <group ref={head} position={[0, 0.86, 0.12]}>
        <RoundedBox args={[0.58, 0.5, 0.52]} radius={0.12} smoothness={3} castShadow>
          {mat(BODY)}
        </RoundedBox>
        <RoundedBox args={[0.36, 0.2, 0.18]} radius={0.06} smoothness={2} position={[0, -0.1, 0.3]}>
          {mat(BELLY)}
        </RoundedBox>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 0.15, 0.06, 0.265]}>
              <boxGeometry args={[0.15, 0.17, 0.02]} />
              <meshStandardMaterial color={EYE} roughness={0.4} />
            </mesh>
            <mesh position={[s * 0.13, 0.04, 0.28]}>
              <boxGeometry args={[0.08, 0.11, 0.02]} />
              <meshStandardMaterial color={PUPIL} roughness={0.3} />
            </mesh>
            <mesh position={[s * 0.11, 0.08, 0.292]}>
              <boxGeometry args={[0.03, 0.03, 0.01]} />
              <meshBasicMaterial color={EYE} />
            </mesh>
            {/* horns */}
            <mesh position={[s * 0.17, 0.33, -0.08]} rotation={[-0.4, 0, s * -0.25]} castShadow>
              <coneGeometry args={[0.06, 0.2, 4]} />
              {mat(HORN)}
            </mesh>
            {/* nostrils */}
            <mesh position={[s * 0.07, -0.05, 0.395]}>
              <boxGeometry args={[0.04, 0.03, 0.01]} />
              <meshStandardMaterial color="#2f7d4b" />
            </mesh>
          </group>
        ))}
      </group>
      {/* back spikes */}
      {[0.2, 0, -0.2].map((z, i) => (
        <mesh key={z} position={[0, 0.72 - i * 0.02, z - 0.05]} rotation-x={-0.3} castShadow>
          <coneGeometry args={[0.06, 0.16, 4]} />
          {mat(WING)}
        </mesh>
      ))}
      {/* wings */}
      {[
        [wingL, 1],
        [wingR, -1],
      ].map(([ref, s]) => (
        <group key={s as number} ref={ref as React.RefObject<THREE.Group>} position={[(s as number) * 0.28, 0.6, -0.05]}>
          <mesh position={[(s as number) * 0.3, 0.02, 0]} castShadow>
            <boxGeometry args={[0.72, 0.05, 0.46]} />
            {mat(WING)}
          </mesh>
          <mesh position={[(s as number) * 0.55, 0.03, -0.18]}>
            <boxGeometry args={[0.12, 0.06, 0.12]} />
            {mat(BODY)}
          </mesh>
        </group>
      ))}
      {/* tail */}
      <group ref={tail} position={[0, 0.34, -0.36]}>
        <RoundedBox args={[0.2, 0.18, 0.34]} radius={0.06} smoothness={2} position={[0, -0.03, -0.14]} castShadow>
          {mat(BODY)}
        </RoundedBox>
        <mesh position={[0, -0.02, -0.38]} rotation-x={-Math.PI / 2}>
          <coneGeometry args={[0.1, 0.18, 4]} />
          {mat(WING)}
        </mesh>
      </group>
    </group>
  );
}
