import { useEffect, useRef } from "react";
import { sound } from "@/game/audio";
import { useGame } from "@/game/store";

/*
 * The handcrafted "Mayur's Wonderworld" title sign in pastel claymorphism:
 * Two rounded wooden clay planks with brass studs, 3D bubbly clay lettering,
 * living bluebirds that fly in, perch, hop and tweet, swaying floral creepers,
 * and drifting petals in the breeze.
 * Coordinates are in 1200 × 580 sign pixels.
 */
const W = 1200;
const H = 580;

/** Letter tops a bird can stand on (feet position). */
const PERCHES: [number, number][] = [
  [380, 82],
  [520, 80],
  [710, 82],
  [220, 280],
  [600, 276],
  [960, 280],
];

/** Hanging creeper strands: anchor, length, sway speed. */
const STRANDS: { x: number; y: number; len: number; dur: number; delay: number; flower?: string }[] = [
  [85, 300, 115, 4.6, 0],
  [310, 470, 85, 5.2, -1.0, "white"],
  [660, 480, 95, 5.3, -1.2, "pink"],
  [1115, 320, 125, 4.1, -2.4],
  [890, 475, 90, 5.5, -1.8, "pink"],
].map(([x, y, len, dur, delay, flower]) => ({
  x: x as number,
  y: y as number,
  len: len as number,
  dur: dur as number,
  delay: delay as number,
  flower: flower as string | undefined,
}));

const PETALS = Array.from({ length: 8 }, (_, i) => ({
  x: 80 + i * 140 + (i % 2) * 35,
  delay: i * 1.5,
  dur: 7 + (i % 3) * 1.5,
  pink: i % 2 === 0,
}));

type Bird = {
  state: "away" | "fly" | "perch" | "leave";
  until: number;
  start: number;
  from: [number, number];
  to: [number, number];
  perch: number;
  x: number;
  y: number;
  face: 1 | -1;
  hopAt: number;
  hopFrom: number;
  hopTo: number;
  nextAct: number;
  peck: number;
  note: number;
};

/** Sign-space bounds of the browser window, so birds come from and go to truly off-screen points. */
const view = { left: -400, right: W + 400, top: -400 };
const offscreen = (): [number, number] => [Math.random() < 0.5 ? view.left - 90 : view.right + 90, view.top - 60 - Math.random() * 140];

/**
 * Gusty wind: a few slow, out-of-step waves so its strength and direction keep
 * changing; the gust rolls across the sign (later for strands further along).
 */
function wind(t: number, x: number) {
  const u = t - x / 700;
  return Math.sin(u * 0.53) * 0.55 + Math.sin(u * 1.37 + 1.3) * 0.3 + Math.sin(u * 2.9 + 0.4) * 0.15 + Math.sin(u * 0.21 + 2.2) * 0.35;
}

function newBird(i: number): Bird {
  return { state: "away", until: 0.6 + i * 2.2, start: 0, from: offscreen(), to: [0, 0], perch: -1, x: -200, y: -200, face: 1, hopAt: -10, hopFrom: 0, hopTo: 0, nextAct: 0, peck: -10, note: -10 };
}

function BirdShape() {
  return (
    <g>
      <path d="M-16 -2 L-34 -10 L-30 2 Z" fill="#2f5fb3" />
      <ellipse cx="0" cy="-14" rx="20" ry="15" fill="#3f86e0" />
      <ellipse cx="3" cy="-8" rx="14" ry="9" fill="#fdf6e8" />
      <circle cx="15" cy="-28" r="11" fill="#3f86e0" />
      <circle cx="19" cy="-30" r="3.2" fill="#1b1b24" />
      <circle cx="20" cy="-31" r="1" fill="#ffffff" />
      <path className="tb-beak" d="M25 -28 L35 -25 L25 -23 Z" fill="#f5a524" />
      <circle cx="12" cy="-23" r="3" fill="#ff9fb4" opacity="0.7" />
      <g className="tb-wing" style={{ transformOrigin: "-2px -18px" }}>
        <path d="M-2 -18 C -18 -34 -30 -26 -24 -12 C -18 -6 -8 -8 -2 -18 Z" fill="#2f6fd0" />
      </g>
      <path d="M-2 0 L-4 7 M4 0 L4 7" stroke="#f5a524" strokeWidth="2.4" strokeLinecap="round" />
    </g>
  );
}

const bez = (a: number, b: number, c: number, t: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

/** Animated wooden title sign with living birds and swaying creepers. */
export function TitleSign({ className }: { className?: string }) {
  const reduced = useGame((s) => s.reducedMotion);
  const birdEls = useRef<(SVGGElement | null)[]>([]);
  const noteEls = useRef<(SVGTextElement | null)[]>([]);
  const svgEl = useRef<SVGSVGElement>(null);
  const strandEls = useRef<(SVGGElement | null)[]>([]);
  const leafEls = useRef<(SVGPathElement | null)[]>([]);
  const bloomEls = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    if (reduced) return;
    const birds = [newBird(0), newBird(1)];
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      // where the window edges are, in sign pixels
      const r = svgEl.current?.getBoundingClientRect();
      if (r && r.width > 0) {
        const k = W / r.width;
        view.left = -r.left * k;
        view.right = W + (window.innerWidth - r.right) * k;
        view.top = -r.top * k;
      }
      // creepers, leaves and blossoms ride the wind — each strand its own lag, swing and flutter
      STRANDS.forEach((st, i) => {
        const g = strandEls.current[i];
        const w = wind(t, st.x) * (0.8 + (i % 3) * 0.15);
        const flutter = Math.sin(t * (5.2 + i * 0.7) + i) * 1.4 * Math.abs(w);
        g?.setAttribute("transform", `rotate(${(w * 9 + flutter).toFixed(2)})`);
        for (let j = 0; j < 3; j++) {
          const leaf = leafEls.current[i * 3 + j];
          const lf = w * 14 + Math.sin(t * (7 + j * 1.9) + i * 2 + j) * (4 + Math.abs(w) * 10);
          leaf?.setAttribute("transform", `rotate(${lf.toFixed(2)})`);
        }
        const bl = bloomEls.current[i];
        bl?.setAttribute("transform", `translate(2 ${st.len + 6}) rotate(${(w * 18 + Math.sin(t * 3.3 + i) * 5).toFixed(2)})`);
      });
      birds.forEach((b, i) => {
        if (t >= b.until) {
          if (b.state === "away") {
            // pick a free letter top and fly in
            const busy = new Set(birds.filter((o) => o !== b && o.perch >= 0).map((o) => o.perch));
            const free = PERCHES.map((_, k) => k).filter((k) => !busy.has(k));
            b.perch = free[Math.floor(Math.random() * free.length)];
            b.from = offscreen();
            b.to = PERCHES[b.perch];
            b.state = "fly";
            b.start = t;
            // a steady flying speed, however far off-screen it starts
            b.until = t + Math.max(1.6, Math.hypot(b.to[0] - b.from[0], b.to[1] - b.from[1]) / 520);
          } else if (b.state === "fly") {
            b.state = "perch";
            b.start = t;
            b.until = t + 5 + Math.random() * 5;
            b.nextAct = t + 0.6;
            b.hopFrom = b.hopTo = 0;
          } else if (b.state === "perch") {
            b.state = "leave";
            b.from = [b.x, b.y];
            b.to = offscreen();
            b.start = t;
            b.until = t + Math.max(1.6, Math.hypot(b.to[0] - b.from[0], b.to[1] - b.from[1]) / 520);
          } else {
            b.state = "away";
            b.perch = -1;
            b.until = t + 1.5 + Math.random() * 3;
          }
        }
        let flying = false;
        let bob = 0;
        if (b.state === "fly" || b.state === "leave") {
          flying = true;
          const raw = Math.min(1, (t - b.start) / (b.until - b.start));
          // arrive gently; take off and keep accelerating out of sight
          const k = b.state === "fly" ? 1 - (1 - raw) * (1 - raw) : raw * raw * 0.4 + raw * 0.6;
          const mx = (b.from[0] + b.to[0]) / 2;
          const my = Math.min(b.from[1], b.to[1]) - 120;
          const nx = bez(b.from[0], mx, b.to[0], k);
          const ny = bez(b.from[1], my, b.to[1], k) + Math.sin(t * 9) * 4;
          if (Math.abs(nx - b.x) > 0.5) b.face = nx > b.x ? 1 : -1;
          b.x = nx;
          b.y = ny;
        } else if (b.state === "perch") {
          const [px, py] = PERCHES[b.perch];
          // little life: hop along the letter, peck, look around, tweet
          if (t >= b.nextAct) {
            const r = Math.random();
            if (r < 0.35) {
              b.hopFrom = b.hopTo;
              b.hopTo = Math.max(-26, Math.min(26, b.hopTo + (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 14)));
              b.hopAt = t;
              b.face = b.hopTo > b.hopFrom ? 1 : -1;
            } else if (r < 0.6) b.peck = t;
            else if (r < 0.8) b.face = b.face === 1 ? -1 : 1;
            else {
              b.note = t;
              sound.songbird(i ? 1.12 : 1);
            }
            b.nextAct = t + 0.8 + Math.random() * 1.6;
          }
          const hk = Math.min(1, (t - b.hopAt) / 0.28);
          const off = b.hopFrom + (b.hopTo - b.hopFrom) * hk;
          const hopY = hk < 1 ? Math.sin(hk * Math.PI) * 14 : 0;
          bob = Math.sin(t * 3 + i) * 1.2;
          b.x = px + off;
          b.y = py - hopY;
        }
        const el = birdEls.current[i];
        if (el) {
          const peck = t - b.peck < 0.35 ? Math.sin(((t - b.peck) / 0.35) * Math.PI) * 28 : 0;
          const tilt = flying ? -8 : peck;
          el.setAttribute("transform", `translate(${b.x.toFixed(1)} ${(b.y + bob).toFixed(1)}) scale(${b.face * 1.7} 1.7) rotate(${tilt.toFixed(1)})`);
          el.setAttribute("class", flying ? "tb-bird tb-flying" : "tb-bird");
          el.style.display = b.state === "away" ? "none" : "";
        }
        const note = noteEls.current[i];
        if (note) {
          const k = (t - b.note) / 1.2;
          const on = k >= 0 && k < 1 && b.state === "perch";
          note.style.display = on ? "" : "none";
          if (on) {
            note.setAttribute("x", (b.x + b.face * 38).toFixed(1));
            note.setAttribute("y", (b.y - 70 - k * 34).toFixed(1));
            note.setAttribute("opacity", (1 - k).toFixed(2));
          }
        }
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <svg
        ref={svgEl}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full overflow-visible select-none"
        aria-label="Mayur's Wonderworld"
      >
        <defs>
          <filter id="woodShadow" x="-10%" y="-10%" width="125%" height="135%">
            <feDropShadow dx="0" dy="16" stdDeviation="14" floodColor="#221226" floodOpacity="0.45" />
          </filter>
          <filter id="pillShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#221226" floodOpacity="0.25" />
          </filter>
          <filter id="textDropShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#2A141A" floodOpacity="0.5" />
          </filter>
          <linearGradient id="clayWoodGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5C5A8" />
            <stop offset="50%" stopColor="#E6A886" />
            <stop offset="100%" stopColor="#C9825E" />
          </linearGradient>
          <linearGradient id="clayWoodGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F7CEB2" />
            <stop offset="50%" stopColor="#EAA885" />
            <stop offset="100%" stopColor="#C87F5A" />
          </linearGradient>
          <linearGradient id="mayurGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFDFC" />
            <stop offset="60%" stopColor="#FFF2E5" />
            <stop offset="100%" stopColor="#FAD8C3" />
          </linearGradient>
          <linearGradient id="wonderGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFBE6" />
            <stop offset="45%" stopColor="#FDEAB2" />
            <stop offset="100%" stopColor="#F7C8A4" />
          </linearGradient>
          <linearGradient id="ropeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9C7756" />
            <stop offset="50%" stopColor="#D9B48F" />
            <stop offset="100%" stopColor="#7A583A" />
          </linearGradient>
        </defs>

        {/* Top hanging ropes with bronze loop rings */}
        {[350, 850].map((rx) => (
          <g key={rx}>
            <rect x={rx - 7} y={-60} width="14" height="110" rx="7" fill="url(#ropeGrad)" />
            <circle cx={rx} cy="50" r="14" fill="#6A4528" stroke="#D9B48F" strokeWidth="4" />
            <circle cx={rx} cy="50" r="6" fill="#2D1B10" />
          </g>
        ))}

        {/* Connecting rope brackets between upper and lower planks */}
        {[350, 850].map((rx) => (
          <g key={`mid-${rx}`}>
            <rect x={rx - 6} y="180" width="12" height="75" rx="6" fill="url(#ropeGrad)" />
            <circle cx={rx} cy="190" r="10" fill="#6A4528" stroke="#D9B48F" strokeWidth="3" />
            <circle cx={rx} cy="245" r="10" fill="#6A4528" stroke="#D9B48F" strokeWidth="3" />
          </g>
        ))}

        {/* UPPER BOARD: "Mayur's" */}
        <g filter="url(#woodShadow)">
          <rect x="250" y="38" width="700" height="155" rx="38" fill="url(#clayWoodGrad1)" stroke="#A96E49" strokeWidth="6" />
          <rect x="262" y="50" width="676" height="131" rx="26" fill="none" stroke="#FFF2E2" strokeWidth="3.5" opacity="0.65" />
          {/* Wood corner rivets */}
          {[
            [285, 70],
            [915, 70],
            [285, 160],
            [915, 160],
          ].map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r="8" fill="#5E381E" />
              <circle cx={cx - 1.5} cy={cy - 1.5} r="4" fill="#D9A87C" />
            </g>
          ))}
        </g>

        {/* LOWER BOARD: "WONDERWORLD" */}
        <g filter="url(#woodShadow)">
          <rect x="60" y="235" width="1080" height="235" rx="46" fill="url(#clayWoodGrad2)" stroke="#A96E49" strokeWidth="7" />
          <rect x="74" y="249" width="1052" height="207" rx="36" fill="none" stroke="#FFF2E2" strokeWidth="4" opacity="0.65" />
          {/* Wood corner rivets */}
          {[
            [100, 275],
            [1100, 275],
            [100, 430],
            [1100, 430],
          ].map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r="9" fill="#5E381E" />
              <circle cx={cx - 2} cy={cy - 2} r="4.5" fill="#D9A87C" />
            </g>
          ))}
        </g>

        {/* BUBBLY CLAY TYPOGRAPHY */}
        {/* "Mayur's" */}
        <g>
          <text
            x="600"
            y="156"
            textAnchor="middle"
            fontFamily="Fredoka, system-ui, sans-serif"
            fontWeight="700"
            fontSize="106"
            fill="#3B1E12"
            opacity="0.85"
          >
            Mayur's
          </text>
          <text
            x="600"
            y="149"
            textAnchor="middle"
            fontFamily="Fredoka, system-ui, sans-serif"
            fontWeight="700"
            fontSize="106"
            fill="url(#mayurGrad)"
            stroke="#FFFFFF"
            strokeWidth="3.5"
            paintOrder="stroke fill"
          >
            Mayur's
          </text>
        </g>

        {/* "WONDERWORLD" */}
        <g>
          <text
            x="600"
            y="384"
            textAnchor="middle"
            fontFamily="Fredoka, system-ui, sans-serif"
            fontWeight="700"
            fontSize="134"
            letterSpacing="6"
            fill="#381D14"
            opacity="0.9"
          >
            WONDERWORLD
          </text>
          <text
            x="600"
            y="376"
            textAnchor="middle"
            fontFamily="Fredoka, system-ui, sans-serif"
            fontWeight="700"
            fontSize="134"
            letterSpacing="6"
            fill="url(#wonderGrad)"
            stroke="#FFFFFF"
            strokeWidth="4"
            paintOrder="stroke fill"
          >
            WONDERWORLD
          </text>
        </g>

        {/* Subtitle Pill Badge */}
        <g filter="url(#pillShadow)">
          <rect x="410" y="416" width="380" height="38" rx="19" fill="#C4E8CF" stroke="#FFF6E9" strokeWidth="2.5" />
          <text
            x="600"
            y="442"
            textAnchor="middle"
            fontFamily="Fredoka, system-ui, sans-serif"
            fontWeight="600"
            fontSize="17"
            letterSpacing="5"
            fill="#274631"
          >
            A MINIATURE ADVENTURE
          </text>
        </g>

        {/* Decorative corner blossom pins */}
        {[
          [262, 50, "#F7CDE2"],
          [938, 50, "#DCC8F5"],
          [74, 249, "#F7CDE2"],
          [1126, 249, "#F7E3A3"],
        ].map(([bx, by, col], i) => (
          <g key={`flower-${i}`} transform={`translate(${bx} ${by})`}>
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx="0" cy="-9" rx="6.5" ry="9" transform={`rotate(${a})`} fill={col as string} opacity="0.95" />
            ))}
            <circle r="5" fill="#FFF6E9" />
          </g>
        ))}

        {/* Creepers swaying from the letters, with blossoms */}
        {STRANDS.map((s, i) => (
          <g key={i} transform={`translate(${s.x} ${s.y})`}>
            <g
              ref={(el) => {
                strandEls.current[i] = el;
              }}
            >
              <path d={`M0 0 C 8 ${s.len * 0.35}, -8 ${s.len * 0.65}, 2 ${s.len}`} stroke="#4f8f3a" strokeWidth="5" fill="none" strokeLinecap="round" />
              {[0.3, 0.55, 0.8].map((k, j) => (
                <g key={j} transform={`translate(${j % 2 ? -3 : 4} ${s.len * k}) rotate(${j % 2 ? -40 : 40})`}>
                  <path
                    ref={(el) => {
                      leafEls.current[i * 3 + j] = el;
                    }}
                    d="M0 0 C 10 -6 20 -2 24 6 C 14 10 4 8 0 0 Z"
                    fill={j % 2 ? "#6fbf4a" : "#5aa83e"}
                  />
                </g>
              ))}
              {s.flower ? (
                <g
                  ref={(el) => {
                    bloomEls.current[i] = el;
                  }}
                  transform={`translate(2 ${s.len + 6})`}
                >
                  {[0, 72, 144, 216, 288].map((a) => (
                    <ellipse key={a} cx="0" cy="-7" rx="5.5" ry="8" transform={`rotate(${a})`} fill={s.flower === "pink" ? "#ff9cc0" : "#fffaf2"} />
                  ))}
                  <circle r="4.5" fill="#ffc93c" />
                </g>
              ) : (
                <path transform={`translate(2 ${s.len})`} d="M0 0 C 8 4 10 14 2 20 C -6 14 -6 4 0 0 Z" fill="#6fbf4a" />
              )}
            </g>
          </g>
        ))}

        {/* Petals carried off by the breeze */}
        {!reduced &&
          PETALS.map((p, i) => (
            <ellipse key={i} className="tb-petal" cx={p.x} cy={H * 0.5} rx="5.5" ry="3.5" fill={p.pink ? "#ffb3cf" : "#fffaf2"} style={{ animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
          ))}

        {/* Living Bluebirds on the letters */}
        {[0, 1].map((i) => (
          <g key={i} ref={(el) => {
            birdEls.current[i] = el;
          }} className="tb-bird" style={{ display: reduced ? "" : "none" }} transform={reduced ? `translate(${PERCHES[i * 2][0]} ${PERCHES[i * 2][1]}) scale(1.7)` : undefined}>
            <BirdShape />
          </g>
        ))}

        {/* Bird song notes */}
        {[0, 1].map((i) => (
          <text key={i} ref={(el) => {
            noteEls.current[i] = el;
          }} fontSize="32" fill="#FFF8EB" stroke="#3a6a2a" strokeWidth="1.5" style={{ display: "none" }}>
            ♪
          </text>
        ))}
      </svg>
    </div>
  );
}
