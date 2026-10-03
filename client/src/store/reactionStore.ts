import { create } from "zustand";
import { makeSparks, type Spark } from "../lib/reactionFx";

/** One emoji floating up over the video. Everything random is decided ONCE here, never during render. */
export interface FloatingReaction {
  id: number;
  emoji: string;
  username: string;
  left: number; // % from the left edge of the player
  sway: number[]; // 5 sideways offsets (px): the wavy path it follows while rising
  sparks: Spark[]; // the burst of confetti / embers / sparkles around it
}

/** "🔥 ×5": shown when several people send the same emoji within a couple of seconds. */
export interface Combo {
  emoji: string;
  count: number;
}

/** Tells the overlay to flash a soft coloured light across the video. */
export interface Pulse {
  id: number;
  emoji: string;
  strong: boolean; // true during a big combo -> brighter light
}

/** Never show more than this many at once, so a burst can't clutter the video or slow the page. */
const MAX_VISIBLE = 24;
const COMBO_WINDOW_MS = 2500; // the same emoji within this window counts toward a combo
const COMBO_MIN = 3; // show the combo chip from the 3rd matching reaction
const STRONG_AT = 5; // from the 5th, the light over the video gets brighter

interface ReactionState {
  items: FloatingReaction[];
  combo: Combo | null;
  pulse: Pulse | null;
  add: (emoji: string, username: string) => void;
  remove: (id: number) => void;
}

let nextId = 1; // local counter: only used as a React key
const recent: { emoji: string; at: number }[] = []; // timestamps of the latest reactions (for combos)
let comboTimer: ReturnType<typeof setTimeout> | undefined;

/** A gentle S-shaped path: out to one side, back across, out again, then settle. */
function makeSway(): number[] {
  const amount = 14 + Math.random() * 20;
  const dir = Math.random() < 0.5 ? -1 : 1;
  return [0, amount * dir, -amount * 0.7 * dir, amount * 0.9 * dir, amount * 0.2 * dir];
}

/**
 * Kept separate from the room store: reactions come and go every second, and this way only the
 * overlay re-renders for them (the chat, the participant list, etc. are not touched).
 */
export const useReactionStore = create<ReactionState>()((set) => ({
  items: [],
  combo: null,
  pulse: null,

  add: (emoji, username) => {
    const now = Date.now();

    // Forget reactions older than the combo window, then count how many of THIS emoji are still "hot".
    while (recent.length && now - recent[0].at > COMBO_WINDOW_MS) recent.shift();
    recent.push({ emoji, at: now });
    const count = recent.filter((r) => r.emoji === emoji).length;

    const id = nextId++;
    set((s) => ({
      items: [
        ...s.items,
        { id, emoji, username, left: 10 + Math.random() * 80, sway: makeSway(), sparks: makeSparks(emoji) },
      ].slice(-MAX_VISIBLE),
      pulse: { id, emoji, strong: count >= STRONG_AT },
      combo: count >= COMBO_MIN ? { emoji, count } : s.combo,
    }));

    // The chip disappears by itself shortly after the last matching reaction.
    if (count >= COMBO_MIN) {
      clearTimeout(comboTimer);
      comboTimer = setTimeout(() => set({ combo: null }), 2200);
    }
  },

  remove: (id) => set((s) => ({ items: s.items.filter((r) => r.id !== id) })),
}));
