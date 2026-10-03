import { rejoinRoom } from "./api";
import { describeAction } from "./format";
import { roomFromUrl, setRoomInUrl } from "./invite";
import { clearSession, loadSession, saveSession } from "./session";
import { socket } from "./socket";
import { useReactionStore } from "../store/reactionStore";
import { useRoomStore } from "../store/roomStore";
import type { ServerToClientEvents } from "../types";
import { toast } from "../store/toastStore";

/**
 * Wires every server event to the store. Called once when the app starts.
 * Components never talk to the socket directly: they read the store and call `lib/api`.
 */
export function bindSocketEvents(): () => void {
  const store = () => useRoomStore.getState();

  /** Runs on the first connect AND after every reconnect (new socket id, same person). */
  let restoring = false;
  async function restoreSession() {
    if (restoring) return;
    const saved = loadSession();
    if (!saved) {
      if (store().status === "restoring") store().setIdle();
      return;
    }
    // Opened an invite link for a DIFFERENT room than the saved one: the person wants the new room.
    const wanted = roomFromUrl();
    if (wanted && wanted !== saved.roomId && store().status !== "in_room") {
      clearSession();
      store().setIdle();
      return;
    }
    restoring = true;
    const res = await rejoinRoom(saved.roomId, saved.token);
    restoring = false;
    if (res.ok) {
      saveSession({ roomId: res.roomId, token: res.token, username: saved.username });
      setRoomInUrl(res.roomId);
      store().applyJoined(res);
    } else if (res.code === "INVALID_SESSION" || res.code === "ROOM_NOT_FOUND") {
      clearSession();
      setRoomInUrl(null);
      store().setIdle();
      toast("That room has ended, so you're back at the start.", "warning");
    }
    // Other errors (e.g. timeout): keep the saved seat, the next reconnect will try again.
  }

  const onConnect = () => void restoreSession();

  // Typed against the event contract, so every parameter below is fully typed automatically.
  const handlers: ServerToClientEvents = {
    sync_state: (s) => store().setPlayback(s, s.action, s.by),

    user_joined: (p) => {
      store().setParticipants(p.participants);
      toast(`${p.username} joined the room`, "success");
    },
    user_left: (p) => {
      store().setParticipants(p.participants);
      toast(`${p.username} left the room`);
    },
    presence_changed: (p) => store().setParticipants(p.participants),

    role_assigned: (p) => {
      store().setParticipants(p.participants);
      const you = store().me?.userId === p.userId;
      toast(you ? `You are now a ${p.role}` : `${p.username} is now a ${p.role}`, "success");
    },

    participant_removed: (p) => {
      store().setParticipants(p.participants);
      toast(`${p.username} was removed from the room`);
    },

    host_transferred: (p) => {
      store().setParticipants(p.participants);
      toast(store().me?.userId === p.newHostId ? "You are now the Host" : `${p.newHostUsername} is now the Host`, "success");
    },

    request_created: (r) => {
      store().addRequest(r);
      toast(`${r.username} asked to ${describeAction(r.action)}`);
    },

    request_resolved: (p) => {
      store().removeRequest(p.requestId);
      if (p.status === "approved") toast(`${p.resolvedBy} approved ${p.requesterName}'s request`, "success");
      if (p.status === "rejected") toast(`${p.resolvedBy} declined ${p.requesterName}'s request`);
    },

    removed_from_room: (p) => {
      clearSession();
      setRoomInUrl(null);
      store().setIdle();
      toast(p.reason, "warning");
    },

    chat_message: (m) => store().addChat(m),

    // A reaction is only a moment on screen. In a hidden tab animations don't run, so skip them there.
    reaction: (r) => {
      if (!document.hidden) useReactionStore.getState().add(r.emoji, r.username);
    },

    session_replaced: () => {
      clearSession();
      setRoomInUrl(null);
      store().setIdle();
      toast("This room was opened in another tab, so this tab stepped out.", "warning");
    },
  };

  socket.on("connect", onConnect);
  socket.on("sync_state", handlers.sync_state);
  socket.on("user_joined", handlers.user_joined);
  socket.on("user_left", handlers.user_left);
  socket.on("presence_changed", handlers.presence_changed);
  socket.on("role_assigned", handlers.role_assigned);
  socket.on("participant_removed", handlers.participant_removed);
  socket.on("host_transferred", handlers.host_transferred);
  socket.on("request_created", handlers.request_created);
  socket.on("request_resolved", handlers.request_resolved);
  socket.on("removed_from_room", handlers.removed_from_room);
  socket.on("session_replaced", handlers.session_replaced);
  socket.on("chat_message", handlers.chat_message);
  socket.on("reaction", handlers.reaction);

  if (socket.connected) onConnect();

  return () => {
    socket.off("connect", onConnect);
    socket.off("sync_state", handlers.sync_state);
    socket.off("user_joined", handlers.user_joined);
    socket.off("user_left", handlers.user_left);
    socket.off("presence_changed", handlers.presence_changed);
    socket.off("role_assigned", handlers.role_assigned);
    socket.off("participant_removed", handlers.participant_removed);
    socket.off("host_transferred", handlers.host_transferred);
    socket.off("request_created", handlers.request_created);
    socket.off("request_resolved", handlers.request_resolved);
    socket.off("removed_from_room", handlers.removed_from_room);
    socket.off("session_replaced", handlers.session_replaced);
    socket.off("chat_message", handlers.chat_message);
    socket.off("reaction", handlers.reaction);
  };
}
