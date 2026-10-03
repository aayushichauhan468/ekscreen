import type { Ack, ClientToServerEvents, ReactionEmoji, RoomJoined } from "../types";
import { socket } from "./socket";

type Events = ClientToServerEvents;
type AckOf<E extends keyof Events> = Parameters<Parameters<Events[E]>[1]>[0];

const NO_RESPONSE = {
  ok: false,
  code: "INTERNAL",
  message: "The server didn't respond. Check your connection and try again.",
} as const;

/**
 * Sends one event and waits for the server's acknowledgement.
 * Resolves with { ok: true, ... } or { ok: false, code, message }; it never throws,
 * so every screen can simply show `message` when `ok` is false.
 */
export function call<E extends keyof Events>(event: E, payload: Parameters<Events[E]>[0]): Promise<AckOf<E>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(NO_RESPONSE as unknown as AckOf<E>), 8000);
    // socket.io's overloaded emit() types don't work with a generic event name, so we
    // use one narrow, typed-by-signature escape hatch here instead of `any` everywhere.
    const raw = socket as unknown as { emit: (...args: unknown[]) => void };
    raw.emit(event, payload, (res: AckOf<E>) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

export const createRoom = (username: string, avatar: string): Promise<Ack<RoomJoined>> =>
  call("create_room", { username, avatar });
export const joinRoom = (roomId: string, username: string, avatar: string): Promise<Ack<RoomJoined>> =>
  call("join_room", { roomId, username, avatar });
export const rejoinRoom = (roomId: string, token: string): Promise<Ack<RoomJoined>> =>
  call("rejoin_room", { roomId, token });
export const leaveRoom = (roomId: string): Promise<Ack> => call("leave_room", { roomId });
export const sendChat = (text: string): Promise<Ack> => call("chat_message", { text });
export const sendReaction = (emoji: ReactionEmoji): Promise<Ack> => call("reaction", { emoji });
