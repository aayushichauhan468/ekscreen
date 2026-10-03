import { create } from "zustand";
import { loadSession } from "../lib/session";
import type { ChatMessage, PendingRequest, PublicParticipant, RoomJoined, SyncState } from "../types";

/** Keep at most this many chat lines in memory (the server keeps 100; this is just a safety cap). */
const MAX_CHAT = 200;

/** What the screen shows: restoring a saved seat -> landing page -> inside a room. */
export type Status = "restoring" | "idle" | "in_room";

export interface Playback extends SyncState {
  receivedAt: number; // client clock when this arrived (used for drift correction in step 3)
  lastAction: string | null;
  lastBy: string | null;
}

interface RoomState {
  status: Status;
  roomId: string | null;
  me: PublicParticipant | null;
  participants: PublicParticipant[];
  playback: Playback | null;
  requests: PendingRequest[];
  chat: ChatMessage[];

  applyJoined: (joined: RoomJoined) => void;
  setParticipants: (list: PublicParticipant[]) => void;
  setPlayback: (state: SyncState, action?: string, by?: string) => void;
  addRequest: (request: PendingRequest) => void;
  removeRequest: (requestId: string) => void;
  addChat: (message: ChatMessage) => void;
  setIdle: () => void;
}

export const useRoomStore = create<RoomState>()((set) => ({
  // If a saved seat exists we start in "restoring" so a refresh never flashes the landing page.
  status: loadSession() ? "restoring" : "idle",
  roomId: null,
  me: null,
  participants: [],
  playback: null,
  requests: [],
  chat: [],

  applyJoined: (j) =>
    set({
      status: "in_room",
      roomId: j.roomId,
      me: j.you,
      participants: j.participants,
      playback: { ...j.state, receivedAt: Date.now(), lastAction: null, lastBy: null },
      requests: j.requests,
      chat: j.chat ?? [], // after a reconnect this also fills in anything we missed
    }),

  // Every participant-list update also refreshes "me", so role changes show up instantly.
  setParticipants: (list) =>
    set((s) => ({
      participants: list,
      me: s.me ? (list.find((p) => p.userId === s.me!.userId) ?? s.me) : s.me,
    })),

  setPlayback: (state, action, by) =>
    set({ playback: { ...state, receivedAt: Date.now(), lastAction: action ?? null, lastBy: by ?? null } }),

  addRequest: (request) =>
    set((s) => ({ requests: s.requests.some((r) => r.id === request.id) ? s.requests : [...s.requests, request] })),

  removeRequest: (requestId) => set((s) => ({ requests: s.requests.filter((r) => r.id !== requestId) })),

  // Ignore a message we already have (same id), then keep only the newest MAX_CHAT.
  addChat: (message) =>
    set((s) => (s.chat.some((m) => m.id === message.id) ? s : { chat: [...s.chat, message].slice(-MAX_CHAT) })),

  setIdle: () =>
    set({ status: "idle", roomId: null, me: null, participants: [], playback: null, requests: [], chat: [] }),
}));
