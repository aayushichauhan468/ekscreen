import type { Playback } from "../store/roomStore";

/** Only correct the player when it is more than this many seconds away. Smaller jumps cause stutter. */
export const DRIFT_THRESHOLD = 1;

/**
 * Where the video SHOULD be right now, according to the server's last update.
 *  - Paused: exactly the saved time.
 *  - Playing: saved time + how long ago we received it.
 * We measure "how long ago" with OUR OWN clock (receivedAt), not the server's clock, because the
 * two clocks are never perfectly equal. The cost is ignoring network delay (~0.05-0.15 s), which is
 * far below the 1 s threshold.
 */
export function expectedTime(p: Pick<Playback, "playState" | "currentTime" | "receivedAt">, now = Date.now()): number {
  if (p.playState !== "playing") return p.currentTime;
  return p.currentTime + (now - p.receivedAt) / 1000;
}

export function isDrifting(localTime: number, expected: number): boolean {
  return Math.abs(localTime - expected) > DRIFT_THRESHOLD;
}