import { useEffect, useMemo, useState } from "react";
import { useGame } from "@/game/store";

const COLORS = ["var(--amber)", "var(--meadow)", "var(--arcane)", "var(--peach)", "var(--cream)", "var(--destructive)"];

/** Confetti + banner when the visitor reaches the final stop. */
export function Celebration() {
  const seq = useGame((s) => s.celebrating);
  const [show, setShow] = useState(0);
  useEffect(() => {
    if (!seq) return;
    setShow(seq);
    const id = setTimeout(() => setShow(0), 8000);
    return () => clearTimeout(id);
  }, [seq]);
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: ((i * 13) % 30) / 10,
        dur: 3.5 + ((i * 7) % 20) / 10,
        drift: ((i * 29) % 160) - 80,
        spin: 360 + ((i * 53) % 900),
        color: COLORS[i % COLORS.length],
        w: 6 + (i % 4) * 2,
      })),
    [],
  );
  if (!show) return null;
  return (
    <div key={show} className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-live="polite">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              width: p.w,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              "--drift": `${p.drift}px`,
              "--spin": `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
      <div className="absolute inset-x-0 bottom-[24%] flex justify-center px-4">
        <div className="reveal-shell animate-portal rounded-3xl px-8 py-5 text-center">
          <p className="font-display text-glow text-4xl text-cream sm:text-6xl">Island: conquered.</p>
          <p className="mt-1 font-swag text-lg tracking-wide text-cream/90">Every hotspot claimed. You're officially a legend — now roam free.</p>
        </div>
      </div>
    </div>
  );
}
