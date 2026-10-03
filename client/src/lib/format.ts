import type { PlaybackAction } from "../types";

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** "play the video", "jump to 1:30"... used in toasts like "Riya asked to play the video". */
export function describeAction(action: PlaybackAction): string {
  switch (action.type) {
    case "play": return "play the video";
    case "pause": return "pause the video";
    case "seek": return `jump to ${formatTime(action.time)}`;
    case "change_video": return "change the video";
  }
}

export const ROLE_LABEL = { host: "Host", moderator: "Moderator", participant: "Participant" } as const;
