import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "../store/toastStore";

type Props = { text: string; label: string; children?: ReactNode; className?: string };

export default function CopyButton({ text, label, children, className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn't copy automatically. Select the text and copy it.", "warning");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={`inline-flex items-center gap-2 rounded-full border border-cream/15 bg-white/[0.04] px-3.5 py-2 text-sm text-cream/85 transition-colors hover:border-cream/35 hover:text-cream ${className}`}
    >
      {copied ? <Check className="h-4 w-4 text-brand" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {children ?? (copied ? "Copied" : label)}
    </button>
  );
}
