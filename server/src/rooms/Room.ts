import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { AppError } from "../errors.js";
import type { PendingRequest, PlaybackAction, PublicParticipant, Role, SyncState } from "../types/domain.js";
import { Participant } from "./Participant.js";
import { PlaybackState } from "./PlaybackState.js";
import { DENIED_MESSAGE, hasPermission, type Permission } from "./permissions.js";

/** What changed when someone leaves, so the caller can broadcast the right events. */
export interface Departure {
  leaving: Participant;
  newHost: Participant | null; // set when the Host left and someone else was promoted
  cancelledRequests: PendingRequest[];
}

/**
 * One watch party. Holds participants, roles, the video state and pending requests.
 * It knows NOTHING about sockets, so all the rules can be tested in isolation.
 * Every method that changes something takes the `actorId` and checks permissions itself.
 */
export class Room {
  private readonly playback = new PlaybackState();
  private readonly participants = new Map<string, Participant>(); // Map keeps join order
  private readonly requests = new Map<string, PendingRequest>();

  constructor(readonly id: string) {}

  get isEmpty(): boolean {
    return this.participants.size === 0;
  }

  // ---------- members ----------

  /** The first person in becomes Host; everyone after is a Participant. */
  addParticipant(id: string, username: string): Participant {
    if (this.participants.size >= config.maxParticipantsPerRoom) {
      throw new AppError("ROOM_FULL", "This room is full.");
    }
    const role: Role = this.participants.size === 0 ? "host" : "participant";
    const participant = new Participant(id, username, role);
    this.participants.set(id, participant);
    return participant;
  }

  /** Removes someone. If the Host leaves, the first Moderator (else the longest-present person) becomes Host. */
  removeParticipant(userId: string): Departure {
    const leaving = this.get(userId);
    this.participants.delete(userId);

    const cancelledRequests = [...this.requests.values()].filter((r) => r.userId === userId);
    cancelledRequests.forEach((r) => this.requests.delete(r.id));

    let newHost: Participant | null = null;
    if (leaving.role === "host" && this.participants.size > 0) {
      const remaining = [...this.participants.values()];
      newHost = remaining.find((p) => p.role === "moderator") ?? remaining[0];
      newHost.role = "host";
    }
    return { leaving, newHost, cancelledRequests };
  }

  /** Host kicks someone out. */
  removeByHost(actorId: string, targetId: string): Departure {
    this.requirePermission(actorId, "remove_participants");
    this.get(targetId);
    if (actorId === targetId) throw new AppError("INVALID_TARGET", "You can't remove yourself. Use Leave room instead.");
    return this.removeParticipant(targetId);
  }

  assignRole(actorId: string, targetId: string, role: Exclude<Role, "host">): Participant {
    this.requirePermission(actorId, "manage_roles");
    const target = this.get(targetId);
    if (actorId === targetId) {
      throw new AppError("INVALID_TARGET", "The Host can't change their own role. Transfer the Host role instead.");
    }
    target.role = role;
    return target;
  }

  /** Host passes the crown; the old Host becomes a Moderator so they keep playback control. */
  transferHost(actorId: string, targetId: string): { oldHost: Participant; newHost: Participant } {
    const oldHost = this.requirePermission(actorId, "transfer_host");
    const newHost = this.get(targetId);
    if (actorId === targetId) throw new AppError("INVALID_TARGET", "You are already the Host.");
    oldHost.role = "moderator";
    newHost.role = "host";
    return { oldHost, newHost };
  }

  // ---------- playback ----------

  /** Direct playback change by a Host or Moderator. */
  applyPlayback(actorId: string, action: PlaybackAction, now = Date.now()): Participant {
    const actor = this.requirePermission(actorId, "control_playback");
    this.playback.apply(action, now);
    return actor;
  }

  syncSnapshot(now = Date.now()): SyncState {
    return this.playback.snapshot(now);
  }

  // ---------- approval requests ----------

  /** A Participant asks for a change. One waiting request per person keeps the Host's list clean. */
  createRequest(userId: string, action: PlaybackAction): PendingRequest {
    const me = this.requirePermission(userId, "create_requests");
    if ([...this.requests.values()].some((r) => r.userId === userId)) {
      throw new AppError("REQUEST_PENDING", "You already have a request waiting for approval.");
    }
    const request: PendingRequest = {
      id: randomUUID().slice(0, 8),
      userId,
      username: me.username,
      action,
      createdAt: Date.now(),
    };
    this.requests.set(request.id, request);
    return request;
  }

  /** Host/Moderator approves (the change is applied) or rejects (nothing changes). */
  resolveRequest(
    actorId: string,
    requestId: string,
    approve: boolean,
    now = Date.now()
  ): { request: PendingRequest; resolver: Participant } {
    const resolver = this.requirePermission(actorId, "resolve_requests");
    const request = this.requests.get(requestId);
    if (!request) throw new AppError("REQUEST_NOT_FOUND", "That request was already handled or no longer exists.");
    if (approve) this.playback.apply(request.action, now); // may throw; the request then stays open
    this.requests.delete(requestId);
    return { request, resolver };
  }

  pendingRequests(): PendingRequest[] {
    return [...this.requests.values()];
  }

  // ---------- reading ----------

  publicParticipants(): PublicParticipant[] {
    return [...this.participants.values()].map((p) => p.toPublic());
  }

  /** Socket ids of everyone who may approve requests (so we notify only them). */
  resolverIds(): string[] {
    return [...this.participants.values()].filter((p) => hasPermission(p.role, "resolve_requests")).map((p) => p.id);
  }

  canResolve(userId: string): boolean {
    return hasPermission(this.get(userId).role, "resolve_requests");
  }

  // ---------- internals ----------

  private get(userId: string): Participant {
    const participant = this.participants.get(userId);
    if (!participant) throw new AppError("USER_NOT_FOUND", "That person isn't in this room.");
    return participant;
  }

  /** The permission gate used by every action above. Returns the actor if allowed. */
  private requirePermission(userId: string, permission: Permission): Participant {
    const participant = this.get(userId);
    if (!hasPermission(participant.role, permission)) {
      throw new AppError("FORBIDDEN", DENIED_MESSAGE[permission]);
    }
    return participant;
  }
}
