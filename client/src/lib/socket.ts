import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000";

// WebSocket-only transport: matches the server config, no HTTP polling fallback.
export const socket = io(SERVER_URL, {
  transports: ["websocket"],
  autoConnect: true,
});
