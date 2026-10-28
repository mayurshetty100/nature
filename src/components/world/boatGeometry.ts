import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const tmp = new THREE.Color();
export function paint(g: THREE.BufferGeometry, hex: string) {
  const geo = g.index ? g.toNonIndexed() : g;
  tmp.set(hex);
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([tmp.r, tmp.g, tmp.b], i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
  if (geo.attributes.uv) geo.deleteAttribute("uv");
  return geo;
}

/** Sleek private yacht: tapered hull, teak decks, two-tier cabin with a glass band, flybridge, rails and a radar mast. Bow along +Z. */
export function yachtGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.5, 0);
  hullShape.lineTo(1.5, 0);
  hullShape.lineTo(2.0, 1.25);
  hullShape.lineTo(-2.0, 1.25);
  hullShape.closePath();
  const hull = new THREE.ExtrudeGeometry(hullShape, { depth: 10, bevelEnabled: false });
  hull.translate(0, -0.45, -5);
  const p = hull.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    if (z > 1.8) {
      const t = (z - 1.8) / 3.2;
      p.setX(i, p.getX(i) * (1 - t * 0.9));
      p.setY(i, p.getY(i) + t * 0.45);
    }
  }
  hull.computeVertexNormals();
  parts.push(paint(hull, "#fbfbf8"));
  const stripe = new THREE.BoxGeometry(4.05, 0.18, 7.4);
  stripe.translate(0, 0.42, -0.9);
  parts.push(paint(stripe, "#1f5fa8"));
  const boot = new THREE.BoxGeometry(3.05, 0.25, 9.2);
  boot.translate(0, -0.32, -0.4);
  parts.push(paint(boot, "#1d2c3c"));
  const deck = new THREE.BoxGeometry(3.7, 0.12, 8.4);
  deck.translate(0, 0.86, -0.7);
  parts.push(paint(deck, "#c99e6a"));
  const swim = new THREE.BoxGeometry(3.2, 0.1, 0.9);
  swim.translate(0, 0.2, -5.4);
  parts.push(paint(swim, "#c99e6a"));
  // lower saloon with a wraparound glass band
  const cabin = new THREE.BoxGeometry(2.8, 1.25, 4.2);
  cabin.translate(0, 1.55, -0.7);
  parts.push(paint(cabin, "#ffffff"));
  const glass = new THREE.BoxGeometry(2.86, 0.5, 3.8);
  glass.translate(0, 1.7, -0.65);
  parts.push(paint(glass, "#2e4f6c"));
  const wind = new THREE.BoxGeometry(2.5, 0.75, 0.08);
  wind.rotateX(-0.5);
  wind.translate(0, 1.6, 1.55);
  parts.push(paint(wind, "#2e4f6c"));
  // flybridge
  const fly = new THREE.BoxGeometry(2.5, 0.12, 3.0);
  fly.translate(0, 2.25, -1.2);
  parts.push(paint(fly, "#f2f2ee"));
  const hard = new THREE.BoxGeometry(2.3, 0.08, 2.2);
  hard.translate(0, 3.35, -1.4);
  parts.push(paint(hard, "#ffffff"));
  for (const sx of [-1, 1])
    for (const sz of [-2.3, -0.5]) {
      const post = new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5);
      post.translate(sx * 1.0, 2.82, sz);
      parts.push(paint(post, "#d9dde0"));
    }
  const helm = new THREE.BoxGeometry(0.9, 0.55, 0.5);
  helm.translate(0, 2.55, 0.0);
  parts.push(paint(helm, "#e8e8e2"));
  const mast = new THREE.CylinderGeometry(0.05, 0.06, 1.4, 6);
  mast.translate(0, 4.05, -1.6);
  parts.push(paint(mast, "#d9dde0"));
  const radar = new THREE.BoxGeometry(0.9, 0.1, 0.18);
  radar.translate(0, 4.5, -1.6);
  parts.push(paint(radar, "#f4f4f0"));
  // bow + side rails
  for (const sx of [-1, 1]) {
    for (let z = -4.6; z <= 3.4; z += 1.0) {
      const w = z > 1.8 ? 1.8 * (1 - (z - 1.8) / 3.4) : 1.8;
      const post = new THREE.CylinderGeometry(0.025, 0.025, 0.55, 4);
      post.translate(sx * w, 1.2, z);
      parts.push(paint(post, "#d9dde0"));
    }
    const rail = new THREE.CylinderGeometry(0.03, 0.03, 8, 4);
    rail.rotateX(Math.PI / 2);
    rail.translate(sx * 1.8, 1.47, -0.6);
    parts.push(paint(rail, "#d9dde0"));
  }
  // sun loungers on the bow
  for (const sx of [-0.55, 0.55]) {
    const pad = new THREE.BoxGeometry(0.9, 0.16, 1.7);
    pad.rotateX(-0.12);
    pad.translate(sx, 1.02, 2.6);
    parts.push(paint(pad, "#eef3f6"));
  }
  return mergeGeometries(parts, false)!;
}
