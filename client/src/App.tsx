import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import Ambient from "./components/Ambient";
import ConnectionBanner from "./components/ConnectionBanner";
import SplashScreen from "./components/SplashScreen";
import Toasts from "./components/Toasts";
import { bindSocketEvents } from "./lib/socketEvents";
import LandingPage from "./pages/LandingPage";
import RestoringPage from "./pages/RestoringPage";
import RoomPage from "./pages/RoomPage";
import { useRoomStore } from "./store/roomStore";

export default function App() {
  const status = useRoomStore((s) => s.status);

  // Opening screen. It is skipped when we are about to win a saved seat back ("restoring" = a refresh inside a
  // room), so refreshing in the middle of a movie never makes you sit through the logo again.
  const [showSplash, setShowSplash] = useState(() => useRoomStore.getState().status === "idle");
  const endSplash = useCallback(() => setShowSplash(false), []);

  // Listen to the server for the whole life of the app.
  useEffect(() => bindSocketEvents(), []);

  return (
    <div className="grain relative min-h-screen overflow-x-clip">
      <Ambient />
      <ConnectionBanner />
      {/* The pages only mount once the splash is leaving, so their own entrance animations play on reveal. */}
      {!showSplash && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={status}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {status === "restoring" ? <RestoringPage /> : status === "in_room" ? <RoomPage /> : <LandingPage />}
          </motion.div>
        </AnimatePresence>
      )}
      <AnimatePresence>{showSplash && <SplashScreen onDone={endSplash} />}</AnimatePresence>
      <Toasts />
    </div>
  );
}
