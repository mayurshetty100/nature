/** Cross-component camera flags (mutable, per-frame). */
export const cameraSnap = { pending: false };

/** Horizontal facing of the camera (radians, atan2(x, z) convention) for the HUD compass. */
export const cameraView = { yaw: 0 };

/** Road direction to the next key point (atan2(x, z) yaw), shared with the HUD compass. */
export const guide = { yaw: 0, active: false };

/** Dev play-testing only: when set, the camera sits here looking at `look`. */
export const cameraDebug: { pos: [number, number, number] | null; look: [number, number, number] } = { pos: null, look: [0, 0, 0] };
