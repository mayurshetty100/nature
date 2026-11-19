import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import { Sparkles } from "lucide-react";
import { useGame } from "@/game/store";
import { TitleSign } from "./TitleSign";

const TIPS = [
  "Handcrafting tiny pastel clay cottages…",
  "Teaching the trees to sway gently in the breeze…",
  "Byte is dusting his cute robotic whiskers…",
  "Polishing the golden trophy on Main Character Peak…",
  "Arranging fresh blossoms on the window sills…",
  "Baking fluffy pastel clouds over the horizon…",
  "Tuning the sunset over the harbor…",
  "Warming up the engine on Velvet Venom…",
];

export function LoadingScreen() {
  const ready = useGame((s) => s.sceneReady);
  const { progress } = useProgress();
  const [tip, setTip] = useState(0);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 1700);
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
      className={`bg-sky-gradient fixed inset-0 z-50 flex flex-col items-center justify-center px-6 transition-opacity duration-700 ${
        ready ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="animate-float mb-2">
        <TitleSign className="title-sway w-[min(88vw,32rem)]" />
      </div>

      <p className="text-glow mt-4 max-w-md text-center font-heading font-semibold text-lg text-cream tracking-wide sm:text-xl">
        Loading miniature wonder, one clay brick at a time ✨
      </p>

      {/* Pastel Claymorphic Progress Card */}
      <div className="clay-card mt-8 w-full max-w-md rounded-3xl border border-white/60 bg-[rgba(255,246,233,0.88)] p-5 text-[#382442] shadow-clay backdrop-blur-md sm:p-6">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span className="flex items-center gap-2 text-[#4A3728]">
            <Sparkles className="h-4 w-4 animate-pulse-soft text-[#F5C5A8]" aria-hidden />
            {TIPS[tip]}
          </span>
          <span className="font-heading font-bold text-base text-[#382442]">{pct}%</span>
        </div>

        {/* Rounded Clay Progress Track */}
        <div className="mt-3.5 h-3.5 overflow-hidden rounded-full border border-white/70 bg-[#EADDFB]/60 p-0.5 shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#F7CDE2] via-[#F7E3A3] to-[#C4E8CF] transition-all duration-500 ease-out shadow-sm"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
