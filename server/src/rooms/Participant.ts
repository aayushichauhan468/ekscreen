import type { PublicParticipant, Role } from "../types/domain.js";

/** One person inside a room. `id` is their socket id. */
export class Participant {
  readonly joinedAt = Date.now();

  constructor(
    readonly id: string,
    readonly username: string,
    public role: Role
  ) {}

  toPublic(): PublicParticipant {
    return { userId: this.id, username: this.username, role: this.role, joinedAt: this.joinedAt };
  }
}
