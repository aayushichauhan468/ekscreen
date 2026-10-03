import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { AvatarConfig } from "../lib/avatarConfig";
import AvatarPicker from "./AvatarPicker";
import { Button } from "./ui";

interface Props {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
  onClose: () => void;
}

/**
 * The avatar picker as a pop-up window. Because it floats above the page, opening it never makes the
 * form taller, so nothing else on the landing page moves (the old inline drop-down pushed the whole
 * layout down and left the right-hand picture floating far below).
 *
 * It is drawn with a "portal": React puts it directly under <body>, so the animated, blurred form
 * around the trigger button cannot shrink or clip it. Esc, the X, the dark backdrop and "Done" all close it.
 */
export default function AvatarDialog({ value, onChange, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose; // always the latest onClose, without re-running the effect below

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null; // give focus back to the button that opened us
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind must not scroll while the window is open
    panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(); // start on "Done"

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      // Keep Tab inside the window (a simple focus trap): from the last control it wraps to the first.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input, [tabindex]:not([tabindex='-1'])");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnTo?.focus();
    };
  }, []);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* dark, softly blurred backdrop: click it to close */}
      <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-dialog-title"
        initial={{ opacity: 0, y: 36, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-gold/20 bg-lounge shadow-[0_40px_120px_-30px_rgb(0_0_0/0.9),0_0_80px_-40px_rgb(34_197_94/0.5)] sm:max-w-3xl sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-cream/10 px-5 py-4 sm:px-6">
          <div>
            <h2 id="avatar-dialog-title" className="font-display text-2xl font-semibold">
              Choose your avatar
            </h2>
            <p className="mt-0.5 text-sm text-cream/55">Pick a ready-made look, or design your own. Everyone in the room will see it.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-cream/60 transition hover:bg-white/8 hover:text-cream"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        {/* the only part that scrolls, so the title and "Done" are always in reach */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <AvatarPicker value={value} onChange={onChange} />
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-cream/10 bg-ink/40 px-5 py-3.5 sm:px-6">
          <Button type="button" onClick={onClose} data-autofocus>
            <Check className="h-4 w-4" aria-hidden /> Done
          </Button>
        </footer>
      </motion.div>
    </motion.div>,
    document.body
  );
}
