import { AnimatePresence, motion } from "framer-motion";
import { Hand, Pause, Play, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { call } from "../lib/api";
import { parseTime } from "../lib/parseTime";
import { toast } from "../store/toastStore";
import type { PlaybackAction } from "../types";
import { Button } from "./ui";

const INPUT =
  "min-w-0 flex-1 rounded-xl border border-cream/15 bg-ink/60 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/20";

interface Props {
  hasVideo: boolean;
  playing: boolean;
  duration: number;
}

/**
 * Participants can't control the video, but they can ASK. Each button sends a `request_action`
 * event; the server stores it and shows it to the Host/Moderators, who approve or reject it.
 */
export default function RequestMenu({ hasVideo, playing, duration }: Props) {
  const [open, setOpen] = useState(false);
  const [jump, setJump] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Sends one request. Returns true if the server accepted it. */
  async function send(action: PlaybackAction): Promise<boolean> {
    setBusy(true);
    setError(null);
    const res = await call("request_action", { action });
    setBusy(false);
    if (!res.ok) {
      setError(res.message); // e.g. "You already have a request waiting for approval."
      return false;
    }
    toast("Request sent. The Host or a Moderator will decide.", "success");
    setOpen(false);
    return true;
  }

  async function sendJump(e: FormEvent) {
    e.preventDefault();
    const seconds = parseTime(jump);
    if (seconds === null) return setError("Enter a time like 1:30.");
    if (duration > 0 && seconds > duration) return setError("That's past the end of the video.");
    if (await send({ type: "seek", time: seconds })) setJump("");
  }

  async function sendVideo(e: FormEvent) {
    e.preventDefault();
    if (!link.trim()) return;
    if (await send({ type: "change_video", videoId: link.trim() })) setLink(""); // the server accepts a link OR an ID
  }

  return (
    <div>
      <Button type="button" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="px-4 py-2">
        <Hand className="h-4 w-4" aria-hidden /> Request a change
      </Button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-4 rounded-2xl border border-cream/10 bg-ink/40 p-4">
              <p className="text-xs text-cream/55">The Host or a Moderator will approve or reject your request.</p>

              <Button
                type="button"
                variant="ghost"
                disabled={!hasVideo || busy}
                onClick={() => send({ type: playing ? "pause" : "play" })}
                className="px-4 py-2"
              >
                {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                {playing ? "Ask to pause" : "Ask to play"}
              </Button>

              <form onSubmit={sendJump} className="flex items-center gap-2" noValidate>
                <input
                  className={INPUT}
                  value={jump}
                  onChange={(e) => setJump(e.target.value)}
                  placeholder="Jump to, e.g. 1:30"
                  aria-label="Jump to time"
                  disabled={!hasVideo}
                  autoComplete="off"
                />
                <Button type="submit" variant="ghost" disabled={!hasVideo || busy || !jump.trim()} className="px-4 py-2">
                  <Send className="h-4 w-4" aria-hidden /> Ask
                </Button>
              </form>

              <form onSubmit={sendVideo} className="flex items-center gap-2" noValidate>
                <input
                  className={INPUT}
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="Suggest a YouTube link"
                  aria-label="Suggest a video"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button type="submit" variant="ghost" disabled={busy || !link.trim()} className="px-4 py-2">
                  <Send className="h-4 w-4" aria-hidden /> Ask
                </Button>
              </form>

              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}