/**
 * End-to-end check of the EkScreen server, with NO UI.
 * It starts a real server on a random port, connects several WebSocket clients
 * (Host, Participants, a late joiner) and walks through the whole assignment flow.
 *
 * Run:  npm run test:sim     (from the server folder)
 */
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Msg = Record<string, any>;

// Short grace period so the "person never came back" checks run quickly (real default: 45 s).
const { httpServer, io: server } = createApp({ reconnectGraceMs: 400 });
await new Promise<void>((resolve) => httpServer.listen(0, resolve));
const url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;

const sockets: Socket[] = [];
async function client(): Promise<Socket> {
  const s = connect(url, { transports: ["websocket"] });
  sockets.push(s);
  await new Promise<void>((resolve) => s.once("connect", () => resolve()));
  return s;
}

/** Send an event and wait for its acknowledgement. */
const call = (s: Socket, event: string, payload: Msg = {}) =>
  new Promise<Msg>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ack for "${event}"`)), 2000);
    s.emit(event, payload, (res: Msg) => {
      clearTimeout(timer);
      resolve(res);
    });
  });

/** Start listening for an event BEFORE triggering it, then await the result. */
const next = (s: Socket, event: string) =>
  new Promise<Msg>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), 2000);
    s.once(event, (data: Msg) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const roleOf = (participants: Msg[], name: string) => participants.find((p) => p.username === name)?.role;

let passed = 0;
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err) {
    console.log(`  \x1b[31m✘ ${name}\x1b[0m`);
    console.error(err);
    process.exitCode = 1;
    throw err;
  }
}

console.log("\nEkScreen server simulation\n");

try {
  let aayushi = await client(); // will be the Host
  let riya = await client();
  let arjun = await client();
  let roomId = "";
  let aayushiId = "", riyaId = "", arjunId = "";
  let aayushiToken = "", riyaToken = "", arjunToken = "";

  await step("Host creates a room and becomes Host", async () => {
    const res = await call(aayushi, "create_room", { username: "Aayushi" });
    assert.equal(res.ok, true);
    assert.equal(res.you.role, "host");
    assert.match(res.roomId, /^[A-Z0-9]{6}$/);
    roomId = res.roomId;
    aayushiId = res.you.userId;
    aayushiToken = res.token;
    assert.ok(res.token.length >= 20, "a secret token is issued");
  });

  await step("Joiner becomes Participant; Host is told", async () => {
    const hostHears = next(aayushi, "user_joined");
    const res = await call(riya, "join_room", { roomId: roomId.toLowerCase(), username: "Riya" }); // lowercase code still works
    assert.equal(res.ok, true);
    assert.equal(res.you.role, "participant");
    assert.equal(res.state.videoId, config.defaultVideoId); // a new room opens on the starter video
    riyaId = res.you.userId;
    riyaToken = res.token;
    const evt = await hostHears;
    assert.equal(evt.username, "Riya");
    assert.equal(roleOf(evt.participants, "Aayushi"), "host");
  });

  await step("Unknown room code and bad names are rejected", async () => {
    const missing = await call(arjun, "join_room", { roomId: "ZZZZZZ", username: "Arjun" });
    assert.deepEqual([missing.ok, missing.code], [false, "ROOM_NOT_FOUND"]);
    const empty = await call(arjun, "join_room", { roomId, username: "   " });
    assert.deepEqual([empty.ok, empty.code], [false, "BAD_REQUEST"]);
  });

  await step("Avatars: a valid pick is stored and shared; an out-of-range or malformed one is rejected", async () => {
    const ava = await client();
    const bad = await call(ava, "create_room", { username: "Mira", avatar: "9-0-0-0-0-0-0-0" }); // skin has only 6 options
    assert.deepEqual([bad.ok, bad.code], [false, "BAD_REQUEST"]);
    const junk = await call(ava, "create_room", { username: "Mira", avatar: "<script>" });
    assert.deepEqual([junk.ok, junk.code], [false, "BAD_REQUEST"]);
    const good = await call(ava, "create_room", { username: "Mira", avatar: "2-2-1-3-1-0-7-2" });
    assert.equal(good.ok, true);
    assert.equal(good.you.avatar, "2-2-1-3-1-0-7-2");
    const none = await call(await client(), "join_room", { roomId: good.roomId, username: "Noor" }); // no avatar is allowed
    assert.equal(none.ok, true);
    assert.equal(none.you.avatar, null);
    assert.equal(none.participants.find((p: Msg) => p.username === "Mira")?.avatar, "2-2-1-3-1-0-7-2"); // others see the pick
  });

  await step("Third person joins", async () => {
    const res = await call(arjun, "join_room", { roomId, username: "Arjun" });
    assert.equal(res.ok, true);
    assert.equal(res.participants.length, 3);
    arjunId = res.you.userId;
    arjunToken = res.token;
    assert.ok(res.participants.every((p: Msg) => p.online), "everyone starts online");
    assert.ok(!JSON.stringify(res.participants).includes(arjunToken), "tokens are never shared with others");
  });

  await step("Refreshing the page keeps your identity (Arjun drops, then rejoins with his token)", async () => {
    const wentOffline = next(aayushi, "presence_changed");
    arjun.disconnect();
    const off = await wentOffline;
    assert.equal(off.userId, arjunId);
    assert.equal(off.online, false);
    assert.equal(off.participants.find((p: Msg) => p.userId === arjunId).online, false);

    const cameBack = next(aayushi, "presence_changed");
    arjun = await client(); // a brand-new socket, like a refreshed page
    const res = await call(arjun, "rejoin_room", { roomId, token: arjunToken });
    assert.equal(res.ok, true);
    assert.equal(res.you.userId, arjunId); // same person...
    assert.equal(res.you.role, "participant"); // ...same role
    assert.equal(res.participants.length, 3); // no duplicate seat
    assert.equal((await cameBack).online, true);
  });

  await step("A wrong token or wrong room cannot take a seat", async () => {
    const stranger = await client();
    const badToken = await call(stranger, "rejoin_room", { roomId, token: "not-the-real-token-at-all" });
    assert.deepEqual([badToken.ok, badToken.code], [false, "INVALID_SESSION"]);
    const badRoom = await call(stranger, "rejoin_room", { roomId: "ZZZZZZ", token: arjunToken });
    assert.deepEqual([badRoom.ok, badRoom.code], [false, "ROOM_NOT_FOUND"]);
    stranger.disconnect();
  });

  await step("Opening the room in a second tab moves the seat; the first tab is told", async () => {
    const replaced = next(riya, "session_replaced");
    const tab2 = await client();
    const res = await call(tab2, "rejoin_room", { roomId, token: riyaToken });
    assert.equal(res.ok, true);
    assert.equal(res.you.userId, riyaId);
    await replaced;
    const oldTab = riya;
    riya = tab2;
    const stale = await call(oldTab, "play");
    assert.deepEqual([stale.ok, stale.code], [false, "NOT_IN_ROOM"]);
  });

  await step("A Host who refreshes keeps the Host role", async () => {
    aayushi.disconnect();
    await sleep(100); // well inside the grace period
    const fresh = await client();
    const res = await call(fresh, "rejoin_room", { roomId, token: aayushiToken });
    assert.equal(res.ok, true);
    assert.equal(res.you.userId, aayushiId);
    assert.equal(res.you.role, "host");
    assert.equal(roleOf(res.participants, "Aayushi"), "host");
    aayushi = fresh;
  });

  await step("Participant cannot play or change video (FORBIDDEN)", async () => {
    const play = await call(riya, "play");
    assert.deepEqual([play.ok, play.code], [false, "FORBIDDEN"]);
    const change = await call(riya, "change_video", { videoId: "dQw4w9WgXcQ" });
    assert.deepEqual([change.ok, change.code], [false, "FORBIDDEN"]);
  });

  await step("Host pastes a YouTube URL: everyone gets the clean video ID", async () => {
    const heard = [aayushi, riya, arjun].map((s) => next(s, "sync_state"));
    const res = await call(aayushi, "change_video", { videoId: "https://youtu.be/dQw4w9WgXcQ?t=5" });
    assert.equal(res.ok, true);
    for (const evt of await Promise.all(heard)) {
      assert.equal(evt.videoId, "dQw4w9WgXcQ");
      assert.equal(evt.playState, "paused");
      assert.equal(evt.currentTime, 0);
      assert.equal(evt.action, "change_video");
    }
  });

  await step("An invalid link is rejected", async () => {
    const res = await call(aayushi, "change_video", { videoId: "https://example.com/video" });
    assert.deepEqual([res.ok, res.code], [false, "BAD_REQUEST"]);
  });

  await step("Play, seek and pause synchronise everyone", async () => {
    let heard = [riya, arjun].map((s) => next(s, "sync_state"));
    await call(aayushi, "play");
    for (const evt of await Promise.all(heard)) assert.equal(evt.playState, "playing");

    heard = [riya, arjun].map((s) => next(s, "sync_state"));
    await call(aayushi, "seek", { time: 30 });
    for (const evt of await Promise.all(heard)) {
      assert.equal(evt.action, "seek");
      assert.equal(evt.currentTime, 30);
      assert.equal(evt.by, "Aayushi");
    }

    heard = [riya, arjun].map((s) => next(s, "sync_state"));
    await sleep(500);
    await call(aayushi, "pause");
    for (const evt of await Promise.all(heard)) {
      assert.equal(evt.playState, "paused");
      assert.ok(evt.currentTime >= 30.4 && evt.currentTime < 31.5, `paused at ${evt.currentTime}`); // time kept running while playing
    }
  });

  await step("Participant request: Host approves, change applies for everyone", async () => {
    const hostGetsRequest = next(aayushi, "request_created");
    const res = await call(riya, "request_action", { action: { type: "seek", time: 90 } });
    assert.equal(res.ok, true);
    const request = await hostGetsRequest;
    assert.equal(request.username, "Riya");
    assert.equal(request.action.time, 90);

    const again = await call(riya, "request_action", { action: { type: "pause" } });
    assert.deepEqual([again.ok, again.code], [false, "REQUEST_PENDING"]);

    const forbidden = await call(arjun, "approve_request", { requestId: request.id });
    assert.deepEqual([forbidden.ok, forbidden.code], [false, "FORBIDDEN"]);

    const heard = [aayushi, riya, arjun].map((s) => next(s, "sync_state"));
    const resolved = next(riya, "request_resolved");
    await call(aayushi, "approve_request", { requestId: request.id });
    for (const evt of await Promise.all(heard)) assert.equal(evt.currentTime, 90);
    const outcome = await resolved;
    assert.equal(outcome.status, "approved");
    assert.equal(outcome.resolvedBy, "Aayushi");
  });

  await step("Host rejects a request: nothing changes", async () => {
    const hostGetsRequest = next(aayushi, "request_created");
    await call(arjun, "request_action", { action: { type: "change_video", videoId: "https://www.youtube.com/watch?v=9bZkp7q19f0" } });
    const request = await hostGetsRequest;
    assert.equal(request.action.videoId, "9bZkp7q19f0");
    const resolved = next(arjun, "request_resolved");
    await call(aayushi, "reject_request", { requestId: request.id });
    assert.equal((await resolved).status, "rejected");
    const state = await call(arjun, "request_sync");
    assert.equal(state.state.videoId, "dQw4w9WgXcQ"); // still the old video
  });

  await step("Only the Host can assign roles", async () => {
    const res = await call(riya, "assign_role", { userId: arjunId, role: "moderator" });
    assert.deepEqual([res.ok, res.code], [false, "FORBIDDEN"]);
  });

  await step("Host promotes Riya to Moderator; everyone sees it; she can now play", async () => {
    const heard = [aayushi, riya, arjun].map((s) => next(s, "role_assigned"));
    const res = await call(aayushi, "assign_role", { userId: riyaId, role: "moderator" });
    assert.equal(res.ok, true);
    for (const evt of await Promise.all(heard)) {
      assert.equal(evt.role, "moderator");
      assert.equal(roleOf(evt.participants, "Riya"), "moderator");
    }
    const arjunHears = next(arjun, "sync_state");
    const play = await call(riya, "play");
    assert.equal(play.ok, true);
    assert.equal((await arjunHears).by, "Riya");
  });

  await step("Moderator cannot manage roles or remove people", async () => {
    const role = await call(riya, "assign_role", { userId: arjunId, role: "moderator" });
    assert.deepEqual([role.ok, role.code], [false, "FORBIDDEN"]);
    const remove = await call(riya, "remove_participant", { userId: arjunId });
    assert.deepEqual([remove.ok, remove.code], [false, "FORBIDDEN"]);
  });

  await step("Chat: any role can send; everyone (sender included) receives it", async () => {
    const heard = [aayushi, riya, arjun].map((s) => next(s, "chat_message"));
    const res = await call(arjun, "chat_message", { text: "  hello <b>everyone</b>  " }); // a plain Participant
    assert.equal(res.ok, true);
    for (const m of await Promise.all(heard)) {
      assert.equal(m.username, "Arjun");
      assert.equal(m.userId, arjunId);
      assert.equal(m.text, "hello <b>everyone</b>"); // trimmed; stored as plain text, never as HTML
      assert.ok(m.id && m.sentAt > 0);
    }
  });

  await step("Chat: empty, too long and control-character messages are rejected", async () => {
    for (const text of ["   ", "x".repeat(501), "bad\u0000text"]) {
      const res = await call(arjun, "chat_message", { text });
      assert.deepEqual([res.ok, res.code], [false, "BAD_REQUEST"], JSON.stringify(text.slice(0, 10)));
    }
    const wrongType = await call(arjun, "chat_message", { text: 42 });
    assert.deepEqual([wrongType.ok, wrongType.code], [false, "BAD_REQUEST"]);
  });

  await step("Chat: flooding is rate limited", async () => {
    const results = [];
    for (let i = 0; i < 8; i++) results.push(await call(riya, "chat_message", { text: `spam ${i}` }));
    assert.ok(results.slice(0, 6).every((r) => r.ok), "first 6 should pass");
    assert.equal(results[7].code, "RATE_LIMITED");
  });

  await step("Reactions: allowed emoji is broadcast to everyone; anything else is rejected", async () => {
    const heard = [aayushi, riya, arjun].map((s) => next(s, "reaction"));
    const res = await call(arjun, "reaction", { emoji: "🔥" });
    assert.equal(res.ok, true);
    for (const r of await Promise.all(heard)) assert.deepEqual([r.emoji, r.username], ["🔥", "Arjun"]);
    for (const emoji of ["hello", "💩", "", 5]) {
      const bad = await call(arjun, "reaction", { emoji });
      assert.deepEqual([bad.ok, bad.code], [false, "BAD_REQUEST"], String(emoji));
    }
  });

  await step("Chat and reactions need a room", async () => {
    const stranger = await client();
    const chat = await call(stranger, "chat_message", { text: "hi" });
    const react = await call(stranger, "reaction", { emoji: "🎉" });
    assert.deepEqual([chat.code, react.code], ["NOT_IN_ROOM", "NOT_IN_ROOM"]);
  });

  await step("Late joiner immediately gets the live position", async () => {
    await sleep(1100); // video has been playing since 90s
    const ishita = await client();
    const res = await call(ishita, "join_room", { roomId, username: "Ishita" });
    assert.equal(res.ok, true);
    assert.equal(res.state.playState, "playing");
    assert.ok(res.state.currentTime >= 91 && res.state.currentTime < 93, `late joiner time ${res.state.currentTime}`);
    assert.equal(res.requests.length, 0);
    assert.ok(res.chat.length >= 7, `late joiner chat history: ${res.chat.length}`);
    assert.equal(res.chat[0].text, "hello <b>everyone</b>"); // oldest first
    await call(ishita, "leave_room", { roomId });
  });

  await step("Host removes Arjun: he is told, others see it, he is out of the room", async () => {
    const removed = next(arjun, "removed_from_room");
    const others = [aayushi, riya].map((s) => next(s, "participant_removed"));
    await call(aayushi, "remove_participant", { userId: arjunId });
    assert.equal((await removed).roomId, roomId);
    for (const evt of await Promise.all(others)) {
      assert.equal(evt.username, "Arjun");
      assert.equal(evt.participants.length, 2);
    }
    const after = await call(arjun, "play");
    assert.deepEqual([after.ok, after.code], [false, "NOT_IN_ROOM"]);
  });

  await step("Host cannot remove or demote themselves", async () => {
    const remove = await call(aayushi, "remove_participant", { userId: aayushiId });
    assert.deepEqual([remove.ok, remove.code], [false, "INVALID_TARGET"]);
    const demote = await call(aayushi, "assign_role", { userId: aayushiId, role: "participant" });
    assert.deepEqual([demote.ok, demote.code], [false, "INVALID_TARGET"]);
  });

  await step("Host transfers the Host role to Riya (old Host becomes Moderator)", async () => {
    const heard = [aayushi, riya].map((s) => next(s, "host_transferred"));
    const res = await call(aayushi, "transfer_host", { userId: riyaId });
    assert.equal(res.ok, true);
    for (const evt of await Promise.all(heard)) {
      assert.equal(evt.reason, "manual");
      assert.equal(roleOf(evt.participants, "Riya"), "host");
      assert.equal(roleOf(evt.participants, "Aayushi"), "moderator");
    }
  });

  await step("If the Host never comes back, a Moderator is promoted automatically", async () => {
    const heard = next(aayushi, "host_transferred");
    riya.disconnect();
    const evt = await heard;
    assert.equal(evt.reason, "host_left");
    assert.equal(evt.newHostUsername, "Aayushi");
    assert.equal(roleOf(evt.participants, "Aayushi"), "host");
  });

  await step("When the last person leaves, the room is deleted", async () => {
    aayushi.disconnect();
    await sleep(900); // longer than the 400 ms grace period
    const stranger = await client();
    const res = await call(stranger, "join_room", { roomId, username: "Late" });
    assert.deepEqual([res.ok, res.code], [false, "ROOM_NOT_FOUND"]);
  });

  console.log(`\n\x1b[32mAll ${passed} checks passed.\x1b[0m\n`);
} catch {
  console.log(`\n\x1b[31mSimulation failed after ${passed} passing checks.\x1b[0m\n`);
} finally {
  sockets.forEach((s) => s.disconnect());
  await server.close();
}
