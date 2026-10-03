import { ZodError } from "zod";
import { AppError } from "../errors.js";
import type { Departure, Room } from "../rooms/Room.js";
import type { RoomManager } from "../rooms/RoomManager.js";
import type { PlaybackAction, ReactionEmoji } from "../types/domain.js";
import type { Ack, RoomJoined, TypedServer, TypedSocket } from "../types/events.js";
import {
  AssignRoleSchema,
  ChangeVideoSchema,
  ChatSchema,
  CreateRoomSchema,
  JoinRoomSchema,
  LeaveRoomSchema,
  RejoinRoomSchema,
  RequestActionSchema,
  ReactionSchema,
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
 *
 * Identity: a person is identified by a stable `userId` (not by their socket id), so they
 * survive a page refresh. When a socket disconnects the person is marked offline and keeps
 * their seat for `graceMs`. If they come back with their secret token (rejoin_room) nothing
 * is lost; if the time runs out they are removed (and the Host role moves on if needed).
 */
export class MessageHandler {
  private readonly graceTimers = new Map<string, NodeJS.Timeout>(); // "roomId:userId" -> timer

  constructor(
    private readonly io: TypedServer,
    private readonly rooms: RoomManager,
    private readonly graceMs: number
  ) {}

  register(socket: TypedSocket): void {
    // ----- room lifecycle -----
    socket.on("create_room", (p, ack) => this.run(ack, () => this.createRoom(socket, CreateRoomSchema.parse(p))));
    socket.on("join_room", (p, ack) => this.run(ack, () => this.joinRoom(socket, JoinRoomSchema.parse(p))));
    socket.on("rejoin_room", (p, ack) => this.run(ack, () => this.rejoinRoom(socket, RejoinRoomSchema.parse(p))));
    socket.on("leave_room", (p, ack) =>
      this.run(ack, () => {
        LeaveRoomSchema.parse(p);
        this.leaveCurrentRoom(socket);
        return {};
      })
    );
    socket.on("request_sync", (_p, ack) => this.run(ack, () => ({ state: this.actor(socket).room.syncSnapshot() })));

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

    // ----- chat and reactions: every role may use these -----
    socket.on("chat_message", (p, ack) => this.run(ack, () => this.chatMessage(socket, ChatSchema.parse(p).text)));
    socket.on("reaction", (p, ack) => this.run(ack, () => this.reaction(socket, ReactionSchema.parse(p).emoji)));

    socket.on("disconnect", () => this.handleDisconnect(socket));
  }

  // =====================================================================
  // Room lifecycle
  // =====================================================================

  private createRoom(socket: TypedSocket, data: { username: string; avatar?: string }): RoomJoined {
    this.leaveCurrentRoom(socket); // a socket can only be in one room at a time
    const room = this.rooms.createRoom();
    const me = room.addParticipant(socket.id, data.username, data.avatar); // first person in = Host
    this.rooms.bind(socket.id, room.id, me.id);
    void socket.join(room.id);
    console.log(`[EkScreen] room ${room.id} created by ${me.username}`);
    return this.joinedPayload(room, me.id);
  }

  private joinRoom(socket: TypedSocket, data: { roomId: string; username: string; avatar?: string }): RoomJoined {
    // Joining the room you're already in is harmless: just return the current state.
    const current = this.rooms.membershipOf(socket.id);
    if (current && current.room.id === data.roomId) return this.joinedPayload(current.room, current.userId);

    const room = this.rooms.getOrThrow(data.roomId);
    this.leaveCurrentRoom(socket);
    const me = room.addParticipant(socket.id, data.username, data.avatar); // everyone after the creator = Participant
    this.rooms.bind(socket.id, room.id, me.id);
    void socket.join(room.id);

    socket.to(room.id).emit("user_joined", {
      username: me.username,
      userId: me.id,
      role: me.role,
      participants: room.publicParticipants(),
    });
    return this.joinedPayload(room, me.id);
  }

  /**
   * Comes back after a page refresh or a dropped connection. The secret token proves who you are,
   * so you get your old seat (and your role, even Host) back instead of becoming a new person.
   */
  private rejoinRoom(socket: TypedSocket, data: { roomId: string; token: string }): RoomJoined {
    const room = this.rooms.getOrThrow(data.roomId);
    const me = room.findByToken(data.token);
    if (!me) throw new AppError("INVALID_SESSION", "Your session has expired. Please join the room again.");

    if (me.socketId === socket.id) return this.joinedPayload(room, me.id); // already attached

    // If this socket was in some other room, leave it first.
    const current = this.rooms.membershipOf(socket.id);
    if (current && !(current.room.id === room.id && current.userId === me.id)) this.leaveCurrentRoom(socket);

    // Same person opened the room in a second tab: the older connection loses the seat.
    if (me.socketId) {
      this.io.to(me.socketId).emit("session_replaced", { roomId: room.id });
      this.io.in(me.socketId).socketsLeave(room.id);
      this.rooms.unbind(me.socketId);
    }

    this.clearGrace(room.id, me.id);
    room.attachSocket(me.id, socket.id);
    this.rooms.bind(socket.id, room.id, me.id);
    void socket.join(room.id);

    socket.to(room.id).emit("presence_changed", {
      userId: me.id,
      username: me.username,
      online: true,
      participants: room.publicParticipants(),
    });
    return this.joinedPayload(room, me.id);
  }

  /** Someone chose to leave (or switched rooms): remove them straight away. */
  private leaveCurrentRoom(socket: TypedSocket): void {
    const membership = this.rooms.membershipOf(socket.id);
    if (!membership) return;
    const { room, userId } = membership;

    this.clearGrace(room.id, userId);
    const departure = room.removeParticipant(userId);
    void socket.leave(room.id);
    this.rooms.unbind(socket.id);
    this.afterDeparture(room, departure);
  }

  /** The connection dropped (refresh, Wi-Fi, closed tab). Keep the seat for a grace period. */
  private handleDisconnect(socket: TypedSocket): void {
    const membership = this.rooms.membershipOf(socket.id);
    if (!membership) return; // never joined a room, or was already replaced/removed
    const { room, userId } = membership;

    this.rooms.unbind(socket.id);
    room.detachSocket(userId);
    const me = room.member(userId);
    this.io.to(room.id).emit("presence_changed", {
      userId,
      username: me.username,
      online: false,
      participants: room.publicParticipants(),
    });

    const key = `${room.id}:${userId}`;
    const timer = setTimeout(() => this.expire(room.id, userId), this.graceMs);
    timer.unref(); // never keep the process alive just for a timer
    this.graceTimers.set(key, timer);
  }

  /** Grace period over and the person never came back: now they really leave. */
  private expire(roomId: string, userId: string): void {
    this.graceTimers.delete(`${roomId}:${userId}`);
    const room = this.rooms.get(roomId);
    if (!room || !room.has(userId) || room.member(userId).online) return;
    this.afterDeparture(room, room.removeParticipant(userId));
  }

  private clearGrace(roomId: string, userId: string): void {
    const key = `${roomId}:${userId}`;
    const timer = this.graceTimers.get(key);
    if (timer) clearTimeout(timer);
    this.graceTimers.delete(key);
  }

  /** After someone is gone: close the room if it is empty, otherwise tell everyone. */
  private afterDeparture(room: Room, departure: Departure): void {
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
    const { room, userId } = this.actor(socket);
    const who = room.applyPlayback(userId, action);
    this.io.to(room.id).emit("sync_state", { ...room.syncSnapshot(), action: action.type, by: who.username });
    return {};
  }

  // =====================================================================
  // Chat and reactions
  // =====================================================================

  /** Save the message, then send it to EVERYONE in the room (the sender too, so all screens agree on order). */
  private chatMessage(socket: TypedSocket, text: string): object {
    const { room, userId } = this.actor(socket);
    const message = room.postChat(userId, text);
    this.io.to(room.id).emit("chat_message", message);
    return {};
  }

  private reaction(socket: TypedSocket, emoji: ReactionEmoji): object {
    const { room, userId } = this.actor(socket);
    const { id, participant } = room.react(userId, emoji);
    this.io.to(room.id).emit("reaction", { id, userId, username: participant.username, emoji });
    return {};
  }

  // =====================================================================
  // Host actions
  // =====================================================================

  private assignRole(socket: TypedSocket, data: { userId: string; role: "moderator" | "participant" }): object {
    const { room, userId } = this.actor(socket);
    const target = room.assignRole(userId, data.userId, data.role);
    this.io.to(room.id).emit("role_assigned", {
      userId: target.id,
      username: target.username,
      role: target.role,
      participants: room.publicParticipants(),
    });
    return {};
  }

  private removeParticipant(socket: TypedSocket, targetId: string): object {
    const { room, userId } = this.actor(socket);
    const departure = room.removeByHost(userId, targetId);
    this.clearGrace(room.id, targetId);

    // Tell the removed person first (if connected), then take their socket out of the room's channel.
    const targetSocket = departure.leaving.socketId;
    if (targetSocket) {
      this.io.to(targetSocket).emit("removed_from_room", { roomId: room.id, reason: "The Host removed you from the room." });
      this.io.in(targetSocket).socketsLeave(room.id);
      this.rooms.unbind(targetSocket);
    }

    this.announceDeparture(room, departure, "removed");
    return {};
  }

  private transferHost(socket: TypedSocket, targetId: string): object {
    const { room, userId } = this.actor(socket);
    const { oldHost, newHost } = room.transferHost(userId, targetId);
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
    const { room, userId } = this.actor(socket);
    const request = room.createRequest(userId, action);
    // Only Host/Moderators need to see it, so notify just their connections.
    for (const id of room.resolverSocketIds()) this.io.to(id).emit("request_created", request);
    return { request };
  }

  private resolveRequest(socket: TypedSocket, requestId: string, approve: boolean): object {
    const { room, userId } = this.actor(socket);
    const { request, resolver } = room.resolveRequest(userId, requestId, approve);

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
    const me = room.member(userId);
    return {
      roomId: room.id,
      token: me.token,
      you: me.toPublic(),
      participants: room.publicParticipants(),
      state: room.syncSnapshot(),
      requests: room.canResolve(userId) ? room.pendingRequests() : [],
      chat: room.chatHistory(),
    };
  }

  /** Who is this socket, and which room are they in? Throws if they have not joined one. */
  private actor(socket: TypedSocket): { room: Room; userId: string } {
    const membership = this.rooms.membershipOf(socket.id);
    if (!membership) throw new AppError("NOT_IN_ROOM", "Join or create a room first.");
    return membership;
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
