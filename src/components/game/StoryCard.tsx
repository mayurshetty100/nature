import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { useGame } from "@/game/store";
import { STOP_BY_ID, type StopId } from "@/game/stops";
import { holdSeconds, storyFor, TYPE_CPS } from "@/game/story";
import { cn } from "@/lib/utils";
import { STOP_ICONS } from "./stopIcons";

const FADE_MS = 2500;

/** Phones and short landscape screens get a slim card that never blocks the view. */
function useCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const check = () => setCompact(window.innerWidth < 900 || window.innerHeight < 700);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return compact;
}

function StoryBody({ id }: { id: StopId }) {
  const story = useMemo(() => storyFor(id), [id]);
  const stop = STOP_BY_ID[id];
  const Icon = STOP_ICONS[id];
  const reduced = useGame((s) => s.reducedMotion);
  const hide = useGame((s) => s.hideStory);
  const parts = useMemo(() => [story.title, ...story.lines], [story]);
  const total = useMemo(() => parts.reduce((n, p) => n + p.length, 0), [parts]);
  const [shown, setShown] = useState(reduced ? total : 0);
  const [fading, setFading] = useState(false);
  const hovering = useRef(false);
  const compact = useCompact();
  const done = shown >= total;

  // type it out
  const shownAt = useRef(performance.now());
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const cps = Math.max(TYPE_CPS, total / 7); // long chapters type faster so reading time remains
      const n = Math.min(total, Math.floor(((performance.now() - t0) / 1000) * cps));
      setShown(n);
      if (n < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total, reduced]);

  // stay a while (longer while hovered), then fade away
  useEffect(() => {
    if (!done) return;
    // whole card (typing + reading time + fade) is gone within 15 seconds
    const typedFor = (performance.now() - shownAt.current) / 1000;
    let left = Math.max(1.5, Math.min(holdSeconds(story), 15 - FADE_MS / 1000 - typedFor));
    const iv = setInterval(() => {
      left -= 0.25;
      if (left <= 0) {
        clearInterval(iv);
        setFading(true);
      }
    }, 250);
    return () => clearInterval(iv);
  }, [done, story]);

  useEffect(() => {
    if (!fading) return;
    const t = setTimeout(hide, FADE_MS);
    return () => clearTimeout(t);
  }, [fading, hide]);

  let offset = 0;
  const typed = parts.map((p) => {
    const vis = Math.max(0, Math.min(p.length, shown - offset));
    offset += p.length;
    return { text: p.slice(0, vis), typing: vis > 0 && vis < p.length, started: vis > 0 };
  });
  // only the most recent lines, like subtitles, so the card stays small
  const lines = typed.slice(1).filter((l) => l.started);
  const visibleLines = lines.slice(compact ? -2 : -3);

  return (
    <div
      className={cn(
        "reveal-shell animate-portal relative w-full overflow-hidden transition-all",
        compact ? "pointer-events-none max-w-[17.5rem] rounded-2xl p-2.5" : "pointer-events-auto max-w-[21rem] rounded-2xl p-3.5",
        fading && "translate-y-2 opacity-0 blur-sm",
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      onPointerEnter={() => (hovering.current = true)}
      onPointerLeave={() => (hovering.current = false)}
      aria-label={`${stop.chapter}: ${story.title}`}
    >
      <div className="reveal-shimmer pointer-events-none absolute inset-0" aria-hidden />
      <div className={cn("flex items-center", compact ? "mb-1 gap-1.5" : "mb-2.5 gap-2.5")}>
        <span className={cn("bg-wood-plank flex shrink-0 items-center justify-center rounded-lg text-cream", compact ? "h-6 w-6" : "h-8 w-8")}>
          <Icon className={compact ? "h-3 w-3" : "h-4 w-4"} aria-hidden />
        </span>
        <p className={cn("min-w-0 flex-1 truncate font-heading font-semibold uppercase text-leaf", compact ? "text-[9px] tracking-[0.14em]" : "text-[11px] tracking-[0.2em]")}>
          {stop.chapter} · {stop.name}
        </p>
      </div>

      {/* screen readers get the whole chapter at once */}
      <div className="sr-only" role="status" aria-live="polite">
        {parts.join(". ")}
      </div>

      <div aria-hidden>
        <h3 className={cn("font-swag leading-snug tracking-wide text-cream", compact ? "line-clamp-2 text-[15px]" : "line-clamp-2 text-lg")}>
          {typed[0].text}
          {typed[0].typing && <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-0.5 animate-pulse bg-leaf" />}
        </h3>
        <ul className={cn("flex flex-col overflow-hidden", compact ? "mt-1 gap-1" : "mt-1.5 gap-1")}>
          {visibleLines.map(
            (l, i) =>
              l.started && (
                <li key={lines.length - visibleLines.length + i} className={cn("flex gap-2 leading-snug text-cream/90", compact ? "text-[11.5px]" : "text-[13px]")}>
                  <span className="mt-[0.4rem] h-2 w-2 shrink-0 rounded-[0_100%_0_100%] bg-leaf" />
                  <span className="line-clamp-2">
                    {l.text}
                    {l.typing && <span className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5 animate-pulse bg-leaf" />}
                  </span>
                </li>
              ),
          )}
        </ul>
      </div>

      {story.links && done && (
        <div className={cn("animate-rise pointer-events-auto flex flex-wrap gap-2", compact ? "mt-2" : "mt-3.5")}>
          {story.links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target={l.href.startsWith("mailto:") ? undefined : "_blank"}
              rel="noreferrer"
              download={l.download ? "Mayur-Shetty-Resume.pdf" : undefined}
              className="glass-panel flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-cream hover:bg-secondary/80"
            >
              {l.download ? <Download className="h-3.5 w-3.5 text-amber" aria-hidden /> : <ExternalLink className="h-3.5 w-3.5 text-amber" aria-hidden />}
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** A chapter of Mayur's story typed out over the world — the journey keeps going underneath. */
export function StoryCard() {
  const story = useGame((s) => s.story);
  const phase = useGame((s) => s.phase);
  if (!story || phase !== "playing") return null;
  return (
    <div className="pointer-events-none fixed left-2 right-auto top-[4.25rem] z-20 flex justify-start sm:left-4 sm:top-20">
      <StoryBody key={story.seq} id={story.id} />
    </div>
  );
}
