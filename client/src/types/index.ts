/**
 * Event contract shared with the server (copied from server/src/types).
 * If you change an event on the server, change it here too.
 */

export type ErrorCode =
  | "BAD_REQUEST" | "NOT_IN_ROOM" | "ROOM_NOT_FOUND" | "ROOM_FULL" | "FORBIDDEN" | "USER_NOT_FOUND"
  | "INVALID_TARGET" | "REQUEST_NOT_FOUND" | "REQUEST_PENDING" | "INVALID_SESSION" | "RATE_LIMITED" | "INTERNAL";

export type Role = "host" | "moderator" | "participant";
export type PlayState = "playing" | "paused";

export type PlaybackAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek"; time: number }
  | { type: "change_video"; videoId: string };

export interface PublicParticipant {
  userId: string;
  username: string;
  role: Role;
  joinedAt: number;
  online: boolean;
  avatar: string | null; // the face this person picked (see lib/avatarConfig.ts); null = drawn from the userId
}

export interface SyncState {
  videoId: string | null;
  playState: PlayState;
  currentTime: number;
  serverTime: number;
}

export interface PendingRequest {
  id: string;
  userId: string;
  username: string;
  action: PlaybackAction;
  createdAt: number;
}

/** The only reactions the server accepts (same list as the server's REACTION_EMOJIS). */
export const REACTION_EMOJIS = ["❤️", "😂", "😮", "👏", "🔥", "🎉"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** One chat line. The server creates the id and time. */
export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  sentAt: number; // ms since epoch (server clock)
}

export type Ack<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; code: ErrorCode; message: string };

export interface RoomJoined {
  roomId: string;
  token: string;
  you: PublicParticipant;
  participants: PublicParticipant[];
  state: SyncState;
  requests: PendingRequest[];
  chat: ChatMessage[]; // recent history for late joiners and refreshes
}

type Empty = Record<string, never>;

export interface ClientToServerEvents {
  create_room: (p: { username: string; avatar?: string }, ack: (r: Ack<RoomJoined>) => void) => void;
  join_room: (p: { roomId: string; username: string; avatar?: string }, ack: (r: Ack<RoomJoined>) => void) => void;
  rejoin_room: (p: { roomId: string; token: string }, ack: (r: Ack<RoomJoined>) => void) => void;
  leave_room: (p: { roomId: string }, ack: (r: Ack) => void) => void;
  request_sync: (p: Empty, ack: (r: Ack<{ state: SyncState }>) => void) => void;
  play: (p: Empty, ack: (r: Ack) => void) => void;
  pause: (p: Empty, ack: (r: Ack) => void) => void;
  seek: (p: { time: number }, ack: (r: Ack) => void) => void;
  change_video: (p: { videoId: string }, ack: (r: Ack) => void) => void;
  assign_role: (p: { userId: string; role: Exclude<Role, "host"> }, ack: (r: Ack) => void) => void;
  remove_participant: (p: { userId: string }, ack: (r: Ack) => void) => void;
  transfer_host: (p: { userId: string }, ack: (r: Ack) => void) => void;
  request_action: (p: { action: PlaybackAction }, ack: (r: Ack<{ request: PendingRequest }>) => void) => void;
  approve_request: (p: { requestId: string }, ack: (r: Ack) => void) => void;
  reject_request: (p: { requestId: string }, ack: (r: Ack) => void) => void;
  chat_message: (p: { text: string }, ack: (r: Ack) => void) => void;
  reaction: (p: { emoji: ReactionEmoji }, ack: (r: Ack) => void) => void;
}

export interface ServerToClientEvents {
  sync_state: (s: SyncState & { action: PlaybackAction["type"]; by: string }) => void;
  user_joined: (p: { username: string; userId: string; role: Role; participants: PublicParticipant[] }) => void;
  user_left: (p: { username: string; userId: string; participants: PublicParticipant[] }) => void;
  role_assigned: (p: { userId: string; username: string; role: Role; participants: PublicParticipant[] }) => void;
  participant_removed: (p: { userId: string; username: string; participants: PublicParticipant[] }) => void;
  presence_changed: (p: { userId: string; username: string; online: boolean; participants: PublicParticipant[] }) => void;
  session_replaced: (p: { roomId: string }) => void;
  removed_from_room: (p: { roomId: string; reason: string }) => void;
  host_transferred: (p: {
    oldHostId: string | null;
    newHostId: string;
    newHostUsername: string;
    reason: "manual" | "host_left";
    participants: PublicParticipant[];
  }) => void;
  request_created: (r: PendingRequest) => void;
  request_resolved: (p: {
    requestId: string;
    userId: string;
    requesterName: string;
    status: "approved" | "rejected" | "cancelled";
    resolvedBy: string | null;
  }) => void;
  chat_message: (m: ChatMessage) => void;
  reaction: (p: { id: string; userId: string; username: string; emoji: ReactionEmoji }) => void;
}
