import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useGame } from "@/game/store";
import { WorldButton } from "./WorldButton";

const DESKTOP: [string, string][] = [
  ["W A S D / Arrow keys", "Walk in any direction"],
  ["Shift (hold)", "Run"],
  ["Space", "Jump — hop onto rocks, stumps, crates and hay"],
  ["Mouse wheel / trackpad scroll", "Spin the view 360° round your explorer (Shift + scroll tilts)"],
  ["Drag with mouse", "Look around"],
  ["Q", "Use your super power"],
  ["G", "Signature move"],
  ["E", "Interact — doors, seats, the swing, petting, daps"],
  ["Space / C while flying", "Climb higher / dive lower"],
  ["F", "Call / hop on your ride — Shift for nitro"],
  ["M", "Open the world map"],
  ["H", "Show these controls"],
  ["Esc", "Close any open panel"],
];

const TOUCH: [string, string][] = [
  ["Joystick (bottom-left)", "Walk — push to the edge to run"],
  ["Swipe anywhere", "Look all the way round your explorer (360°)"],
  ["Jump button", "Hop onto rocks, stumps, crates and hay"],
  ["Power button", "Use your super power — while flying, Jump climbs higher"],
  ["Ride button", "Call your ride or hop on and off"],
  ["Map button", "Open the world map"],
];

export function ControlGuide() {
  const open = useGame((s) => s.controlsOpen);
  const isTouch = useGame((s) => s.isTouch);
  const set = useGame((s) => s.setControlsOpen);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!open) return null;
  const rows = isTouch ? TOUCH : DESKTOP;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-scrim/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Controls">
      <div className="glass-strong animate-rise w-full max-w-md rounded-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold text-cream">How to explore</h2>
          <WorldButton ref={ref} variant="icon" size="icon" onClick={() => set(false)} aria-label="Close controls (Esc)">
            <X className="h-5 w-5" />
          </WorldButton>
        </div>
        <dl className="flex flex-col gap-2.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 rounded-xl bg-secondary/60 px-3.5 py-2.5">
              <dt className="font-heading text-sm font-semibold text-amber">{k}</dt>
              <dd className="text-right text-sm text-cream/90">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">Follow the arrow — it always points to the next place. Each place tells its story as you arrive, without stopping your walk.</p>
      </div>
    </div>
  );
}
