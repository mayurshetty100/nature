import * as THREE from "three";

const frustum = new THREE.Frustum();
const m = new THREE.Matrix4();
const sphere = new THREE.Sphere();
let stamp = -1;

/**
 * Cheap visibility test for things three can't frustum-cull itself
 * (skinned characters keep frustumCulled off because their bounds lie).
 * The frustum is rebuilt once per frame (keyed on the frame clock).
 */
export function inView(camera: THREE.Camera, time: number, x: number, y: number, z: number, r: number, far: number) {
  const dx = camera.position.x - x;
  const dz = camera.position.z - z;
  if (dx * dx + dz * dz > far * far) return false;
  if (time !== stamp) {
    stamp = time;
    m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(m);
  }
  sphere.center.set(x, y, z);
  sphere.radius = r;
  return frustum.intersectsSphere(sphere);
}
