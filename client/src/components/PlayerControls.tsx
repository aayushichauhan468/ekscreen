import { Link2, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { call } from "../lib/api";
import { formatTime } from "../lib/format";
import { expectedTime } from "../lib/syncMath";
import { useRoomStore } from "../store/roomStore";
import { toast } from "../store/toastStore";
import RequestMenu from "./RequestMenu";
import { Button, Field } from "./ui";

interface Props {
  /** The position the viewer is actually looking at, or null while the player has not started yet. */
  getActualTime?: () => number | null;
  canControl: boolean;
  duration: number;
  volume: number; // 0-100 (0 while muted)
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
}

const SKIP_SECONDS = 10;

/**
 * Controls bar. What you see depends on your role:
 *  - Host / Moderator: play/pause, -10s/+10s, seek bar, volume, "change video".
 *  - Participant: only the time and volume (the controls they can't use are not shown at all).
 * `canControl` comes from the live role in the store, so when the Host promotes someone or
 * hands over the Host role, the controls appear or disappear instantly, with no page refresh.
 * Hiding buttons is only for a clean UI: the server checks the role again on every event.
 */
export default function PlayerControls({ getActualTime, canControl, duration, volume, onVolumeChange, onToggleMute }: Props) {
  const playback = useRoomStore((s) => s.playback);
  const [now, setNow] = useState(() => Date.now());
  const [dragValue, setDragValue] = useState<number | null>(null); // seek-bar value while the thumb is held
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Re-render twice a second so the time and the seek bar move while the video plays.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const hasVideo = !!playback?.videoId;
  const playing = playback?.playState === "playing";
  // Prefer the real player position so the clock matches the picture; fall back to the server's clock.
  const actual = getActualTime?.() ?? null;
  const liveTime = actual ?? (playback ? Math.min(expectedTime(playback, now), duration || Infinity) : 0);
  const shown = dragValue ?? liveTime;
  const totalLabel = duration > 0 ? formatTime(duration) : "--:--";

  async function togglePlay() {
    setBusy(true);
    const res = playing ? await call("pause", {}) : await call("play", {});
    setBusy(false);
    if (!res.ok) toast(res.message, "warning");
  }

  /** Jump back/forward from where the video is RIGHT NOW. Sent as a normal `seek`, so it syncs for everyone. */
  async function skip(deltaSeconds: number) {
    if (!playback) return;
    const target = Math.min(Math.max(expectedTime(playback) + deltaSeconds, 0), duration || Infinity);
    const res = await call("seek", { time: target });
    if (!res.ok) toast(res.message, "warning");
  }

  async function commitSeek() {
    if (dragValue === null) return;
    const time = dragValue;
    setDragValue(null);
    const res = await call("seek", { time });
    if (!res.ok) toast(res.message, "warning");
  }

  async function changeVideo(e: FormEvent) {
    e.preventDefault();
    if (!link.trim()) return;
    setBusy(true);
    setLinkError(null);
    const res = await call("change_video", { videoId: link }); // the server accepts a link OR an ID
    setBusy(false);
    if (!res.ok) return setLinkError(res.message);
    setLink("");
  }

  const barDisabled = !hasVideo || duration <= 0;

  return (
    <div className="glass space-y-4 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 sm:gap-x-4">
        {/* Host / Moderator only: playback buttons */}
        {canControl && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => skip(-SKIP_SECONDS)}
              disabled={barDisabled}
              aria-label={`Back ${SKIP_SECONDS} seconds`}
              title={`Back ${SKIP_SECONDS}s`}
              className="h-11 w-11 shrink-0 p-0!"
            >
              <RotateCcw className="h-5 w-5" aria-hidden />
            </Button>
            <Button
              type="button"
              onClick={togglePlay}
              disabled={!hasVideo || busy}
              aria-label={playing ? "Pause" : "Play"}
              className="h-11 w-11 shrink-0 p-0!"
            >
              {playing ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5 translate-x-0.5" aria-hidden />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => skip(SKIP_SECONDS)}
              disabled={barDisabled}
              aria-label={`Forward ${SKIP_SECONDS} seconds`}
              title={`Forward ${SKIP_SECONDS}s`}
              className="h-11 w-11 shrink-0 p-0!"
            >
              <RotateCw className="h-5 w-5" aria-hidden />
            </Button>
          </div>
        )}

        {canControl ? (
          // Host / Moderator: time + draggable seek bar
          <div className="flex min-w-48 flex-1 items-center gap-3">
            <span className="w-12 text-right text-xs tabular-nums text-cream/70">{formatTime(shown)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 1)}
              step={1}
              value={Math.min(shown, Math.max(duration, 1))}
              disabled={barDisabled}
              onChange={(e) => setDragValue(Number(e.target.value))}
              onPointerUp={commitSeek}
              onKeyUp={commitSeek}
              aria-label="Seek"
              className="range-gold min-w-0 flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            style={{ "--fill": `${(Math.min(shown, Math.max(duration, 1)) / Math.max(duration, 1)) * 100}%` } as React.CSSProperties}
            />
            <span className="w-12 text-xs tabular-nums text-cream/50">{totalLabel}</span>
          </div>
        ) : (
          // Participant: just the time, nothing to click
          <div className="flex-1 text-sm tabular-nums text-cream/70">
            {formatTime(shown)} <span className="text-cream/40">/ {totalLabel}</span>
          </div>
        )}

        {/* Personal volume: works for everyone, including Participants. */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="quiet"
            onClick={onToggleMute}
            aria-label={volume === 0 ? "Unmute" : "Mute"}
            className="h-10 w-10 shrink-0 p-0!"
          >
            {volume === 0 ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
          </Button>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-label="Volume"
            className="range-gold hidden w-24 cursor-pointer sm:block"
            style={{ "--fill": `${volume}%` } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Participant only: ask the Host/Moderators for a change */}
      {!canControl && <RequestMenu hasVideo={hasVideo} playing={playing} duration={duration} />}

      {/* Host / Moderator only: change video */}
      {canControl && (
        <form onSubmit={changeVideo} className="flex flex-col gap-2 sm:flex-row sm:items-end" noValidate>
          <div className="flex-1">
            <Field
              label="Change video"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste a YouTube link or video ID"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Button type="submit" loading={busy} disabled={!link.trim()} className="sm:mb-px">
            <Link2 className="h-4 w-4" aria-hidden /> Load video
          </Button>
        </form>
      )}
      {canControl && linkError && (
        <p role="alert" className="text-sm text-danger">
          {linkError}
        </p>
      )}
    </div>
  );
}