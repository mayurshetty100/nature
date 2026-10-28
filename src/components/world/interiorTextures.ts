import * as THREE from "three";
import type { FloorTex, WallTex } from "@/game/interiors";

/** Light, mostly-neutral canvas patterns; each room tints them with its own colours. */
function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D, r: () => number) => void, repeat = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  let seed = 11;
  const r = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  draw(g, r);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const cache = new Map<string, THREE.Texture>();
const memo = (k: string, f: () => THREE.Texture) => {
  let t = cache.get(k);
  if (!t) {
    t = f();
    cache.set(k, t);
  }
  return t;
};

/** Floor pattern; one texture repeat covers 2 × 2 m. */
export function floorTexture(kind: FloorTex) {
  return memo(`f-${kind}`, () =>
    canvas(256, 256, (g, r) => {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, 256, 256);
      if (kind === "wood" || kind === "plank") {
        const rows = kind === "plank" ? 4 : 8;
        const hgt = 256 / rows;
        for (let i = 0; i < rows; i++) {
          const off = r() * 256;
          for (let x = -256; x < 512; x += kind === "plank" ? 256 : 128) {
            const shade = 0.82 + r() * 0.18;
            g.fillStyle = `rgb(${255 * shade},${245 * shade},${235 * shade})`;
            g.fillRect(x + off, i * hgt + 1, kind === "plank" ? 255 : 127, hgt - 2);
          }
          g.fillStyle = "rgba(60,35,15,0.35)";
          g.fillRect(0, i * hgt, 256, 1.5);
          for (let k = 0; k < 18; k++) {
            g.fillStyle = "rgba(90,55,25,0.08)";
            g.fillRect(r() * 256, i * hgt + r() * hgt, 30 + r() * 60, 1);
          }
        }
      } else if (kind === "tile" || kind === "marble") {
        const n = kind === "tile" ? 4 : 2;
        const s = 256 / n;
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            const shade = (i + j) % 2 && kind === "tile" ? 0.8 : 0.97;
            g.fillStyle = `rgb(${255 * shade},${255 * shade},${252 * shade})`;
            g.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
          }
        if (kind === "marble")
          for (let k = 0; k < 14; k++) {
            g.strokeStyle = "rgba(120,120,130,0.18)";
            g.lineWidth = 1 + r() * 1.5;
            g.beginPath();
            let x = r() * 256;
            let y = r() * 256;
            g.moveTo(x, y);
            for (let q = 0; q < 6; q++) {
              x += (r() - 0.5) * 70;
              y += (r() - 0.3) * 50;
              g.lineTo(x, y);
            }
            g.stroke();
          }
        g.fillStyle = "rgba(0,0,0,0.12)";
        for (let i = 0; i <= n; i++) {
          g.fillRect(i * s - 1, 0, 2, 256);
          g.fillRect(0, i * s - 1, 256, 2);
        }
      } else if (kind === "stone") {
        for (let y = 0; y < 256; y += 64)
          for (let x = (y / 64) % 2 ? -48 : 0; x < 256; x += 96) {
            const shade = 0.78 + r() * 0.2;
            g.fillStyle = `rgb(${255 * shade},${250 * shade},${240 * shade})`;
            g.fillRect(x + 2, y + 2, 92, 60);
          }
      } else {
        for (let k = 0; k < 3000; k++) {
          g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)";
          g.fillRect(r() * 256, r() * 256, 2, 2);
        }
      }
    }),
  );
}

/** Wall pattern; one repeat covers 3 m wide × one storey. */
export function wallTexture(kind: WallTex) {
  return memo(`w-${kind}`, () =>
    canvas(256, 256, (g, r) => {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, 256, 256);
      if (kind === "brick" || kind === "stone") {
        const bh = kind === "brick" ? 16 : 40;
        const bw = kind === "brick" ? 48 : 80;
        for (let y = 0; y < 256; y += bh)
          for (let x = (y / bh) % 2 ? -bw / 2 : 0; x < 256; x += bw) {
            const shade = 0.8 + r() * 0.2;
            g.fillStyle = `rgb(${255 * shade},${248 * shade},${238 * shade})`;
            g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
          }
      } else if (kind === "timber") {
        for (let x = 0; x < 256; x += 32) {
          const shade = 0.85 + r() * 0.15;
          g.fillStyle = `rgb(${255 * shade},${246 * shade},${236 * shade})`;
          g.fillRect(x + 1, 0, 30, 256);
          g.fillStyle = "rgba(70,40,20,0.25)";
          g.fillRect(x, 0, 1.5, 256);
        }
      } else if (kind === "glass") {
        g.fillStyle = "rgba(0,0,0,0.06)";
        for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 3, 256);
        g.fillRect(0, 200, 256, 3);
      } else {
        for (let k = 0; k < 2200; k++) {
          g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.025)" : "rgba(255,255,255,0.06)";
          g.fillRect(r() * 256, r() * 256, 3, 3);
        }
      }
    }),
  );
}

/** A little storybook landscape for picture frames. */
export function paintingTexture(seed: number) {
  return memo(`p-${seed}`, () =>
    canvas(
      192,
      128,
      (g, r) => {
        for (let i = 0; i < seed % 7; i++) r();
        const skies = [
          ["#ffd6a5", "#ff9a8b"],
          ["#a8e0ff", "#e8f7ff"],
          ["#c7b8ff", "#ffd1e8"],
          ["#ffe29a", "#ffa96b"],
        ];
        const [a, b] = skies[seed % skies.length];
        const grd = g.createLinearGradient(0, 0, 0, 128);
        grd.addColorStop(0, a);
        grd.addColorStop(1, b);
        g.fillStyle = grd;
        g.fillRect(0, 0, 192, 128);
        g.fillStyle = "#fff6d8";
        g.beginPath();
        g.arc(40 + r() * 110, 34 + r() * 20, 12, 0, Math.PI * 2);
        g.fill();
        const hills = ["#7fb069", "#5a8f55", "#3f6f4a"];
        hills.forEach((c, k) => {
          g.fillStyle = c;
          g.beginPath();
          g.moveTo(0, 128);
          for (let x = 0; x <= 192; x += 12) g.lineTo(x, 70 + k * 16 + Math.sin(x * 0.04 + r() * 2 + k) * 10);
          g.lineTo(192, 128);
          g.fill();
        });
      },
      false,
    ),
  );
}

/** Wall board with a heading and lines of text (resume content on landmark walls). */
export function boardTexture(title: string, lines: string[], dark = true) {
  return memo(`b-${title}-${lines.join("|")}`, () =>
    canvas(
      1024,
      640,
      (g) => {
        g.fillStyle = dark ? "#1d2b3a" : "#f7efe0";
        g.fillRect(0, 0, 1024, 640);
        g.strokeStyle = "#e7b45a";
        g.lineWidth = 10;
        g.strokeRect(14, 14, 996, 612);
        g.fillStyle = "#ffd27e";
        g.font = "bold 64px Georgia, serif";
        g.fillText(title, 56, 110);
        g.fillStyle = dark ? "#f3ead8" : "#3b2a1e";
        let y = 190;
        for (const raw of lines) {
          // wrap long lines
          const words = raw.split(" ");
          let line = "";
          g.font = "34px Arial, sans-serif";
          for (const w of words) {
            const test = line ? `${line} ${w}` : w;
            if (g.measureText(test).width > 900) {
              g.fillText(line, 56, y);
              y += 44;
              line = w;
            } else line = test;
          }
          g.fillText(`${line}`, 56, y);
          y += 62;
          if (y > 610) break;
        }
      },
      false,
    ),
  );
}
