import { randomBytes } from "node:crypto";
import type { PublicParticipant, Role } from "../types/domain.js";

/**
 * One person inside a room.
 *  - `id`      is PUBLIC and stable: everyone sees it, and it survives page refreshes.
 *  - `token`   is SECRET: only this person knows it. Presenting it proves "I am this person",
 *              so nobody can steal another person's seat just by knowing their id.
 *  - `socketId` is the CURRENT connection. It becomes null while the person is disconnected
 *              (refresh, bad Wi-Fi) and is set again when they rejoin.
 */
export class Participant {
  readonly joinedAt = Date.now();
  readonly id = randomBytes(9).toString("base64url");
  readonly token = randomBytes(24).toString("base64url");
  socketId: string | null;

  constructor(
    socketId: string,
    readonly username: string,
    public role: Role,
    readonly avatar: string | null = null
  ) {
    this.socketId = socketId;
  }

  get online(): boolean {
    return this.socketId !== null;
  }

  toPublic(): PublicParticipant {
    return {
      userId: this.id,
      username: this.username,
      role: this.role,
      joinedAt: this.joinedAt,
      online: this.online,
      avatar: this.avatar,
    };
  }
}
