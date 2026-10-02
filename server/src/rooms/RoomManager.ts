import { AppError } from "../errors.js";
import { generateRoomCode } from "../utils/roomCode.js";
import { Room } from "./Room.js";

/** Keeps every live room and remembers which room each socket is in. */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly roomBySocket = new Map<string, string>();

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

  getOrThrow(roomId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new AppError("ROOM_NOT_FOUND", "No room found with that code. Check it and try again.");
    return room;
  }

  roomOf(socketId: string): Room | undefined {
    const roomId = this.roomBySocket.get(socketId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  bind(socketId: string, roomId: string): void {
    this.roomBySocket.set(socketId, roomId);
  }

  unbind(socketId: string): void {
    this.roomBySocket.delete(socketId);
  }

  delete(roomId: string): void {
    this.rooms.delete(roomId);
  }
}
