import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useConnectionStatus } from "../hooks/useConnectionStatus";
import { useRoomStore } from "../store/roomStore";

/** Shown while the WebSocket is down. Your seat is kept, and we rejoin automatically. */
export default function ConnectionBanner() {
  const connected = useConnectionStatus();
  const status = useRoomStore((s) => s.status);
  const visible = !connected && status !== "idle";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-2 border-b border-gold/30 bg-ink/90 px-4 py-2 text-sm text-gold backdrop-blur"
          role="alert"
        >
          <WifiOff className="h-4 w-4" aria-hidden />
          Connection lost. Reconnecting, your seat is saved.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
