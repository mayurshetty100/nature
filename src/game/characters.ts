import type { HeroMoveKind, PetMoveKind } from "./moves";
import type { PetPerk } from "./abilities";

/** Selectable explorers (CC0 Quaternius, restyled) and pets (CC0 Kenney Cube Pets + Byte + a cube dragon). */
export type HeroId = "mayur" | "kai" | "sora" | "hana" | "ren";
export type PetId = "byte" | "panda" | "penguin" | "bunny" | "dragon" | "cat" | "puppy" | "fox" | "none";
export type PowerId = "fly" | "speed" | "teleport" | "invisible" | "leap";

export type GearKind = "orbs" | "chain" | "headphones" | "gauntlets" | "wings";

export type HairStyle = "swept" | "spiky" | "silver" | "bun" | "shaggy";

/** How an explorer is painted / dressed on top of the base model. */
export type HeroLook = {
  skin: string;
  hair: string;
  /** material-name → colour overrides (outfit) */
  outfit?: Record<string, string>;
  /** sculpted hairstyle (and Mayur's moustache) added to the head bone */
  hairStyle?: HairStyle;
  /** light moustache (Mayur only) */
  moustache?: boolean;
  /** cloth band across the eyes */
  blindfold?: string;
  /** headband across the forehead */
  headband?: string;
  /** sunglasses (lens colour) */
  glasses?: string;
  /** scarf round the neck with tails that flutter */
  scarf?: string;
  /** stand-up coat collar */
  collar?: string;
  /** sakura flower pinned in the hair */
  flower?: string;
  /** cuffs on both wrists */
  wristbands?: string;
  /** footwear: upper, sole and optional trim band */
  shoes?: { color: string; sole: string; trim?: string };
  /** sash tails hanging from the belt */
  sash?: string;
  /** top layer: a long coat (to the knees), a hoodie, or an open jacket — shell colour, glowing radium trim, and the shirt seen at the front */
  jacket?: { style: "long" | "hoodie" | "open"; color: string; trim: string; inner: string; mat: string };
  /** loose, stacked baggy jeans with a glowing radium stitch down the side */
  jeans?: { color: string; stitch: string };
  /** muscle build: biceps, shoulders and chest V-taper (1 = athletic, < 1 leaner) */
  build?: number;
  /** a material made to glow softly (belt, details…) */
  glow?: { mat: string; color: string };
  /** rocket pack on the back — it fires up for the signature flight and Sky Flight */
  jetpack?: { color: string; glow: string; flame: string };
  /** cool extras (no stick weapons): floating orbs, gold chain, neck headphones, glowing gauntlets, petal wings */
  gear?: { kinds: GearKind[]; color: string; glow: string };
};

/** Fair, warm skin tone used for every explorer. */
export const FAIR_SKIN = "#f0c4a2";

export const POWERS: Record<PowerId, { name: string; how: string; seconds: number; cooldown: number }> = {
  fly: { name: "Sky Flight", how: "Jetpack on — own the skyline for a while", seconds: 12, cooldown: 6 },
  speed: { name: "Flash Rush", how: "Run at twice the speed — catch feelings, not traffic", seconds: 10, cooldown: 6 },
  teleport: { name: "Blink", how: "Vanish and reappear far ahead in a flash", seconds: 0, cooldown: 2.5 },
  invisible: { name: "Shadow Veil", how: "Turn invisible — gone, but never forgotten", seconds: 12, cooldown: 6 },
  leap: { name: "Moon Leap", how: "Moon-gravity jumps — land on rooftops like a rumour", seconds: 12, cooldown: 6 },
};

export type Hero = { id: HeroId; name: string; title: string; blurb: string; url: string; power: PowerId; look: HeroLook };

export const HEROES: Hero[] = [
  {
    id: "mayur",
    name: "Shetty",
    title: "The Heartbreak Architect",
    blurb: "Gold-lit long trench · baggy denim · rocket pack",
    url: "/models/people/Suit_Male.glb",
    power: "fly",
    look: {
      shoes: { color: "#141418", sole: "#f1ebe1", trim: "#ffb547" },
      skin: "#efc09c",
      hair: "#141010",
      outfit: { Black: "#17181e", Shirt: "#7a1e2c", Belt: "#141418", Details: "#2a2b31" },
      hairStyle: "swept",
      moustache: true,
      glasses: "#1d2430",
      build: 1.15,
      jacket: { style: "long", color: "#17181e", trim: "#ffb547", inner: "#7a1e2c", mat: "Black" },
      jeans: { color: "#26324f", stitch: "#ffb547" },
      glow: { mat: "Belt", color: "#ffb547" },
      gear: { kinds: ["chain"], color: "#e8b84a", glow: "#ffd27a" },
      jetpack: { color: "#2a2c34", glow: "#ffb547", flame: "#ff8a2a" },
    },
  },
  {
    id: "kai",
    name: "Blaze Romeo",
    title: "Speed-Dates at Light Speed",
    blurb: "Radium-line hoodie · baggy jeans · fire-fist gauntlets",
    url: "/models/people/Casual_Male.glb",
    power: "speed",
    look: {
      shoes: { color: "#1f4fb3", sole: "#f4efe6", trim: "#ffe14d" },
      skin: FAIR_SKIN,
      hair: "#121014",
      outfit: { Shirt: "#e8701a", Pants: "#2f5fa8", Belt: "#1b1d24" },
      hairStyle: "spiky",
      build: 1.2,
      jacket: { style: "hoodie", color: "#e8701a", trim: "#ffe14d", inner: "#1b1d24", mat: "Shirt" },
      jeans: { color: "#2f5fa8", stitch: "#ffe14d" },
      glow: { mat: "Belt", color: "#ffb02e" },
      gear: { kinds: ["gauntlets"], color: "#2a2c34", glow: "#ffb02e" },
    },
  },
  {
    id: "sora",
    name: "Vex Noir",
    title: "Teleports Into Your Thoughts",
    blurb: "Void long coat · cyan radium · infinity orbs",
    url: "/models/people/Casual2_Male.glb",
    power: "teleport",
    look: {
      shoes: { color: "#141826", sole: "#eef2f8", trim: "#8fd8ff" },
      skin: "#f4d2b8",
      hair: "#eef2f8",
      outfit: { Shirt: "#141826", Pants: "#171a24", Belt: "#2a3150" },
      hairStyle: "silver",
      blindfold: "#0c0d12",
      build: 1.05,
      jacket: { style: "long", color: "#141826", trim: "#8fd8ff", inner: "#232a45", mat: "Shirt" },
      jeans: { color: "#171a24", stitch: "#8fd8ff" },
      glow: { mat: "Belt", color: "#9a7bff" },
      gear: { kinds: ["orbs"], color: "#8fd8ff", glow: "#9a7bff" },
    },
  },
  {
    id: "hana",
    name: "Rosé Ruin",
    title: "Unseen, Still Unforgettable",
    blurb: "Midnight long jacket · sakura petal wings",
    url: "/models/people/Kimono_Female.glb",
    power: "invisible",
    look: {
      shoes: { color: "#8a1f3d", sole: "#f6e7d3", trim: "#ffc2d6" },
      skin: FAIR_SKIN,
      hair: "#24131a",
      outfit: { Clothes: "#f4a7c0", Band: "#8a1f3d" },
      hairStyle: "bun",
      flower: "#ffc2d6",
      build: 0.75,
      jacket: { style: "long", color: "#3a1626", trim: "#ff5c8a", inner: "#f4a7c0", mat: "Clothes" },
      glow: { mat: "Band", color: "#ff5c8a" },
      gear: { kinds: ["wings"], color: "#ffc2d6", glow: "#ff8fb4" },
    },
  },
  {
    id: "ren",
    name: "Jinx Casanova",
    title: "Leaps Straight Into Your DMs",
    blurb: "Storm hoodie · baggy jeans · neon headphones",
    url: "/models/people/Casual3_Male.glb",
    power: "leap",
    look: {
      shoes: { color: "#1d212c", sole: "#f1f1f1", trim: "#ff3b47" },
      skin: FAIR_SKIN,
      hair: "#2b2f45",
      outfit: { Shirt: "#262a35", Pants: "#1c2438", Belt: "#c8252f" },
      hairStyle: "shaggy",
      build: 1.15,
      jacket: { style: "hoodie", color: "#262a35", trim: "#6fc8ff", inner: "#14161d", mat: "Shirt" },
      jeans: { color: "#1c2438", stitch: "#ff3b47" },
      glow: { mat: "Belt", color: "#ff3b47" },
      gear: { kinds: ["headphones"], color: "#14161d", glow: "#ff3b47" },
    },
  },
];

/** How each pet keeps you company. */
export type PetBehavior = {
  /** distance kept beside / behind the explorer */
  side: number;
  back: number;
  /** follow responsiveness */
  follow: number;
  /** hop height while moving (bunny) */
  hop?: number;
  /** side-to-side waddle (penguin) */
  waddle?: number;
  /** hovers in the air (dragon) */
  fly?: number;
  /** plays this clip now and then while idle */
  idleTrick?: "eat" | "dance" | "gesture-positive";
  /** trots around the explorer while idle (fox) */
  circle?: boolean;
  /** runs a little ahead (puppy) */
  ahead?: boolean;
  /** slides on its belly when running fast (penguin) */
  slide?: boolean;
  /** puffs a little flame now and then (dragon) */
  puff?: boolean;
  /** wags its tail end while happy */
  wag?: boolean;
};

/** Little outfit piece worn by a pet. */
export type PetAccessory = { kind: "bow" | "scarf" | "collar" | "bandana" | "leaf" | "goggles"; color: string; bell?: boolean };

/** Headwear / costume piece on top of the accessory. */
export type PetOutfit = { kind: "straw" | "goggles" | "flowers" | "crown" | "cape" | "wizard"; color: string; trim: string };

/** Each pet's ability: a named perk that really works while it travels with you, plus a sparkle aura in its colours. */
export type PetMagic = { name: string; how: string; perk: PetPerk; colors: [string, string] };

/** A pet's signature stunt, shown in the picker and pulled now and then in the world. */
export type PetMove = { name: string; kind: PetMoveKind };

export type Pet = { id: PetId; name: string; blurb: string; url?: string; height?: number; behavior: PetBehavior; accessory?: PetAccessory; outfit?: PetOutfit; magic?: PetMagic; move?: PetMove; trait: string };

const CUBE = "/models/pets/animal-";

export const PETS: Pet[] = [
  { id: "byte", move: { name: "Glitch Orbit Spin", kind: "orbit" }, name: "Byte Me", blurb: "Robot cat, zero chill", trait: "Beeps hello and lights the way", magic: { name: "Overclock Purr", how: "your super power recharges twice as fast", perk: "cooldown", colors: ["#5fe3ff", "#b6f4ff"] }, behavior: { side: 1.3, back: 1.1, follow: 3.2 } },
  { id: "panda", move: { name: "Bamboo Barrel Roll", kind: "roll" }, name: "Bao Bae", blurb: "Clingy snack king", trait: "Munches bamboo when you rest", url: `${CUBE}panda.glb`, height: 0.85, accessory: { kind: "leaf", color: "#6fbf4a" }, outfit: { kind: "straw", color: "#e8c46a", trim: "#c8252f" }, magic: { name: "Snack Stamina", how: "your super power lasts 50% longer", perk: "duration", colors: ["#8fe36a", "#e6ffb3"] }, behavior: { side: 1.4, back: 1.3, follow: 2.6, idleTrick: "eat" } },
  { id: "penguin", move: { name: "Ice Queen Twirl", kind: "twirl" }, name: "Pip Cold-Heart", blurb: "Ice-cold, secretly soft", trait: "Belly-slides when you run", url: `${CUBE}penguin.glb`, height: 0.75, accessory: { kind: "scarf", color: "#e2483c" }, outfit: { kind: "goggles", color: "#7a4a2a", trim: "#8fd8ff" }, magic: { name: "Turbo Flippers", how: "you swim almost twice as fast", perk: "swim", colors: ["#bfefff", "#ffffff"] }, behavior: { side: 1.2, back: 1.2, follow: 3, waddle: 0.22, slide: true, idleTrick: "dance" } },
  { id: "bunny", move: { name: "Moon Backflip", kind: "backflip" }, name: "Mochi Heartthief", blurb: "Hops into hearts", trait: "Bounces everywhere", url: `${CUBE}bunny.glb`, height: 0.75, accessory: { kind: "bow", color: "#ff7eb3" }, outfit: { kind: "flowers", color: "#ffd1e6", trim: "#ffe066" }, magic: { name: "Moon Bounce", how: "you jump a quarter higher", perk: "jump", colors: ["#ff9ad5", "#fff0a8"] }, behavior: { side: 1.2, back: 1, follow: 3.6, hop: 0.35, idleTrick: "gesture-positive" } },
  { id: "dragon", move: { name: "Fire Loop-de-Loop", kind: "loop" }, name: "Ember Red Flag", blurb: "Tiny dragon, hot temper", trait: "Flies with you and puffs tiny flames", magic: { name: "Wing Glide", how: "you float down softly from any height", perk: "glide", colors: ["#ff8a2a", "#ffd23f"] }, height: 0.65, behavior: { side: 1.5, back: 1.4, follow: 3.4, fly: 2.4, puff: true } },
  { id: "cat", move: { name: "Moonlight Pounce", kind: "pounce" }, name: "Luna Femme Fatale", blurb: "Purrs, judges, steals hearts", trait: "Naps in the sun, jingles her bell", url: `${CUBE}cat.glb`, height: 0.75, accessory: { kind: "collar", color: "#7b5cd6", bell: true }, outfit: { kind: "crown", color: "#ffcf3f", trim: "#e84a8a" }, magic: { name: "Nine-Lives Climb", how: "you pull yourself up ledges twice as tall", perk: "climb", colors: ["#b48cff", "#fff1a8"] }, behavior: { side: 1.6, back: 1.5, follow: 2.8, idleTrick: "gesture-positive", wag: true } },
  { id: "puppy", move: { name: "Tail-Chase Zoomies", kind: "zoomies" }, name: "Biscuit Big Simp", blurb: "Loyal to a fault", trait: "Runs ahead and wags his tail", url: `${CUBE}dog.glb`, height: 0.8, accessory: { kind: "bandana", color: "#2f7fd6" }, outfit: { kind: "cape", color: "#d6283a", trim: "#ffcf3f" }, magic: { name: "Zoomies", how: "you walk and run 25% faster", perk: "speed", colors: ["#ffcf3f", "#ff6a3d"] }, behavior: { side: 1.1, back: -1.4, follow: 4, ahead: true, idleTrick: "dance", wag: true } },
  { id: "fox", move: { name: "Spirit Cartwheel", kind: "cartwheel" }, name: "Rusty Situationship", blurb: "Sly fox, mixed signals", trait: "Trots happy circles round you", url: `${CUBE}fox.glb`, height: 0.8, accessory: { kind: "scarf", color: "#2e8b57" }, outfit: { kind: "wizard", color: "#3b3f9e", trim: "#ffd84a" }, magic: { name: "Fox-Fire Nitro", how: "every ride goes 15% faster", perk: "ride", colors: ["#6fd8ff", "#c79bff"] }, behavior: { side: 1.3, back: 1.2, follow: 3.4, circle: true, wag: true } },
  { id: "none", name: "Lone Wolf", blurb: "Single and thriving", trait: "Just you and the open road", behavior: { side: 0, back: 0, follow: 0 } },
];

export const HERO_CLIPS = {
  idle: "CharacterArmature|Idle",
  walk: "CharacterArmature|Walk",
  dance: "CharacterArmature|Victory",
  sit: "CharacterArmature|SitDown",
  punch: "CharacterArmature|Punch",
  cast: "CharacterArmature|Shoot_OneHanded",
} as const;

/** How the hero sits on furniture (metres): drop onto the seat, and shift forward so the sit clip's hips land on the seat — never inside the chair back. */
export const SIT_POSE = { drop: 0.34, back: -0.2 };

export type EmoteFx = "confetti" | "aura" | "orbs" | "petals" | "storm";

/** Each explorer's signature emote (G key / emote button). */
/** Each explorer's signature move: emote clip + procedural limb timeline (`move`, see game/moves.ts) + effect. */
export const EMOTES: Record<HeroId, { name: string; clip: keyof typeof HERO_CLIPS; move: HeroMoveKind; fx: EmoteFx; seconds: number; spin?: boolean; colors: [string, string] }> = {
  mayur: { name: "Jetpack Boss Flight", clip: "idle", move: "jetpack", fx: "confetti", seconds: 4, colors: ["#ffcf5a", "#ff8a2a"] },
  kai: { name: "Fire-Fist Kung-Fu Combo", clip: "punch", move: "kungfu", fx: "aura", seconds: 3, colors: ["#ffd23f", "#ff8a1f"] },
  sora: { name: "Infinity Backflip", clip: "cast", move: "voidflip", fx: "orbs", seconds: 3, colors: ["#8fd8ff", "#9a7bff"] },
  hana: { name: "Sakura Spin-Kick Storm", clip: "idle", move: "blossomkick", fx: "petals", seconds: 3.4, colors: ["#ffc2d6", "#ff8fb4"] },
  ren: { name: "Thunder Dash Backflip", clip: "idle", move: "thunderflip", fx: "storm", seconds: 3.2, colors: ["#d8f4ff", "#6fc8ff"] },
};

/** Clip names shared by every Kenney cube pet. */
export const PET_CLIPS = { idle: "idle", walk: "walk", run: "run" } as const;
