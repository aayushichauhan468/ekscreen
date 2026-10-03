import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../types";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// WebSocket-only transport: matches the server config, no HTTP polling fallback.
export const socket: AppSocket = io(SERVER_URL, {
  transports: ["websocket"],
  autoConnect: true,
});
