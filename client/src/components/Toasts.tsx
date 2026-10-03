import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useToastStore, type ToastTone } from "../store/toastStore";

const ICON: Record<ToastTone, typeof Info> = { info: Info, success: CheckCircle2, warning: AlertTriangle };
const COLOR: Record<ToastTone, string> = { info: "text-cream/70", success: "text-brand", warning: "text-gold" };

/** Safari (iPad / older macOS) only has the prefixed version of fullscreenElement. */
type FsDocument = Document & { webkitFullscreenElement?: Element | null };
const fullscreenElement = () => (document as FsDocument).fullscreenElement ?? (document as FsDocument).webkitFullscreenElement ?? null;

/**
 * Small messages at the bottom of the screen ("Riya joined the room", "Riya asked to pause").
 *
 * In fullscreen the browser draws ONLY the fullscreen element and what is inside it, so a normal
 * message at the bottom of the page would be invisible. We therefore render the messages (React portal)
 * INTO the fullscreen element while it is fullscreen, and into the page body the rest of the time.
 */
export default function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const [host, setHost] = useState<Element>(() => fullscreenElement() ?? document.body);

  useEffect(() => {
    const sync = () => setHost(fullscreenElement() ?? document.body);
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="glass pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full px-4 py-2.5 text-sm shadow-lg"
            >
              <Icon className={`h-4 w-4 shrink-0 ${COLOR[t.tone]}`} aria-hidden />
              <span>{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    host
  );
}
