import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getLayout } from "@/game/layout";
import { getWorld, rng } from "@/game/world";
import { seawalkDist } from "@/game/coast";
import { OceanLife } from "./OceanLife";

const tmp = new THREE.Color();
function paint(g: THREE.BufferGeometry, hex: string) {
  const geo = g.index ? g.toNonIndexed() : g;
  tmp.set(hex);
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = tmp.r;
    c[i * 3 + 1] = tmp.g;
    c[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
  if (geo.attributes.uv) geo.deleteAttribute("uv");
  return geo;
}

/** Leaning palms along the sand, merged into a single mesh. */
function Palms() {
  const geom = useMemo(() => {
    const w = getWorld();
    const parts: THREE.BufferGeometry[] = [];
    for (const p of getLayout().palms) {
      const base = w.gridHeight(p.x, p.z) - 0.2;
      const seg = 6;
      let x = 0;
      let y = 0;
      const dir = new THREE.Vector3(Math.cos(p.rot), 0, Math.sin(p.rot));
      for (let k = 0; k < seg; k++) {
        const len = p.h / seg;
        const bend = p.lean * (k / seg) * 1.6;
        const g = new THREE.CylinderGeometry(0.2 - k * 0.018, 0.24 - k * 0.018, len + 0.05, 7);
        g.rotateZ(-bend);
        g.rotateY(-p.rot);
        g.translate(p.x + dir.x * x, base + y + len / 2, p.z + dir.z * x);
        parts.push(paint(g, k % 2 ? "#9b7650" : "#8a6744"));
        x += Math.sin(bend) * len;
        y += Math.cos(bend) * len;
      }
      const tx = p.x + dir.x * x;
      const tz = p.z + dir.z * x;
      const ty = base + y;
      for (let f = 0; f < 8; f++) {
        const a = (f / 8) * Math.PI * 2 + p.rot;
        const leaf = new THREE.BoxGeometry(0.75, 0.06, 3.2);
        leaf.translate(0, 0, 1.6);
        leaf.rotateX(0.5 + (f % 2) * 0.25);
        leaf.rotateY(a);
        leaf.translate(tx, ty, tz);
        parts.push(paint(leaf, f % 2 ? "#4f9a3c" : "#62ad47"));
      }
      const nut = new THREE.IcosahedronGeometry(0.32, 0);
      nut.translate(tx, ty - 0.25, tz);
      parts.push(paint(nut, "#6b4a2b"));
    }
    return parts.length ? mergeGeometries(parts, false) : null;
  }, []);
  if (!geom) return null;
  return (
    <mesh geometry={geom} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.9} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Striped beach umbrellas and towels. */
function BeachProps() {
  const geom = useMemo(() => {
    const w = getWorld();
    const r = rng(303);
    const parts: THREE.BufferGeometry[] = [];
    const colors = ["#e85d4a", "#3f8fd8", "#f2b440", "#4cb38a"];
    let placed = 0;
    for (let n = 0; n < 600 && placed < 9; n++) {
      const x = 140 + r() * 30;
      const z = -40 + r() * 70;
      const h = w.gridHeight(x, z);
      if (h < 0.7 || h > 1.6) continue;
      if (w.nearestRoad(x, z, 8).dist < 5) continue;
      if (seawalkDist(x, z) < 4) continue;
      placed++;
      const c = colors[placed % colors.length];
      const pole = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5);
      pole.translate(x, h + 1.2, z);
      parts.push(paint(pole, "#f4efe6"));
      for (let s = 0; s < 8; s++) {
        const cone = new THREE.ConeGeometry(1.5, 0.6, 8, 1, true, (s / 8) * Math.PI * 2, Math.PI / 4);
        cone.translate(x, h + 2.5, z);
        parts.push(paint(cone, s % 2 ? "#ffffff" : c));
      }
      const towel = new THREE.BoxGeometry(0.9, 0.04, 1.9);
      towel.rotateY(r() * 3);
      towel.translate(x + 1.2, h + 0.03, z + 0.4);
      parts.push(paint(towel, colors[(placed + 1) % colors.length]));
    }
    return parts.length ? mergeGeometries(parts, false) : null;
  }, []);
  if (!geom) return null;
  return (
    <mesh geometry={geom} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

function sailboatGeometry(sail: string) {
  const parts: THREE.BufferGeometry[] = [];
  const hull = new THREE.BoxGeometry(1.6, 0.7, 4.6);
  hull.translate(0, 0.1, 0);
  parts.push(paint(hull, "#7a4b2b"));
  const mast = new THREE.CylinderGeometry(0.06, 0.06, 6, 5);
  mast.translate(0, 3.3, 0.2);
  parts.push(paint(mast, "#efe7da"));
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0, 5.2);
  shape.lineTo(2.6, 0);
  shape.closePath();
  const s1 = new THREE.ShapeGeometry(shape);
  s1.rotateY(-Math.PI / 2);
  s1.translate(0, 0.8, 0.3);
  parts.push(paint(s1, sail));
  return mergeGeometries(parts, false)!;
}

/** Sunset Harbor — palms, umbrellas, sailboats on the bay, playful dolphins and open-ocean life. */
export function Coast() {
  const sails = useMemo(() => [sailboatGeometry("#fff7ea"), sailboatGeometry("#ffd9b8")], []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }), []);
  const boatRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    boatRefs.current.forEach((b, i) => {
      if (!b) return;
      const a = t * 0.025 * (i ? -1 : 1) + i * 2.4;
      const cx = 228 + i * 18;
      const cz = -10 + i * 40;
      const R = 26 + i * 8;
      b.position.set(cx + Math.cos(a) * R, 0.3 + Math.sin(t * 1.3 + i) * 0.1, cz + Math.sin(a) * R);
      b.rotation.set(0, Math.atan2(-Math.sin(a), Math.cos(a)) * (i ? -1 : 1) + (i ? Math.PI : 0), Math.sin(t * 0.9 + i) * 0.06);
    });

  });

  return (
    <group>
      <Palms />
      <BeachProps />
      <OceanLife />
      {sails.map((g, i) => (
        <mesh
          key={i}
          ref={(el) => {
            boatRefs.current[i] = el;
          }}
          geometry={g}
          material={mat}
          castShadow
        />
      ))}

    </group>
  );
}
