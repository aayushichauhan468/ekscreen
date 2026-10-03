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
  online: boolean; // false while disconnected but still inside the reconnect grace period
  avatar: string | null; // the face this person picked, e.g. "2-2-1-3-1-0-4-2" (null = client draws one from the userId)
}

/**
 * An avatar is 8 numbers joined by "-": skin, hair style, hair colour, outfit colour, eyes, mouth,
 * accessory, background. These are how many choices each part has. The client draws the face; the
 * server only checks that every number is in range, so a client can never store arbitrary text here.
 * IMPORTANT: keep this list equal to PART_COUNTS in client/src/lib/avatarConfig.ts.
 */
export const AVATAR_PART_COUNTS = [6, 9, 6, 6, 4, 4, 8, 6] as const;

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

/** The only reactions allowed. The Zod schema and the client buttons both use this one list. */
export const REACTION_EMOJIS = ["❤️", "😂", "😮", "👏", "🔥", "🎉"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** One chat line. The server creates the id and time, so a client can never fake them. */
export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  sentAt: number; // ms since epoch
}
