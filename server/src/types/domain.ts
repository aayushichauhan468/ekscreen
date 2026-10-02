export type Role = "host" | "moderator" | "participant";
export type PlayState = "playing" | "paused";

/** Everything that can change the video. Used for direct actions AND for approval requests. */
export type PlaybackAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek"; time: number }
  | { type: "change_video"; videoId: string };

/** What other people are allowed to see about a participant. */
export interface PublicParticipant {
  userId: string;
  username: string;
  role: Role;
  joinedAt: number;
}

/** Snapshot of the video, computed at `serverTime`. */
export interface SyncState {
  videoId: string | null;
  playState: PlayState;
  currentTime: number; // seconds
  serverTime: number; // ms since epoch, when the snapshot was taken
}

/** A change a Participant asked for, waiting for Host/Moderator approval. */
export interface PendingRequest {
  id: string;
  userId: string;
  username: string;
  action: PlaybackAction;
  createdAt: number;
}
