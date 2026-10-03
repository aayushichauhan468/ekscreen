const HEIGHTS = [60, 95, 70, 120, 85, 55, 105, 75, 130, 90, 65, 100, 80, 115, 70, 95, 60];
const FIREFLIES = [
  [70, 300, "0s"], [150, 330, "-1.2s"], [210, 290, "-2.4s"], [430, 320, "-0.6s"],
  [500, 296, "-3s"], [570, 335, "-1.8s"], [380, 280, "-2.1s"],
] as const;

/**
 * A drawn dusk skyline with two silhouettes watching together: our stand-in for a movie still.
 * Pure SVG, so it is tiny, sharp at any size and needs no image files.
 */
export default function DuskScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="dusk-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1410" />
          <stop offset="0.38" stopColor="#25382b" />
          <stop offset="0.62" stopColor="#a8682c" />
          <stop offset="0.82" stopColor="#e8a24a" />
          <stop offset="1" stopColor="#f6cf80" />
        </linearGradient>
        <radialGradient id="dusk-sun" cx="50%" cy="66%" r="42%">
          <stop offset="0" stopColor="#ffe3a3" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffe3a3" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="640" height="400" fill="url(#dusk-sky)" />
      <rect width="640" height="400" fill="url(#dusk-sun)" />

      {/* distant hills */}
      <path d="M0 262 C90 228 160 244 250 256 S420 232 520 252 S600 240 640 246 V400 H0Z" fill="#16241b" opacity="0.9" />

      {/* city skyline with a few lit windows */}
      {HEIGHTS.map((h, i) => {
        const x = i * 38 - 6;
        const top = 282 - h;
        return (
          <g key={i}>
            <rect x={x} y={top} width="31" height={h + 20} fill="#0f1b14" />
            {i % 2 === 0 &&
              [0, 1, 2].map((k) => (
                <rect key={k} x={x + 7 + (k % 2) * 13} y={top + 12 + k * 17} width="4" height="6" fill="#f6cf80" opacity="0.55" />
              ))}
          </g>
        );
      })}

      {/* foreground ledge */}
      <path d="M0 332 C120 314 260 324 380 318 S560 308 640 320 V400 H0Z" fill="#080e0b" />

      {/* two people, seen from behind */}
      <g fill="#050806" stroke="#f6cf80" strokeOpacity="0.4" strokeWidth="1.2">
        <circle cx="292" cy="300" r="15" />
        <path d="M262 352 C262 324 276 316 292 316 S322 324 322 352 Z" />
        <circle cx="352" cy="302" r="14" />
        <path d="M324 352 C324 326 337 318 352 318 S380 326 380 352 Z" />
      </g>

      {FIREFLIES.map(([x, y, delay], i) => (
        <circle key={i} cx={x} cy={y} r="2.2" fill="#ffe3a3" className="animate-flicker" style={{ animationDelay: delay }} />
      ))}
    </svg>
  );
}
