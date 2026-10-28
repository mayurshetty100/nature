/**
 * Procedural soundscape (Web Audio, no files): calm generative music, wind,
 * birds by day / crickets by night, river water, footsteps, vehicle engine and
 * celebration effects. Created on the first user gesture.
 */
import { enginePitch, RIDES, type EngineVoice, type RideId } from "./vehicles";

const PENTA = [0, 2, 4, 7, 9];
const CHORDS = [
  [48, 55, 64, 71], // Cmaj7
  [45, 52, 60, 67], // Am7
  [41, 48, 57, 64], // Fmaj7
  [43, 50, 59, 64], // G6
];
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class SoundEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private amb!: GainNode;
  private sfx!: GainNode;
  private reverb!: ConvolverNode;
  private noise!: AudioBuffer;
  private water!: GainNode;
  private wind!: GainNode;
  private engine: ReturnType<SoundEngine["makeEngine"]> | null = null;
  private timers: number[] = [];
  private muted = false;
  night = 0;
  private bar = 0;

  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = 0.16;
    this.music.connect(this.master);
    this.music.connect(this.reverb);
    this.amb = ctx.createGain();
    this.amb.gain.value = 0.5;
    this.amb.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.7;
    this.sfx.connect(this.master);
    this.sfx.connect(this.reverb);

    this.noise = this.noiseBuffer(4);
    // wind bed
    {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 380;
      this.wind = ctx.createGain();
      this.wind.gain.value = 0.12;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.06;
      lfo.connect(lfoGain).connect(this.wind.gain);
      lfo.start();
      src.connect(f).connect(this.wind).connect(this.amb);
      src.start();
    }
    // river / waterfall bed (volume follows distance)
    {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      src.playbackRate.value = 0.8;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1100;
      f.Q.value = 0.6;
      this.water = ctx.createGain();
      this.water.gain.value = 0;
      src.connect(f).connect(this.water).connect(this.amb);
      src.start();
    }
    this.scheduleMusic();
    this.scheduleCreatures();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.15);
  }

  /** Called ~10×/s from the scene. */
  update(o: { water: number; night: number; riding: RideId | null; speed: number }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.night = o.night;
    this.water.gain.setTargetAtTime(Math.min(0.5, o.water * 0.5), t, 0.3);
    this.wind.gain.setTargetAtTime(0.1 + o.night * 0.04 + (o.riding ? Math.min(0.12, o.speed * 0.004) : 0), t, 0.6);
    if (o.riding) {
      const def = RIDES[o.riding];
      if (this.engine && this.engine.id !== o.riding) this.stopEngine();
      if (!this.engine) this.engine = this.makeEngine(o.riding, def.engine);
      const e = this.engine;
      const v = def.engine;
      const f = enginePitch(v, o.speed, def.topSpeed);
      const load = Math.min(1, Math.abs(o.speed) / Math.max(1, def.topSpeed));
      e.osc.frequency.setTargetAtTime(f, t, 0.06);
      e.osc2.frequency.setTargetAtTime(f * 2.005, t, 0.06);
      e.sub.frequency.setTargetAtTime(f * 0.5, t, 0.06);
      e.filter.frequency.setTargetAtTime(v.filter * (0.55 + load * 1.1), t, 0.08);
      e.gain.gain.setTargetAtTime(v.gain * (0.7 + load * 0.6), t, 0.08);
      if (e.whine) {
        e.whine.osc.frequency.setTargetAtTime(900 + load * 2600, t, 0.08);
        e.whine.gain.gain.setTargetAtTime(v.whine * load, t, 0.1);
      }
      if (e.wash) e.wash.gain.setTargetAtTime(Math.min(0.35, 0.04 + load * 0.4), t, 0.2);
    } else if (this.engine) this.stopEngine();
  }

  private stopEngine() {
    const e = this.engine;
    if (!e || !this.ctx) return;
    const t = this.ctx.currentTime;
    e.gain.gain.setTargetAtTime(0, t, 0.12);
    e.wash?.gain.setTargetAtTime(0, t, 0.2);
    e.whine?.gain.gain.setTargetAtTime(0, t, 0.1);
    for (const n of e.nodes) n.stop(t + 0.9);
    this.engine = null;
  }

  /** Engine turning over: a short starter whirr and a rev blip in the vehicle's own voice. */
  engineStart(id: RideId) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const v = RIDES[id].engine;
    const o = ctx.createOscillator();
    o.type = v.wave;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = v.filter * 1.4;
    const g = ctx.createGain();
    o.frequency.setValueAtTime(v.base * 0.5, t);
    o.frequency.linearRampToValueAtTime(v.base * 0.8, t + 0.25);
    o.frequency.exponentialRampToValueAtTime(v.base + v.rev * 0.9, t + 0.55);
    o.frequency.exponentialRampToValueAtTime(v.base, t + 1.1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v.gain * 1.6, t + 0.08);
    g.gain.setValueAtTime(v.gain * 1.6, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 1.25);
  }

  /** Swoosh of magic (vehicle summoned, teleport, flight). */
  whoosh() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 3, 0.65);
    this.bell(mtof(91), t + 0.35, 0.06, 1.2);
  }

  /** Splash entering water (strength 0..1). */
  splash(k = 0.6) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(400, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25 + k * 0.4, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35 + k * 0.4);
    src.connect(f).connect(g).connect(this.amb);
    src.start(t, Math.random() * 3, 1);
  }

  /** Thud of suspension hitting a bump / a hard landing. */
  bump(k = 0.5) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08 + k * 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.3);
  }

  /** Wooden door creak + latch. */
  door() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(180, t);
    o.frequency.linearRampToValueAtTime(240, t + 0.25);
    o.frequency.linearRampToValueAtTime(160, t + 0.4);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 900;
    f.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.45);
    this.bump(0.15);
  }

  /** Each pet's happy little call. */
  chirp(pet: string) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const voice: Record<string, [number, number, OscillatorType, number]> = {
      panda: [300, 220, "triangle", 2],
      penguin: [900, 1300, "square", 3],
      bunny: [1800, 2400, "sine", 2],
      dragon: [420, 180, "sawtooth", 1],
      cat: [700, 980, "triangle", 1],
      puppy: [620, 420, "square", 2],
      fox: [1100, 1500, "triangle", 3],
      byte: [1400, 2100, "square", 2],
    };
    const [a, b, type, n] = voice[pet] ?? voice.cat;
    for (let i = 0; i < n; i++) {
      const st = t + i * 0.13;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(a, st);
      o.frequency.exponentialRampToValueAtTime(b, st + 0.1);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 2400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(type === "sine" ? 0.05 : 0.025, st + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.12);
      o.connect(f).connect(g).connect(this.sfx);
      o.start(st);
      o.stop(st + 0.14);
    }
  }

  /** A little songbird tweet (the birds on the title sign). */
  songbird(pitch = 1) {
    if (!this.ctx || document.hidden) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const st = t + i * (0.09 + Math.random() * 0.05);
      const o = ctx.createOscillator();
      o.type = "sine";
      const f0 = (3200 + Math.random() * 900) * pitch;
      o.frequency.setValueAtTime(f0, st);
      o.frequency.exponentialRampToValueAtTime(f0 * (1.25 + Math.random() * 0.3), st + 0.035);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.8, st + 0.07);
      // a quick trill on top
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 38;
      const lg = ctx.createGain();
      lg.gain.value = f0 * 0.04;
      lfo.connect(lg).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.035, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.08);
      o.connect(g).connect(this.sfx);
      o.start(st);
      lfo.start(st);
      o.stop(st + 0.09);
      lfo.stop(st + 0.09);
    }
  }

  /** A soft, friendly animal call when you pat a creature. */
  animal(voice: string) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // [start Hz, end Hz, wave, seconds, vibrato Hz, vibrato depth Hz, lowpass Hz, repeats]
    const V: Record<string, [number, number, OscillatorType, number, number, number, number, number]> = {
      moo: [150, 118, "sawtooth", 0.9, 5, 4, 700, 1],
      neigh: [620, 380, "sawtooth", 0.75, 14, 40, 1800, 1],
      baa: [330, 300, "sawtooth", 0.5, 22, 18, 1500, 1],
      oink: [260, 200, "square", 0.12, 0, 0, 900, 2],
      purr: [70, 64, "sawtooth", 0.9, 26, 6, 420, 1],
      trumpet: [380, 560, "sawtooth", 0.7, 7, 14, 2200, 1],
      yip: [1100, 1500, "triangle", 0.1, 0, 0, 3000, 2],
      coo: [520, 440, "sine", 0.35, 6, 10, 2000, 1],
    };
    const [a, b, type, dur, vr, vd, lp, n] = V[voice] ?? V.coo;
    for (let i = 0; i < n; i++) {
      const st = t + i * (dur + 0.06);
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(a, st);
      o.frequency.exponentialRampToValueAtTime(b, st + dur);
      if (vr > 0) {
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = vr;
        lg.gain.value = vd;
        lfo.connect(lg).connect(o.frequency);
        lfo.start(st);
        lfo.stop(st + dur + 0.05);
      }
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = lp;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(type === "sine" || type === "triangle" ? 0.07 : 0.045, st + Math.min(0.06, dur * 0.3));
      g.gain.setValueAtTime(type === "sine" || type === "triangle" ? 0.07 : 0.045, st + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
      o.connect(f).connect(g).connect(this.sfx);
      o.start(st);
      o.stop(st + dur + 0.05);
    }
  }

  /** Sparkly flourish for an explorer's signature emote. */
  emote() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [76, 79, 83, 88, 91].forEach((m, i) => this.bell(mtof(m), t + i * 0.07, 0.09, 1.0, "triangle"));
  }

  step(soft = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = soft ? 500 : 700 + Math.random() * 300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(soft ? 0.12 : 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(f).connect(g).connect(this.amb);
    src.start(t, Math.random() * 3, 0.12);
  }

  /** Magical reveal chime. */
  chime() {
    if (!this.ctx) return;
    [84, 88, 91, 96, 100].forEach((m, i) => this.bell(mtof(m), this.ctx!.currentTime + i * 0.09, 0.16, 1.8));
  }

  /** Light "hup" when jumping. */
  hop() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.2);
  }

  /** Friendly two-tone horn (pitch scales the tone: bikes beep high, the yacht toots low). */
  horn(pitch = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const [f, at] of [
      [392, 0],
      [494, 0],
      [392, 0.22],
      [494, 0.22],
    ] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1400;
      o.type = "sawtooth";
      o.frequency.value = f * pitch;
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(0.035, t + at + 0.02);
      g.gain.setValueAtTime(0.035, t + at + 0.14);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.19);
      o.connect(lp).connect(g).connect(this.sfx);
      o.start(t + at);
      o.stop(t + at + 0.22);
    }
  }

  bellRing() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.bell(2600, t, 0.12, 0.6);
    this.bell(2600, t + 0.14, 0.1, 0.8);
  }

  /** Celebration: fanfare + a series of fireworks. */
  fanfare() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => this.bell(mtof(m), t + i * 0.16, 0.14, 1.2, "triangle"));
    for (let i = 0; i < 9; i++) this.firework(t + 0.6 + i * 0.75 + Math.random() * 0.3);
  }

  firework(at?: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = at ?? ctx.currentTime;
    // whistle
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(700, t);
    o.frequency.exponentialRampToValueAtTime(2200, t + 0.7);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.03, t + 0.1);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
    o.connect(og).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.75);
    // boom
    const b = ctx.createBufferSource();
    b.buffer = this.noise;
    const bf = ctx.createBiquadFilter();
    bf.type = "lowpass";
    bf.frequency.value = 900;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t + 0.72);
    bg.gain.exponentialRampToValueAtTime(0.5, t + 0.74);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 2);
    b.connect(bf).connect(bg).connect(this.sfx);
    b.start(t + 0.72, Math.random(), 1.4);
    // crackle
    for (let k = 0; k < 10; k++) {
      const c = ctx.createBufferSource();
      c.buffer = this.noise;
      const cf = ctx.createBiquadFilter();
      cf.type = "highpass";
      cf.frequency.value = 3000;
      const cg = ctx.createGain();
      const ct = t + 0.9 + k * 0.06 + Math.random() * 0.2;
      cg.gain.setValueAtTime(0.0001, ct);
      cg.gain.exponentialRampToValueAtTime(0.08, ct + 0.005);
      cg.gain.exponentialRampToValueAtTime(0.0001, ct + 0.05);
      c.connect(cf).connect(cg).connect(this.sfx);
      c.start(ct, Math.random() * 3, 0.06);
    }
  }

  private bell(freq: number, t: number, vol: number, dur: number, type: OscillatorType = "sine") {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = freq * 2.01;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(this.sfx);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  /**
   * One engine voice per vehicle: two detuned oscillators + a sub through a
   * low-pass, an amplitude "lope" (V-twin rattle, jeep burble), an optional
   * turbo/electric whine and, for the yacht, a hull-wash noise bed.
   */
  private makeEngine(id: RideId, v: EngineVoice) {
    const ctx = this.ctx!;
    const nodes: AudioScheduledSourceNode[] = [];
    const osc = ctx.createOscillator();
    osc.type = v.wave;
    const osc2 = ctx.createOscillator();
    osc2.type = v.wave2;
    osc2.detune.value = 9;
    const sub = ctx.createOscillator();
    sub.type = "sine";
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = v.filter;
    filter.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const lopeGain = ctx.createGain();
    lopeGain.gain.value = 1;
    const g2 = ctx.createGain();
    g2.gain.value = 0.4;
    const gs = ctx.createGain();
    gs.gain.value = 0.7;
    osc.connect(filter);
    osc2.connect(g2).connect(filter);
    sub.connect(gs).connect(filter);
    filter.connect(lopeGain).connect(gain).connect(this.sfx);
    nodes.push(osc, osc2, sub);
    if (v.lope > 0) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = v.lope;
      lfo.type = "square";
      const depth = ctx.createGain();
      depth.gain.value = 0.35;
      lfo.connect(depth).connect(lopeGain.gain);
      lfo.start();
      nodes.push(lfo);
    }
    let whine: { osc: OscillatorNode; gain: GainNode } | null = null;
    if (v.whine > 0) {
      const wo = ctx.createOscillator();
      wo.type = "sine";
      const wg = ctx.createGain();
      wg.gain.value = 0;
      wo.connect(wg).connect(this.sfx);
      wo.start();
      nodes.push(wo);
      whine = { osc: wo, gain: wg };
    }
    let wash: GainNode | null = null;
    if (RIDES[id].kind === "boat") {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 700;
      wash = ctx.createGain();
      wash.gain.value = 0;
      src.connect(f).connect(wash).connect(this.amb);
      src.start();
      nodes.push(src);
    }
    osc.start();
    osc2.start();
    sub.start();
    return { id, osc, osc2, sub, gain, filter, whine, wash, nodes };
  }

  private scheduleMusic() {
    const ctx = this.ctx!;
    const beat = 60 / 76;
    let next = ctx.currentTime + 0.3;
    const tick = () => {
      if (!this.ctx) return;
      while (next < ctx.currentTime + 1.5) {
        const chord = CHORDS[this.bar % CHORDS.length];
        // soft pad, one chord per bar (4 beats)
        chord.forEach((m) => this.pad(mtof(m), next, beat * 4));
        // gentle marimba melody on eighth notes
        for (let e = 0; e < 8; e++) {
          if (Math.random() < (this.night > 0.6 ? 0.22 : 0.38)) {
            const deg = PENTA[Math.floor(Math.random() * PENTA.length)];
            const oct = Math.random() < 0.6 ? 72 : 84;
            this.pluck(mtof(oct + deg), next + e * beat * 0.5);
          }
        }
        next += beat * 4;
        this.bar++;
      }
    };
    tick();
    this.timers.push(window.setInterval(tick, 500));
  }

  private pad(freq: number, t: number, dur: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    o.detune.value = (Math.random() - 0.5) * 8;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
    o.connect(f).connect(g).connect(this.music);
    o.start(t);
    o.stop(t + dur * 1.1);
  }

  private pluck(freq: number, t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + 1.2);
  }

  private scheduleCreatures() {
    const loop = () => {
      if (!this.ctx) return;
      if (this.night < 0.6) this.bird();
      else this.cricket();
      const wait = this.night < 0.6 ? 1200 + Math.random() * 3800 : 700 + Math.random() * 1400;
      this.timers.push(window.setTimeout(loop, wait));
    };
    this.timers.push(window.setTimeout(loop, 1500));
  }

  private bird() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.amb);
    const base = 2200 + Math.random() * 1800;
    const notes = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < notes; i++) {
      const st = t + i * (0.09 + Math.random() * 0.06);
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), st);
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.35), st + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.05 * (1 - this.night), st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.08);
      o.connect(g).connect(pan);
      o.start(st);
      o.stop(st + 0.1);
    }
  }

  private cricket() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.amb);
    for (let i = 0; i < 3; i++) {
      const st = t + i * 0.05;
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = 4400 + Math.random() * 300;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 4500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.012 * this.night, st + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.035);
      o.connect(f).connect(g).connect(pan);
      o.start(st);
      o.stop(st + 0.04);
    }
  }

  private noiseBuffer(sec: number) {
    const ctx = this.ctx!;
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02; // brownish
      d[i] = last * 3.5 * 0.6 + w * 0.4;
    }
    return b;
  }

  private impulse(sec: number) {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * sec;
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return b;
  }

  dispose() {
    this.timers.forEach((id) => {
      clearTimeout(id);
      clearInterval(id);
    });
    this.timers = [];
    void this.ctx?.close();
    this.ctx = null;
    this.engine = null;
  }
}

export const sound = new SoundEngine();
