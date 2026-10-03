import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { Play } from "lucide-react";
import type { PointerEvent } from "react";
import DuskScene from "./DuskScene";

const REACTIONS = [
  { emoji: "❤️", left: "70%", delay: "0s", drift: "18px" },
  { emoji: "🔥", left: "78%", delay: "-2.2s", drift: "-10px" },
  { emoji: "👏", left: "86%", delay: "-4.4s", drift: "12px" },
  { emoji: "😍", left: "74%", delay: "-5.6s", drift: "-16px" },
  { emoji: "😂", left: "90%", delay: "-1.1s", drift: "-6px" },
];

/**
 * Landing page showpiece: a glass-framed "screen" with reactions floating up over the scene.
 * It has three gentle movements, all switched off for people who prefer reduced motion:
 *  1. it floats slowly up and down, like it is hanging in the air;
 *  2. with a mouse it tilts a little towards the pointer (a soft 3D effect that eases back when you leave);
 *  3. a faint band of light sweeps across the glass now and then.
 */
export default function HeroScreen() {
  const reduce = useReducedMotion() ?? false;

  // Where the pointer is inside the card, from -0.5 (left/top edge) to 0.5 (right/bottom edge).
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  // Springs make the tilt follow smoothly instead of snapping.
  const sx = useSpring(px, { stiffness: 120, damping: 16 });
  const sy = useSpring(py, { stiffness: 120, damping: 16 });
  const rotateY = useTransform(sx, [-0.5, 0.5], [-9, 9]); // pointer on the right -> turns to the right
  const rotateX = useTransform(sy, [-0.5, 0.5], [7, -7]); // pointer at the top -> tips upwards

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (reduce || e.pointerType !== "mouse") return; // no tilt on touch screens
    const box = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - box.left) / box.width - 0.5);
    py.set((e.clientY - box.top) / box.height - 0.5);
  }
  function onPointerLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    // Outer layer: the slow float
    <motion.div
      animate={reduce ? undefined : { y: [0, -12, 0] }}
      transition={{ duration: 6.5, ease: "easeInOut", repeat: Infinity }}
    >
      {/* Inner layer: the pointer tilt (kept separate so float and tilt never fight each other) */}
      <motion.div
        className="relative"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={reduce ? undefined : { rotateX, rotateY, transformPerspective: 1100 }}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[2rem] border border-gold/25 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8),0_0_90px_-30px_rgb(34_197_94/0.45)]">
          <DuskScene className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-transparent to-ink/35" />

          {/* A faint band of light that sweeps across the glass every few seconds */}
          {!reduce && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-cream/15 to-transparent"
              animate={{ x: ["0%", "480%"] }}
              transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 5 }}
            />
          )}

          <p className="font-script absolute left-6 top-5 -rotate-6 text-2xl text-cream/90 sm:text-3xl">
            Good movies,
            <br />
            better together
          </p>

          {REACTIONS.map((r) => (
            <span
              key={r.emoji}
              aria-hidden
              className="animate-float-up absolute bottom-16 text-2xl motion-reduce:hidden"
              style={{ left: r.left, animationDelay: r.delay, ["--drift" as string]: r.drift }}
            >
              {r.emoji}
            </span>
          ))}

          {/* a miniature player bar, purely decorative */}
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-ink/80 to-transparent px-5 pb-4 pt-8">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-ink">
              <Play className="h-4 w-4" fill="currentColor" aria-hidden />
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-cream/25">
              <div className="h-full w-[34%] rounded-full bg-gold" />
            </div>
            <span className="text-xs tabular-nums text-cream/80">32:15 / 1:48:20</span>
          </div>
        </div>

        <div className="glass absolute -bottom-5 left-6 flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-lg">
          <span className="h-2.5 w-2.5 rounded-full bg-brand shadow-[0_0_10px_var(--color-brand)]" />
          All synced
        </div>
      </motion.div>
    </motion.div>
  );
}
