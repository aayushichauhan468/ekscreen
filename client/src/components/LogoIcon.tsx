type Props = { size?: number; animated?: boolean };

/**
 * EkScreen icon: a gradient screen surrounded by four signal arcs.
 * The inner arcs gently pulse when `animated` is true (used for the "synced" feel).
 */
export default function LogoIcon({ size = 40, animated = false }: Props) {
  const arcClass = animated ? "animate-arc-pulse" : "";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="EkScreen">
      <defs>
        <linearGradient id="ek-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F0C98A" />
          <stop offset="0.55" stopColor="#5E9A6F" />
          <stop offset="1" stopColor="#0F6F4C" />
        </linearGradient>
        <linearGradient id="ek-arc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6DDB0" />
          <stop offset="1" stopColor="#D2A869" />
        </linearGradient>
        <filter id="ek-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#ek-glow)">
        <rect x="64" y="70" width="72" height="60" rx="14" fill="url(#ek-screen)" />
        <g fill="none" stroke="url(#ek-arc)" strokeWidth="8" strokeLinecap="round">
          {/* outer arcs */}
          <path d="M23.9 135.5 A84 84 0 0 1 159.4 40.6" />
          <path d="M176.1 64.5 A84 84 0 0 1 40.6 159.4" />
          {/* inner arcs */}
          <g className={arcClass}>
            <path d="M65.6 50.8 A60 60 0 0 1 134.4 50.8" />
            <path d="M65.6 149.2 A60 60 0 0 0 134.4 149.2" />
            <path d="M45.6 74.6 A60 60 0 0 0 45.6 125.4" />
            <path d="M154.4 74.6 A60 60 0 0 1 154.4 125.4" />
          </g>
        </g>
      </g>
    </svg>
  );
}
