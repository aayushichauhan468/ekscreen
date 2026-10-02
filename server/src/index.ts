import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));

// Health check: used by Render and by us to confirm the server is alive.
app.get("/health", (_req, res) => {
  res.json({ app: "EkScreen", status: "ok" });
});

const httpServer = createServer(app);

// Socket.IO locked to pure WebSocket (no HTTP long-polling fallback),
// so every real-time event travels over a real WebSocket connection.
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
  transports: ["websocket"],
});

io.on("connection", (socket) => {
  console.log(`[EkScreen] client connected: ${socket.id}`);
  socket.emit("server_ready", { message: "Connected to EkScreen server" });

  socket.on("disconnect", (reason) => {
    console.log(`[EkScreen] client disconnected: ${socket.id} (${reason})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[EkScreen] server listening on http://localhost:${PORT}`);
});
