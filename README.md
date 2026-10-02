# EkScreen

**Watch Together. Feel Closer.**
EkScreen is a real-time YouTube watch party: create a room, share the code, and everyone sees the same video state (play, pause, seek, current video) over WebSockets, with Host / Moderator / Participant roles.

> Live URL: _to be added after deployment_

## Tech stack
React + TypeScript + Vite, Tailwind CSS, Framer Motion, Zustand, YouTube IFrame API,
Node.js + Express + TypeScript, Socket.IO (WebSocket-only transport), Zod,
PostgreSQL + Prisma, Redis (later steps).

## Run locally
```bash
npm run install:all          # installs root, server and client dependencies
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run dev                  # server on :4000, client on :5173
```
Open http://localhost:5173 - the green "Server connected" pill confirms the WebSocket link works.

## Project structure
```
ekscreen/
  client/   React app (UI, YouTube player, socket client)
  server/   Express + Socket.IO (rooms, roles, sync logic)
  docs/     Architecture notes
```
