/**
 * Everything about HOW an avatar is described (not how it is drawn; that is components/Avatar.tsx).
 *
 * An avatar is just 8 small numbers, one per part: skin, hair style, hair colour, outfit colour, eyes, mouth,
 * accessory, background. We send them to the server as a short text code like "2-2-1-3-1-0-7-2". The server
 * checks every number is in range and shows the code to everybody in the room; every browser draws the same face.
 * No image is uploaded and nothing heavy is stored.
 */

export interface AvatarConfig {
  skin: number;
  hairStyle: number;
  hairColor: number;
  clothes: number;
  eyes: number;
  mouth: number;
  accessory: number;
  background: number;
}

// ---- The palette (outfit and background colours come from the EkScreen theme; skin and hair are natural tones) ----

export const SKIN = ["#F6D5B8", "#EBBE94", "#D49A6A", "#B97A4A", "#8D5A38", "#5E3A24"];
export const HAIR = ["#1B1410", "#3A2418", "#6B3A1E", "#A8581F", "#D9A441", "#C9C5BC"];
// Shirt / cap colours: cream, charcoal, gold, emerald, rose-gold, sage.
export const CLOTHES = ["#F3F4F6", "#1A2421", "#FBBF24", "#22C55E", "#E8B4A0", "#9BC4A8"];
// Gradients behind the face: deep, warm and calm, so every skin tone stands out.
export const BACKGROUNDS: [string, string][] = [
  ["#0b3d2a", "#1f9d62"], // emerald
  ["#5a3a10", "#d99a24"], // antique gold
  ["#123f3a", "#3fa58f"], // teal green
  ["#4a2f18", "#c27a3b"], // copper
  ["#1d3b2c", "#86c19a"], // sage
  ["#3d3314", "#e3c26a"], // champagne
];

// ---- Part order and option counts ---------------------------------------------------------------------------

/** The order the numbers are written in the code. */
export const PART_ORDER = [
  "skin",
  "hairStyle",
  "hairColor",
  "clothes",
  "eyes",
  "mouth",
  "accessory",
  "background",
] as const satisfies readonly (keyof AvatarConfig)[];

/** How many choices each part has. The SERVER keeps the same list (AVATAR_PART_COUNTS in domain.ts). */
export const PART_COUNTS: Record<keyof AvatarConfig, number> = {
  skin: SKIN.length, // 6
  hairStyle: 9, // 0 crop, 1 side-swept, 2 long, 3 bun, 4 curly, 5 cap, 6 bald, 7 bob, 8 ponytail
  hairColor: HAIR.length, // 6
  clothes: CLOTHES.length, // 6
  eyes: 4,
  mouth: 4,
  accessory: 8, // 0 none, 1 beard, 2 round glasses, 3 sunglasses, 4 headphones, 5 bow tie, 6 party hat, 7 moustache
  background: BACKGROUNDS.length, // 6
};

export const HAIR_STYLE_NAMES = ["Short", "Side-swept", "Long", "Bun", "Curly", "Cap", "Bald", "Bob", "Ponytail"];
export const ACCESSORY_NAMES = ["None", "Beard", "Glasses", "Shades", "Headphones", "Bow tie", "Party hat", "Moustache"];
/** "Mood" sets the eyes and the mouth together, so 4 moods = 4 matching pairs (they can never clash). */
export const MOOD_NAMES = ["Calm", "Cheerful", "Surprised", "Playful"];

const CAP = 5;
const PARTY_HAT = 6;
const HEADPHONES = 4;

/**
 * Removes combinations that cannot be drawn: a cap sits where headphones and a party hat would go, so a
 * cap wearer gets no accessory in that case. Used by the picker (so the buttons always tell the truth)
 * and by the drawing code (so even a hand-made code looks right).
 */
export function normalizeAvatar(c: AvatarConfig): AvatarConfig {
  if (c.hairStyle === CAP && (c.accessory === PARTY_HAT || c.accessory === HEADPHONES)) return { ...c, accessory: 0 };
  return c;
}

// ---- Encode / decode ---------------------------------------------------------------------------------------

export function encodeAvatar(c: AvatarConfig): string {
  return PART_ORDER.map((key) => c[key]).join("-");
}

/** Turns "2-2-1-3-1-0-7-2" back into numbers. Returns null for anything malformed or out of range. */
export function parseAvatar(code: string | null | undefined): AvatarConfig | null {
  if (!code) return null;
  const parts = code.split("-").map(Number);
  if (parts.length !== PART_ORDER.length) return null;
  const config = {} as AvatarConfig;
  for (let i = 0; i < PART_ORDER.length; i++) {
    const key = PART_ORDER[i];
    const n = parts[i];
    if (!Number.isInteger(n) || n < 0 || n >= PART_COUNTS[key]) return null;
    config[key] = n;
  }
  return config;
}

// ---- Seeded fallback (people who have no avatar code) -------------------------------------------------------

/** Turns any text into a stable number (FNV-1a hash). */
function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** One independent "dice roll" per feature: the salt makes each feature use a different part of the hash. */
const roll = (seed: string, salt: string, sides: number) => hash(`${salt}|${seed}`) % sides;

/** A face generated from text. Used only when nobody picked an avatar. Same seed = same face everywhere. */
export function avatarFromSeed(seed: string): AvatarConfig {
  const config = {} as AvatarConfig;
  for (const key of PART_ORDER) config[key] = roll(seed, key, PART_COUNTS[key]);
  config.mouth = config.eyes; // matching mood
  return config;
}

/** The face to draw: the picked one if it is valid, else one generated from the seed. */
export function resolveAvatar(code: string | null | undefined, seed: string): AvatarConfig {
  return normalizeAvatar(parseAvatar(code) ?? avatarFromSeed(seed));
}

export function randomAvatar(): AvatarConfig {
  const pick = (n: number) => Math.floor(Math.random() * n);
  const config = {} as AvatarConfig;
  for (const key of PART_ORDER) config[key] = pick(PART_COUNTS[key]);
  config.mouth = config.eyes;
  return normalizeAvatar(config);
}

// ---- Ready-made looks shown first in the picker (a mix, so everyone finds one that feels like them) ----------
// order: skin, hairStyle, hairColor, clothes, eyes, mouth, accessory, background
const preset = (code: string): AvatarConfig => parseAvatar(code)!;

export const PRESETS: AvatarConfig[] = [
  preset("1-2-1-3-2-2-0-0"), // long brown hair
  preset("2-3-0-2-0-0-2-1"), // bun + glasses
  preset("0-7-1-4-1-1-0-2"), // bob
  preset("3-8-3-5-0-0-0-3"), // ponytail
  preset("2-0-0-1-0-0-0-4"), // short hair
  preset("1-1-1-3-3-3-3-0"), // side-swept + shades
  preset("4-5-0-0-1-1-0-5"), // cap
  preset("4-4-0-2-2-2-0-1"), // curly
  preset("1-0-1-1-0-0-1-2"), // short hair + beard
  preset("3-1-0-3-1-1-7-4"), // side-swept + moustache
  preset("0-0-4-0-1-1-6-3"), // party hat
  preset("5-6-0-2-0-0-2-2"), // bald + glasses
];

// ---- Remember my last pick in this browser (convenience only, no secrets) ------------------------------------

const AVATAR_KEY = "ekscreen:avatar";
export const loadAvatarCode = (): string | null => {
  try {
    const saved = localStorage.getItem(AVATAR_KEY);
    return parseAvatar(saved) ? saved : null;
  } catch {
    return null;
  }
};
export const saveAvatarCode = (value: string): void => {
  try {
    localStorage.setItem(AVATAR_KEY, value);
  } catch {
    /* ignore: private mode / storage full */
  }
};
