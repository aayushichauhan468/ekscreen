import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { useConnectionStatus } from "../hooks/useConnectionStatus";
import { sendReaction } from "../lib/api";
import { fxFor } from "../lib/reactionFx";
import { toast } from "../store/toastStore";
import { REACTION_EMOJIS, type ReactionEmoji } from "../types";

/** Minimum gap between two clicks from this browser (the server also rate-limits, this just feels smoother). */
const CLICK_GAP_MS = 150;

/**
 * Row of reaction buttons, available to EVERY role. A click sends `reaction` to the server; the server
 * broadcasts it back to the whole room (us included), and ReactionOverlay shows it floating over the video.
 * The floating emoji is never created locally on click, so what you see is exactly what everyone else sees.
 * (The small ripple on the button itself is only button feedback, it is not the reaction.)
 */
export default function ReactionBar() {
  const connected = useConnectionStatus();
  const lastClick = useRef(0);
  // Ripples currently playing on a button. Each one removes itself when its animation ends.
  const [ripples, setRipples] = useState<{ id: number; emoji: ReactionEmoji }[]>([]);
  const rippleId = useRef(0);

  async function react(emoji: ReactionEmoji) {
    const now = Date.now();
    if (now - lastClick.current < CLICK_GAP_MS) return;
    lastClick.current = now;
    setRipples((r) => [...r, { id: rippleId.current++, emoji }]);
    const res = await sendReaction(emoji);
    // Too many reactions is not worth a popup; show anything else (e.g. "not in a room").
    if (!res.ok && res.code !== "RATE_LIMITED") toast(res.message, "warning");
  }

  return (
    <div className="glass relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
      {/* A thin line of gold light that slowly slides along the top edge (see .shimmer-line in index.css). */}
      <span className="shimmer-line pointer-events-none absolute inset-x-8 top-0 h-px" aria-hidden />

      <span className="font-script text-xl leading-none text-gold/90">React to the moment</span>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Send a reaction">
        {REACTION_EMOJIS.map((emoji) => {
          const fx = fxFor(emoji);
          return (
            <motion.button
              key={emoji}
              type="button"
              onClick={() => void react(emoji)}
              disabled={!connected}
              whileHover={{ y: -4, scale: 1.12 }}
              whileTap={{ scale: 0.82 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              aria-label={`React with ${emoji}`}
              className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-cream/10 bg-white/4 hover:border-gold/50 disabled:opacity-40"
              style={{ ["--glow" as string]: fx.tint }}
            >
              {/* Soft glow in the emoji's own colour, fades in on hover. */}
              <span
                className="absolute inset-0 rounded-full opacity-0 blur-md transition-opacity duration-200 group-hover:opacity-100"
                style={{ background: fx.tint }}
                aria-hidden
              />
              {/* The emoji does its little personality move (heart pulses, hands clap...) while hovered. */}
              <motion.span className="relative text-2xl leading-none" whileHover={fx.hover}>
                {emoji}
              </motion.span>

              {ripples
                .filter((rp) => rp.emoji === emoji)
                .map((rp) => (
                  <motion.span
                    key={rp.id}
                    className="pointer-events-none absolute inset-0 rounded-full border-2 border-gold"
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                    onAnimationComplete={() => setRipples((all) => all.filter((x) => x.id !== rp.id))}
                  />
                ))}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
