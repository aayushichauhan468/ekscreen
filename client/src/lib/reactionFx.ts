import type { Transition, TargetAndTransition } from "framer-motion";

/**
 * The "look" of each reaction. Keeping it in one table means ReactionOverlay, ReactionBar and the store
 * all read from the same place, and adding a new emoji later is one new entry here.
 *
 * Colours stay inside the EkScreen palette (gold, champagne, emerald, cream) plus two warm accents
 * (ember orange, coral) for fire and hearts. No neon, no purple/magenta.
 */

const GOLD = "#FBBF24";
const CHAMPAGNE = "#F5E3B3";
const EMERALD = "#22C55E";
const CREAM = "#F3F4F6";
const EMBER = "#FB923C";
const CORAL = "#F87171";

type SparkShape = "dot" | "bar" | "star";

interface Fx {
  tint: string; // colour of the halo behind the emoji and of the light that blooms over the video
  colors: string[]; // colours of the little pieces that burst out
  shapes: SparkShape[];
  count: number; // how many pieces burst out
  spread: number; // how far they travel (px)
  lift: number; // extra upward push (px): fire sends embers up, confetti stays wide
  tagline: string; // small handwritten line shown in the combo chip
  idle: { animate: TargetAndTransition; transition: Transition }; // the emoji's own little "personality" motion
  hover: TargetAndTransition; // what the button does on hover in the reaction bar
}

/** A looping transition. `repeat: Infinity` keeps the personality motion going while the emoji floats. */
const loop = (duration: number): Transition => ({
  duration,
  repeat: Infinity,
  ease: "easeInOut",
});

export const REACTION_FX: Record<string, Fx> = {
  "❤️": {
    tint: "rgba(248,113,113,0.55)",
    colors: [CORAL, CHAMPAGNE, CREAM],
    shapes: ["dot", "star"],
    count: 9,
    spread: 70,
    lift: 20,
    tagline: "love in the room",
    idle: { animate: { scale: [1, 1.22, 1, 1.22, 1] }, transition: loop(1.1) }, // heartbeat: two quick beats
    hover: { scale: [1, 1.25, 1.1, 1.25], transition: { duration: 0.7 } },
  },
  "😂": {
    tint: "rgba(251,191,36,0.5)",
    colors: [GOLD, CHAMPAGNE, CREAM],
    shapes: ["dot", "star"],
    count: 9,
    spread: 75,
    lift: 10,
    tagline: "everyone is laughing",
    idle: { animate: { rotate: [-12, 12, -12], y: [0, -4, 0] }, transition: loop(0.45) }, // shaking with laughter
    hover: { rotate: [0, -14, 14, -14, 0], transition: { duration: 0.5 } },
  },
  "😮": {
    tint: "rgba(245,227,179,0.5)",
    colors: [CHAMPAGNE, CREAM, GOLD],
    shapes: ["dot", "star"],
    count: 8,
    spread: 65,
    lift: 10,
    tagline: "no way!",
    idle: { animate: { scale: [1, 1.18, 1] }, transition: loop(1.6) }, // gasp: slow breathe in, out
    hover: { scale: [1, 1.35, 1.15], transition: { duration: 0.35 } },
  },
  "👏": {
    tint: "rgba(251,191,36,0.5)",
    colors: [GOLD, CREAM, CHAMPAGNE],
    shapes: ["star", "dot"],
    count: 10,
    spread: 80,
    lift: 10,
    tagline: "applause!",
    idle: { animate: { rotate: [-18, 10, -18], scale: [1, 1.12, 1] }, transition: loop(0.4) }, // clapping
    hover: { rotate: [0, -20, 10, -20, 0], transition: { duration: 0.45 } },
  },
  "🔥": {
    tint: "rgba(251,146,60,0.6)",
    colors: [EMBER, GOLD, CORAL],
    shapes: ["dot", "dot", "star"],
    count: 11,
    spread: 55,
    lift: 70, // embers fly up
    tagline: "on fire!",
    idle: {
      animate: { scaleY: [1, 1.14, 0.95, 1.1, 1], scaleX: [1, 0.94, 1.04, 0.96, 1], rotate: [-3, 3, -2, 3, -3] },
      transition: loop(0.8), // flame flicker
    },
    hover: { y: [0, -6, 0], scale: [1, 1.2, 1.1], transition: { duration: 0.4 } },
  },
  "🎉": {
    tint: "rgba(251,191,36,0.55)",
    colors: [GOLD, EMERALD, CREAM, CORAL, CHAMPAGNE],
    shapes: ["bar", "bar", "dot", "star"],
    count: 18, // the big one: lots of confetti
    spread: 110,
    lift: 30,
    tagline: "party time!",
    idle: { animate: { rotate: [-10, 10, -10], y: [0, -6, 0] }, transition: loop(0.7) }, // bouncing
    hover: { rotate: [0, -15, 15, 0], y: [0, -6, 0], transition: { duration: 0.5 } },
  },
};

/** Fallback so an unknown emoji never crashes the overlay. */
const DEFAULT_FX = REACTION_FX["🎉"];
export const fxFor = (emoji: string): Fx => REACTION_FX[emoji] ?? DEFAULT_FX;

/** One piece of confetti / ember / sparkle. All numbers are decided once, when the reaction arrives. */
export interface Spark {
  id: number;
  shape: SparkShape;
  color: string;
  size: number; // px
  dx: number; // px it travels sideways
  dy: number; // px it travels vertically (negative = up)
  rot: number; // degrees it spins
  delay: number; // seconds
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pickOne = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/**
 * Creates the burst for one reaction. Pieces are spread evenly around a circle (with a little
 * randomness) so the burst always looks round and never clumps on one side.
 */
export function makeSparks(emoji: string): Spark[] {
  const fx = fxFor(emoji);
  return Array.from({ length: fx.count }, (_, i) => {
    const angle = (i / fx.count) * Math.PI * 2 + rand(-0.25, 0.25);
    const distance = fx.spread * rand(0.55, 1);
    const shape = pickOne(fx.shapes);
    return {
      id: i,
      shape,
      color: pickOne(fx.colors),
      size: shape === "bar" ? rand(5, 8) : shape === "star" ? rand(9, 14) : rand(4, 8), // stars need to be bigger to read as sparkles
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance * 0.8 - fx.lift,
      rot: rand(-320, 320),
      delay: rand(0, 0.08),
    };
  });
}
