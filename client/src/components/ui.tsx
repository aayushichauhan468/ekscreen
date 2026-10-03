import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "quiet";
  loading?: boolean;
};

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-[transform,background-color,box-shadow,opacity] duration-200 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]";

const BUTTON_VARIANT = {
  primary: "bg-gold text-ink shadow-[0_8px_30px_-8px_rgb(251_191_36/0.55)] hover:bg-[#fcc94b]",
  ghost: "border border-cream/20 bg-white/[0.03] text-cream hover:border-cream/40 hover:bg-white/[0.07]",
  quiet: "px-3 py-2 text-cream/70 hover:text-cream",
} as const;

export function Button({ variant = "primary", loading, className = "", children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string };

export function Field({ label, hint, id, className = "", ...rest }: FieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-cream/60">
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full rounded-xl border border-cream/15 bg-ink/60 px-4 py-3 text-base text-cream placeholder:text-cream/30 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/20 ${className}`}
        {...rest}
      />
      {hint && <p className="mt-1.5 text-xs text-cream/45">{hint}</p>}
    </div>
  );
}
