/**
 * Every ride in the world in one table: the vehicle picked at the start (bikes,
 * cars, SUVs, the jeep) and the harbor yacht. Handling, terrain ability and
 * engine sound all come from here so the picker, the world and the audio agree.
 */
export type VehicleId = "superbike" | "scrambler" | "supercar" | "coupe" | "luxury" | "suv" | "jeep";
export type RideId = VehicleId | "yacht";
export type VehicleKind = "bike" | "car" | "boat";

/** Synth engine voice: two detuned oscillators through a low-pass filter, with gear shifts. */
export type EngineVoice = {
  /** idle frequency (Hz) */
  base: number;
  /** extra Hz at the top of each gear */
  rev: number;
  gears: number;
  wave: OscillatorType;
  wave2: OscillatorType;
  filter: number;
  gain: number;
  /** slow amplitude "lope" (Hz) — the jeep's burble, the bikes' rattle */
  lope: number;
  /** high turbo / electric whine on top (0 = none) */
  whine: number;
};

export type RideSkin = { body: string; accent: string; glow: string; rim: string; name: string };

export type VehicleDef = {
  id: RideId;
  name: string;
  type: string;
  blurb: string;
  kind: VehicleKind;
  /** model length in world units */
  length: number;
  /** collision radius */
  radius: number;
  topSpeed: number;
  /** throttle response (1/s) */
  accel: number;
  /** steering rate (rad/s at full lock) */
  turn: number;
  /** lateral grip 0..1 (lower = more drift) */
  grip: number;
  /** tallest rock / log it can roll over */
  climb: number;
  /** steepest grade it can still climb */
  slope: number;
  /** speed kept off the road (1 = no loss) */
  offroad: number;
  /** follow-camera distance */
  cam: number;
  /** 0..5 star ratings shown in the picker */
  stats: { speed: number; offroad: number; handling: number };
  engine: EngineVoice;
  /** custom paint job: body colour, accent wrap, glow (underglow, strips, rims) and rim colour */
  skin?: RideSkin;
  /** where the explorer sits / stands (local, metres); omitted = hidden inside a closed cabin */
  seat?: { x: number; y: number; z: number; pose: "sit" | "stand" };
};

export const VEHICLES: VehicleDef[] = [
  {
    id: "supercar",
    name: "Velvet Venom",
    type: "Hypercar",
    blurb: "Two-tone curves and a top speed that ruins first dates",
    kind: "car",
    length: 4.8,
    radius: 1.45,
    topSpeed: 38,
    accel: 1.9,
    turn: 2.6,
    grip: 0.8,
    climb: 0.45,
    slope: 1.5,
    offroad: 0.62,
    cam: 12,
    stats: { speed: 5, offroad: 2, handling: 4 },
    skin: { body: "#1d3fb8", accent: "#0b0d14", glow: "#6fd3ff", rim: "#c9ced6", name: "Midnight blue over carbon black" },
    engine: { base: 46, rev: 150, gears: 6, wave: "sawtooth", wave2: "sawtooth", filter: 820, gain: 0.055, lope: 0, whine: 0.018 },
  },
  {
    id: "superbike",
    name: "Midnight Seducer",
    type: "Race bike",
    blurb: "Full fairing, knee-down lean, zero chill",
    kind: "bike",
    length: 2.6,
    radius: 0.8,
    topSpeed: 33,
    accel: 2.6,
    turn: 3.6,
    grip: 0.9,
    climb: 0.55,
    slope: 1.9,
    offroad: 0.72,
    cam: 8.5,
    stats: { speed: 5, offroad: 3, handling: 5 },
    skin: { body: "#3fae3a", accent: "#121417", glow: "#b6ff5a", rim: "#3fae3a", name: "Race green over gloss black" },
    engine: { base: 78, rev: 260, gears: 6, wave: "sawtooth", wave2: "square", filter: 1300, gain: 0.05, lope: 0, whine: 0.008 },
    seat: { x: 0, y: 0.28, z: -0.35, pose: "sit" },
  },
  {
    id: "scrambler",
    name: "Toxic Ex RR",
    type: "Naked race bike",
    blurb: "No fairing, all attitude — grips forests, rocks and riverbeds",
    kind: "bike",
    length: 2.4,
    radius: 0.75,
    topSpeed: 24,
    accel: 3,
    turn: 4,
    grip: 0.85,
    climb: 1.05,
    slope: 2.6,
    offroad: 1,
    cam: 8,
    stats: { speed: 3, offroad: 5, handling: 5 },
    skin: { body: "#ff5a1f", accent: "#141518", glow: "#ff9a3d", rim: "#141518", name: "Blaze orange over matte black" },
    engine: { base: 60, rev: 170, gears: 5, wave: "square", wave2: "square", filter: 900, gain: 0.045, lope: 14, whine: 0 },
    seat: { x: 0, y: 0.2, z: -0.33, pose: "sit" },
  },
  {
    id: "coupe",
    name: "Heartbreaker V12",
    type: "Wedge supercar",
    blurb: "Sharp edges, scissor-door energy and a wing that means business",
    kind: "car",
    length: 4.5,
    radius: 1.4,
    topSpeed: 32,
    accel: 1.8,
    turn: 2.8,
    grip: 0.78,
    climb: 0.5,
    slope: 1.6,
    offroad: 0.7,
    cam: 11.5,
    stats: { speed: 5, offroad: 2, handling: 4 },
    skin: { body: "#f5b301", accent: "#121216", glow: "#ffd23f", rim: "#1d1e22", name: "Venom yellow · black rims" },
    engine: { base: 40, rev: 120, gears: 6, wave: "sawtooth", wave2: "triangle", filter: 620, gain: 0.05, lope: 0, whine: 0.006 },
  },
  {
    id: "luxury",
    name: "Silk Sin",
    type: "Hand-built hypercar",
    blurb: "Bubble glass, butter-soft ride and four pipes that purr your name",
    kind: "car",
    length: 4.8,
    radius: 1.5,
    topSpeed: 27,
    accel: 1.5,
    turn: 2.6,
    grip: 0.82,
    climb: 0.85,
    slope: 2.2,
    offroad: 0.88,
    cam: 12.5,
    stats: { speed: 4, offroad: 3, handling: 4 },
    skin: { body: "#7a1230", accent: "#121218", glow: "#ffb36b", rim: "#d7b46a", name: "Wine red · gold rims" },
    engine: { base: 30, rev: 70, gears: 8, wave: "triangle", wave2: "sine", filter: 360, gain: 0.04, lope: 0, whine: 0 },
  },
  {
    id: "suv",
    name: "Situationship GT",
    type: "Grand tourer",
    blurb: "Long hood, longer stares — never commits to one lane",
    kind: "car",
    length: 4.7,
    radius: 1.45,
    topSpeed: 25,
    accel: 1.5,
    turn: 2.7,
    grip: 0.84,
    climb: 0.95,
    slope: 2.4,
    offroad: 0.95,
    cam: 12.5,
    stats: { speed: 3, offroad: 4, handling: 3 },
    skin: { body: "#cfd4dc", accent: "#141820", glow: "#7fd8ff", rim: "#2a2d33", name: "Moonlit silver · black rims" },
    engine: { base: 34, rev: 85, gears: 5, wave: "sawtooth", wave2: "triangle", filter: 420, gain: 0.045, lope: 0, whine: 0 },
  },
  {
    id: "jeep",
    name: "Wild Thing Rally",
    type: "Rally supercar",
    blurb: "Lifted hypercar with a light bar — eats rocks and rivers for breakfast",
    kind: "car",
    length: 4.2,
    radius: 1.35,
    topSpeed: 23,
    accel: 1.7,
    turn: 3.1,
    grip: 0.86,
    climb: 1.35,
    slope: 3,
    offroad: 1,
    cam: 11,
    stats: { speed: 3, offroad: 5, handling: 4 },
    skin: { body: "#1f8a6a", accent: "#121417", glow: "#ffb547", rim: "#121417", name: "Jungle teal · amber light bar" },
    engine: { base: 26, rev: 75, gears: 5, wave: "square", wave2: "sawtooth", filter: 320, gain: 0.05, lope: 7, whine: 0 },
  },
];

export const YACHT: VehicleDef = {
  id: "yacht",
  name: "Sea-duction",
  type: "Private yacht",
  blurb: "Luxury cruiser: infinity pool, dinner on deck, a captain at the helm",
  kind: "boat",
  length: 12,
  radius: 3.1,
  topSpeed: 17,
  accel: 0.7,
  turn: 1.25,
  grip: 0.3,
  climb: 0,
  slope: 0,
  offroad: 1,
  cam: 19,
  stats: { speed: 3, offroad: 0, handling: 2 },
  engine: { base: 22, rev: 40, gears: 1, wave: "triangle", wave2: "sawtooth", filter: 240, gain: 0.05, lope: 3, whine: 0 },
  // at the helm in the bridge (upper deck)
  seat: { x: -0.35, y: 2.6, z: 1.45, pose: "stand" },
};

export const RIDES: Record<RideId, VehicleDef> = Object.fromEntries([...VEHICLES, YACHT].map((v) => [v.id, v])) as Record<RideId, VehicleDef>;

/** Water depth a land vehicle starts floating at (amphibious). */
export const FLOAT_DEPTH = 1.1;
/** Speed kept while floating / wading. */
export const WATER_SPEED = 0.55;
export const WADE_SPEED = 0.75;

/**
 * Engine pitch for a speed: revs climb through each gear then drop at the
 * shift, like a real gearbox. Returns Hz for the main oscillator.
 */
export function enginePitch(v: EngineVoice, speed: number, top: number) {
  const t = Math.max(0, Math.min(1, Math.abs(speed) / Math.max(top, 1)));
  const g = t * v.gears;
  const gear = Math.min(v.gears - 1, Math.floor(g));
  const inGear = g - gear;
  // first gear revs from idle; later gears start part-way up
  const rpm = gear === 0 ? inGear : 0.35 + inGear * 0.65;
  return v.base + v.rev * rpm * (1 + gear * 0.06);
}
