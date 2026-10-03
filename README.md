# EkScreen

**Watch Together. Feel Closer.**

EkScreen is a real-time YouTube watch party. Create a room, share the code, and everyone in the room sees
the same video state (play, pause, seek position, current video) at the same time. Rooms have roles
(Host, Moderator, Participant), live chat and emoji reactions.

> **Live URL:** https://ekscreen.vercel.app
## Features

| Area | What works |
|---|---|
| Rooms | Create a room (you become the Host) or join with a 6-character code or an invite link. |
| Sync | Play, pause, seek and change video are synchronised for everyone. Late joiners land at the current position. |
| Roles | **Host** (everything, incl. assign roles, remove people, transfer host), **Moderator** (play/pause/seek/change video, approve requests), **Participant** (watch only). |
| Requests | A Participant can ask for a change; the Host or a Moderator approves or rejects it in the Requests panel. |
| Social | Participant list with role badges, live chat, six emoji reactions that float over the video. |
| Avatars | Everyone picks an avatar when creating or joining a room; all participants see it. |
| Screen size | Full screen (messages and chat previews still show) and a wide theater mode. |
| Reliability | A refresh or short network drop keeps your seat (45 s grace period); the Host leaving passes the crown on automatically. |
| Safety | Every incoming event is validated with Zod, permission-checked on the server, and chat/reactions are rate limited. |
| Opening screen | A glowing EkScreen sign appears when the app opens, then fades into the landing page. Click or press any key to skip. It is skipped when you refresh inside a room. |
| Landing page | Animated green "party" glow with floating confetti, and a hero card that floats, tilts towards the mouse and has a light sweep. All motion switches off for people who prefer reduced motion. |
| Avatar designer | A popup window with a live preview, 12 quick picks and every part of the face (skin, hair, mood, extras, outfit, background). Nothing is saved until "Use this avatar" is pressed. |
| Starter video | A new room opens on a default video (paused at 0:00) so nobody sees a blank player. Host or Moderator can change it. |
## Tech stack

| Layer | Technology | Used for |
|---|---|---|
| Frontend | React 18, TypeScript, Vite | UI, build tooling |
| Styling and motion | Tailwind CSS, Framer Motion | Theme, layout, animations |
| State | Zustand | Room, chat, toast and UI state |
| Video | YouTube IFrame Player API | Embedded, controllable player |
| Backend | Node.js, Express, TypeScript | HTTP server, health check |
| Realtime | Socket.IO, **WebSocket transport only** | Bidirectional events between server and clients |
| Validation | Zod | Checks the payload of every incoming event |

**Not built yet** (planned): PostgreSQL + Prisma (saved rooms), Redis + Socket.IO Redis adapter (several servers),
shadcn/ui, GSAP, a left navigation with "My Rooms". Rooms currently live in the server's memory, so they are
lost when the server restarts.

## Run locally

Requirements: a recent Node.js (version 20 or newer is recommended) and npm.

```bash
npm run install:all                 # installs root, server and client dependencies
cp server/.env.example server/.env  # on Windows: copy server\.env.example server\.env
cp client/.env.example client/.env
npm run dev                         # server on :4000, client on :5173
```

Open http://localhost:5173. To test several people on one computer, use two different browsers
(or one normal and one private window), create a room in the first and join with the code in the second.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts server and client together |
| `npm run build` | Builds the server (`tsc`) and the client (`tsc -b && vite build`) |
| `npm run test:sim --prefix server` | Runs 29 automatic checks against a real in-process server (rooms, roles, sync, requests, reconnect, chat, avatars) |

### Environment variables

| File | Variable | Purpose |
|---|---|---|
| `server/.env` | `PORT` | Port the server listens on (default 4000) |
| `server/.env` | `CLIENT_ORIGIN` | The browser address allowed to connect (CORS). Use the Vercel URL in production |
| `server/.env` | `EKSCREEN_DEFAULT_VIDEO_ID` | Optional. The 11-character YouTube ID every new room starts with |
| `client/.env` | `VITE_SERVER_URL` | Address of the server. Use the Render URL in production |

## Project structure

```
ekscreen/
  client/                     React app
    src/pages/                LandingPage (create/join), RoomPage, RestoringPage
    src/components/           SyncedPlayer, PlayerControls, ChatPanel, ParticipantsPanel,
                              RequestsPanel, Avatar, AvatarPicker, Toasts, ...
    src/store/                Zustand stores (room, toasts, reactions, ui)
    src/lib/                  socket.ts, api.ts (typed event calls), syncMath.ts (drift), session.ts
  server/                     Express + Socket.IO
    src/handlers/             MessageHandler (one place for every event), schemas.ts (Zod)
    src/rooms/                Room, Participant, PlaybackState, RoomManager, RateLimiter, permissions.ts
    src/types/                domain types and the typed event lists
    scripts/simulate.ts       automatic end-to-end test
  docs/ARCHITECTURE.md        how WebSockets, roles and sync fit together
```

## How it works (short version)

1. Each browser opens one WebSocket to the server (Socket.IO, WebSocket transport only).
2. A Host or Moderator action (`play`, `pause`, `seek`, `change_video`) is sent to the server.
3. The server checks the sender's role, updates the room's single source of truth
   `{ videoId, playState, time, updatedAt }`, and broadcasts `sync_state` to the room.
4. Every client moves its YouTube player to the expected position and corrects it only if it is more than
   1 second off.

Details are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Deployment

Target setup: **backend on Render, frontend on Vercel**. These steps have not been run yet. Fill in the real
URLs in the table below once the app is live.

**Backend (Render, Web Service)**
1. Root directory `server`. Build command `npm install && npm run build`. Start command `npm start`.
2. Environment variables: `CLIENT_ORIGIN` = your Vercel URL (no trailing slash). `PORT` is set by Render.
3. Health check path: `/health`.
4. If the build says `tsc: not found`, use the build command `npm install --include=dev && npm run build`.

**Frontend (Vercel)**
1. Root directory `client`. Framework preset Vite (build `npm run build`, output `dist`).
2. Environment variable: `VITE_SERVER_URL` = your Render URL. Vite reads it at build time, so redeploy after changing it.

**Known limits to expect**
- Render's free tier puts the server to sleep when idle, so the first connection can take about a minute.
- Rooms are held in memory: a restart or a sleep deletes every room until the database step is built.
- Use one server instance only until the Redis step is built, otherwise people in the same room could land on different instances.
- Browsers block unmuted autoplay, so a joiner may need to click "Join the screening" once before the video can start.

| Item | URL |
|---|---|
| Frontend (live app) | _to be added_ |
| Backend health check | _to be added_ (`/health`) |

## Roadmap

- [ ] Deploy to Render and Vercel, add the live URL above
- [ ] PostgreSQL + Prisma: persistent rooms, users, roles, chat history, "My Rooms"
- [ ] Redis + Socket.IO Redis adapter: several server instances
- [ ] Left navigation (Home, Create Room, Join Room, My Rooms)
- [ ] shadcn/ui and GSAP polish
- [ ] Authentication (optional)

## UI and motion notes

- **Theme:** "Cinematic Social Lounge". Dark base, emerald glow, champagne-gold highlights, glass panels.
- **Opening screen and landing page:** built with Framer Motion. The landing page has a soft green party glow
  (`PartyGlow`) and an animated hero card (`HeroScreen`: slow float, pointer tilt, light sweep).
- **Reduced motion:** every decorative animation checks `useReducedMotion` and stays still when the user's
  device asks for less motion.
- **Avatar popup:** rendered with a React portal into `<body>`, so no parent animation can move it. The page
  behind cannot scroll while it is open, Esc closes it, and keyboard focus stays inside it.
- **Stable layout:** the hero card on the right is `position: sticky` and centred in the window, so it does not
  move when the form opens or the page scrolls.
- **Full screen:** the browser's Fullscreen API is used on the video box, not on the YouTube iframe, so toasts and chat previews still appear.

| Item | URL |
|---|---|
| Frontend (live app) | https://ekscreen.vercel.app |
| Backend health check | https://ekscreen.onrender.com/health |