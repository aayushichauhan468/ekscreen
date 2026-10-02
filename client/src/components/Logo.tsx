import LogoIcon from "./LogoIcon";

type Props = { size?: number; animated?: boolean; showTagline?: boolean };

/** Icon + wordmark. "Ek" in gold, "Screen" in cream, set in Playfair Display. */
export default function Logo({ size = 44, animated = false, showTagline = false }: Props) {
  return (
    <div className="flex items-center gap-3">
      <LogoIcon size={size} animated={animated} />
      <div className="text-left leading-none">
        <div className="font-display text-3xl font-semibold tracking-tight">
          <span className="text-gold">Ek</span>
          <span className="text-cream">Screen</span>
        </div>
        {showTagline && (
          <div className="font-script mt-1 text-lg text-cream/70">Watch Together. Feel Closer.</div>
        )}
      </div>
    </div>
  );
}
