import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { applyTime, daylight, timeForProgress } from "@/game/dayCycle";
import { player, useGame } from "@/game/store";
import { lanternMaterial, SHADOW_LAYER, windowMaterial } from "./constants";

const INTRO_TIME = 0.62;

/** Sun/moon, sky light and fog that change as the journey progresses. */
export function DayNight({ shadowSize }: { shadowSize: number }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const moon = useRef<THREE.Mesh>(null);
  const { scene } = useThree();
  const t = useRef(INTRO_TIME);
  const focus = useMemo(() => new THREE.Vector3(), []);
  const introFocus = useMemo(() => new THREE.Vector3(0, 4, 0), []);
  const snap = useMemo(() => ({ m: new THREE.Matrix4(), inv: new THREE.Matrix4(), v: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), o: new THREE.Vector3() }), []);

  const fogMix = useRef(1);
  useLayoutEffect(() => {
    if (sun.current) {
      scene.add(sun.current.target);
      sun.current.shadow.camera.layers.enable(SHADOW_LAYER);
    }
    if (!scene.fog) scene.fog = new THREE.Fog("#f3c6a5", 120, 420);
  }, [scene]);

  useFrame(({ camera }, raw) => {
    const dt = Math.min(raw, 0.1);
    const st = useGame.getState();
    const target = st.phase === "intro" ? INTRO_TIME : timeForProgress(player.progress);
    t.current += (target - t.current) * (1 - Math.exp(-1.3 * dt));
    applyTime(t.current);

    const fog = scene.fog as THREE.Fog;
    fog.color.copy(daylight.horizon);
    // wide haze for the opening overview, closer haze while exploring
    const intro = st.phase === "intro" ? 1 : 0;
    fogMix.current += (intro - fogMix.current) * (1 - Math.exp(-1.5 * dt));
    fog.near = 150 + fogMix.current * 220 - daylight.night * 40;
    fog.far = 640 + fogMix.current * 520 - daylight.night * 160;
    if (scene.background instanceof THREE.Color) scene.background.copy(daylight.horizon);
    else scene.background = daylight.horizon.clone();

    if (hemi.current) {
      hemi.current.color.copy(daylight.hemiSky);
      hemi.current.groundColor.copy(daylight.hemiGround);
      hemi.current.intensity = daylight.hemiIntensity;
    }
    if (amb.current) amb.current.intensity = daylight.ambient;
    lanternMaterial.emissiveIntensity = daylight.lanterns;
    windowMaterial.emissiveIntensity = 0.5 + daylight.night * 1.6;

    const l = sun.current;
    if (l) {
      focus.copy(st.phase === "intro" ? introFocus : player.position);
      // snap the shadow frame to whole shadow-map texels so edges don't crawl while you move
      {
        const r0 = st.phase === "intro" ? 90 : 38;
        const texel = (2 * r0) / shadowSize;
        snap.m.lookAt(snap.o, daylight.sunDir, snap.up);
        snap.inv.copy(snap.m).invert();
        snap.v.copy(focus).applyMatrix4(snap.inv);
        snap.v.x = Math.round(snap.v.x / texel) * texel;
        snap.v.y = Math.round(snap.v.y / texel) * texel;
        focus.copy(snap.v.applyMatrix4(snap.m));
      }
      l.position.set(focus.x + daylight.sunDir.x * 90, focus.y + daylight.sunDir.y * 90 + 10, focus.z + daylight.sunDir.z * 90);
      l.target.position.copy(focus);
      l.target.updateMatrixWorld();
      l.color.copy(daylight.sunColor);
      l.intensity = daylight.sunIntensity;
      const cam = l.shadow.camera as THREE.OrthographicCamera;
      const r = st.phase === "intro" ? 90 : 38;
      if (cam.right !== r) {
        cam.left = -r;
        cam.right = r;
        cam.top = r;
        cam.bottom = -r;
        cam.updateProjectionMatrix();
      }
    }
    if (moon.current) {
      moon.current.visible = daylight.night > 0.55;
      moon.current.position.copy(camera.position).addScaledVector(daylight.sunDir, 650);
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#ffe9d2", "#5f8a4f", 1.05]} />
      <ambientLight ref={amb} intensity={0.18} color="#ffe2c8" />
      <directionalLight
        ref={sun}
        intensity={2.6}
        castShadow
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-near={1}
        shadow-camera-far={240}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
      />
      <mesh ref={moon} visible={false}>
        <sphereGeometry args={[18, 24, 16]} />
        <meshBasicMaterial color="#f4f1ff" fog={false} toneMapped={false} />
      </mesh>
    </>
  );
}
