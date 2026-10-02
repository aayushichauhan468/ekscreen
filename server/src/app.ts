import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { MessageHandler } from "./handlers/MessageHandler.js";
import { RoomManager } from "./rooms/RoomManager.js";
import type { ClientToServerEvents, ServerToClientEvents } from "./types/events.js";

/**
 * Builds the HTTP + WebSocket server WITHOUT starting it, so index.ts can listen on
 * a fixed port and the test script can start its own copy on a random port.
 */
export function createApp(options: { clientOrigin?: string } = {}) {
  const clientOrigin = options.clientOrigin ?? config.clientOrigin;

  const app = express();
  app.use(cors({ origin: clientOrigin }));

  const rooms = new RoomManager();

  // Health check: used by Render and by us to confirm the server is alive.
  app.get("/health", (_req, res) => {
    res.json({ app: "EkScreen", status: "ok", rooms: rooms.count });
  });

  const httpServer = createServer(app);

  // Socket.IO locked to pure WebSocket (no HTTP long-polling fallback),
  // so every real-time event travels over a real WebSocket connection.
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: clientOrigin },
    transports: ["websocket"],
    maxHttpBufferSize: 16 * 1024, // events are tiny; refuse oversized messages
  });

  const handler = new MessageHandler(io, rooms);
  io.on("connection", (socket) => {
    console.log(`[EkScreen] client connected: ${socket.id}`);
    handler.register(socket);
    socket.on("disconnect", (reason) => console.log(`[EkScreen] client disconnected: ${socket.id} (${reason})`));
  });

  return { app, httpServer, io, rooms };
}
