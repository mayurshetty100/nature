import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import {
  beachWeight,
  getWorld,
  islandDist,
  RIVER_HALF,
  ROAD_HALF,
  smoothstep,
  TERRAIN_D,
  TERRAIN_SEG_X,
  TERRAIN_SEG_Z,
  TERRAIN_W,
} from "@/game/world";
import { makeOceanMaterial, makeRiverMaterial, makeWaterfallMaterial } from "./materials";
import { timeUniform as timeUniformRef } from "@/game/store";
import { daylight } from "@/game/dayCycle";
import { zoneAt } from "@/game/zones";
import { getLayout } from "@/game/layout";
import { rng } from "@/game/world";
import { getFalls } from "@/game/falls";


export function SkyDome() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uSun: { value: daylight.sunDir },
          uTop: { value: daylight.skyTop },
          uMid: { value: daylight.skyMid },
          uHorizon: { value: daylight.horizon },
          uSunCol: { value: daylight.sunColor },
          uNight: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uSun; uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uSunCol; uniform float uNight;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 col = mix(uHorizon, uMid, smoothstep(0.04, 0.32, h));
            col = mix(col, uTop, smoothstep(0.22, 0.75, h));
            float s = max(dot(d, normalize(uSun)), 0.0);
            float disc = pow(s, 900.0) * 3.0;
            col += uSunCol * (disc * (1.0 + uNight) + (pow(s, 60.0) * 0.35 + pow(s, 6.0) * 0.18) * (1.0 - uNight * 0.7));
            col = mix(col, uHorizon * 1.02, smoothstep(0.02, -0.15, h));
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  );
  const stars = useMemo(() => {
    const r = rng(2024);
    const pos = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.05;
      const rr = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(th) * rr * 800;
      pos[i * 3 + 1] = y * 800;
      pos[i * 3 + 2] = Math.sin(th) * rr * 800;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const starMat = useMemo(() => new THREE.PointsMaterial({ color: "#ffffff", size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }), []);
  const starsRef = useRef<THREE.Points>(null);
  useFrame(({ camera, clock }) => {
    ref.current?.position.copy(camera.position);
    starsRef.current?.position.copy(camera.position);
    mat.uniforms.uNight.value = daylight.night;
    starMat.opacity = Math.max(0, daylight.night - 0.25) * (0.85 + Math.sin(clock.elapsedTime * 2) * 0.1);
    if (starsRef.current) starsRef.current.visible = daylight.night > 0.25;
  });
  return (
    <group>
      <mesh ref={ref} material={mat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[900, 32, 16]} />
      </mesh>
      <points ref={starsRef} geometry={stars} material={starMat} renderOrder={-9} frustumCulled={false} />
    </group>
  );
}

const C = (hex: string) => new THREE.Color(hex);

const REGION_GRASS: [string, string][] = [
  ["#a4d65f", "#79bd48"], // meadow
  ["#5f9c3f", "#4a8536"], // forest
  ["#b2cc5c", "#8fbb4c"], // fields
  ["#93c752", "#73ad43"], // village
  ["#8fc057", "#76a948"], // city
  ["#86b24f", "#6a9a42"], // cliffs
  ["#a2cc5e", "#86b84e"], // harbor
];

export function Terrain() {
  const geom = useMemo(() => {
    const w = getWorld();
    const layout = getLayout();
    const g = new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, TERRAIN_SEG_X, TERRAIN_SEG_Z);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, w.heights[i]);
    g.computeVertexNormals();
    const nrm = g.attributes.normal as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const grassA = REGION_GRASS.map(([a]) => C(a));
    const grassB = REGION_GRASS.map(([, b]) => C(b));
    const grassC = C("#c4d873");
    const pine = C("#4f8a43");
    const rock = C("#a39586");
    const rockWarm = C("#c2a688");
    const rockDark = C("#6e625a");
    const snow = C("#f6f3ee");
    const dirt = C("#c9a36f");
    const bank = C("#d9c48f");
    const bed = C("#5f9aa0");
    const plazaStone = C("#d8c7a4");
    const soil = C("#9a7247");
    const soilDark = C("#7d5a37");
    const wheatGold = C("#d8bb5a");
    const savannaGround = C("#d7c46c");
    const meadowGround = C("#9ad65e");
    const pave = C("#cfc7ba");
    const sand = C("#efdcaa");
    const wetSand = C("#b89d72");
    const sandWarm = C("#e8c98e");
    const sandPale = C("#f7ead0");
    const col = new THREE.Color();
    const tmp = new THREE.Color();
    const regionCol = new THREE.Color();
    const OFF = [
      [5, 3],
      [-4, 5],
      [-5, -3],
      [3, -5],
    ];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const ny = nrm.getY(i);
      const n1 = 0.5 + 0.5 * Math.sin(x * 0.21 + 1) * Math.sin(z * 0.17 - 2);
      const n2 = 0.5 + 0.5 * Math.sin(x * 0.07 - z * 0.05 + 3);
      // region grass, softly blended across borders
      regionCol.setRGB(0, 0, 0);
      for (const [ox, oz] of OFF) {
        const r = w.regionIndexAt(x + ox, z + oz);
        tmp.copy(grassB[r]).lerp(grassA[r], n1);
        regionCol.r += tmp.r / 4;
        regionCol.g += tmp.g / 4;
        regionCol.b += tmp.b / 4;
      }
      col.copy(regionCol);
      col.lerp(grassC, n2 * 0.25);
      if (y > 10) col.lerp(pine, smoothstep(10, 16, y) * 0.7);
      // river bed + banks
      const rv = w.nearestRiver(x, z, RIVER_HALF + 3).dist;
      if (rv < RIVER_HALF + 2.5) {
        col.lerp(bank, 1 - smoothstep(RIVER_HALF, RIVER_HALF + 2.5, rv));
        if (rv < RIVER_HALF) col.lerp(bed, 1 - smoothstep(RIVER_HALF * 0.4, RIVER_HALF, rv));
      }
      // zone ground: savanna gold, lush meadows, city pavement
      const zn = zoneAt(x, z, 3);
      if (zn) {
        const f = 1 - smoothstep(zn.r - 3, zn.r + 3, Math.hypot(x - zn.x, z - zn.z));
        if (zn.kind === "savanna") col.lerp(savannaGround, f * 0.65);
        else if (zn.kind === "meadow") col.lerp(meadowGround, f * 0.45);
        else if (zn.kind === "city") col.lerp(pave, smoothstep(0.15, 0.6, f) * 0.92);
      }
      // farm plots: furrowed soil, golden wheat
      for (const p of layout.plots) {
        const ex = Math.abs(x - p.x) - p.w / 2;
        const ez = Math.abs(z - p.z) - p.d / 2;
        if (ex > 1.2 || ez > 1.2) continue;
        const inside = 1 - smoothstep(-0.4, 1.2, Math.max(ex, ez));
        const rows = 0.5 + 0.5 * Math.sin(((z - p.z) / 0.8) * Math.PI);
        tmp.copy(soil).lerp(soilDark, rows);
        if (p.crop === "wheat") tmp.lerp(wheatGold, 0.75);
        col.lerp(tmp, inside);
      }
      // village plaza cobbles
      {
        const pl = layout.plaza;
        const pd = Math.hypot(x - pl.x, z - pl.z);
        if (pd < pl.r + 2) col.lerp(plazaStone, (1 - smoothstep(pl.r - 1, pl.r + 1.5, pd)) * 0.9);
      }
      // road shoulders (pavement in the city)
      const rr = w.nearestRoad(x, z, ROAD_HALF + 5);
      if (rr.dist < ROAD_HALF + 4.5) {
        const city = w.roadRegion[rr.index] === 4;
        if (city) col.lerp(pave, 1 - smoothstep(ROAD_HALF + 3, ROAD_HALF + 4.5, rr.dist));
        else col.lerp(dirt, (1 - smoothstep(ROAD_HALF, ROAD_HALF + 1.8, rr.dist)) * 0.85);
      }
      // sandy east coast
      const bw = beachWeight(x, z);
      if (bw > 0) {
        const s2 = bw * (1 - smoothstep(2.6, 3.6, y));
        const ripple = 0.5 + 0.5 * Math.sin(x * 1.3 + Math.sin(z * 0.4) * 2) * Math.sin(z * 0.9 - x * 0.2);
        tmp.copy(sandWarm).lerp(sand, smoothstep(0.6, 2.2, y));
        tmp.lerp(sandPale, smoothstep(1.8, 3.0, y) * 0.6 + ripple * 0.12);
        col.lerp(tmp, s2);
        if (y < 0.7) col.lerp(wetSand, bw * smoothstep(0.7, -0.3, y));
      }
      // rock on steep slopes, cliffs and high peaks; snow on the summits
      const steep = smoothstep(0.86, 0.6, ny);
      const d = islandDist(x, z);
      const cliff = smoothstep(0.92, 0.95, d) * (1 - bw);
      const high = smoothstep(14, 19, y) * 0.8;
      const r = Math.max(steep, cliff, high);
      if (r > 0) {
        tmp.copy(rock).lerp(rockWarm, 0.5 + 0.5 * Math.sin(y * 1.9 + x * 0.05));
        if (y < 1.5) tmp.lerp(rockDark, smoothstep(1.5, -1, y));
        col.lerp(tmp, r);
      }
      if (y > 20) col.lerp(snow, smoothstep(20, 23, y) * (0.5 + 0.5 * ny));
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);
  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
    </mesh>
  );
}

export function Ocean() {
  const mat = useMemo(() => {
    const m = makeOceanMaterial();
    m.uniforms.uDeep.value = daylight.oceanDeep;
    m.uniforms.uShallow.value = daylight.oceanShallow;
    m.uniforms.uSun.value = daylight.sunColor;
    m.uniforms.uSky.value = daylight.horizon;
    m.uniforms.uSunDir.value = daylight.sunDir;
    return m;
  }, []);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0} material={mat}>
      <planeGeometry args={[1600, 1600, 1, 1]} />
    </mesh>
  );
}

/** River ribbon + waterfall where it leaves the island. */
export function River() {
  const { geom, fall } = useMemo(() => {
    const w = getWorld();
    const r = w.river;
    const verts: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    let last = 0;
    let n = 0;
    for (let i = 0; i < r.count; i++) {
      if (islandDist(r.xs[i], r.zs[i]) > 0.935) break;
      last = i;
      const j = Math.min(r.count - 1, i + 1);
      const k = Math.max(0, i - 1);
      const tx = r.xs[j] - r.xs[k];
      const tz = r.zs[j] - r.zs[k];
      const len = Math.hypot(tx, tz) || 1;
      const nx = -tz / len;
      const nz = tx / len;
      const half = RIVER_HALF + 0.7;
      verts.push(r.xs[i] - nx * half, r.ys[i], r.zs[i] - nz * half);
      verts.push(r.xs[i] + nx * half, r.ys[i], r.zs[i] + nz * half);
      uvs.push(0, r.cum[i] / 6, 1, r.cum[i] / 6);
      if (n > 0) {
        const a = (n - 1) * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      n++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const dx = r.xs[last] - r.xs[Math.max(0, last - 4)];
    const dz = r.zs[last] - r.zs[Math.max(0, last - 4)];
    const l = Math.hypot(dx, dz) || 1;
    return {
      geom: g,
      fall: { x: r.xs[last], z: r.zs[last], y: r.ys[last], dx: dx / l, dz: dz / l, width: (RIVER_HALF + 0.7) * 2 },
    };
  }, []);
  const mat = useMemo(() => makeRiverMaterial(0.9), []);
  return (
    <group>
      <mesh geometry={geom} material={mat} receiveShadow />
      <Waterfall x={fall.x} z={fall.z} top={fall.y} dirX={fall.dx} dirZ={fall.dz} width={fall.width} />
    </group>
  );
}

/** Curved falling-water sheet from a cliff top down to the sea. */
/** Sheet geometry: rows down the drop, columns across a slightly bowed curtain. */
function fallSheet(x: number, z: number, top: number, bottom: number, dirX: number, dirZ: number, width: number, reach: number, spread: number, push: number) {
  const rows = 22;
  const cols = 8;
  const nx = -dirZ;
  const nz = dirX;
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const out = Math.pow(t, 0.55) * reach + 0.4 + push;
    const y = top - (top - bottom) * Math.pow(t, 1.35);
    const wv = width * (0.8 + t * spread);
    for (let j = 0; j <= cols; j++) {
      const u = j / cols;
      const across = (u - 0.5) * wv;
      // the middle carries more water and bows out a touch
      const bow = Math.sin(u * Math.PI) * (0.18 + t * 0.25);
      verts.push(x + dirX * (out + bow) + nx * across, y, z + dirZ * (out + bow) + nz * across);
      uvs.push(u, 1 - t);
    }
    if (i > 0)
      for (let j = 0; j < cols; j++) {
        const a = (i - 1) * (cols + 1) + j;
        const c = a + cols + 1;
        idx.push(a, c, a + 1, a + 1, c, c + 1);
      }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

let mistTex: THREE.Texture | null = null;
function getMistTexture() {
  if (mistTex) return mistTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,0.9)");
  gr.addColorStop(0.45, "rgba(255,255,255,0.35)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  mistTex = new THREE.CanvasTexture(c);
  return mistTex;
}

/** Soft spray clouds billowing up and drifting off where the water lands. */
function Mist({ x, y, z, width, seed }: { x: number; y: number; z: number; width: number; seed: number }) {
  const N = 7;
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: getMistTexture(), transparent: true, depthWrite: false, opacity: 0.5, color: "#f4fbff", fog: true }), []);
  const mats = useMemo(() => Array.from({ length: N }, () => mat.clone()), [mat]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.35 + seed;
    for (let i = 0; i < N; i++) {
      const s = refs.current[i];
      if (!s) continue;
      const k = (t + i / N) % 1; // each puff rises, swells and fades, then starts again
      const a = i * 2.4 + seed;
      s.position.set(x + Math.cos(a) * width * (0.3 + k * 0.5), y + 0.3 + k * width * 0.9, z + Math.sin(a) * width * (0.3 + k * 0.5));
      s.scale.setScalar(width * (0.9 + k * 1.6));
      mats[i].opacity = Math.sin(k * Math.PI) * 0.42;
    }
  });
  return (
    <group>
      {mats.map((m, i) => (
        <sprite key={i} ref={(el) => (refs.current[i] = el)} material={m} renderOrder={5} />
      ))}
    </group>
  );
}

export function Waterfall({
  x,
  z,
  top,
  dirX,
  dirZ,
  width,
  seed = 0,
  bottom = -0.2,
  reach = 6.5,
}: {
  x: number;
  z: number;
  top: number;
  dirX: number;
  dirZ: number;
  width: number;
  seed?: number;
  /** where the water lands */
  bottom?: number;
  /** how far out it arcs */
  reach?: number;
}) {
  const sheet = useMemo(() => fallSheet(x, z, top, bottom, dirX, dirZ, width, reach, 0.25, 0), [x, z, top, dirX, dirZ, width, bottom, reach]);
  const veil = useMemo(() => fallSheet(x, z, top - 0.2, bottom, dirX, dirZ, width * 1.15, reach, 0.55, 0.22), [x, z, top, dirX, dirZ, width, bottom, reach]);
  const mat = useMemo(() => {
    const m = makeWaterfallMaterial(0);
    m.uniforms.uSeed.value = seed * 7.3;
    return m;
  }, [seed]);
  const veilMat = useMemo(() => {
    const m = makeWaterfallMaterial(1);
    m.uniforms.uSeed.value = seed * 3.1 + 11;
    return m;
  }, [seed]);
  const bx = x + dirX * (reach + 0.5);
  const bz = z + dirZ * (reach + 0.5);
  const splash = useMemo(() => makeSplashMaterial(), []);
  return (
    <group>
      <mesh geometry={sheet} material={mat} renderOrder={2} />
      <mesh geometry={veil} material={veilMat} renderOrder={3} />
      <mesh position={[bx, bottom + 0.28, bz]} rotation-x={-Math.PI / 2} material={splash} renderOrder={4}>
        <circleGeometry args={[width * 1.5, 32]} />
      </mesh>
      <Mist x={bx} y={bottom} z={bz} width={width} seed={seed} />
      <Sparkles position={[bx, bottom + 1.2, bz]} count={40} scale={[width * 2, 2.2, width * 2]} size={5} speed={1.2} color="#ffffff" opacity={0.75} />
    </group>
  );
}

function makeSplashMaterial() {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float rings = smoothstep(0.75, 1.0, sin(d * 18.0 - uTime * 4.0) * 0.5 + 0.5);
        float core = 1.0 - smoothstep(0.0, 0.55, d);
        float a = (rings * 0.55 + core * 0.8) * (1.0 - smoothstep(0.7, 1.0, d));
        gl_FragColor = vec4(vec3(1.0), a * 0.85);
      }`,
  });
  m.uniforms.uTime = timeUniformRef;
  return m;
}

/** A few springs pouring off the cliffs around the island, like the reference art. */
export function CliffFalls() {
  const falls = useMemo(() => getFalls().cliff, []);
  const pool = useMemo(() => makeRiverMaterial(0.25), []);
  return (
    <group>
      {falls.map((f) => (
        <group key={f.seed}>
          {f.pool && (
            <mesh position={[f.pool.x, f.pool.y + 0.08, f.pool.z]} rotation-x={-Math.PI / 2} material={pool}>
              <circleGeometry args={[2.6, 20]} />
            </mesh>
          )}
          <Waterfall x={f.x} z={f.z} top={f.top} dirX={f.dirX} dirZ={f.dirZ} width={f.width} seed={f.seed} />
        </group>
      ))}
    </group>
  );
}

/** A tall fall tumbling off a rocky ledge into the river's source in the northern mountains. */
export function MountainFalls() {
  const f = useMemo(() => {
    const { mountain, rocks } = getFalls();
    return { lx: mountain.x, lz: mountain.z, top: mountain.top, bottom: mountain.bottom, ux: mountain.dirX, uz: mountain.dirZ, rocks };
  }, []);
  return (
    <group>
      {f.rocks.map((r, i) => (
        <mesh key={i} position={r.p} scale={r.s} rotation-y={r.r} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={i % 3 ? "#a8998a" : "#8f8274"} roughness={0.95} />
        </mesh>
      ))}
      <Waterfall x={f.lx} z={f.lz} top={f.top} dirX={f.ux} dirZ={f.uz} width={4.2} seed={9} bottom={f.bottom} reach={3.4} />
    </group>
  );
}
