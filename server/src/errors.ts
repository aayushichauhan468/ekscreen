/** Every failure the client can receive has one of these codes (the UI can react to them). */
export type ErrorCode =
  | "BAD_REQUEST"
  | "NOT_IN_ROOM"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "FORBIDDEN"
  | "USER_NOT_FOUND"
  | "INVALID_TARGET"
  | "REQUEST_NOT_FOUND"
  | "REQUEST_PENDING"
  | "INVALID_SESSION"
  | "RATE_LIMITED"
  | "INTERNAL";

/** An expected, user-facing error. Anything else is treated as a server bug (INTERNAL). */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}
