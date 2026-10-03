import { LogOut, Users } from "lucide-react";
import Avatar from "../components/Avatar";
import ChatPanel from "../components/ChatPanel";
import CopyButton from "../components/CopyButton";
import Logo from "../components/Logo";
import ParticipantsPanel from "../components/ParticipantsPanel";
import ReactionBar from "../components/ReactionBar";
import RequestsPanel from "../components/RequestsPanel";
import RoleBadge from "../components/RoleBadge";
import SyncedPlayer from "../components/SyncedPlayer";
import { Button } from "../components/ui";
import { useConnectionStatus } from "../hooks/useConnectionStatus";
import { leaveRoom } from "../lib/api";
import { inviteLink, setRoomInUrl } from "../lib/invite";
import { clearSession } from "../lib/session";
import { useRoomStore } from "../store/roomStore";
import { useUiStore } from "../store/uiStore";
import type { PublicParticipant } from "../types";

function TopBar({ roomId, me, participants }: { roomId: string; me: PublicParticipant; participants: PublicParticipant[] }) {
  const connected = useConnectionStatus();

  async function leave() {
    await leaveRoom(roomId); // even if this fails, we still leave on our side
    clearSession();
    setRoomInUrl(null);
    useRoomStore.getState().setIdle();
  }

  return (
    <header className="glass flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Logo size={34} />
        <span className="hidden h-8 w-px bg-cream/15 sm:block" />
        <div className="flex items-center gap-3">
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-wider text-cream/50">Room</div>
            <div className="font-semibold tracking-[0.25em]">{roomId}</div>
          </div>
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${connected ? "bg-brand/15 text-brand" : "bg-gold/15 text-gold"}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-brand" : "bg-gold"}`} />
            {connected ? "Live" : "Reconnecting"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2 text-sm text-cream/70">
          <Users className="h-4 w-4" aria-hidden />
          {participants.length} watching
        </div>
        <div className="flex items-center gap-2.5 rounded-full border border-cream/10 bg-white/3 py-1 pl-1 pr-3">
          <Avatar name={me.username} avatar={me.avatar} seed={me.userId} size={30} role={me.role} />
          <span className="max-w-36 truncate text-sm font-medium">{me.username}</span>
          <RoleBadge role={me.role} />
        </div>
        <Button variant="ghost" onClick={leave} className="px-4 py-2">
          <LogOut className="h-4 w-4" aria-hidden /> Leave room
        </Button>
      </div>
    </header>
  );
}

function SyncBar({ canControl }: { canControl: boolean }) {
  const connected = useConnectionStatus();
  const playback = useRoomStore((s) => s.playback);
  return (
    <div className="glass flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 text-sm">
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-brand shadow-[0_0_10px_var(--color-brand)]" : "bg-gold"}`}
        />
        <div className="leading-tight">
          <div className="text-[11px] uppercase tracking-wider text-cream/50">Sync status</div>
          <div className="font-medium">{connected ? "All synced" : "Reconnecting…"}</div>
        </div>
      </div>
      {playback && <div className="text-cream/70">{playback.playState === "playing" ? "Playing" : "Paused"}</div>}
      <div className="text-cream/55">
        {canControl ? "You control playback" : "Only the Host and Moderators control playback"}
      </div>
    </div>
  );
}

function InviteCard({ roomId }: { roomId: string }) {
  return (
    <section className="glass p-5" aria-label="Invite friends">
      <h2 className="text-sm font-semibold">Invite friends</h2>
      <p className="mt-1 text-xs text-cream/55">Anyone with the code can join as a Participant.</p>
      <div className="my-4 rounded-2xl border border-gold/20 bg-ink/50 py-4 text-center font-display text-4xl font-semibold tracking-[0.3em] text-gold">
        {roomId}
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={roomId} label="Copy code" />
        <CopyButton text={inviteLink(roomId)} label="Copy invite link" />
      </div>
    </section>
  );
}

export default function RoomPage() {
  const roomId = useRoomStore((s) => s.roomId);
  const me = useRoomStore((s) => s.me);
  const participants = useRoomStore((s) => s.participants);
  const theater = useUiStore((s) => s.theater);
  if (!roomId || !me) return null;

  const canControl = me.role === "host" || me.role === "moderator";

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-375 flex-col gap-4 px-4 pb-6 pt-4 sm:px-6">
      <TopBar roomId={roomId} me={me} participants={participants} />
      {/* Normal: player + 21rem sidebar. Theater: one column, so the player gets the full width. */}
      <div className={`grid flex-1 content-start gap-4 ${theater ? "" : "lg:grid-cols-[minmax(0,1fr)_21rem]"}`}>
        <section className="flex min-w-0 flex-col gap-4">
          <SyncedPlayer canControl={canControl} />
          <ReactionBar />
          <SyncBar canControl={canControl} />
        </section>
        {/* In theater mode the panels sit under the player in a row of columns instead of a narrow sidebar. */}
        <aside className={theater ? "grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-4"}>
          {/* Only Host/Moderators see the Requests panel */}
          {canControl && <RequestsPanel />}
          <ChatPanel />
          <ParticipantsPanel participants={participants} meId={me.userId} myRole={me.role} />
          <InviteCard roomId={roomId} />
        </aside>
      </div>
    </div>
  );
}