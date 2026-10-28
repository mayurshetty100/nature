/**
 * Input state shared by the scene. Mutable object read inside useFrame —
 * never React state, so input never causes re-renders.
 */
export const input = {
  keys: new Set<string>(),
  joyX: 0,
  joyY: 0,
  joyActive: false,
  /** scroll/swipe-to-walk impulse, positive = forward along the road */
  scroll: 0,
  /** accumulated camera drag in pixels since last frame */
  dragX: 0,
  dragY: 0,
  lastDragAt: 0,
  /** camera distance multiplier from pinch / ctrl+wheel (1 = default, <1 closer, >1 further) */
  zoom: 1,
  run: false,
  enabled: false,
  /** performance.now() of the last jump press (buffered briefly) */
  jumpAt: 0,
};

/** Ask the explorer to jump (keyboard Space or the touch Jump button). */
export function requestJump() {
  if (input.enabled) input.jumpAt = performance.now();
}

const MOVE_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyC",
  "ShiftLeft",
  "ShiftRight",
]);

function isTypingTarget(t: EventTarget | null) {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

export function clearInput() {
  input.keys.clear();
  input.joyX = 0;
  input.joyY = 0;
  input.joyActive = false;
  input.scroll = 0;
  input.dragX = 0;
  input.dragY = 0;
  input.run = false;
}

export function readMoveAxes() {
  const k = input.keys;
  let x = 0;
  let y = 0;
  if (k.has("KeyW") || k.has("ArrowUp")) y += 1;
  if (k.has("KeyS") || k.has("ArrowDown")) y -= 1;
  if (k.has("KeyD") || k.has("ArrowRight")) x += 1;
  if (k.has("KeyA") || k.has("ArrowLeft")) x -= 1;
  if (input.joyActive) {
    x += input.joyX;
    y += input.joyY;
  }
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  const run = input.run || k.has("ShiftLeft") || k.has("ShiftRight") || (input.joyActive && Math.hypot(input.joyX, input.joyY) > 0.92);
  return { x, y, mag: Math.min(1, len), run };
}

/** Attach global keyboard listeners. Returns cleanup. */
export function attachKeyboard(handlers: { onKey?: (code: string, e: KeyboardEvent) => void }) {
  const down = (e: KeyboardEvent) => {
    if (isTypingTarget(e.target)) return;
    if (e.code === "Space" && input.enabled) {
      e.preventDefault();
      input.keys.add("Space");
      if (!e.repeat) requestJump();
      return;
    }
    if (MOVE_CODES.has(e.code)) {
      if (input.enabled) {
        input.keys.add(e.code);
        if (e.code.startsWith("Arrow")) e.preventDefault();
      }
    }
    if (!e.repeat) handlers.onKey?.(e.code, e);
  };
  const up = (e: KeyboardEvent) => {
    if (e.code === "Space" && input.enabled && !isTypingTarget(e.target)) e.preventDefault();
    input.keys.delete(e.code);
  };
  const blur = () => clearInput();
  const vis = () => {
    if (document.hidden) clearInput();
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", vis);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
    document.removeEventListener("visibilitychange", vis);
  };
}

/**
 * Pointer + wheel handling on the canvas wrapper:
 *  - wheel / trackpad scroll → spin the camera round the explorer (360°), he stays put
 *  - mouse drag / one-finger swipe → look around (yaw + tilt)
 * Walking is WASD / arrows on a keyboard and the joystick on phones.
 */
/** Camera zoom limits for pinch / ctrl+wheel. */
export const ZOOM_MIN = 0.45;
export const ZOOM_MAX = 2.2;
export function zoomBy(f: number) {
  input.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, input.zoom * f));
}

export function attachPointer(el: HTMLElement) {
  let active: { id: number; x: number; y: number; type: string } | null = null;
  // two-finger pinch: every touch on the canvas, so a second finger turns a swipe into a zoom
  const touches = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;
  const spread = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : 1;
    // trackpad pinch (ctrl+wheel) zooms the camera — also on the opening overview
    if (e.ctrlKey) {
      zoomBy(Math.exp(e.deltaY * k * 0.01));
      return;
    }
    if (!input.enabled) return;
    // vertical and sideways scroll both orbit the view; shift+scroll tilts it
    if (e.shiftKey) input.dragY += e.deltaY * k * 0.35;
    else input.dragX += (e.deltaY + e.deltaX) * k * 0.45;
    input.lastDragAt = performance.now();
  };
  const pdown = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        pinchDist = spread();
        active = null; // stop looking around while pinching
      }
    }
    if (active || touches.size > 1) return;
    active = { id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType };
    el.setPointerCapture?.(e.pointerId);
  };
  const pmove = (e: PointerEvent) => {
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const d = spread();
        if (pinchDist > 0 && d > 0) zoomBy(pinchDist / d);
        pinchDist = d;
        return;
      }
    }
    if (!active || e.pointerId !== active.id || !input.enabled) return;
    const dx = e.clientX - active.x;
    const dy = e.clientY - active.y;
    active.x = e.clientX;
    active.y = e.clientY;
    if (active.type === "touch") {
      // swipe anywhere to look all the way round; the joystick does the walking
      input.dragX += dx * 1.25;
      input.dragY += dy * 0.6;
      input.lastDragAt = performance.now();
    } else {
      input.dragX += dx;
      input.dragY += dy;
      input.lastDragAt = performance.now();
    }
  };
  const pup = (e: PointerEvent) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinchDist = 0;
    if (active && e.pointerId === active.id) active = null;
  };
  el.addEventListener("wheel", wheel, { passive: false });
  el.addEventListener("pointerdown", pdown);
  el.addEventListener("pointermove", pmove);
  el.addEventListener("pointerup", pup);
  el.addEventListener("pointercancel", pup);
  el.addEventListener("lostpointercapture", pup);
  return () => {
    el.removeEventListener("wheel", wheel);
    el.removeEventListener("pointerdown", pdown);
    el.removeEventListener("pointermove", pmove);
    el.removeEventListener("pointerup", pup);
    el.removeEventListener("pointercancel", pup);
    el.removeEventListener("lostpointercapture", pup);
  };
}
