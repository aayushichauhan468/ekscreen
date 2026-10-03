import { ROLE_LABEL } from "../lib/format";
import type { Role } from "../types";

const STYLE: Record<Role, string> = {
  host: "border-gold/40 bg-gold/10 text-gold",
  moderator: "border-brand/40 bg-brand/10 text-brand",
  participant: "border-cream/15 bg-white/[0.04] text-cream/60",
};

export default function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none ${STYLE[role]}`}>
      {ROLE_LABEL[role]}
    </span>
  );
}
