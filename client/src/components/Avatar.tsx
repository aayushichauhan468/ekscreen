import { Crown } from "lucide-react";
import type { ReactNode } from "react";
import { BACKGROUNDS, CLOTHES, HAIR, SKIN, normalizeAvatar, resolveAvatar, type AvatarConfig } from "../lib/avatarConfig";
import type { Role } from "../types";

/**
 * Illustrated avatars, drawn as inline SVG (no images to download).
 * The face comes from a short code the person PICKED when they created/joined the room (see AvatarPicker);
 * the server stores that text and shows it to everyone, so the same face appears on EVERY screen.
 * If a person has no valid code, a face is generated from their userId instead, so nobody is ever blank.
 */

// ---- The parts the faces are built from live in lib/avatarConfig.ts (shared with the picker) ------------------

const INK = "#2b1a12"; // eyes, mouth, brows

// ---- Drawing -----------------------------------------------------------------------------------------------

/** Hair is drawn in two layers: `back` behind the head (long hair, bun) and `front` over the forehead. */
function hairLayers(style: number, color: string, cap: string): { back: ReactNode; front: ReactNode } {
  const crop = (
    <path
      fill={color}
      d="M19.2 27 C18.6 15.5 24.5 11.5 32 11.5 C39.5 11.5 45.4 15.5 44.8 27 C42.6 21.4 38.4 18.8 32 18.8 C25.6 18.8 21.4 21.4 19.2 27 Z"
    />
  );
  switch (style) {
    case 0: // short crop
      return { back: null, front: crop };
    case 1: // side-swept fringe
      return {
        back: null,
        front: (
          <path
            fill={color}
            d="M19 28 C17.8 15 25 10.8 33.5 11.4 C41.5 12 46.5 17.5 44.8 28 C43.8 23.4 41 20.6 37 19.8 C31 24 24.5 22.5 19 28 Z"
          />
        ),
      };
    case 2: // long hair, centre parting
      return {
        back: (
          <path
            fill={color}
            d="M17.8 29 C16.8 14 24.5 10 32 10 C39.5 10 47.2 14 46.2 29 L46.8 47 C46.8 49.4 43.4 50 42.4 47.6 L41.6 36 L22.4 36 L21.6 47.6 C20.6 50 17.2 49.4 17.2 47 Z"
          />
        ),
        front: (
          <path
            fill={color}
            d="M19.8 26.5 C20.2 17 25.5 14 32 14 C38.5 14 43.8 17 44.2 26.5 C41 21 37 19 32 17.6 C27 19 23 21 19.8 26.5 Z"
          />
        ),
      };
    case 3: // bun on top
      return { back: <circle cx="32" cy="9.6" r="5.2" fill={color} />, front: crop };
    case 4: // curly
      return {
        back: (
          <g fill={color}>
            <circle cx="21.5" cy="21" r="5" />
            <circle cx="26.5" cy="15.5" r="5.6" />
            <circle cx="32" cy="13" r="5.8" />
            <circle cx="37.5" cy="15.5" r="5.6" />
            <circle cx="42.5" cy="21" r="5" />
            <circle cx="19.5" cy="28" r="3.6" />
            <circle cx="44.5" cy="28" r="3.6" />
          </g>
        ),
        front: (
          <path
            fill={color}
            d="M21 25 C22 17.5 27 15.6 32 15.6 C37 15.6 42 17.5 43 25 C40 21 36 20 32 20 C28 20 24 21 21 25 Z"
          />
        ),
      };
    case 5: // baseball cap (hair hidden underneath)
      return {
        back: null,
        front: (
          <g>
            <path fill={cap} d="M19.4 23.5 C19.4 14 25 10.8 32 10.8 C39 10.8 44.6 14 44.6 23.5 Z" />
            <path
              fill={cap}
              d="M17.6 23.5 H46.4 C46.4 26 44.4 27 41.6 27 H22.4 C19.6 27 17.6 26 17.6 23.5 Z"
            />
            {/* a darker strip under the brim gives it depth */}
            <path fill="#000" fillOpacity=".22" d="M17.6 23.5 H46.4 C46.4 26 44.4 27 41.6 27 H22.4 C19.6 27 17.6 26 17.6 23.5 Z" />
          </g>
        ),
      };
    case 6: // bald
      return { back: null, front: null };
    case 7: // bob: chin-length hair framing the face, straight fringe
      return {
        back: (
          <path
            fill={color}
            d="M17.6 29 C16.6 13.5 24.8 9.8 32 9.8 C39.2 9.8 47.4 13.5 46.4 29 L46.8 40.5 C46.8 42.4 44.6 43 43.4 41.6 L42 35 L22 35 L20.6 41.6 C19.4 43 17.2 42.4 17.2 40.5 Z"
          />
        ),
        front: (
          <path
            fill={color}
            d="M19.4 27.5 C19.6 16.5 25.4 13.2 32 13.2 C38.6 13.2 44.4 16.5 44.6 27.5 C44.2 22.4 40 20.4 32 20.4 C24 20.4 19.8 22.4 19.4 27.5 Z"
          />
        ),
      };
    default: // 8: ponytail, tied at the side with a gold band
      return {
        back: (
          <g>
            <path
              fill={color}
              d="M43.6 21 C52.4 19 56.4 30 51.4 40.4 C49.8 43.4 46 42 47 38.6 C49 32.4 48 27.4 43.2 26.2 Z"
            />
            <circle cx="44.6" cy="23.4" r="2" fill="#FBBF24" />
          </g>
        ),
        front: (
          <path
            fill={color}
            d="M19.2 27 C18.6 15.5 24.5 11.5 32 11.5 C39.5 11.5 45.4 15.5 44.8 27 C42.6 21.4 38.4 18.8 32 18.8 C25.6 18.8 21.4 21.4 19.2 27 Z"
          />
        ),
      };
  }
}

function eyes(style: number): ReactNode {
  switch (style) {
    case 0: // simple dots
      return (
        <g fill={INK}>
          <circle cx="27" cy="29" r="1.7" />
          <circle cx="37" cy="29" r="1.7" />
        </g>
      );
    case 1: // happy, closed arcs
      return (
        <g fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round">
          <path d="M24.8 29.8 Q27 26.8 29.2 29.8" />
          <path d="M34.8 29.8 Q37 26.8 39.2 29.8" />
        </g>
      );
    case 2: // big eyes with a sparkle
      return (
        <g>
          <ellipse cx="27" cy="29" rx="2" ry="2.5" fill={INK} />
          <ellipse cx="37" cy="29" rx="2" ry="2.5" fill={INK} />
          <circle cx="27.7" cy="28.1" r=".75" fill="#fff" />
          <circle cx="37.7" cy="28.1" r=".75" fill="#fff" />
        </g>
      );
    default: // 3: wink
      return (
        <g>
          <circle cx="27" cy="29" r="1.7" fill={INK} />
          <path d="M34.8 29.8 Q37 26.8 39.2 29.8" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
  }
}

function mouth(style: number): ReactNode {
  switch (style) {
    case 0: // soft smile
      return <path d="M27.5 35 Q32 39.6 36.5 35" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />;
    case 1: // big grin
      return (
        <g>
          <path d="M27 34.4 Q32 42 37 34.4 Z" fill="#5b2420" />
          <path d="M28.4 35 Q32 36.6 35.6 35 L35 36.4 Q32 37.6 29 36.4 Z" fill="#fff" />
        </g>
      );
    case 2: // surprised "o"
      return <ellipse cx="32" cy="37" rx="2" ry="2.5" fill="#5b2420" />;
    default: // 3: smirk
      return <path d="M28 36.4 Q32.5 38.6 37 35" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />;
  }
}

/** Things worn on top of the face. Index 0 and 1 are "nothing". */
function accessory(index: number, clothes: string, hairColor: string): ReactNode {
  switch (index) {
    case 1: // beard: a ring around the jaw with a gap left open so the mouth still shows
      return (
        <path
          fill={hairColor}
          fillRule="evenodd"
          d="M19.6 29 C19.8 43 26 49.5 32 49.5 C38 49.5 44.2 43 44.4 29 C42 34 38 35 32 35 C26 35 22 34 19.6 29 Z M32 33.8 C28.6 33.8 26.4 35.4 26.4 37.6 C26.4 39.8 28.6 41.4 32 41.4 C35.4 41.4 37.6 39.8 37.6 37.6 C37.6 35.4 35.4 33.8 32 33.8 Z"
        />
      );
    case 7: // moustache
      return <path fill={hairColor} d="M26.6 34.4 Q29.4 32.2 32 33.8 Q34.6 32.2 37.4 34.4 Q34.8 36.2 32 35.2 Q29.2 36.2 26.6 34.4 Z" />;
    case 2: // round glasses
      return (
        <g fill="#fff" fillOpacity=".14" stroke="#e8c872" strokeWidth="1.3">
          <circle cx="27" cy="29" r="4.2" />
          <circle cx="37" cy="29" r="4.2" />
          <path d="M31.2 29 H32.8" fill="none" />
        </g>
      );
    case 3: // sunglasses
      return (
        <g>
          <rect x="22" y="26.2" width="9.6" height="6.2" rx="2.6" fill="#14110e" />
          <rect x="32.4" y="26.2" width="9.6" height="6.2" rx="2.6" fill="#14110e" />
          <path d="M31.4 27.6 H32.6" stroke="#14110e" strokeWidth="1.4" />
          <path d="M24 28 L26.4 27.4 M34.4 28 L36.8 27.4" stroke="#fff" strokeOpacity=".45" strokeWidth=".8" strokeLinecap="round" />
        </g>
      );
    case 4: // headphones
      return (
        <g>
          <path d="M19.2 28 C19 11 45 11 44.8 28" fill="none" stroke="#1a2421" strokeWidth="2.6" strokeLinecap="round" />
          <rect x="16.2" y="25" width="5.4" height="10" rx="2.7" fill="#FBBF24" />
          <rect x="42.4" y="25" width="5.4" height="10" rx="2.7" fill="#FBBF24" />
        </g>
      );
    case 5: // bow tie (sits on the shirt, below the chin)
      return (
        <g fill={clothes === "#FBBF24" ? "#1A2421" : "#FBBF24"}>
          <path d="M32 47.4 L25 43.8 V51 Z M32 47.4 L39 43.8 V51 Z" />
          <circle cx="32" cy="47.4" r="1.9" />
        </g>
      );
    case 6: // party hat
      return (
        <g transform="rotate(-9 32 17)">
          <path d="M32 5.4 L24.2 17.6 H39.8 Z" fill="#FBBF24" />
          <path d="M28.2 11.6 H35.8 L37.2 14 H26.8 Z" fill="#F3F4F6" fillOpacity=".85" />
          <ellipse cx="32" cy="17.6" rx="7.8" ry="1.5" fill="#22C55E" />
          <circle cx="32" cy="5.2" r="2" fill="#F3F4F6" />
        </g>
      );
    default:
      return null;
  }
}

/** The whole face, built from an AvatarConfig (8 small numbers: see lib/avatarConfig.ts). */
export function Face({ config }: { config: AvatarConfig }) {
  const c = normalizeAvatar(config);
  const skin = SKIN[c.skin];
  const hairColor = HAIR[c.hairColor];
  const clothes = CLOTHES[c.clothes];
  // Small details (blush, freckles) come from the numbers too, so the same code always draws the same face.
  const showBlush = (c.skin + c.mouth + c.eyes) % 3 === 0;
  const showFreckles = (c.skin + c.hairColor) % 4 === 0 && c.skin < 3;

  const hair = hairLayers(c.hairStyle, hairColor, clothes === "#F3F4F6" ? "#FBBF24" : clothes);

  return (
    // viewBox is cropped to head + shoulders so faces stay big even at 28px.
    <svg viewBox="8 4 48 48" width="100%" height="100%" aria-hidden focusable="false">
      {/* shoulders / shirt */}
      <path d="M6 60 C6 49 18 44 32 44 C46 44 58 49 58 60 Z" fill={clothes} />
      {hair.back}
      {/* neck, with a slightly darker shade so the head looks like it sits in front of it */}
      <rect x="27" y="36" width="10" height="12" rx="4" fill={skin} />
      <rect x="27" y="36" width="10" height="12" rx="4" fill="#000" fillOpacity=".12" />
      {/* ears + head */}
      <circle cx="19.6" cy="29.5" r="2.7" fill={skin} />
      <circle cx="44.4" cy="29.5" r="2.7" fill={skin} />
      <ellipse cx="32" cy="28" rx="12.5" ry="14" fill={skin} />
      {/* face details */}
      {showBlush && (
        <g fill="#F87171" fillOpacity=".35">
          <circle cx="23.6" cy="34" r="2.5" />
          <circle cx="40.4" cy="34" r="2.5" />
        </g>
      )}
      {showFreckles && (
        <g fill="#000" fillOpacity=".28">
          <circle cx="25" cy="33" r=".6" />
          <circle cx="27.4" cy="34" r=".6" />
          <circle cx="36.6" cy="34" r=".6" />
          <circle cx="39" cy="33" r=".6" />
        </g>
      )}
      <g fill="none" stroke={hairColor} strokeWidth="1.5" strokeLinecap="round">
        <path d="M24.4 24.6 Q27 23.2 29.6 24.6" />
        <path d="M34.4 24.6 Q37 23.2 39.6 24.6" />
      </g>
      {eyes(c.eyes)}
      {mouth(c.mouth)}
      {hair.front}
      {accessory(c.accessory, clothes, hairColor)}
    </svg>
  );
}

// ---- The component -----------------------------------------------------------------------------------------

type Props = {
  name: string;
  /** The code the person picked ("2-2-1-3-1-0-7-2"). If missing or invalid, a face is generated from `seed`. */
  avatar?: string | null;
  /** What the face is generated from. Pass the userId so two people called "Riya" still look different. */
  seed?: string;
  size?: number;
  role?: Role;
  online?: boolean;
  showStatus?: boolean;
};

export default function Avatar({ name, avatar, seed, size = 44, role, online = true, showStatus = false }: Props) {
  const key = seed ?? name;
  const config = resolveAvatar(avatar, key);
  const [from, to] = BACKGROUNDS[config.background];
  const ring =
    role === "host"
      ? "ring-2 ring-gold shadow-[0_0_14px_rgb(251_191_36/0.45)]"
      : role === "moderator"
        ? "ring-2 ring-brand"
        : "ring-1 ring-cream/20";

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {role === "host" && (
        <Crown
          className="animate-crown absolute -top-2.5 left-1/2 z-10 h-4 w-4 -translate-x-1/2 text-gold drop-shadow"
          fill="currentColor"
          aria-label="Host"
        />
      )}
      <span
        className={`block h-full w-full overflow-hidden rounded-full ${ring} ${online ? "" : "opacity-45 grayscale"}`}
        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        title={name}
      >
        <Face config={config} />
      </span>
      {showStatus && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-lounge ${online ? "bg-brand" : "bg-cream/40"}`}
          title={online ? "Online" : "Reconnecting"}
        />
      )}
    </span>
  );
}
