import { AppError } from "../errors.js";
import { generateRoomCode } from "../utils/roomCode.js";
import { Room } from "./Room.js";

/** Keeps every live room and remembers which person each socket currently is. */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  // socket id -> (room, person). A person keeps their id across reconnects, but their socket id changes.
  private readonly memberships = new Map<string, { roomId: string; userId: string }>();

  get count(): number {
    return this.rooms.size;
  }

  createRoom(): Room {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode(); // practically never loops
    const room = new Room(code);
    this.rooms.set(code, room);
    return room;
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getOrThrow(roomId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new AppError("ROOM_NOT_FOUND", "No room found with that code. Check it and try again.");
    return room;
  }

  /** Who is this socket? (undefined if it is not in a room) */
  membershipOf(socketId: string): { room: Room; userId: string } | undefined {
    const m = this.memberships.get(socketId);
    const room = m ? this.rooms.get(m.roomId) : undefined;
    return m && room ? { room, userId: m.userId } : undefined;
  }

  bind(socketId: string, roomId: string, userId: string): void {
    this.memberships.set(socketId, { roomId, userId });
  }

  unbind(socketId: string): void {
    this.memberships.delete(socketId);
  }

  delete(roomId: string): void {
    this.rooms.delete(roomId);
  }
}
