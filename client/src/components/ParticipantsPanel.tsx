import { AnimatePresence, motion } from "framer-motion";
import { Ellipsis } from "lucide-react";
import { useState } from "react";
import { call } from "../lib/api";
import { toast } from "../store/toastStore";
import type { PublicParticipant, Role } from "../types";
import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";

const ROLE_ORDER: Record<Role, number> = { host: 0, moderator: 1, participant: 2 };

const PILL =
  "rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60";
const PILL_NORMAL = `${PILL} border-cream/20 bg-white/3 text-cream hover:border-cream/40`;
const PILL_DANGER = `${PILL} border-danger/40 text-danger hover:border-danger/70`;

type Confirming = "host" | "remove" | null;

/**
 * Everyone sees the list with role badges. Only the Host also gets a "..." button on each other
 * person: promote/demote, hand over the Host role, or remove. Risky actions need a second tap.
 * The server re-checks that you're the Host, so this is for convenience, not security.
 */
export default function ParticipantsPanel({
  participants,
  meId,
  myRole,
}: {
  participants: PublicParticipant[];
  meId: string;
  myRole: Role;
}) {
  const isHost = myRole === "host";
  const [openId, setOpenId] = useState<string | null>(null); // whose menu is open
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [busy, setBusy] = useState(false);

  const sorted = [...participants].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.joinedAt - b.joinedAt);

  function toggleMenu(userId: string) {
    setConfirming(null);
    setOpenId((current) => (current === userId ? null : userId));
  }

  /** Runs one server call, shows an error toast if it failed, then closes the menu. */
  async function act(request: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setBusy(true);
    const res = await request();
    setBusy(false);
    if (!res.ok) toast(res.message, "warning");
    setConfirming(null);
    setOpenId(null);
  }

  return (
    <section className="glass p-4" aria-label="Participants">
      <h2 className="mb-3 flex items-center justify-between text-sm font-semibold">
        <span>Participants ({participants.length})</span>
      </h2>
      <ul className="space-y-1.5">
        <AnimatePresence initial={false}>
          {sorted.map((p) => {
            const canManage = isHost && p.userId !== meId;
            const open = openId === p.userId;
            return (
              <motion.li
                key={p.userId}
                layout
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="rounded-xl border border-transparent px-2 py-2 hover:border-cream/10 hover:bg-white/3"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={p.username} avatar={p.avatar} seed={p.userId} size={40} role={p.role} online={p.online} showStatus />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-sm font-medium">
                      {p.username}
                      {p.userId === meId && <span className="ml-1.5 text-xs font-normal text-cream/45">(you)</span>}
                    </div>
                    {!p.online && <div className="text-xs text-gold">Reconnecting…</div>}
                  </div>
                  <RoleBadge role={p.role} />
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => toggleMenu(p.userId)}
                      aria-label={`Manage ${p.username}`}
                      aria-expanded={open}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-cream/60 transition hover:bg-white/8 hover:text-cream"
                    >
                      <Ellipsis className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {canManage && open && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap gap-2 pb-1 pt-3">
                        {p.role === "participant" ? (
                          <button
                            type="button"
                            disabled={busy}
                            className={PILL_NORMAL}
                            onClick={() => act(() => call("assign_role", { userId: p.userId, role: "moderator" }))}
                          >
                            Make Moderator
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            className={PILL_NORMAL}
                            onClick={() => act(() => call("assign_role", { userId: p.userId, role: "participant" }))}
                          >
                            Make Participant
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={busy}
                          className={PILL_NORMAL}
                          onClick={() =>
                            confirming === "host" ? act(() => call("transfer_host", { userId: p.userId })) : setConfirming("host")
                          }
                        >
                          {confirming === "host" ? "Tap again to confirm" : "Make Host"}
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          className={PILL_DANGER}
                          onClick={() =>
                            confirming === "remove"
                              ? act(() => call("remove_participant", { userId: p.userId }))
                              : setConfirming("remove")
                          }
                        >
                          {confirming === "remove" ? "Tap again to remove" : "Remove"}
                        </button>
                      </div>
                      {confirming === "host" && (
                        <p className="pb-1 text-xs text-cream/55">You'll become a Moderator and {p.username} will be the Host.</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}