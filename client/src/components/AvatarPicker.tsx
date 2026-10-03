import { Check, Shuffle } from "lucide-react";
import {
  ACCESSORY_NAMES,
  BACKGROUNDS,
  CLOTHES,
  HAIR,
  HAIR_STYLE_NAMES,
  MOOD_NAMES,
  PRESETS,
  SKIN,
  encodeAvatar,
  normalizeAvatar,
  randomAvatar,
  type AvatarConfig,
} from "../lib/avatarConfig";
import Avatar from "./Avatar";

interface Props {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
}

/**
 * Lets a person design the face that represents them in the room: pick a ready-made look, or customise
 * each part. It only edits the 8 numbers; the face itself is drawn by <Avatar>, exactly as everyone else
 * will see it. The picker keeps the numbers valid with normalizeAvatar (e.g. no party hat on a cap).
 */
export default function AvatarPicker({ value, onChange }: Props) {
  const current = encodeAvatar(value);

  /** Changes one part (e.g. skin = 3) and keeps the whole avatar valid. */
  const set = (patch: Partial<AvatarConfig>) => onChange(normalizeAvatar({ ...value, ...patch }));

  return (
    // Wide screens: preview + quick picks on the left (they stay in view), the detailed options on the right.
    // Phones: one column.
    <div className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8">
      <div className="space-y-5 md:sticky md:top-0 md:self-start">
        {/* Live preview + shuffle */}
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-cream/10 bg-ink/40 px-4 py-5 text-center">
          <Avatar name="You" avatar={current} size={104} />
          <div>
            <div className="text-sm font-semibold">Your avatar</div>
            <p className="mt-0.5 text-xs text-cream/55">This is how everyone will see you.</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(randomAvatar())}
            className="inline-flex items-center gap-1.5 rounded-full border border-cream/20 px-3.5 py-1.5 text-xs font-medium text-cream transition hover:border-gold/60 hover:text-gold"
          >
            <Shuffle className="h-3.5 w-3.5" aria-hidden /> Surprise me
          </button>
        </div>

        {/* Ready-made looks */}
        <Section title="Quick picks">
          <div className="grid grid-cols-6 gap-1.5 md:grid-cols-4">
            {PRESETS.map((p, i) => {
              const code = encodeAvatar(p);
              const selected = code === current;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => onChange(p)}
                  aria-label={`Quick pick ${i + 1}`}
                  aria-pressed={selected}
                  className={`relative flex justify-center rounded-xl p-1 transition ${selected ? "bg-gold/15 ring-2 ring-gold" : "hover:bg-white/6"}`}
                >
                  <Avatar name={`Quick pick ${i + 1}`} avatar={code} size={42} />
                </button>
              );
            })}
          </div>
        </Section>
      </div>

      {/* Customise each part */}
      <div className="min-w-0 space-y-5">
        <Section title="Skin">
          <Swatches colors={SKIN} selected={value.skin} onPick={(skin) => set({ skin })} label="Skin tone" />
        </Section>
        <Section title="Hair style">
          <Chips names={HAIR_STYLE_NAMES} selected={value.hairStyle} onPick={(hairStyle) => set({ hairStyle })} />
        </Section>
        <Section title="Hair colour">
          <Swatches colors={HAIR} selected={value.hairColor} onPick={(hairColor) => set({ hairColor })} label="Hair colour" />
        </Section>
        <Section title="Mood">
          {/* eyes and mouth change together so they always match */}
          <Chips names={MOOD_NAMES} selected={value.eyes} onPick={(mood) => set({ eyes: mood, mouth: mood })} />
        </Section>
        <Section title="Extras">
          <Chips names={ACCESSORY_NAMES} selected={value.accessory} onPick={(accessory) => set({ accessory })} />
        </Section>
        <Section title="Outfit">
          <Swatches colors={CLOTHES} selected={value.clothes} onPick={(clothes) => set({ clothes })} label="Outfit colour" />
        </Section>
        <Section title="Background">
          <Swatches
            colors={BACKGROUNDS.map(([from, to]) => `linear-gradient(135deg, ${from}, ${to})`)}
            selected={value.background}
            onPick={(background) => set({ background })}
            label="Background"
          />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-cream/55">{title}</div>
      {children}
    </div>
  );
}

/** A row of round colour buttons. `colors` are CSS backgrounds (a hex colour or a gradient). */
function Swatches({
  colors,
  selected,
  onPick,
  label,
}: {
  colors: string[];
  selected: number;
  onPick: (index: number) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2.5" role="group" aria-label={label}>
      {colors.map((color, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(i)}
          aria-label={`${label} ${i + 1}`}
          aria-pressed={selected === i}
          style={{ background: color }}
          className={`flex h-9 w-9 items-center justify-center rounded-full border border-cream/20 transition hover:scale-110 ${selected === i ? "ring-2 ring-gold ring-offset-2 ring-offset-lounge" : ""}`}
        >
          {selected === i && <Check className="h-4 w-4 text-ink mix-blend-difference" aria-hidden />}
        </button>
      ))}
    </div>
  );
}

/** A row of text buttons (hair styles, moods, extras). */
function Chips({ names, selected, onPick }: { names: string[]; selected: number; onPick: (index: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {names.map((name, i) => (
        <button
          key={name}
          type="button"
          onClick={() => onPick(i)}
          aria-pressed={selected === i}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            selected === i
              ? "border-gold bg-gold/15 text-gold"
              : "border-cream/20 bg-white/3 text-cream/80 hover:border-cream/40 hover:text-cream"
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
