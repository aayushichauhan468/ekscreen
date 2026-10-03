import { Film, Maximize, Minimize, PanelTop, Play, RectangleHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { call } from "../lib/api";
import { loadYouTubeApi } from "../lib/youtubeApi";
import { expectedTime, isDrifting } from "../lib/syncMath";
import { useFullscreen } from "../hooks/useFullscreen";
import { useRoomStore } from "../store/roomStore";
import { toast } from "../store/toastStore";
import { useUiStore } from "../store/uiStore";
import DuskScene from "./DuskScene";
import FullscreenChatPeek from "./FullscreenChatPeek";
import ReactionOverlay from "./ReactionOverlay";
import PlayerControls from "./PlayerControls";

// YouTube's numeric player states (from the IFrame API docs).
const PLAYING = 1;
const BUFFERING = 3;

/**
 * The shared video. It never decides anything itself: it only OBEYS the server's state
 * (store.playback). Buttons send events to the server; the server's reply changes the store;
 * this component reacts to the store. That one-way flow is what keeps everyone in sync.
 */
export default function SyncedPlayer({ canControl }: { canControl: boolean }) {
  const playback = useRoomStore((s) => s.playback);
  const hasVideo = !!playback?.videoId;

  const stageRef = useRef<HTMLDivElement>(null); // the whole video box (iframe + overlays): this is what goes fullscreen
  const hostRef = useRef<HTMLDivElement>(null); // empty box; the YouTube iframe is created inside it
  const { supported: canFullscreen, isFullscreen, toggle: toggleFullscreen } = useFullscreen(stageRef);
  const theater = useUiStore((s) => s.theater);
  const toggleTheater = useUiStore((s) => s.toggleTheater);
  const playerRef = useRef<YT.Player | null>(null);
  const readyRef = useRef(false); // true once YouTube says the player is ready
  const loadedIdRef = useRef<string | null>(null); // which video the iframe currently holds
  const lastSeekRef = useRef(0); // when we last corrected drift (ms)
  const tapTimer = useRef<number | undefined>(undefined);

  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [needsTap, setNeedsTap] = useState(false); // browser blocked autoplay: ask for one click
  const [loadFailed, setLoadFailed] = useState(false);
  const [volume, setVolume] = useState(80); // 0-100, personal: never sent to the server
  const [muted, setMuted] = useState(false);

  /** If we asked the player to play but it is not playing 2.5 s later, the browser blocked autoplay. */
  const armAutoplayCheck = useCallback(() => {
    window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => {
      const wantsPlay = useRoomStore.getState().playback?.playState === "playing";
      const state = playerRef.current?.getPlayerState();
      if (wantsPlay && state !== PLAYING && state !== BUFFERING) setNeedsTap(true);
    }, 2500);
  }, []);

  /**
   * Make the real player match the server's state. Safe to call as often as we like:
   * it only touches the player when something is actually different.
   * `force` = true skips the 1 s tolerance (used right after someone seeks).
   */
  const applyServerState = useCallback(
    (force = false) => {
      const player = playerRef.current;
      const pb = useRoomStore.getState().playback;
      if (!player || !readyRef.current || !pb) return;

      // 1) No video chosen yet -> make sure nothing is playing.
      if (!pb.videoId) {
        if (loadedIdRef.current) player.stopVideo();
        loadedIdRef.current = null;
        return;
      }

      const target = expectedTime(pb); // where the video should be right now
      const wantsPlay = pb.playState === "playing";

      // 2) Different video -> load it at the right position (late joiners land here too).
      if (loadedIdRef.current !== pb.videoId) {
        loadedIdRef.current = pb.videoId;
        const args = { videoId: pb.videoId, startSeconds: target };
        if (wantsPlay) {
          player.loadVideoById(args); // load AND play
          armAutoplayCheck();
        } else {
          player.cueVideoById(args); // load, stay paused
        }
        return;
      }

      // 3) Same video -> fix drift. Skip while buffering (its clock is unreliable), right after
      //    a correction (give it time to land), and past the end of the video.
      const state = player.getPlayerState();
      const ended = duration > 0 && target >= duration;
      const cooledDown = Date.now() - lastSeekRef.current > 2000;
      if (!ended && state !== BUFFERING && (force || cooledDown) && (force || isDrifting(player.getCurrentTime(), target))) {
        player.seekTo(target, true);
        lastSeekRef.current = Date.now();
      }

      // 4) Make play/pause match.
      if (wantsPlay && state !== PLAYING && state !== BUFFERING) {
        player.playVideo();
        armAutoplayCheck();
      } else if (!wantsPlay && (state === PLAYING || state === BUFFERING)) {
        player.pauseVideo();
      }
    },
    [armAutoplayCheck, duration]
  );

  // Always call the newest version of applyServerState from long-lived callbacks (timer, YouTube events).
  const applyRef = useRef(applyServerState);
  useEffect(() => {
    applyRef.current = applyServerState;
  }, [applyServerState]);

  // Create the YouTube player once, when this component appears.
  useEffect(() => {
    let cancelled = false;
    let player: YT.Player | null = null;

    loadYouTubeApi()
      .then((api) => {
        if (cancelled || !hostRef.current) return;
        // YouTube REPLACES the element we give it with an iframe, so give it a throwaway child
        // (otherwise React would lose track of its own element).
        const mount = document.createElement("div");
        hostRef.current.appendChild(mount);

        player = new api.Player(mount, {
          width: "100%",
          height: "100%",
          playerVars: {
            controls: 0, // hide YouTube's own controls: ours are role-aware
            disablekb: 1, // ignore keyboard shortcuts inside the video
            fs: 0,
            rel: 0,
            playsinline: 1, // iPhones: play inside the page, not fullscreen
            iv_load_policy: 3, // no annotations
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              readyRef.current = true;
              setReady(true);
              applyRef.current(); // late joiner: jump to the room's current state
            },
            onStateChange: (e) => {
              if (e.data === PLAYING) {
                setNeedsTap(false); // it plays, so no tap needed
                // The video only really starts now, after loading/buffering/tap. The server's clock kept
                // running meanwhile, so correct the position straight away instead of waiting for the timer.
                lastSeekRef.current = 0;
                applyRef.current();
              }
              const d = e.target.getDuration();
              if (d > 0) setDuration(d);
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(tapTimer.current);
      readyRef.current = false;
      playerRef.current = null;
      loadedIdRef.current = null;
      player?.destroy();
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, []);

  // React to every new state from the server (play / pause / seek / change_video / rejoin).
  useEffect(() => {
    applyRef.current(playback?.lastAction === "seek");
  }, [playback, ready]);

  // Safety net: re-check once a second. Fixes slow drift, and also a viewer who paused locally.
  useEffect(() => {
    const id = window.setInterval(() => applyRef.current(), 1000);
    return () => window.clearInterval(id);
  }, []);

  /**
   * The position the viewer is ACTUALLY looking at, or null while the player has not started the
   * room's video yet (loading, waiting for the tap, between videos). PlayerControls shows this number
   * so the clock always matches the picture. Before this, the clock showed the server's running time
   * even while the picture was still at 0:00.
   */
  const getActualTime = useCallback((): number | null => {
    const player = playerRef.current;
    const pb = useRoomStore.getState().playback;
    if (!player || !readyRef.current || !pb?.videoId || loadedIdRef.current !== pb.videoId) return null;
    const state = player.getPlayerState();
    if (state !== PLAYING && state !== 2 /* PAUSED */ && state !== BUFFERING) return null;
    return player.getCurrentTime();
  }, []);

  // Volume is personal: each viewer sets their own, nothing is sent to the server.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !ready) return;
    player.setVolume(volume);
    if (muted || volume === 0) player.mute();
    else player.unMute();
  }, [volume, muted, ready]);

  function changeVolume(v: number) {
    setVolume(v);
    setMuted(v === 0); // dragging up from 0 un-mutes
  }

  function toggleMute() {
    if (muted || volume === 0) {
      setMuted(false);
      if (volume === 0) setVolume(50); // un-mute from 0 -> pick a sensible level
    } else {
      setMuted(true);
    }
  }

  /** Clicking the video itself = play/pause, but only for Host/Moderator, and it goes through the server. */
  async function clickVideo() {
    if (!hasVideo) return;
    if (!canControl) {
      toast("Only the Host and Moderators can control playback. Tap Request a change to ask.");
      return;
    }
    const playing = useRoomStore.getState().playback?.playState === "playing";
    const res = playing ? await call("pause", {}) : await call("play", {});
    if (!res.ok) toast(res.message, "warning");
  }

  /** Runs inside a real click, so the browser allows sound + autoplay from now on. */
  function joinScreening() {
    setNeedsTap(false);
    applyServerState(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={stageRef}
        className={
          isFullscreen
            ? // fullscreen: fill the whole screen; YouTube letterboxes the picture itself
              "group relative h-full w-full overflow-hidden bg-black"
            : // normal: keep 16:9. In theater mode the width is large, so cap the height to the window
              `group relative mx-auto aspect-video w-full overflow-hidden rounded-3xl border border-gold/20 bg-ink shadow-[0_30px_80px_-24px_rgb(0_0_0/0.8)] ${theater ? "max-h-[calc(100vh-10rem)]" : ""}`
        }
      >
        {/* The YouTube iframe is created inside this box. */}
        <div ref={hostRef} className="absolute inset-0" />

        {/* Invisible shield: clicks never reach YouTube's player, so nobody can pause it for themselves.
            A click is turned into a play/pause request to the server instead. */}
        <div
          className={`absolute inset-0 ${hasVideo && canControl ? "cursor-pointer" : ""}`}
          onClick={clickVideo}
          aria-hidden
        />

        {/* Emoji reactions float up over the video. They never block clicks. */}
        {hasVideo && <ReactionOverlay />}

        {/* The chat panel is hidden in fullscreen, so show new messages from others on the video for a few seconds. */}
        {isFullscreen && <FullscreenChatPeek />}

        {/* Screen size buttons. Always visible on touch screens (no hover there); on a mouse they fade in
            when you hover the video or tab to them. They sit above the click shield (z-20). */}
        <div className="absolute right-3 top-3 z-20 flex gap-2 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
          {!isFullscreen && (
            <button
              type="button"
              onClick={toggleTheater}
              aria-pressed={theater}
              aria-label={theater ? "Exit theater mode" : "Theater mode"}
              title={theater ? "Exit theater mode" : "Theater mode"}
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-cream/20 bg-ink/70 text-cream backdrop-blur-md transition hover:border-gold/60 hover:text-gold lg:flex"
            >
              {theater ? <RectangleHorizontal className="h-5 w-5" aria-hidden /> : <PanelTop className="h-5 w-5" aria-hidden />}
            </button>
          )}
          {canFullscreen && (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
              title={isFullscreen ? "Exit full screen" : "Full screen"}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/20 bg-ink/70 text-cream backdrop-blur-md transition hover:border-gold/60 hover:text-gold"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" aria-hidden /> : <Maximize className="h-5 w-5" aria-hidden />}
            </button>
          )}
        </div>

        {!hasVideo && (
          <div className="absolute inset-0">
            <DuskScene className="absolute inset-0 h-full w-full scale-110 blur-sm brightness-[0.75]" />
            <div className="absolute inset-0 bg-ink/30" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
                <Film className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="font-display text-2xl font-semibold sm:text-3xl">No video yet</h2>
              <p className="max-w-sm text-sm text-cream/70">
                {loadFailed
                  ? "The YouTube player couldn't load. Check your connection and refresh."
                  : canControl
                    ? "Paste a YouTube link below to start the screening."
                    : "Waiting for the Host to choose a video."}
              </p>
            </div>
          </div>
        )}

        {hasVideo && needsTap && (
          <button
            type="button"
            onClick={joinScreening}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/75 backdrop-blur-sm"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold text-ink shadow-[0_8px_30px_-8px_rgb(251_191_36/0.55)]">
              <Play className="h-7 w-7 translate-x-0.5" aria-hidden />
            </span>
            <span className="font-display text-xl font-semibold">Join the screening</span>
            <span className="text-xs text-cream/60">Your browser needs one click before it can play sound.</span>
          </button>
        )}
      </div>

      <PlayerControls
        getActualTime={getActualTime}
        canControl={canControl}
        duration={duration}
        volume={muted ? 0 : volume}
        onVolumeChange={changeVolume}
        onToggleMute={toggleMute}
      />
    </div>
  );
}