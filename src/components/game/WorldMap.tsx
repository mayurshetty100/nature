import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MapPin, Minus, Plus, RotateCcw, X } from "lucide-react";
import { player, useGame } from "@/game/store";
import { STOPS, type StopId } from "@/game/stops";
import { edgeNoise, getWorld, ISLAND_P, ISLAND_RX, ISLAND_RZ, MOUNTAINS } from "@/game/world";
import { REGIONS } from "@/game/regions";
import { WorldButton } from "./WorldButton";
import { mapImage } from "./mapImage";
import { STOP_ICONS } from "./stopIcons";

const VB = { x: -196, z: -126, w: 392, h: 252 };
type View = { x: number; z: number; w: number; h: number };
/** Closest zoom: one fifth of the island across. */
const MIN_W = VB.w / 5;
/** Keep the view inside the map at a given width (height follows the map's aspect). */
function clampView(x: number, z: number, w: number): View {
  const ww = Math.min(VB.w, Math.max(MIN_W, w));
  const hh = (ww * VB.h) / VB.w;
  return { x: Math.min(VB.x + VB.w - ww, Math.max(VB.x, x)), z: Math.min(VB.z + VB.h - hh, Math.max(VB.z, z)), w: ww, h: hh };
}
/** where each region's name sits on the map */
const REGION_LABELS: [string, number, number][] = [
  [REGIONS[0].name, -128, 80],
  [REGIONS[1].name, -112, -64],
  [REGIONS[2].name, -4, 84],
  [REGIONS[3].name, 56, -52],
  [REGIONS[4].name, 104, 70],
  [REGIONS[5].name, 128, -76],
  [REGIONS[6].name, 176, -2],
];

export function WorldMap() {
  const open = useGame((s) => s.mapOpen);
  const phase = useGame((s) => s.phase);
  const visited = useGame((s) => s.visited);
  const target = useGame((s) => s.targetStop);
  const setMapOpen = useGame((s) => s.setMapOpen);
  const travelTo = useGame((s) => s.travelTo);
  const setPhase = useGame((s) => s.setPhase);
  const warpTo = useGame((s) => s.warpTo);
  const dot = useRef<SVGGElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [img, setImg] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  // zoom + pan: two-finger pinch / wheel to zoom, drag to pan; a tap still teleports
  const [view, setView] = useState<View>(VB);
  const viewRef = useRef<View>(VB);
  viewRef.current = view;
  const gesture = useRef({ pts: new Map<number, { x: number; y: number }>(), moved: 0, dist: 0, anchor: { x: 0, z: 0 } });
  useEffect(() => {
    if (open) setView(VB);
  }, [open]);
  /** svg screen layout (viewBox is fitted "meet") → helpers between client px and world for a given view */
  const layout = (v: View) => {
    const r = svg.current!.getBoundingClientRect();
    const k = Math.min(r.width / v.w, r.height / v.h);
    return { r, k, ox: (r.width - v.w * k) / 2, oy: (r.height - v.h * k) / 2 };
  };
  const clientToWorld = (cx: number, cy: number, v: View) => {
    const { r, k, ox, oy } = layout(v);
    return { x: v.x + (cx - r.left - ox) / k, z: v.z + (cy - r.top - oy) / k };
  };
  /** zoom by factor f keeping the world point under (cx, cy) still */
  const zoomAt = (f: number, cx: number, cy: number) => {
    const v = viewRef.current;
    const a = clientToWorld(cx, cy, v);
    const w2 = Math.min(VB.w, Math.max(MIN_W, v.w * f));
    const s2 = w2 / v.w;
    setView(clampView(a.x - (a.x - v.x) * s2, a.z - (a.z - v.z) * s2, w2));
  };
  useEffect(() => {
    const el = svg.current;
    if (!open || !el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(Math.exp(dy * 0.0015), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, img]);
  // draw the top-down picture once, after the map first opens
  useEffect(() => {
    if (!open || img) return;
    const id = setTimeout(() => setImg(mapImage()), 30);
    return () => clearTimeout(id);
  }, [open, img]);
  const closeRef = useRef<HTMLButtonElement>(null);

  const paths = useMemo(() => {
    const w = getWorld();
    const coast: string[] = [];
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const r = (0.95 - edgeNoise(a)) / Math.pow(Math.pow(Math.abs(c) / ISLAND_RX, ISLAND_P) + Math.pow(Math.abs(s) / ISLAND_RZ, ISLAND_P), 1 / ISLAND_P);
      coast.push(`${i === 0 ? "M" : "L"}${(c * r).toFixed(1)},${(s * r).toFixed(1)}`);
    }
    const line = (xs: Float32Array, zs: Float32Array, n: number, step: number) => {
      const out: string[] = [];
      for (let i = 0; i < n; i += step) out.push(`${i === 0 ? "M" : "L"}${xs[i].toFixed(1)},${zs[i].toFixed(1)}`);
      return out.join(" ");
    };
    return {
      coast: coast.join(" ") + "Z",
      road: line(w.road.xs, w.road.zs, w.road.count, 4),
      river: line(w.river.xs, w.river.zs, w.river.count, 3),
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    let id = 0;
    const tick = () => {
      if (dot.current) dot.current.setAttribute("transform", `translate(${player.position.x.toFixed(2)} ${player.position.z.toFixed(2)})`);
      id = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  /** screen point → world x/z on the map */
  const toWorld = (e: React.PointerEvent | React.MouseEvent) => {
    const el = svg.current;
    const m = el?.getScreenCTM();
    if (!el || !m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: pt.x, z: pt.y };
  };
  const go = (id: StopId) => {
    travelTo(id);
    if (phase === "intro") setPhase("entering");
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-scrim/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="World map">
      <div className="glass-strong animate-rise relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl lg:flex-row">
        <div className="relative min-h-0 flex-1 p-3 sm:p-5">
          <svg
            ref={svg}
            viewBox={`${view.x} ${view.z} ${view.w} ${view.h}`}
            className="h-auto max-h-[52vh] w-full cursor-crosshair touch-none select-none lg:max-h-[70vh]"
            role="img"
            aria-label="Top-down map of the island — pinch or scroll to zoom, drag to pan, tap anywhere to teleport there"
            onPointerDown={(e) => {
              const G = gesture.current;
              G.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
              if (G.pts.size === 1) G.moved = 0;
              if (G.pts.size === 2) {
                const [a, b] = [...G.pts.values()];
                G.dist = Math.hypot(a.x - b.x, a.y - b.y);
                G.moved = 99; // a pinch is never a tap
              }
            }}
            onPointerMove={(e) => {
              setHover(toWorld(e));
              const G = gesture.current;
              const prev = G.pts.get(e.pointerId);
              if (!prev) return;
              const dx = e.clientX - prev.x;
              const dy = e.clientY - prev.y;
              G.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
              if (G.pts.size === 2) {
                const [a, b] = [...G.pts.values()];
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                if (G.dist > 0 && d > 0) zoomAt(G.dist / d, (a.x + b.x) / 2, (a.y + b.y) / 2);
                G.dist = d;
                return;
              }
              G.moved += Math.abs(dx) + Math.abs(dy);
              const v = viewRef.current;
              if (v.w < VB.w && G.moved > 6) {
                const { k } = layout(v);
                setView(clampView(v.x - dx / k, v.z - dy / k, v.w));
              }
            }}
            onPointerUp={(e) => {
              gesture.current.pts.delete(e.pointerId);
            }}
            onPointerCancel={(e) => {
              gesture.current.pts.delete(e.pointerId);
            }}
            onPointerLeave={(e) => {
              setHover(null);
              gesture.current.pts.delete(e.pointerId);
            }}
            onClickCapture={(e) => {
              // a drag or pinch isn't a tap: don't teleport / pick a hotspot
              if (gesture.current.moved > 6) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            onClick={(e) => {
              if (phase === "intro") return;
              const p = toWorld(e);
              if (p) warpTo(p.x, p.z);
            }}
          >
            <defs>
              <radialGradient id="sea" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="oklch(0.72 0.1 200)" />
                <stop offset="100%" stopColor="oklch(0.5 0.09 225)" />
              </radialGradient>
              <radialGradient id="land" cx="40%" cy="45%" r="65%">
                <stop offset="0%" stopColor="oklch(0.78 0.15 135)" />
                <stop offset="100%" stopColor="oklch(0.6 0.13 145)" />
              </radialGradient>
            </defs>
            <rect x={VB.x} y={VB.z} width={VB.w} height={VB.h} rx="10" fill="url(#sea)" />
            {img && <image href={img} x={VB.x} y={VB.z} width={VB.w} height={VB.h} preserveAspectRatio="none" style={{ imageRendering: "auto" }} />}
            {!img && (
              <>
            <path d={paths.coast} fill="oklch(0.88 0.06 85)" transform="scale(1.03)" opacity="0.8" />
            <path d={paths.coast} fill="url(#land)" stroke="oklch(0.45 0.07 60)" strokeWidth="0.8" />
            {MOUNTAINS.filter((m) => m[2] >= 11).map(([x, z, , r]) => (
              <g key={`${x}${z}`} opacity="0.75">
                <path d={`M${x - r},${z + r * 0.5} L${x},${z - r * 0.7} L${x + r},${z + r * 0.5} Z`} fill="oklch(0.55 0.05 60)" />
                <path d={`M${x - r * 0.3},${z - r * 0.25} L${x},${z - r * 0.7} L${x + r * 0.3},${z - r * 0.25} Z`} fill="oklch(0.9 0.02 85)" />
              </g>
            ))}
            <path d={paths.river} fill="none" stroke="oklch(0.75 0.11 210)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <path d={paths.road} fill="none" stroke="oklch(0.45 0.07 60)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
            <path d={paths.road} fill="none" stroke="oklch(0.9 0.07 85)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3.6" />
              </>
            )}
            {REGION_LABELS.map(([name, x, z]) => (
              <text key={name} x={x} y={z} textAnchor="middle" fontSize="8.5" fill="oklch(0.98 0.02 90)" stroke="oklch(0.28 0.06 60 / 0.85)" strokeWidth="1.6" paintOrder="stroke" fontFamily="'Lobster Two', Fredoka, sans-serif" fontWeight={700} letterSpacing="0.3" pointerEvents="none">
                {name}
              </text>
            ))}
            {STOPS.map((s) => {
              const done = visited.includes(s.id);
              const isTarget = target === s.id;
              const Icon = STOP_ICONS[s.id];
              return (
                <g
                  key={s.id}
                  transform={`translate(${s.lx} ${s.lz})`}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(s.id);
                  }}
                >
                  {isTarget && <circle r="13" fill="oklch(0.82 0.15 75 / 0.35)" className="animate-pulse-soft" />}
                  <circle r="8.5" fill={done ? "oklch(0.82 0.15 75)" : "oklch(0.42 0.09 60)"} stroke="oklch(0.86 0.12 135)" strokeWidth="1.8" />
                  <Icon x={-4.5} y={-4.5} width={9} height={9} color={done ? "oklch(0.3 0.07 55)" : "oklch(0.96 0.03 85)"} strokeWidth={2.4} aria-hidden />
                  <text y="-13" textAnchor="middle" fontSize="7.5" fill="oklch(0.98 0.02 90)" stroke="oklch(0.3 0.07 55)" strokeWidth="1.9" paintOrder="stroke" fontFamily="'Lobster Two', Fredoka, sans-serif" fontWeight={700}>
                    {s.name}
                  </text>
                </g>
              );
            })}
            {hover && phase !== "intro" && (
              <g transform={`translate(${hover.x} ${hover.z})`} pointerEvents="none">
                <circle r="5" fill="none" stroke="oklch(0.98 0.02 90)" strokeWidth="1.2" strokeDasharray="2 1.6" />
                <circle r="1.2" fill="oklch(0.98 0.02 90)" />
              </g>
            )}
            {phase !== "intro" && (
              <g ref={dot} pointerEvents="none">
                <circle r="6" fill="oklch(0.97 0.015 85)" stroke="oklch(0.2 0.04 262)" strokeWidth="1.6" />
                <circle r="2.6" fill="oklch(0.66 0.16 55)" />
              </g>
            )}
          </svg>
          <div className="absolute right-5 top-5 flex flex-col gap-1.5 sm:right-7 sm:top-7">
            <WorldButton variant="icon" size="icon" className="h-9 w-9" aria-label="Zoom in" onClick={() => { const r = svg.current!.getBoundingClientRect(); zoomAt(0.7, r.left + r.width / 2, r.top + r.height / 2); }}>
              <Plus className="h-4 w-4" />
            </WorldButton>
            <WorldButton variant="icon" size="icon" className="h-9 w-9" aria-label="Zoom out" onClick={() => { const r = svg.current!.getBoundingClientRect(); zoomAt(1 / 0.7, r.left + r.width / 2, r.top + r.height / 2); }}>
              <Minus className="h-4 w-4" />
            </WorldButton>
            {view.w < VB.w && (
              <WorldButton variant="icon" size="icon" className="h-9 w-9" aria-label="Show the whole island" onClick={() => setView(VB)}>
                <RotateCcw className="h-4 w-4" />
              </WorldButton>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">Pinch or scroll to zoom, drag to pan. Tap anywhere to teleport, or tap a hotspot to zap to its doorstep.</p>
        </div>
        <div className="flex w-full flex-col border-t border-panel-border p-4 sm:p-5 lg:w-80 lg:border-l lg:border-t-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-swag text-2xl tracking-wide text-cream">Where to, legend?</h2>
            <WorldButton ref={closeRef} variant="icon" size="icon" onClick={() => setMapOpen(false)} aria-label="Close map (Esc)">
              <X className="h-5 w-5" />
            </WorldButton>
          </div>
          <ul className="flex max-h-[30vh] flex-col gap-1.5 overflow-y-auto pr-1 lg:max-h-none">
            {STOPS.map((s) => {
              const Icon = STOP_ICONS[s.id];
              const done = visited.includes(s.id);
              return (
                <li key={s.id}>
                  <button
                    onClick={() => go(s.id)}
                    className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${done ? "bg-amber-gradient text-primary-foreground" : "bg-wood-plank text-cream"}`}>
                      <Icon className="h-4.5 w-4.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-swag text-[15px] tracking-wide text-cream">{s.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.subtitle}</span>
                    </span>
                    {done ? (
                      <Check className="h-4 w-4 text-amber" aria-label="Been there" />
                    ) : (
                      <MapPin className="h-4 w-4 text-amber opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
