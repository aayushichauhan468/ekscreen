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

/* eslint-disable @typescript-eslint/no-explicit-any */
type Msg = Record<string, any>;

const { httpServer, io: server } = createApp();
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
  const aayushi = await client(); // will be the Host
  const riya = await client();
  const arjun = await client();
  let roomId = "";
  let riyaId = "";
  let arjunId = "";
  let aayushiId = "";

  await step("Host creates a room and becomes Host", async () => {
    const res = await call(aayushi, "create_room", { username: "Aayushi" });
    assert.equal(res.ok, true);
    assert.equal(res.you.role, "host");
    assert.match(res.roomId, /^[A-Z0-9]{6}$/);
    roomId = res.roomId;
    aayushiId = res.you.userId;
  });

  await step("Joiner becomes Participant; Host is told", async () => {
    const hostHears = next(aayushi, "user_joined");
    const res = await call(riya, "join_room", { roomId: roomId.toLowerCase(), username: "Riya" }); // lowercase code still works
    assert.equal(res.ok, true);
    assert.equal(res.you.role, "participant");
    assert.equal(res.state.videoId, null);
    riyaId = res.you.userId;
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

  await step("Third person joins", async () => {
    const res = await call(arjun, "join_room", { roomId, username: "Arjun" });
    assert.equal(res.ok, true);
    assert.equal(res.participants.length, 3);
    arjunId = res.you.userId;
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

  await step("Late joiner immediately gets the live position", async () => {
    await sleep(1100); // video has been playing since 90s
    const ishita = await client();
    const res = await call(ishita, "join_room", { roomId, username: "Ishita" });
    assert.equal(res.ok, true);
    assert.equal(res.state.playState, "playing");
    assert.ok(res.state.currentTime >= 91 && res.state.currentTime < 93, `late joiner time ${res.state.currentTime}`);
    assert.equal(res.requests.length, 0);
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

  await step("If the Host disconnects, a Moderator is promoted automatically", async () => {
    const heard = next(aayushi, "host_transferred");
    riya.disconnect();
    const evt = await heard;
    assert.equal(evt.reason, "host_left");
    assert.equal(evt.newHostUsername, "Aayushi");
    assert.equal(roleOf(evt.participants, "Aayushi"), "host");
  });

  await step("When the last person leaves, the room is deleted", async () => {
    aayushi.disconnect();
    await sleep(150);
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
