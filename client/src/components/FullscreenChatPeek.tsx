import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRoomStore } from "../store/roomStore";
import type { ChatMessage } from "../types";

const SHOW_MS = 6000; // how long a message stays on the video

/**
 * Only rendered while the video is fullscreen (the chat panel is not visible then).
 * Shows the newest message from SOMEONE ELSE in the bottom-left corner for a few seconds, then fades out.
 * It is read-only: to reply, leave fullscreen (Esc).
 */
export default function FullscreenChatPeek() {
  const chat = useRoomStore((s) => s.chat);
  const meId = useRoomStore((s) => s.me?.userId);
  const [shown, setShown] = useState<ChatMessage | null>(null);
  const lastSeenId = useRef<string | undefined>(chat[chat.length - 1]?.id); // history before fullscreen is not replayed

  useEffect(() => {
    const last = chat[chat.length - 1];
    if (!last || last.id === lastSeenId.current) return;
    lastSeenId.current = last.id;
    if (last.userId === meId) return; // you know what you just wrote
    setShown(last);
    const id = window.setTimeout(() => setShown((m) => (m?.id === last.id ? null : m)), SHOW_MS);
    return () => window.clearTimeout(id);
  }, [chat, meId]);

  return (
    <div className="pointer-events-none absolute bottom-20 left-4 z-20 max-w-[min(22rem,80%)]" aria-live="polite">
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.id}
            initial={{ opacity: 0, x: -24, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="glass flex items-start gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm shadow-lg"
          >
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-cream/80">{shown.username}</div>
              <div className="whitespace-pre-wrap wrap-break-word leading-snug">{shown.text}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
