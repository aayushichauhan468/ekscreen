import type { Server, Socket } from "socket.io";
import type { ErrorCode } from "../errors.js";
import type { PendingRequest, PlaybackAction, PublicParticipant, Role, SyncState } from "./domain.js";

/** Every client -> server event answers through an acknowledgement callback. */
export type Ack<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; code: ErrorCode; message: string };

/** Returned to someone who just created or joined a room. */
export interface RoomJoined {
  roomId: string;
  you: PublicParticipant;
  participants: PublicParticipant[];
  state: SyncState; // late joiners get the current video state right here
  requests: PendingRequest[]; // only filled for Host/Moderator
}

type Empty = Record<string, never>;

/** Events the CLIENT sends. Always send an object (even `{}`) followed by the ack callback. */
export interface ClientToServerEvents {
  create_room: (p: { username: string }, ack: (r: Ack<RoomJoined>) => void) => void;
  join_room: (p: { roomId: string; username: string }, ack: (r: Ack<RoomJoined>) => void) => void;
  leave_room: (p: { roomId: string }, ack: (r: Ack) => void) => void;
  request_sync: (p: Empty, ack: (r: Ack<{ state: SyncState }>) => void) => void;

  // playback (Host / Moderator)
  play: (p: Empty, ack: (r: Ack) => void) => void;
  pause: (p: Empty, ack: (r: Ack) => void) => void;
  seek: (p: { time: number }, ack: (r: Ack) => void) => void;
  change_video: (p: { videoId: string }, ack: (r: Ack) => void) => void; // accepts an ID or a YouTube URL

  // Host only
  assign_role: (p: { userId: string; role: Exclude<Role, "host"> }, ack: (r: Ack) => void) => void;
  remove_participant: (p: { userId: string }, ack: (r: Ack) => void) => void;
  transfer_host: (p: { userId: string }, ack: (r: Ack) => void) => void;

  // Participant asks, Host/Moderator decides
  request_action: (p: { action: PlaybackAction }, ack: (r: Ack<{ request: PendingRequest }>) => void) => void;
  approve_request: (p: { requestId: string }, ack: (r: Ack) => void) => void;
  reject_request: (p: { requestId: string }, ack: (r: Ack) => void) => void;
}

/** Events the SERVER broadcasts. */
export interface ServerToClientEvents {
  /** `action` and `by` say what changed and who did it (for toasts like "Riya paused"). */
  sync_state: (s: SyncState & { action: PlaybackAction["type"]; by: string }) => void;
  user_joined: (p: { username: string; userId: string; role: Role; participants: PublicParticipant[] }) => void;
  user_left: (p: { username: string; userId: string; participants: PublicParticipant[] }) => void;
  role_assigned: (p: { userId: string; username: string; role: Role; participants: PublicParticipant[] }) => void;
  participant_removed: (p: { userId: string; username: string; participants: PublicParticipant[] }) => void;
  removed_from_room: (p: { roomId: string; reason: string }) => void; // sent only to the removed person
  host_transferred: (p: {
    oldHostId: string | null;
    newHostId: string;
    newHostUsername: string;
    reason: "manual" | "host_left";
    participants: PublicParticipant[];
  }) => void;
  request_created: (r: PendingRequest) => void; // sent only to Host/Moderators
  request_resolved: (p: {
    requestId: string;
    userId: string;
    requesterName: string;
    status: "approved" | "rejected" | "cancelled";
    resolvedBy: string | null;
  }) => void;
}

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
