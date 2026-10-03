# EkScreen architecture

This document explains how the pieces fit together: where WebSockets come in, who is allowed to do what,
and how every screen stays in sync. It describes the code as it is today (single server, rooms in memory).

## 1. Big picture

```
 Browser A (Host)          Browser B (Moderator)       Browser C (Participant)
 React + YouTube player    React + YouTube player      React + YouTube player
        |                          |                            |
        |   one WebSocket each (Socket.IO, transports: ["websocket"])
        +--------------------------+----------------------------+
                                   |
                       Node.js + Express + Socket.IO
                       MessageHandler  ->  Room  ->  PlaybackState
                       (validate)         (permissions)   (source of truth)
```

- **Express** only serves `GET /health` (used by the host platform to check the server is alive).
- **Socket.IO** carries all real-time traffic. It is locked to the `websocket` transport on both server and
  client, so there is no HTTP long-polling fallback: every event travels over a real WebSocket.
- **The server is the single source of truth.** Clients never tell each other what to do; they send a request
  to the server, which decides and then tells everybody.

## 2. Why WebSockets

HTTP is request and response: the server can never speak first. A watch party needs the server to push
"the Host paused at 1:42" to everyone instantly. A WebSocket is one long-lived two-way connection, so the
server can push to all clients without them asking. Socket.IO adds named events, acknowledgements (the
callback every client call receives), rooms (a group of sockets we broadcast to) and automatic reconnects.

## 3. Server structure (OOP)

| Class / file | Responsibility |
|---|---|
| `MessageHandler` | Registers every socket event. For each one: validate payload (Zod) -> call the room -> broadcast. Contains no game rules itself. |
| `RoomManager` | Creates rooms, finds a room by code, remembers which socket belongs to which room and person. |
| `Room` | One watch party: participants, roles, chat history, pending requests, playback. All rules (assign role, remove, transfer host, requests) live here and throw `AppError` when something is not allowed. |
| `Participant` | One person: id, username, role, avatar, secret token, online flag. |
| `PlaybackState` | The video state `{ videoId, playState, time, updatedAt }` and the maths for "where is the video right now". |
| `permissions.ts` | One table: role -> allowed actions. The only place to change what a role can do. |
| `RateLimiter` | Sliding-window limit so nobody can flood chat or reactions. |
| `schemas.ts` | Zod schema for every incoming event. |

Ids are only trusted from the server: a client can never choose its own `userId` or role.

## 4. Roles and permission checks

| Permission | Host | Moderator | Participant |
|---|:-:|:-:|:-:|
| Play, pause, seek, change video | yes | yes | no |
| Approve or reject requests | yes | yes | no |
| Create a request | no (not needed) | no (not needed) | yes |
| Assign roles, remove people, transfer host | yes | no | no |
| Chat and reactions | yes | yes | yes |

Flow for every event:

1. Zod validates the payload shape (a bad payload is answered with `BAD_REQUEST`).
2. The handler finds who the sender is from the socket (never from the payload).
3. `Room.requirePermission(userId, permission)` checks `permissions.ts`. If not allowed, it throws an
   `AppError` with a friendly message and nothing changes.
4. Only then is the state changed and broadcast.

The UI also hides or disables controls from the role it receives, but that is only for convenience: the
server check in step 3 is what actually protects the room.

Host rules: the Host cannot change their own role or remove themselves. Transferring the Host makes the old
Host a Moderator. If the Host leaves or times out, the first Moderator (otherwise the longest-present
person who is online) becomes Host automatically.

## 5. Events

Client -> server (each call gets an acknowledgement `{ ok, ... }` or `{ ok: false, code, message }`):

| Event | Who | Payload |
|---|---|---|
| `create_room` / `join_room` | anyone | `{ username, avatar? }` / `{ roomId, username, avatar? }` |
| `rejoin_room` | returning person | `{ roomId, token }` (token proves identity after a refresh) |
| `leave_room`, `request_sync` | member | `{ roomId }` / `{}` |
| `play`, `pause` | Host, Moderator | `{}` |
| `seek` | Host, Moderator | `{ time }` |
| `change_video` | Host, Moderator | `{ videoId }` (an ID or any YouTube URL) |
| `request_action` | Participant | `{ action }` (play, pause, seek or change_video) |
| `approve_request`, `reject_request` | Host, Moderator | `{ requestId }` |
| `assign_role` | Host | `{ userId, role }` |
| `remove_participant`, `transfer_host` | Host | `{ userId }` |
| `chat_message`, `reaction` | any member | `{ text }` / `{ emoji }` |

Server -> clients (broadcast to the room unless noted):

| Event | Meaning |
|---|---|
| `sync_state` | New video state, plus who did what (for "Riya paused" toasts) |
| `user_joined`, `user_left` | Someone arrived or left; includes the full participant list |
| `role_assigned`, `host_transferred` | Role changes; includes the updated list |
| `participant_removed` | Host removed someone; `removed_from_room` goes only to that person |
| `presence_changed` | Someone went offline or came back (within the grace period) |
| `request_created`, `request_resolved` | Request lifecycle (`request_created` goes only to Host and Moderators) |
| `chat_message`, `reaction` | Chat and floating emoji |
| `session_replaced` | The same person opened the room in another tab |

The names `join_room`, `leave_room`, `sync_state`, `play`, `pause`, `seek`, `change_video`, `assign_role`,
`remove_participant`, `user_joined`, `user_left`, `role_assigned` and `participant_removed` are the ones
required by the assignment. The others are our additions.

## 6. How synchronisation works

The server stores `{ videoId, playState, time, updatedAt }` and sends it in every `sync_state`.

- **Where should the video be now?** Paused: exactly `time`. Playing: `time + (now - moment we received it)`.
  We measure elapsed time with the **client's own clock** (not the server's), because two computers' clocks
  never match exactly. The cost is ignoring network delay (about 0.05-0.15 s), far below our threshold.
- **Drift correction:** every second each client compares its player's real position with the expected one
  and only seeks if the difference is **more than 1 second**. Smaller jumps would cause constant stuttering.
- **Late joiners:** `join_room` returns the current `sync_state`, so a new person starts at the right spot.
- **Starter video:** a new room starts on a default video, paused at 0:00, so nobody sees a blank player.
- **Autoplay policy:** browsers block unmuted autoplay, so a joiner may see a "Join the screening" button. One
  click lets the player obey the room.
- **Click shield:** an invisible layer over the YouTube iframe stops viewers clicking its built-in controls
  (which would desync them). Only our own role-aware controls can change playback.

## 7. Requests (Participant -> Host/Moderator)

1. A Participant sends `request_action`. Only one waiting request per person is allowed.
2. The server sends `request_created` only to the Host and Moderators (Requests panel).
3. On `approve_request` the server applies the action exactly like a normal playback event and broadcasts
   `sync_state`; on `reject_request` nothing changes. Either way `request_resolved` tells everyone concerned.
4. A request is cancelled automatically if its sender leaves.

## 8. Reconnects and sessions

- On joining, the server gives the client a secret **token**, stored in `sessionStorage` (survives a refresh
  of that tab, but a second tab gets its own identity, which makes testing easy).
- After a refresh or a network drop the client sends `rejoin_room { roomId, token }` and gets its seat back.
- A disconnected person stays in the room, marked offline, for **45 seconds**; after that they are removed
  (and the Host crown passes on if they were the Host). The last person leaving closes the room.

## 9. Testing

`server/scripts/simulate.ts` starts a real server on a random port and drives it with several Socket.IO
clients: create/join, permission denials, role changes, remove, transfer host, requests, sync, late join,
reconnect, chat, rate limits and avatars (29 checks).

## 10. Limits today and the path forward

| Today | Planned step |
|---|---|
| Rooms live in the server's memory; a restart deletes them | PostgreSQL + Prisma: persist rooms, users, roles and chat; "My Rooms" |
| One server instance only; rate-limit counters are in memory | Redis + Socket.IO Redis adapter so several instances can serve the same room; limiter counters move to Redis |
| No login (identity = token per tab) | Optional authentication |

## 11. Avatars

- An avatar is **8 small numbers** written as a text code, for example `2-2-1-3-1-0-7-2`: skin, hair style,
  hair colour, outfit, eyes, mouth, accessory, background.
- The client sends the code in `create_room` or `join_room`. The server validates it with Zod (8 numbers, each
  below that part's option count, taken from `AVATAR_PART_COUNTS`) and stores it on the `Participant`.
- It is included in every participant list, so all screens draw the same face. No image is uploaded or stored.
- If a person has no valid code, the browser draws a face from their `userId`, so nobody is ever blank.
- `AVATAR_PART_COUNTS` (server, `domain.ts`) and `PART_COUNTS` (client, `avatarConfig.ts`) must always match.

## 12. Client UI layers

| Layer | Purpose |
|---|---|
| `SplashScreen` | Opening animation; ends on a timer, click or key. Skipped when restoring a saved seat. |
| `LandingPage` + `PartyGlow` + `HeroScreen` | Create/join form with decorative glow and animated card. |
| `AvatarPopup` | Modal designer, mounted by a portal; edits a draft, saves on confirm. |
| `RoomPage` | Player, controls, requests, chat, participants. Theater mode and fullscreen are personal and never sent to the server. |
| Zustand stores | `roomStore` (room state), `toastStore`, `reactionStore`, `uiStore` (theater mode). |