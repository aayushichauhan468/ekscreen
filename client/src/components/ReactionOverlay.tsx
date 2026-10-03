import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { memo, type CSSProperties } from "react";
import { fxFor, type Spark } from "../lib/reactionFx";
import { useReactionStore, type FloatingReaction } from "../store/reactionStore";

/** How long one emoji takes to float up and fade out. */
const RISE_SECONDS = 3.6;

/**
 * Everything that happens over the video when someone reacts. Sits on top of the player but never blocks
 * clicks (pointer-events-none). Four layers, from back to front:
 *   1. Bloom      - a soft coloured light that washes up from the bottom of the video
 *   2. ComboChip  - "🔥 ×5 on fire!" when several people send the same emoji together
 *   3. Floating   - the emoji itself: pops in, bursts confetti, then sways upward and fades
 * Each emoji removes itself from the store when its animation ends.
 */
export default function ReactionOverlay() {
  const items = useReactionStore((s) => s.items);
  const remove = useReactionStore((s) => s.remove);
  const reduceMotion = useReducedMotion(); // respect "reduce motion": no bursts, just a gentle fade

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {!reduceMotion && <Bloom />}
      <ComboChip reduceMotion={!!reduceMotion} />
      {items.map((r) => (
        <Floating key={r.id} r={r} reduceMotion={!!reduceMotion} onDone={remove} />
      ))}
    </div>
  );
}

/** A warm light that flashes up from the bottom edge of the video, coloured by the emoji. */
function Bloom() {
  const pulse = useReactionStore((s) => s.pulse);
  if (!pulse) return null;
  const tint = fxFor(pulse.emoji).tint;
  return (
    <motion.div
      key={pulse.id} // a new reaction = a new key = the flash restarts
      className="absolute inset-0"
      style={{
        background: `radial-gradient(ellipse 85% 65% at 50% 100%, ${tint}, transparent 70%)`,
        // During a big combo the whole frame glows, like the room lighting up.
        boxShadow: pulse.strong ? `inset 0 0 80px ${tint}` : undefined,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, pulse.strong ? 0.95 : 0.55, 0] }}
      transition={{ duration: 1.2, ease: "easeOut" }}
    />
  );
}

/** The "🔥 ×5 on fire!" chip. The number springs every time it goes up. */
function ComboChip({ reduceMotion }: { reduceMotion: boolean }) {
  const combo = useReactionStore((s) => s.combo);
  return (
    // The wrapper does the centering; the motion child only animates (so their transforms never fight).
    <div className="absolute left-1/2 top-3 -translate-x-1/2 sm:top-4">
      <AnimatePresence>
        {combo && (
          <motion.div
            key="combo"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
            className="flex items-center gap-2 rounded-full border border-gold/40 bg-ink/70 px-4 py-1.5 shadow-[0_0_28px_rgb(251_191_36/0.22)] backdrop-blur-md"
          >
            <span className="text-2xl leading-none">{combo.emoji}</span>
            <motion.span
              key={combo.count} // new number = new element = the entrance spring plays again
              initial={reduceMotion ? false : { scale: 1.8, y: -5 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 16 }}
              className="font-display text-xl font-semibold tabular-nums text-gold"
            >
              ×{combo.count}
            </motion.span>
            <span className="whitespace-nowrap font-script text-xl leading-none text-cream/85">
              {fxFor(combo.emoji).tagline}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * One floating emoji. Wrapped in memo() so it does NOT re-render every time another reaction arrives
 * (its `r` object never changes), which keeps its animation smooth during a burst of reactions.
 *
 * Three nested motion layers, each with ONE job (so the animations never fight over the same property):
 *   outer  -> where it is (rises, sways sideways, fades in and out)
 *   middle -> how big it is (springs from tiny to full size with a little overshoot)
 *   inner  -> its personality (heart beats, flame flickers, hands clap...)
 */
const Floating = memo(function Floating({
  r,
  reduceMotion,
  onDone,
}: {
  r: FloatingReaction;
  reduceMotion: boolean;
  onDone: (id: number) => void;
}) {
  const fx = fxFor(r.emoji);

  return (
    // Plain div: puts the emoji at its random horizontal spot and centres it on that spot.
    <div className="absolute bottom-6 -translate-x-1/2" style={{ left: `${r.left}%` }}>
      <motion.div
        className="flex flex-col items-center"
        initial={{ opacity: 0, y: 0, x: 0 }}
        animate={
          reduceMotion
            ? { opacity: [0, 1, 1, 0] }
            : { opacity: [0, 1, 1, 0], y: -250, x: r.sway }
        }
        // Each property gets its own timing: it rises steadily, sways in a smooth wave, and is only faded at the ends.
        transition={
          reduceMotion
            ? { duration: 1.5, ease: "easeOut", times: [0, 0.12, 0.75, 1] }
            : {
                y: { duration: RISE_SECONDS, ease: "easeOut" },
                x: { duration: RISE_SECONDS, ease: "easeInOut", times: [0, 0.25, 0.5, 0.75, 1] },
                opacity: { duration: RISE_SECONDS, ease: "easeOut", times: [0, 0.08, 0.78, 1] },
              }
        }
        onAnimationComplete={() => onDone(r.id)}
      >
        <motion.div
          className="relative flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20"
          initial={reduceMotion ? false : { scale: 0.2 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 11 }} // low damping = a playful overshoot
        >
          {!reduceMotion && (
            <>
              {/* Halo: a ring of coloured light that expands behind the emoji and fades. */}
              <motion.span
                className="absolute inset-0 rounded-full"
                style={{ background: `radial-gradient(circle, ${fx.tint}, transparent 68%)` }}
                initial={{ scale: 0.4, opacity: 0.9 }}
                animate={{ scale: 1.9, opacity: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
              {/* Burst: confetti / embers / sparkles flying out from the centre (pure CSS, see index.css). */}
              <span className="absolute left-1/2 top-1/2">
                {r.sparks.map((s) => (
                  <SparkPiece key={s.id} s={s} />
                ))}
              </span>
            </>
          )}
          <motion.span
            className="relative text-4xl leading-none drop-shadow-[0_6px_14px_rgb(0_0_0/0.55)] sm:text-5xl"
            style={{ originY: 0.85 }}
            animate={reduceMotion ? undefined : fx.idle.animate}
            transition={fx.idle.transition}
          >
            {r.emoji}
          </motion.span>
        </motion.div>

        <span className="mt-1 flex max-w-28 items-center gap-1.5 truncate rounded-full border border-cream/15 bg-ink/65 px-2.5 py-0.5 text-[10px] font-medium normal-case text-cream/90 backdrop-blur-sm">
          <span className="h-1 w-1 shrink-0 rounded-full bg-gold" />
          <span className="truncate">{r.username}</span>
        </span>
      </motion.div>
    </div>
  );
});

/** One piece of the burst. The motion itself is the `spark-burst` keyframes in index.css, driven by these CSS variables. */
function SparkPiece({ s }: { s: Spark }) {
  const style = {
    "--dx": `${s.dx}px`,
    "--dy": `${s.dy}px`,
    "--rot": `${s.rot}deg`,
    width: s.shape === "bar" ? s.size * 0.55 : s.size,
    height: s.shape === "bar" ? s.size * 1.7 : s.size,
    background: s.color,
    animationDelay: `${s.delay}s`,
  } as CSSProperties;
  return <span className={`spark spark-${s.shape}`} style={style} />;
}
