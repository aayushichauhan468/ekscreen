import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import LogoIcon from "./LogoIcon";

/** How long the opening screen stays before the landing page appears (shorter if the person prefers less motion). */
const SHOW_MS = 2800;
const SHOW_MS_REDUCED = 900;

/**
 * The opening screen: the EkScreen sign glows in the middle of a dark screen, then fades away to reveal the
 * landing page. It also ends on a click, a tap or any key press, so nobody is ever made to wait.
 *
 * `onDone` is called once, when the splash wants to go away. The parent (App) then removes it, and
 * <AnimatePresence> plays the `exit` animation below, so the splash fades out instead of vanishing.
 */
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    const timer = window.setTimeout(onDone, reduce ? SHOW_MS_REDUCED : SHOW_MS);
    const skip = () => onDone();
    window.addEventListener("keydown", skip);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", skip);
    };
  }, [onDone, reduce]);

  return (
    <motion.div
      role="status"
      aria-label="EkScreen is opening"
      onClick={onDone}
      className="fixed inset-0 z-[70] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-ink"
      initial={{ opacity: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04, filter: "blur(6px)" }}
      transition={{ duration: reduce ? 0.2 : 0.7, ease: "easeInOut" }}
    >
      {/* Wide, soft emerald light behind everything, plus a warm gold one, like a projector warming up. */}
      <motion.div
        aria-hidden
        className="absolute h-[34rem] w-[34rem] rounded-full bg-brand/20 blur-3xl"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduce ? 0 : 1.6, ease: "easeOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute h-[22rem] w-[22rem] translate-x-24 translate-y-20 rounded-full bg-gold/10 blur-3xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0 : 2, delay: reduce ? 0 : 0.4 }}
      />
      {/* Soft vignette: the corners fall into darkness */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgb(11_15_12/0.85)_100%)]"
      />

      <div className="relative flex flex-col items-center">
        {/* The glowing sign: a halo that slowly breathes behind the icon */}
        <div className="relative flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48">
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-full bg-gold/25 blur-2xl"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={reduce ? { opacity: 0.7, scale: 1 } : { opacity: [0.35, 0.9, 0.5, 0.9], scale: [0.85, 1.15, 0.95, 1.15] }}
            transition={reduce ? { duration: 0 } : { duration: 2.6, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
          />
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 16, delay: 0.15 }}
            style={{ filter: "drop-shadow(0 0 22px rgb(251 191 36 / 0.45))" }}
          >
            <LogoIcon size={132} animated />
          </motion.div>
        </div>

        <motion.h1
          className="font-display mt-4 text-5xl font-semibold tracking-tight sm:text-6xl"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.8, delay: reduce ? 0 : 0.7, ease: "easeOut" }}
        >
          <span className="text-gold">Ek</span>
          <span className="text-cream">Screen</span>
        </motion.h1>

        <motion.p
          className="font-script mt-2 text-xl text-cream/70 sm:text-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : 1.3 }}
        >
          Watch Together. Feel Closer.
        </motion.p>
      </div>
    </motion.div>
  );
}
