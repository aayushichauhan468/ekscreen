import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

/**
 * A bright, warm "party" glow behind the landing page: pools of emerald light that slowly breathe behind the
 * headline and the card, a soft spotlight that turns very slowly, and a little confetti of green and gold
 * specks drifting upwards. It is purely decoration (aria-hidden, never blocks clicks), and it stands still
 * when the person has asked their device for reduced motion.
 */

const CONFETTI_COLORS = ["#22C55E", "#4ADE80", "#86EFAC", "#FBBF24", "#FDE68A", "#F3F4F6"];
type Shape = "dot" | "bar" | "star";
const SHAPES: Shape[] = ["dot", "bar", "dot", "star"];

/** A tiny repeatable "random" generator, so the confetti is the same on every render (no flicker, no Math.random). */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export default function PartyGlow() {
  const reduce = useReducedMotion() ?? false;

  const confetti = useMemo(() => {
    const rand = seeded(7);
    return Array.from({ length: 26 }, (_, i) => ({
      left: `${rand() * 100}%`,
      top: `${10 + rand() * 85}%`,
      size: 5 + rand() * 7,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      shape: SHAPES[i % SHAPES.length],
      rise: 50 + rand() * 90, // how far it floats up (px)
      sway: (rand() - 0.5) * 50, // sideways drift (px)
      spin: (rand() - 0.5) * 240, // rotation (degrees)
      duration: 7 + rand() * 7,
      delay: rand() * 6,
    }));
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Pool of bright green light behind the headline */}
      <motion.div
        className="absolute -left-24 top-[8%] h-[26rem] w-[26rem] rounded-full bg-[#22C55E]/45 blur-3xl sm:-left-32 sm:h-[38rem] sm:w-[38rem]"
        animate={reduce ? undefined : { scale: [1, 1.14, 1], opacity: [0.75, 1, 0.75], x: [0, 30, 0] }}
        transition={{ duration: 9, ease: "easeInOut", repeat: Infinity }}
      />
      {/* Lighter, minty pool behind the card */}
      <motion.div
        className="absolute -right-24 top-[14%] h-[24rem] w-[24rem] rounded-full bg-[#4ADE80]/35 blur-3xl sm:-right-20 sm:h-[34rem] sm:w-[34rem]"
        animate={reduce ? undefined : { scale: [1.1, 0.95, 1.1], opacity: [0.7, 1, 0.7], y: [0, -26, 0] }}
        transition={{ duration: 11, ease: "easeInOut", repeat: Infinity }}
      />
      {/* Champagne gold warmth low in the corner, so it feels like a party and not a dashboard */}
      <motion.div
        className="absolute -bottom-40 right-[12%] h-[24rem] w-[24rem] rounded-full bg-gold/20 blur-3xl"
        animate={reduce ? undefined : { opacity: [0.5, 0.95, 0.5], scale: [1, 1.12, 1] }}
        transition={{ duration: 8, ease: "easeInOut", repeat: Infinity, delay: 1 }}
      />
      {/* A soft spotlight that turns very slowly behind everything */}
      <motion.div
        className="absolute left-1/2 top-[38%] h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-[70px]"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgb(34 197 94 / 0.55) 55deg, transparent 120deg, rgb(251 191 36 / 0.30) 200deg, transparent 260deg, rgb(74 222 128 / 0.45) 320deg, transparent 360deg)",
        }}
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 60, ease: "linear", repeat: Infinity }}
      />

      {/* Confetti */}
      {confetti.map((c, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{
            left: c.left,
            top: c.top,
            width: c.shape === "bar" ? c.size * 0.5 : c.size,
            height: c.shape === "bar" ? c.size * 1.8 : c.size,
            background: c.color,
            borderRadius: c.shape === "dot" ? "9999px" : c.shape === "bar" ? "2px" : "0",
            clipPath:
              c.shape === "star"
                ? "polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)"
                : undefined,
            boxShadow: c.shape === "dot" ? `0 0 10px ${c.color}` : undefined,
          }}
          initial={{ opacity: reduce ? 0.55 : 0 }}
          animate={
            reduce
              ? undefined
              : { opacity: [0, 0.9, 0.9, 0], y: [0, -c.rise], x: [0, c.sway], rotate: [0, c.spin] }
          }
          transition={{ duration: c.duration, delay: c.delay, ease: "easeOut", repeat: Infinity }}
        />
      ))}
    </div>
  );
}
