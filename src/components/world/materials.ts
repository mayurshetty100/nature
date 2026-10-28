import * as THREE from "three";
import { timeUniform } from "@/game/store";
import { ISLAND_P, ISLAND_RX, ISLAND_RZ } from "@/game/world";

/** Gentle wind sway for instanced foliage (vertex shader injection). */
export function addWind(mat: THREE.Material, strength: number) {
  // strength is a uniform (not baked into the code) so every swaying material shares ONE shader program —
  // otherwise each new plant type compiles its own shader and the game hitches when it first comes into view
  const uWind = { value: strength };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.uniforms.uWind = uWind;
    shader.vertexShader =
      "uniform float uTime;\nuniform float uWind;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #else
          vec2 ip = vec2(0.0);
        #endif
        float hgt = max(position.y, 0.0);
        float sway = sin(uTime * 1.4 + ip.x * 0.31 + ip.y * 0.17) * 0.6 + sin(uTime * 2.9 + ip.x * 0.7) * 0.25;
        transformed.x += sway * uWind * hgt * hgt;
        transformed.z += sway * uWind * 0.6 * hgt * hgt;`,
      );
  };
  mat.customProgramCacheKey = () => "wind";
}

const waterCommonVert = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const waterNoise = /* glsl */ `
  float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wNoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float wFbm(vec2 p) { return wNoise(p) * 0.55 + wNoise(p * 2.1 + 3.1) * 0.3 + wNoise(p * 4.3 + 7.7) * 0.15; }
`;

/**
 * Open sea: rolling swell normals, fine wind ripples, sky reflection by angle,
 * sun glitter, turquoise shallows, and surf that rolls in toward the beach and
 * breaks into foam on the sand.
 */
export function makeOceanMaterial() {
  const m = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uDeep: { value: new THREE.Color("#2f7f9e") },
        uShallow: { value: new THREE.Color("#5fc7c9") },
        uFoam: { value: new THREE.Color("#fff6e8") },
        uSun: { value: new THREE.Color("#ffd9a6") },
        uSky: { value: new THREE.Color("#bfe0ee") },
        uSunDir: { value: new THREE.Vector3(0.75, 0.3, -0.6).normalize() },
      },
    ]),
    vertexShader: waterCommonVert,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform vec3 uSun; uniform vec3 uSky; uniform vec3 uSunDir;
      varying vec2 vUv; varying vec3 vWorld;
      ${waterNoise}
      float edgeNoise(float a) {
        return 0.03*sin(3.0*a+1.0) + 0.022*sin(7.0*a+2.0) + 0.012*sin(13.0*a+0.5) + 0.007*sin(23.0*a+4.0);
      }
      vec2 swell(vec2 p, vec2 dir, float k, float amp, float sp) {
        vec2 d = normalize(dir);
        return d * cos(dot(d, p) * k + uTime * sp) * k * amp;
      }
      void main() {
        vec2 p = vWorld.xz;
        float a = atan(vWorld.z, vWorld.x);
        float P = ${ISLAND_P.toFixed(1)};
        float d = pow(pow(abs(vWorld.x) / ${ISLAND_RX.toFixed(1)}, P) + pow(abs(vWorld.z) / ${ISLAND_RZ.toFixed(1)}, P), 1.0 / P) + edgeNoise(a);
        float cs = vWorld.x / max(length(vWorld.xz), 0.001);
        float bw = vWorld.x > 0.0 ? smoothstep(0.62, 0.86, cs) : 0.0;
        float shallow = 1.0 - smoothstep(0.98 - bw * 0.06, 1.45, d);

        // surface normal: four swells + drifting wind ripples
        vec2 g = swell(p, vec2(1.0, 0.35), 0.16, 0.55, 1.05) + swell(p, vec2(-0.4, 1.0), 0.23, 0.35, 1.4)
               + swell(p, vec2(0.7, -0.8), 0.37, 0.18, 1.9) + swell(p, vec2(-1.0, -0.2), 0.61, 0.08, 2.6);
        vec2 q = p * 0.55 + vec2(uTime * 0.35, uTime * 0.21);
        float e = 0.2;
        float n0 = wFbm(q);
        vec2 gn = vec2(wFbm(q + vec2(e, 0.0)) - n0, wFbm(q + vec2(0.0, e)) - n0) / e;
        // calm the detail with distance so far water never stripes or shimmers
        float dist = length(cameraPosition - vWorld);
        float near = 1.0 - smoothstep(40.0, 320.0, dist);
        vec3 N = normalize(vec3(-(g.x * (0.25 + 0.75 * near) + gn.x * 0.22 * near), 1.0, -(g.y * (0.25 + 0.75 * near) + gn.y * 0.22 * near)));
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);

        // body colour: deep → turquoise shallows, with light caustic ripples near the island
        vec3 col = mix(uDeep, uShallow, shallow * 0.9);
        float caust = wFbm(p * 0.9 + vec2(uTime * 0.4, -uTime * 0.3));
        col += smoothstep(0.55, 0.85, caust) * 0.08 * shallow * uSun;
        // sky reflection by viewing angle (dimmer at night through the sun colour)
        float lum = clamp(dot(uSun, vec3(0.3, 0.5, 0.2)) * 1.3, 0.25, 1.0);
        col = mix(col, uSky * lum, fres * 0.6);
        // sun glitter
        vec3 H = normalize(normalize(uSunDir) + V);
        float spec = (pow(max(dot(N, H), 0.0), 220.0) * 2.2 * near + pow(max(dot(N, H), 0.0), 40.0) * 0.12);
        col += uSun * spec;

        // surf: wave crests roll in toward the shore and break into foam
        float shore = mix(0.985, 0.955, bw);
        float toShore = d - shore;
        float surfZone = smoothstep(0.11 + bw * 0.05, 0.0, toShore) * step(-0.02, toShore);
        float crest = fract(toShore * (70.0 - bw * 25.0) + uTime * 0.28 + edgeNoise(a * 3.0) * 4.0);
        float band = smoothstep(0.86, 0.97, crest) * smoothstep(1.0, 0.97, crest);
        float broken = smoothstep(0.35, 0.75, wFbm(p * 1.6 + vec2(uTime * 0.5, 0.0)));
        float surf = band * surfZone * (0.35 + 0.65 * broken) * (0.4 + bw * 0.6);
        // swash: foamy wash right at the waterline, pulsing up the sand
        float wash = toShore - 0.006 * (0.5 + 0.5 * sin(uTime * 0.7 + a * 9.0));
        float swash = smoothstep(0.022, 0.0, abs(wash)) * (0.55 + 0.45 * wFbm(p * 2.4 + uTime * 0.6));
        float lace = smoothstep(0.5, 0.8, wFbm(p * 3.0 - uTime * 0.4)) * smoothstep(0.05, 0.0, toShore) * 0.5;
        col = mix(col, uFoam, clamp(surf + swash * 0.9 + lace, 0.0, 1.0));

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  m.uniforms.uTime = timeUniform;
  return m;
}

/** Flowing water for rivers / pools (uv.y runs along the flow): streaming ripples, glints and foam at the banks. */
export function makeRiverMaterial(speed = 1.2) {
  const m = new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uDeep: { value: new THREE.Color("#3a9fb8") },
        uLight: { value: new THREE.Color("#8fe0dc") },
        uSpeed: { value: speed },
      },
    ]),
    vertexShader: waterCommonVert,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec3 uDeep; uniform vec3 uLight; uniform float uSpeed;
      varying vec2 vUv; varying vec3 vWorld;
      ${waterNoise}
      void main() {
        float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
        vec3 col = mix(uLight, uDeep, edge);
        // ripples streaming downstream (faster in the middle of the channel)
        float flow = uTime * uSpeed * (0.6 + edge * 0.6);
        vec2 q = vec2(vUv.x * 4.0, vUv.y * 1.6 - flow);
        float n = wFbm(q * vec2(1.0, 2.5));
        float streak = smoothstep(0.62, 0.9, wFbm(vec2(vUv.x * 9.0, vUv.y * 0.8 - flow * 1.3)));
        col += streak * 0.16 * edge;
        col += (n - 0.5) * 0.08;
        // sun glints dancing on the surface
        float glint = smoothstep(0.86, 0.98, wNoise(vec2(vUv.x * 30.0, vUv.y * 12.0 - flow * 3.0)));
        col += glint * 0.35;
        // white foam where the water rubs the banks
        float bank = 1.0 - smoothstep(0.0, 0.14, min(vUv.x, 1.0 - vUv.x));
        float foam = bank * smoothstep(0.35, 0.7, wFbm(vec2(vUv.x * 14.0, vUv.y * 3.0 - flow * 1.6)));
        col = mix(col, vec3(0.97, 0.99, 1.0), foam * 0.75);
        gl_FragColor = vec4(col, 0.9 + edge * 0.06);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  m.uniforms.uTime = timeUniform;
  return m;
}

/**
 * Falling water: fast vertical streaks that stretch as the water accelerates,
 * a glassy teal core near the lip that turns into churning white foam lower
 * down, ragged see-through edges and a soft fade into the mist at the base.
 * `layer` 0 = main sheet, 1 = outer spray veil (whiter, rougher, fainter).
 */
export function makeWaterfallMaterial(layer = 0) {
  const m = new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSeed: { value: 0 }, uLayer: { value: layer } }]),
    vertexShader: waterCommonVert,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform float uSeed; uniform float uLayer;
      varying vec2 vUv; varying vec3 vWorld;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        float x = vUv.x;
        float t = 1.0 - vUv.y;               // 0 at the lip, 1 at the base
        float fall = t * t * 2.2 + t * 1.2;  // accelerating: streaks stretch lower down
        float sp = uTime * (1.5 + uLayer * 0.6);
        // long vertical streaks (high frequency across, stretched along)
        float streak = fbm(vec2(x * 26.0 + uSeed, fall * 1.6 - sp));
        float fine = n(vec2(x * 70.0 + uSeed * 3.0, fall * 4.0 - sp * 2.3));
        // churning foam grows with the drop
        float churn = fbm(vec2(x * 9.0 + uSeed, fall * 3.0 - sp * 1.4));
        float foam = smoothstep(0.35, 0.85, churn + t * 0.55 + uLayer * 0.25);
        vec3 deep = vec3(0.30, 0.62, 0.70);
        vec3 glass = vec3(0.62, 0.86, 0.92);
        vec3 white = vec3(0.96, 0.99, 1.0);
        vec3 col = mix(deep, glass, streak);
        col = mix(col, white, clamp(foam * 0.85 + fine * 0.25 * t, 0.0, 1.0));
        // ragged, wind-torn edges
        float edgeN = fbm(vec2(fall * 2.0 - sp * 0.8, x * 3.0 + uSeed)) * 0.22;
        float side = smoothstep(0.0, 0.16 + edgeN, x) * smoothstep(1.0, 0.84 - edgeN, x);
        float a = side * mix(0.62 + streak * 0.3, 0.9, foam);
        a *= mix(1.0, 0.35 + fine * 0.5, uLayer);       // veil is patchy
        a *= smoothstep(0.0, 0.05, t);                  // soft lip
        a *= 1.0 - smoothstep(0.82, 1.0, t) * 0.75;     // dissolves into mist
        gl_FragColor = vec4(col, a * (uLayer > 0.5 ? 0.45 : 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  m.uniforms.uTime = timeUniform;
  return m;
}

/** Storybook cobblestone road texture (u across the road, v along it). */
export function makeCobbleTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#b8925f";
  g.fillRect(0, 0, c.width, c.height);
  let seed = 7;
  const r = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const tones = ["#e3c697", "#d8b885", "#ceac78", "#e9d2a6", "#d2b07e", "#c9a46f"];
  const rowH = 36;
  for (let y = -rowH; y < c.height + rowH; y += rowH) {
    let x = (y / rowH) % 2 === 0 ? 0 : -22;
    while (x < c.width) {
      const w = 34 + r() * 22;
      g.fillStyle = tones[Math.floor(r() * tones.length)];
      g.beginPath();
      const rr = 9;
      const px = x + 2.5;
      const py = y + 2.5;
      const pw = w - 5;
      const ph = rowH - 5;
      g.roundRect(px, py, pw, ph, rr);
      g.fill();
      g.fillStyle = "rgba(255,245,220,0.25)";
      g.beginPath();
      g.roundRect(px + 3, py + 3, pw - 10, ph * 0.35, 6);
      g.fill();
      x += w;
    }
  }
  // darker edges (kerb)
  const grad = g.createLinearGradient(0, 0, c.width, 0);
  grad.addColorStop(0, "rgba(120,85,45,0.28)");
  grad.addColorStop(0.08, "rgba(120,85,45,0)");
  grad.addColorStop(0.92, "rgba(120,85,45,0)");
  grad.addColorStop(1, "rgba(120,85,45,0.28)");
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function makePlankTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const tones = ["#9a6a3f", "#8b5d36", "#a7744a", "#946440"];
  const ph = 32;
  for (let y = 0; y < c.height; y += ph) {
    g.fillStyle = tones[(y / ph) % tones.length];
    g.fillRect(0, y, c.width, ph - 3);
    g.fillStyle = "#5b3a1f";
    g.fillRect(0, y + ph - 3, c.width, 3);
    g.fillStyle = "rgba(60,35,15,0.35)";
    g.fillRect(18, y + 12, 6, 6);
    g.fillRect(c.width - 24, y + 12, 6, 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Lit-window facade texture for city towers. */
export function makeWindowTexture(seedStart = 3) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#3d5f7d";
  g.fillRect(0, 0, c.width, c.height);
  let seed = seedStart;
  const r = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let y = 6; y < c.height; y += 16) {
    for (let x = 6; x < c.width; x += 14) {
      const lit = r() < 0.38;
      g.fillStyle = lit ? (r() < 0.5 ? "#ffd98a" : "#ffe9b8") : r() < 0.5 ? "#7fb2d4" : "#9cc6e0";
      g.fillRect(x, y, 9, 11);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** City avenue: dark asphalt, dashed centre line, white kerb lines (u across, v along). */
export function makeAsphaltTexture(base = "#5d6168") {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, c.width, c.height);
  let seed = 5;
  const r = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let k = 0; k < 900; k++) {
    g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
    g.fillRect(r() * c.width, r() * c.height, 2, 2);
  }
  // kerbs
  g.fillStyle = "#e9e4da";
  g.fillRect(0, 0, 9, c.height);
  g.fillRect(c.width - 9, 0, 9, c.height);
  g.fillStyle = "#f2efe8";
  g.fillRect(12, 0, 3, c.height);
  g.fillRect(c.width - 15, 0, 3, c.height);
  // dashed centre line
  g.fillStyle = "#f4cf5a";
  g.fillRect(c.width / 2 - 2, 20, 4, 90);
  g.fillRect(c.width / 2 - 2, 148, 4, 90);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Facade with a window grid (map) plus a mask of windows lit at night (lit). One tile = one window bay. */
export function makeFacadeTexture(kind: "apartment" | "glass") {
  const S = 64;
  const c = document.createElement("canvas");
  c.width = S * 4;
  c.height = S * 4;
  const m = document.createElement("canvas");
  m.width = c.width;
  m.height = c.height;
  const g = c.getContext("2d")!;
  const k = m.getContext("2d")!;
  k.fillStyle = "#000";
  k.fillRect(0, 0, m.width, m.height);
  let seed = kind === "glass" ? 17 : 9;
  const r = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  g.fillStyle = kind === "glass" ? "#dfeaf2" : "#ffffff";
  g.fillRect(0, 0, c.width, c.height);
  for (let ty = 0; ty < 4; ty++)
    for (let tx = 0; tx < 4; tx++) {
      const x0 = tx * S;
      const y0 = ty * S;
      const lit = r() < 0.42;
      if (kind === "glass") {
        g.fillStyle = r() < 0.5 ? "#6f9fc4" : "#82b2d4";
        g.fillRect(x0 + 2, y0 + 4, S - 4, S - 10);
        g.fillStyle = "rgba(255,255,255,0.35)";
        g.fillRect(x0 + 6, y0 + 8, 10, S - 18);
        if (lit) {
          k.fillStyle = "#fff";
          k.fillRect(x0 + 2, y0 + 4, S - 4, S - 10);
        }
      } else {
        // sill + frame + glass
        g.fillStyle = "#d9cfc0";
        g.fillRect(x0 + 14, y0 + 46, 36, 5);
        g.fillStyle = "#7c5a44";
        g.fillRect(x0 + 16, y0 + 12, 32, 34);
        g.fillStyle = r() < 0.5 ? "#8fc0dc" : "#a6d0e6";
        g.fillRect(x0 + 19, y0 + 15, 26, 28);
        g.fillStyle = "#7c5a44";
        g.fillRect(x0 + 31, y0 + 15, 2, 28);
        if (lit) {
          k.fillStyle = "#fff";
          k.fillRect(x0 + 19, y0 + 15, 26, 28);
        }
      }
    }
  const make = (cv: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(0.25, 0.25);
    t.anisotropy = 4;
    return t;
  };
  return { map: make(c), lit: make(m) };
}
