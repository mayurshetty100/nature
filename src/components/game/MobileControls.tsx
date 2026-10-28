import { useRef } from "react";
import { ChevronsUp } from "lucide-react";
import { input, requestJump } from "@/game/input";
import { useGame } from "@/game/store";
import { WorldButton } from "./WorldButton";

const RADIUS = 54;

function Joystick() {
  const knob = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);

  const update = (cx: number, cy: number) => {
    const r = base.current!.getBoundingClientRect();
    let dx = cx - (r.left + r.width / 2);
    let dy = cy - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / RADIUS;
    const ny = -dy / RADIUS;
    const m = Math.hypot(nx, ny);
    const dead = 0.12;
    const scale = m < dead ? 0 : (m - dead) / (1 - dead) / (m || 1);
    input.joyX = nx * scale;
    input.joyY = ny * scale;
    input.joyActive = true;
  };
  const end = () => {
    pid.current = null;
    input.joyX = 0;
    input.joyY = 0;
    input.joyActive = false;
    if (knob.current) knob.current.style.transform = "translate(0px, 0px)";
  };

  return (
    <div
      ref={base}
      className="glass-panel relative flex h-36 w-36 touch-none items-center justify-center rounded-full"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (pid.current !== null) return;
        pid.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== pid.current) return;
        e.stopPropagation();
        update(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => e.pointerId === pid.current && end()}
      onPointerCancel={(e) => e.pointerId === pid.current && end()}
      onLostPointerCapture={(e) => e.pointerId === pid.current && end()}
      role="application"
      aria-label="Movement joystick"
    >
      <div className="absolute inset-4 rounded-full border border-panel-border" />
      <div ref={knob} className="bg-amber-gradient shadow-glow h-14 w-14 rounded-full transition-transform duration-75" />
    </div>
  );
}

export function MobileControls() {
  const isTouch = useGame((s) => s.isTouch);
  const phase = useGame((s) => s.phase);
  const riding = useGame((s) => s.riding);
  if (!isTouch || phase !== "playing") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-end justify-between p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto">
        <Joystick />
      </div>
      {!riding && (
        <WorldButton
          variant="hero"
          size="iconLg"
          className="pointer-events-auto h-20 w-20 rounded-full"
          onPointerDown={(e) => {
            e.stopPropagation();
            requestJump();
          }}
          aria-label="Jump"
        >
          <ChevronsUp className="h-8 w-8" />
        </WorldButton>
      )}
    </div>
  );
}
