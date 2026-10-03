import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Shuffle, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ACCESSORY_NAMES,
  BACKGROUNDS,
  CLOTHES,
  HAIR,
  HAIR_STYLE_NAMES,
  MOOD_NAMES,
  PRESETS,
  SKIN,
  encodeAvatar,
  normalizeAvatar,
  randomAvatar,
  type AvatarConfig,
} from "../lib/avatarConfig";
import Avatar from "./Avatar";
import { Button } from "./ui";

interface Props {
  open: boolean;
  /** The avatar the person has right now. The popup starts from it. */
  value: AvatarConfig;
  /** Called with the new avatar when the person presses "Use this avatar". */
  onSave: (next: AvatarConfig) => void;
  /** Called when the popup should close without saving (X button, Cancel, Esc, click outside). */
  onClose: () => void;
}

/**
 * The avatar designer as a popup window (a modal dialog) instead of a dropdown inside the form.
 *
 * Why a popup: a dropdown makes the page taller, which pushes the rest of the landing page around.
 * A popup floats above the page, so nothing underneath moves.
 *
 * How it behaves:
 *  - It edits a private DRAFT. The real avatar only changes when the person presses "Use this avatar".
 *  - It is rendered with a portal into <body>, so no parent animation or transform can trap or move it.
 *  - Esc, the X, Cancel or a click on the dark background all close it without saving.
 *  - The page behind cannot scroll while it is open, and keyboard focus stays inside it (accessibility).
 */
export default function AvatarPopup({ open, value, onSave, onClose }: Props) {
  const reduce = useReducedMotion() ?? false;
  const [draft, setDraft] = useState<AvatarConfig>(value);
  const panelRef = useRef<HTMLDivElement>(null);

  // The parent passes a new onClose function on every render. Keeping the latest one in a ref means the effect
  // below does not restart (and steal focus back) each time the parent re-renders.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Every time the popup opens, start the draft from the current avatar.
  useEffect(() => {
    if (open) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when it opens, not when `value` changes underneath
  }, [open]);

  // While open: lock page scrolling, handle Esc, keep Tab inside the popup, and give focus back on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Hiding the page scrollbar would make the page jump sideways, so add the same width as padding.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const oldOverflow = document.body.style.overflow;
    const oldPadding = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
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
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = oldOverflow;
      document.body.style.paddingRight = oldPadding;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  /** Changes one part (e.g. skin = 3) and keeps the whole avatar valid (no party hat on a cap, etc.). */
  const set = (patch: Partial<AvatarConfig>) =>
    setDraft((d) => normalizeAvatar({ ...d, ...patch }));
  const code = encodeAvatar(draft);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose(); // click on the dark background only
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-popup-title"
            tabIndex={-1}
            className="glass flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-b-none border-gold/20 shadow-[0_30px_90px_-20px_rgb(0_0_0/0.9)] outline-none sm:max-h-[88vh] sm:rounded-[1.5rem]"
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, y: 36, scale: 0.97 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: "spring", stiffness: 340, damping: 30 }
            }
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-cream/10 px-5 py-4 sm:px-6">
              <div>
                <h2
                  id="avatar-popup-title"
                  className="font-display text-2xl font-semibold"
                >
                  Design your avatar
                </h2>
                <p className="mt-0.5 text-sm text-cream/60">
                  This is how everyone in the room will see you.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close without saving"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cream/15 text-cream/70 transition hover:border-gold/60 hover:text-gold"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {/* Body: scrolls inside the popup, never the page. Two columns on wider screens. */}
            <div className="grid flex-1 gap-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 md:grid-cols-[15rem_1fr]">
              {/* Left: live preview + quick picks */}
              <div className="space-y-5">
                <div className="flex flex-col items-center rounded-2xl border border-cream/10 bg-ink/40 p-4">
                  <Avatar name="You" avatar={code} size={120} />
                  <button
                    type="button"
                    onClick={() => setDraft(randomAvatar())}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-cream/20 px-3.5 py-1.5 text-xs font-medium text-cream transition hover:border-gold/60 hover:text-gold"
                  >
                    <Shuffle className="h-3.5 w-3.5" aria-hidden /> Surprise me
                  </button>
                </div>

                <Section title="Quick picks">
                  <div className="grid grid-cols-4 gap-2 md:grid-cols-3">
                    {PRESETS.map((p, i) => {
                      const presetCode = encodeAvatar(p);
                      const selected = presetCode === code;
                      return (
                        <button
                          key={presetCode}
                          type="button"
                          onClick={() => setDraft(p)}
                          aria-label={`Quick pick ${i + 1}`}
                          aria-pressed={selected}
                          className={`flex justify-center rounded-xl p-1 transition ${selected ? "bg-gold/15 ring-2 ring-gold" : "hover:bg-white/[0.06]"}`}
                        >
                          <Avatar
                            name={`Quick pick ${i + 1}`}
                            avatar={presetCode}
                            size={46}
                          />
                        </button>
                      );
                    })}
                  </div>
                </Section>
              </div>

              {/* Right: every part of the face */}
              <div className="space-y-5">
                <Section title="Skin">
                  <Swatches
                    colors={SKIN}
                    selected={draft.skin}
                    onPick={(skin) => set({ skin })}
                    label="Skin tone"
                  />
                </Section>
                <Section title="Hair style">
                  <Chips
                    names={HAIR_STYLE_NAMES}
                    selected={draft.hairStyle}
                    onPick={(hairStyle) => set({ hairStyle })}
                  />
                </Section>
                <Section title="Hair colour">
                  <Swatches
                    colors={HAIR}
                    selected={draft.hairColor}
                    onPick={(hairColor) => set({ hairColor })}
                    label="Hair colour"
                  />
                </Section>
                <Section title="Mood">
                  {/* eyes and mouth change together so they always match */}
                  <Chips
                    names={MOOD_NAMES}
                    selected={draft.eyes}
                    onPick={(mood) => set({ eyes: mood, mouth: mood })}
                  />
                </Section>
                <Section title="Extras">
                  <Chips
                    names={ACCESSORY_NAMES}
                    selected={draft.accessory}
                    onPick={(accessory) => set({ accessory })}
                  />
                </Section>
                <Section title="Outfit">
                  <Swatches
                    colors={CLOTHES}
                    selected={draft.clothes}
                    onPick={(clothes) => set({ clothes })}
                    label="Outfit colour"
                  />
                </Section>
                <Section title="Background">
                  <Swatches
                    colors={BACKGROUNDS.map(
                      ([from, to]) => `linear-gradient(135deg, ${from}, ${to})`,
                    )}
                    selected={draft.background}
                    onPick={(background) => set({ background })}
                    label="Background"
                  />
                </Section>
              </div>
            </div>

            {/* Footer: always visible, so saving never needs scrolling */}
            <div className="flex items-center justify-end gap-3 border-t border-cream/10 bg-ink/30 px-5 py-4 sm:px-6">
              <Button type="button" variant="quiet" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onSave(draft);
                  onClose();
                }}
              >
                Use this avatar
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-cream/55">
        {title}
      </div>
      {children}
    </div>
  );
}

/** A row of round colour buttons. `colors` are CSS backgrounds (a hex colour or a gradient). */
function Swatches({
  colors,
  selected,
  onPick,
  label,
}: {
  colors: string[];
  selected: number;
  onPick: (index: number) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2.5" role="group" aria-label={label}>
      {colors.map((color, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(i)}
          aria-label={`${label} ${i + 1}`}
          aria-pressed={selected === i}
          style={{ background: color }}
          className={`flex h-9 w-9 items-center justify-center rounded-full border border-cream/20 transition hover:scale-110 ${selected === i ? "ring-2 ring-gold ring-offset-2 ring-offset-lounge" : ""}`}
        >
          {selected === i && (
            <Check
              className="h-4 w-4 text-ink mix-blend-difference"
              aria-hidden
            />
          )}
        </button>
      ))}
    </div>
  );
}

/** A row of text buttons (hair styles, moods, extras). */
function Chips({
  names,
  selected,
  onPick,
}: {
  names: string[];
  selected: number;
  onPick: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {names.map((name, i) => (
        <button
          key={name}
          type="button"
          onClick={() => onPick(i)}
          aria-pressed={selected === i}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            selected === i
              ? "border-gold bg-gold/15 text-gold"
              : "border-cream/20 bg-white/[0.03] text-cream/80 hover:border-cream/40 hover:text-cream"
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
