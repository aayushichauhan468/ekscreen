import { ZodError } from "zod";
import { AppError } from "../errors.js";
import type { Departure, Room } from "../rooms/Room.js";
import type { RoomManager } from "../rooms/RoomManager.js";
import type { PlaybackAction } from "../types/domain.js";
import type { Ack, RoomJoined, TypedServer, TypedSocket } from "../types/events.js";
import {
  AssignRoleSchema,
  ChangeVideoSchema,
  CreateRoomSchema,
  JoinRoomSchema,
  LeaveRoomSchema,
  RequestActionSchema,
  RequestIdSchema,
  SeekSchema,
  TargetSchema,
} from "./schemas.js";

/**
 * Connects Socket.IO events to the Room logic. For every event it does the same 3 things:
 *   1. validate the payload (Zod)          -> bad data is rejected as BAD_REQUEST
 *   2. call the Room method (permissions)  -> not allowed is rejected as FORBIDDEN
 *   3. broadcast the result to the room    -> everyone stays in sync
 * The Room class holds the rules; this class only does the wiring.
 */
export class MessageHandler {
  constructor(
    private readonly io: TypedServer,
    private readonly rooms: RoomManager
  ) {}

  register(socket: TypedSocket): void {
    // ----- room lifecycle -----
    socket.on("create_room", (p, ack) => this.run(ack, () => this.createRoom(socket, CreateRoomSchema.parse(p))));
    socket.on("join_room", (p, ack) => this.run(ack, () => this.joinRoom(socket, JoinRoomSchema.parse(p))));
    socket.on("leave_room", (p, ack) =>
      this.run(ack, () => {
        LeaveRoomSchema.parse(p);
        this.leaveCurrentRoom(socket);
        return {};
      })
    );
    socket.on("request_sync", (_p, ack) => this.run(ack, () => ({ state: this.roomOf(socket).syncSnapshot() })));

    // ----- playback: Host / Moderator only -----
    socket.on("play", (_p, ack) => this.run(ack, () => this.control(socket, { type: "play" })));
    socket.on("pause", (_p, ack) => this.run(ack, () => this.control(socket, { type: "pause" })));
    socket.on("seek", (p, ack) =>
      this.run(ack, () => this.control(socket, { type: "seek", time: SeekSchema.parse(p).time }))
    );
    socket.on("change_video", (p, ack) =>
      this.run(ack, () => this.control(socket, { type: "change_video", videoId: ChangeVideoSchema.parse(p).videoId }))
    );

    // ----- Host only -----
    socket.on("assign_role", (p, ack) => this.run(ack, () => this.assignRole(socket, AssignRoleSchema.parse(p))));
    socket.on("remove_participant", (p, ack) =>
      this.run(ack, () => this.removeParticipant(socket, TargetSchema.parse(p).userId))
    );
    socket.on("transfer_host", (p, ack) =>
      this.run(ack, () => this.transferHost(socket, TargetSchema.parse(p).userId))
    );

    // ----- approval flow -----
    socket.on("request_action", (p, ack) =>
      this.run(ack, () => this.createRequest(socket, RequestActionSchema.parse(p).action))
    );
    socket.on("approve_request", (p, ack) =>
      this.run(ack, () => this.resolveRequest(socket, RequestIdSchema.parse(p).requestId, true))
    );
    socket.on("reject_request", (p, ack) =>
      this.run(ack, () => this.resolveRequest(socket, RequestIdSchema.parse(p).requestId, false))
    );

    socket.on("disconnect", () => this.leaveCurrentRoom(socket));
  }

  // =====================================================================
  // Room lifecycle
  // =====================================================================

  private createRoom(socket: TypedSocket, data: { username: string }): RoomJoined {
    this.leaveCurrentRoom(socket); // a socket can only be in one room at a time
    const room = this.rooms.createRoom();
    const me = room.addParticipant(socket.id, data.username); // first person in = Host
    this.rooms.bind(socket.id, room.id);
    void socket.join(room.id);
    console.log(`[EkScreen] room ${room.id} created by ${me.username}`);
    return this.joinedPayload(room, me.id);
  }

  private joinRoom(socket: TypedSocket, data: { roomId: string; username: string }): RoomJoined {
    // Joining the room you're already in is harmless: just return the current state.
    const current = this.rooms.roomOf(socket.id);
    if (current && current.id === data.roomId) return this.joinedPayload(current, socket.id);

    const room = this.rooms.getOrThrow(data.roomId);
    this.leaveCurrentRoom(socket);
    const me = room.addParticipant(socket.id, data.username); // everyone after the creator = Participant
    this.rooms.bind(socket.id, room.id);
    void socket.join(room.id);

    socket.to(room.id).emit("user_joined", {
      username: me.username,
      userId: me.id,
      role: me.role,
      participants: room.publicParticipants(),
    });
    return this.joinedPayload(room, me.id);
  }

  /** Used by leave_room, disconnect, and when switching rooms. Safe to call when in no room. */
  private leaveCurrentRoom(socket: TypedSocket): void {
    const room = this.rooms.roomOf(socket.id);
    if (!room) return;

    const departure = room.removeParticipant(socket.id);
    void socket.leave(room.id);
    this.rooms.unbind(socket.id);

    if (room.isEmpty) {
      this.rooms.delete(room.id); // last one out closes the room
      console.log(`[EkScreen] room ${room.id} closed`);
      return;
    }
    this.announceDeparture(room, departure, "left");
  }

  // =====================================================================
  // Playback
  // =====================================================================

  /** Shared by play / pause / seek / change_video. The Room checks the permission. */
  private control(socket: TypedSocket, action: PlaybackAction): object {
    const room = this.roomOf(socket);
    const actor = room.applyPlayback(socket.id, action);
    this.io.to(room.id).emit("sync_state", { ...room.syncSnapshot(), action: action.type, by: actor.username });
    return {};
  }

  // =====================================================================
  // Host actions
  // =====================================================================

  private assignRole(socket: TypedSocket, data: { userId: string; role: "moderator" | "participant" }): object {
    const room = this.roomOf(socket);
    const target = room.assignRole(socket.id, data.userId, data.role);
    this.io.to(room.id).emit("role_assigned", {
      userId: target.id,
      username: target.username,
      role: target.role,
      participants: room.publicParticipants(),
    });
    return {};
  }

  private removeParticipant(socket: TypedSocket, userId: string): object {
    const room = this.roomOf(socket);
    const departure = room.removeByHost(socket.id, userId);

    // Tell the removed person first, then take their socket out of the room's channel.
    this.io.to(userId).emit("removed_from_room", { roomId: room.id, reason: "The Host removed you from the room." });
    this.io.in(userId).socketsLeave(room.id);
    this.rooms.unbind(userId);

    this.announceDeparture(room, departure, "removed");
    return {};
  }

  private transferHost(socket: TypedSocket, userId: string): object {
    const room = this.roomOf(socket);
    const { oldHost, newHost } = room.transferHost(socket.id, userId);
    this.io.to(room.id).emit("host_transferred", {
      oldHostId: oldHost.id,
      newHostId: newHost.id,
      newHostUsername: newHost.username,
      reason: "manual",
      participants: room.publicParticipants(),
    });
    return {};
  }

  // =====================================================================
  // Approval requests
  // =====================================================================

  private createRequest(socket: TypedSocket, action: PlaybackAction): { request: ReturnType<Room["createRequest"]> } {
    const room = this.roomOf(socket);
    const request = room.createRequest(socket.id, action);
    // Only Host/Moderators need to see it, so notify just them (each socket id is its own channel).
    for (const id of room.resolverIds()) this.io.to(id).emit("request_created", request);
    return { request };
  }

  private resolveRequest(socket: TypedSocket, requestId: string, approve: boolean): object {
    const room = this.roomOf(socket);
    const { request, resolver } = room.resolveRequest(socket.id, requestId, approve);

    if (approve) {
      // Approved = the change really happens, for everyone.
      this.io.to(room.id).emit("sync_state", {
        ...room.syncSnapshot(),
        action: request.action.type,
        by: resolver.username,
      });
    }
    this.io.to(room.id).emit("request_resolved", {
      requestId,
      userId: request.userId,
      requesterName: request.username,
      status: approve ? "approved" : "rejected",
      resolvedBy: resolver.username,
    });
    return {};
  }

  // =====================================================================
  // Helpers
  // =====================================================================

  /** Broadcasts everything that follows from someone leaving or being removed. */
  private announceDeparture(room: Room, departure: Departure, kind: "left" | "removed"): void {
    const { leaving, newHost, cancelledRequests } = departure;
    const base = { userId: leaving.id, username: leaving.username, participants: room.publicParticipants() };

    if (kind === "left") this.io.to(room.id).emit("user_left", base);
    else this.io.to(room.id).emit("participant_removed", base);

    if (newHost) {
      this.io.to(room.id).emit("host_transferred", {
        oldHostId: leaving.id,
        newHostId: newHost.id,
        newHostUsername: newHost.username,
        reason: "host_left",
        participants: room.publicParticipants(),
      });
    }
    for (const request of cancelledRequests) {
      this.io.to(room.id).emit("request_resolved", {
        requestId: request.id,
        userId: request.userId,
        requesterName: request.username,
        status: "cancelled",
        resolvedBy: null,
      });
    }
  }

  private joinedPayload(room: Room, userId: string): RoomJoined {
    const participants = room.publicParticipants();
    return {
      roomId: room.id,
      you: participants.find((p) => p.userId === userId)!,
      participants,
      state: room.syncSnapshot(),
      requests: room.canResolve(userId) ? room.pendingRequests() : [],
    };
  }

  private roomOf(socket: TypedSocket): Room {
    const room = this.rooms.roomOf(socket.id);
    if (!room) throw new AppError("NOT_IN_ROOM", "Join or create a room first.");
    return room;
  }

  /**
   * Runs a handler and answers through the ack callback:
   *   success -> { ok: true, ...data }     failure -> { ok: false, code, message }
   * One place turns every thrown error into a clean reply, so a bad request can never crash the server.
   */
  private run<T extends object>(ack: ((r: Ack<T>) => void) | undefined, fn: () => T): void {
    let result: Ack<T>;
    try {
      result = { ok: true, ...fn() };
    } catch (err) {
      result = this.toFailure(err);
    }
    if (typeof ack === "function") ack(result);
  }

  private toFailure(err: unknown): { ok: false; code: AppError["code"]; message: string } {
    if (err instanceof AppError) return { ok: false, code: err.code, message: err.message };
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      return { ok: false, code: "BAD_REQUEST", message: issue?.message ?? "Invalid request." };
    }
    console.error("[EkScreen] unexpected error:", err);
    return { ok: false, code: "INTERNAL", message: "Something went wrong on our side." };
  }
}
