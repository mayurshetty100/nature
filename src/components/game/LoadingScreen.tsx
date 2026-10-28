import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import { Leaf } from "lucide-react";
import { useGame } from "@/game/store";
import { TitleSign } from "./TitleSign";

const TIPS = [
  "Teaching the trees to wink…",
  "Convincing the river to flow your way…",
  "Bribing the birds to sing on cue…",
  "Polishing the main-character lighting…",
  "Byte is fixing his hair…",
  "Charging the rizz reactor…",
];

export function LoadingScreen() {
  const ready = useGame((s) => s.sceneReady);
  const { progress } = useProgress();
  const [tip, setTip] = useState(0);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 1600);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => setGone(true), 900);
    return () => clearTimeout(id);
  }, [ready]);

  if (gone) return null;
  const pct = ready ? 100 : Math.min(98, Math.round(progress));
  return (
    <div
      className={`bg-sky-gradient fixed inset-0 z-50 flex flex-col items-center justify-center px-6 transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`}
      role="status"
      aria-live="polite"
    >
      <h1>
        <TitleSign className="title-sway w-[min(86vw,30rem)]" />
      </h1>
      <p className="text-glow mt-3 max-w-md text-center font-swag text-xl tracking-wide text-cream sm:text-2xl">Loading rizz, one pixel at a time.</p>
      <div className="glass-panel mt-10 w-full max-w-sm rounded-2xl p-5">
        <div className="flex items-center justify-between text-sm text-cream">
          <span className="flex items-center gap-2">
            <Leaf className="h-4 w-4 animate-pulse-soft text-leaf" aria-hidden />
            {TIPS[tip]}
          </span>
          <span className="font-heading font-semibold">{pct}%</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary">
          <div className="bg-leaf-gradient h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
