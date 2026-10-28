import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Plinth } from "@/game/foundations";
import { paint } from "./boatGeometry";

/** Stone plinth geometry: rounded blocks with a capstone lip, sunk into the slope. */
export function plinthGeometry(list: Plinth[]) {
  const P: THREE.BufferGeometry[] = [];
  for (const p of list) {
    const h = p.top - p.bottom;
    const body = new RoundedBoxGeometry(p.w, h, p.d, 2, 0.12);
    body.translate(0, p.bottom + h / 2, 0);
    const cap = new RoundedBoxGeometry(p.w + 0.18, 0.16, p.d + 0.18, 2, 0.06);
    cap.translate(0, p.top - 0.08, 0);
    for (const [g, c] of [
      [body, "#a39a8c"],
      [cap, "#c9bfae"],
    ] as const) {
      g.rotateY(p.rot);
      g.translate(p.x, 0, p.z);
      P.push(paint(g, c));
    }
  }
  return P.length ? mergeGeometries(P, false) : null;
}

