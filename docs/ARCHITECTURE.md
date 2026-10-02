# EkScreen architecture (draft, updated each step)

- Client connects to the server with Socket.IO restricted to the `websocket` transport.
- The server is the single source of truth for each room: `{ videoId, playState, time, updatedAt }`.
- Every incoming event is validated (Zod) and permission-checked (role) before it is broadcast.
