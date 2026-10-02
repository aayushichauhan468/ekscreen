import { AppError } from "../errors.js";
import type { PlaybackAction, PlayState, SyncState } from "../types/domain.js";

/**
 * The video's state, kept on the server (the "source of truth").
 *
 * We do NOT store a constantly-ticking clock. We store the position at the moment
 * of the last change (`position` at `updatedAt`). While playing, the current time is:
 *     position + (now - updatedAt)
 * So the server only does work when something changes, and any client can work out
 * the exact position by itself.
 */
export class PlaybackState {
  private videoId: string | null = null;
  private playState: PlayState = "paused";
  private position = 0; // seconds, valid at `updatedAt`
  private updatedAt = Date.now(); // ms

  currentTime(now: number): number {
    if (this.playState !== "playing") return this.position;
    return this.position + (now - this.updatedAt) / 1000;
  }

  apply(action: PlaybackAction, now: number): void {
    switch (action.type) {
      case "play":
        if (this.videoId === null) throw new AppError("BAD_REQUEST", "Choose a video before pressing play.");
        this.position = this.currentTime(now);
        this.playState = "playing";
        break;
      case "pause":
        this.position = this.currentTime(now); // freeze the time exactly where it is
        this.playState = "paused";
        break;
      case "seek":
        this.position = action.time;
        break;
      case "change_video":
        this.videoId = action.videoId;
        this.position = 0;
        this.playState = "paused"; // the Host presses play when everyone is ready
        break;
    }
    this.updatedAt = now;
  }

  snapshot(now: number): SyncState {
    return {
      videoId: this.videoId,
      playState: this.playState,
      currentTime: Math.round(this.currentTime(now) * 1000) / 1000,
      serverTime: now,
    };
  }
}
