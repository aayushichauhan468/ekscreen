import { AnimatePresence, motion } from "framer-motion";
import { Check, ExternalLink, X } from "lucide-react";
import { useState } from "react";
import { call } from "../lib/api";
import { describeAction } from "../lib/format";
import { useRoomStore } from "../store/roomStore";
import { toast } from "../store/toastStore";

/**
 * Host / Moderator only. Lists what Participants have asked for.
 * Approve -> the server applies the change and tells everyone (sync_state).
 * Reject  -> nothing changes. Either way the server removes the request (request_resolved).
 */
export default function RequestsPanel() {
  const requests = useRoomStore((s) => s.requests);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function resolve(requestId: string, approve: boolean) {
    setBusyId(requestId);
    const res = approve ? await call("approve_request", { requestId }) : await call("reject_request", { requestId });
    setBusyId(null);
    if (!res.ok) {
      toast(res.message, "warning");
      // Another Moderator got there first: drop it from our list too.
      if (res.code === "REQUEST_NOT_FOUND") useRoomStore.getState().removeRequest(requestId);
    }
  }

  return (
    <section className="glass p-4" aria-label="Requests">
      <h2 className="mb-3 flex items-center justify-between text-sm font-semibold">
        <span>Requests</span>
        {requests.length > 0 && (
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">{requests.length}</span>
        )}
      </h2>

      {requests.length === 0 ? (
        <p className="text-sm text-cream/50">No requests right now. When a Participant asks for a change, it shows up here.</p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {requests.map((r) => (
              <motion.li
                key={r.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="rounded-xl border border-gold/20 bg-gold/[0.04] p-3"
              >
                <p className="text-sm">
                  <span className="font-semibold">{r.username}</span> asked to {describeAction(r.action)}
                </p>
                {r.action.type === "change_video" && (
                  <a
                    href={`https://www.youtube.com/watch?v=${r.action.videoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-gold hover:underline"
                  >
                    Preview video <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => resolve(r.id, true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-[#fcc94b] disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => resolve(r.id, false)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-cream/20 px-3.5 py-1.5 text-xs font-semibold text-cream/80 transition hover:border-cream/40 disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden /> Reject
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}