import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, MessageCircle, Send, Smile } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useConnectionStatus } from "../hooks/useConnectionStatus";
import { sendChat } from "../lib/api";
import { useRoomStore } from "../store/roomStore";
import type { ChatMessage, Role } from "../types";
import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";

const MAX_LENGTH = 500; // same limit the server enforces
const GROUP_GAP_MS = 2 * 60 * 1000; // messages from one person within 2 minutes share one name header
const NEAR_BOTTOM_PX = 80; // closer than this to the bottom = "the reader is following the chat"

/** Emojis offered in the little tray next to the text box (they are just text, so the server needs no change). */
const QUICK_EMOJIS = ["😂", "❤️", "🔥", "👏", "🎉", "😮", "🍿", "🎬", "💯", "🙌"];

const timeLabel = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/**
 * If the message is ONLY 1-3 emojis, returns how many; otherwise 0. Those messages are shown big and
 * bouncy instead of inside a bubble. (\p{Extended_Pictographic} is the Unicode class for emoji symbols.)
 */
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f|\s)+$/u;
function emojiOnlyCount(text: string): number {
  const t = text.trim();
  if (!t || !EMOJI_ONLY.test(t)) return 0;
  // Intl.Segmenter counts "visible characters", so a family emoji or a flag counts as one.
  const count = Array.from(new Intl.Segmenter().segment(t)).filter((s) => s.segment.trim()).length;
  return count <= 3 ? count : 0;
}

/**
 * Live chat for everyone in the room.
 * Flow: send -> server validates + stores -> server broadcasts `chat_message` to the room (us included)
 * -> the store adds it -> this list renders it. We don't add our own message locally, so every screen
 * shows the same messages in the same order.
 * Text is rendered as plain text by React (never as HTML), so a message like "<script>" can't run.
 */
export default function ChatPanel() {
  const chat = useRoomStore((s) => s.chat);
  const me = useRoomStore((s) => s.me);
  const participants = useRoomStore((s) => s.participants);
  const connected = useConnectionStatus();
  const reduceMotion = useReducedMotion();

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unseen, setUnseen] = useState(0); // new messages that arrived while scrolled up
  const [trayOpen, setTrayOpen] = useState(false); // the quick-emoji tray
  const [flights, setFlights] = useState(0); // counts successful sends; each one plays the "paper plane" animation

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const followRef = useRef(true); // true while the reader is at (or near) the bottom
  const lastCountRef = useRef(chat.length);
  // Messages already on screen at first render (history) appear instantly; only later ones spring in.
  const seenRef = useRef(new Set(useRoomStore.getState().chat.map((m) => m.id)));

  function scrollToBottom() {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    followRef.current = true;
    setUnseen(0);
  }

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (followRef.current) setUnseen(0);
  }

  // When messages are added: follow them if the reader is at the bottom (or wrote the message themselves);
  // otherwise leave the scroll position alone and show a "new messages" button.
  useLayoutEffect(() => {
    const added = chat.length - lastCountRef.current;
    lastCountRef.current = chat.length;
    const last = chat[chat.length - 1];
    if (!last) return;
    if (followRef.current || last.userId === me?.userId) scrollToBottom();
    else if (added > 0) setUnseen((n) => n + added);
  }, [chat, me?.userId]);

  // Remember which messages have been shown, so a re-render never replays an entrance animation.
  useEffect(() => {
    chat.forEach((m) => seenRef.current.add(m.id));
  }, [chat]);

  // An error message disappears by itself after a few seconds.
  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(id);
  }, [error]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    setTrayOpen(false);
    const res = await sendChat(message);
    setSending(false);
    if (res.ok) {
      setText("");
      setFlights((n) => n + 1);
    } else setError(res.message); // keep what they typed so nothing is lost
  }

  /** Adds an emoji from the tray to the text box (unless that would pass the length limit). */
  function addEmoji(emoji: string) {
    if (text.length + emoji.length <= MAX_LENGTH) setText((t) => t + emoji);
    setTrayOpen(false);
    inputRef.current?.focus();
  }

  const roleOf = (userId: string) => participants.find((p) => p.userId === userId)?.role;
  const avatarOf = (userId: string) => participants.find((p) => p.userId === userId)?.avatar ?? null;

  return (
    <section className="glass relative flex h-[26rem] flex-col overflow-hidden lg:h-[30rem]" aria-label="Live chat">
      <ChatAmbience />
      <span className="shimmer-line pointer-events-none absolute inset-x-8 top-0 h-px" aria-hidden />

      <h2 className="relative flex items-center gap-2 px-4 pb-2 pt-4 text-sm font-semibold">
        <MessageCircle className="h-4 w-4 text-gold" aria-hidden /> Live chat
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-brand">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" aria-hidden />
          {chat.length} {chat.length === 1 ? "message" : "messages"}
        </span>
      </h2>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          className="h-full space-y-1.5 overflow-y-auto px-3 py-2"
        >
          {chat.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
              <motion.span
                className="text-5xl"
                animate={reduceMotion ? undefined : { y: [0, -8, 0], rotate: [-6, 6, -6] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              >
                🍿
              </motion.span>
              <span className="font-script text-2xl text-gold/90">Say hello</span>
              <p className="text-sm text-cream/50">Be the first to say something to the room.</p>
            </div>
          )}

          {chat.map((m, i) => (
            <Bubble
              key={m.id}
              message={m}
              mine={m.userId === me?.userId}
              showHeader={isGroupStart(chat, i)}
              role={roleOf(m.userId)}
              avatar={avatarOf(m.userId)}
              animate={!seenRef.current.has(m.id) && !reduceMotion}
            />
          ))}
        </div>

        <AnimatePresence>
          {unseen > 0 && (
            <motion.button
              type="button"
              onClick={scrollToBottom}
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 450, damping: 22 }}
              className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-gold/40 bg-ink/90 px-3 py-1.5 text-xs font-medium text-gold shadow-lg"
            >
              <motion.span
                animate={reduceMotion ? undefined : { y: [0, 3, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="flex"
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
              </motion.span>
              {unseen} new {unseen === 1 ? "message" : "messages"}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <form onSubmit={submit} className="relative border-t border-cream/10 p-3" noValidate>
        {/* Quick-emoji tray: pops up from the smiley button, each emoji springs in one after another. */}
        <AnimatePresence>
          {trayOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 480, damping: 28 }}
              style={{ originX: 1, originY: 1 }}
              className="absolute bottom-full right-3 z-20 mb-1 grid grid-cols-5 gap-1 rounded-2xl border border-cream/15 bg-lounge/95 p-2 shadow-xl backdrop-blur-md"
              role="group"
              aria-label="Quick emojis"
            >
              {QUICK_EMOJIS.map((emoji, i) => (
                <motion.button
                  key={emoji}
                  type="button"
                  onClick={() => addEmoji(emoji)}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.025, type: "spring", stiffness: 520, damping: 16 }}
                  whileHover={{ scale: 1.3, rotate: -8 }}
                  whileTap={{ scale: 0.85 }}
                  aria-label={`Add ${emoji}`}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-xl hover:bg-white/8"
                >
                  {emoji}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p role="alert" className="mb-2 text-xs text-danger">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2">
          {/* The text box and the smiley button share one rounded "pill" that glows gold while you type. */}
          <div className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-cream/15 bg-ink/50 pl-4 pr-1 transition focus-within:border-gold/50 focus-within:shadow-[0_0_0_3px_rgb(251_191_36/0.12)]">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setTrayOpen(false)}
              maxLength={MAX_LENGTH}
              placeholder={connected ? "Write a message…" : "Reconnecting…"}
              disabled={!connected}
              autoComplete="off"
              enterKeyHint="send"
              aria-label="Chat message"
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-cream placeholder:text-cream/35 focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setTrayOpen((o) => !o)}
              disabled={!connected}
              aria-label="Open emoji tray"
              aria-expanded={trayOpen}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-white/8 hover:text-gold disabled:opacity-40 ${trayOpen ? "text-gold" : "text-cream/55"}`}
            >
              <Smile className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <motion.button
            type="submit"
            disabled={!connected || sending || !text.trim()}
            aria-label="Send message"
            whileHover={{ scale: 1.08, rotate: -6 }}
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold text-ink shadow-[0_6px_18px_-6px_rgb(251_191_36/0.7)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {/* After each successful send the paper plane flies off one corner and flies back in from the other. */}
            <motion.span
              key={flights} // new key = the element restarts its animation
              className="flex"
              animate={
                flights > 0 && !reduceMotion
                  ? { x: [0, 26, -26, 0], y: [0, -26, 26, 0], opacity: [1, 0, 0, 1] }
                  : undefined
              }
              transition={{ duration: 0.55, times: [0, 0.4, 0.41, 1], ease: "easeInOut" }}
            >
              <Send className="h-4 w-4" aria-hidden />
            </motion.span>
          </motion.button>
        </div>
        {text.length > MAX_LENGTH - 100 && (
          <div className="mt-1.5 text-right text-[11px] tabular-nums text-cream/45">
            {text.length}/{MAX_LENGTH}
          </div>
        )}
      </form>
    </section>
  );
}

/** A name header is shown when the sender changes, or when there was a pause of 2+ minutes. */
function isGroupStart(chat: ChatMessage[], i: number): boolean {
  const prev = chat[i - 1];
  const cur = chat[i];
  return !prev || prev.userId !== cur.userId || cur.sentAt - prev.sentAt > GROUP_GAP_MS;
}

/** A few specks of warm light drifting slowly behind the messages (pure CSS, GPU-friendly). */
const SPECKS = [
  { left: "14%", top: "70%", size: 5, delay: "0s" },
  { left: "80%", top: "30%", size: 6, delay: "-5s" },
  { left: "55%", top: "82%", size: 4, delay: "-9s" },
  { left: "30%", top: "20%", size: 4, delay: "-3s" },
  { left: "90%", top: "75%", size: 5, delay: "-12s" },
];

function ChatAmbience() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="animate-drift absolute -left-16 -top-16 h-56 w-56 rounded-full bg-brand/15 blur-3xl" />
      <div
        className="animate-drift absolute -bottom-20 -right-16 h-60 w-60 rounded-full bg-gold/10 blur-3xl"
        style={{ animationDirection: "alternate-reverse" }}
      />
      {SPECKS.map((s, i) => (
        <span
          key={i}
          className="animate-bokeh absolute rounded-full bg-gold/40 blur-[2px]"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }}
        />
      ))}
    </div>
  );
}

function Bubble({
  message,
  mine,
  showHeader,
  role,
  avatar,
  animate,
}: {
  message: ChatMessage;
  mine: boolean;
  showHeader: boolean;
  role: Role | undefined;
  avatar: string | null;
  animate: boolean;
}) {
  const bigEmojis = emojiOnlyCount(message.text); // 0 = normal text message
  const special = role === "host" || role === "moderator";

  // Bubble colours: yours = emerald glow, Host = gold, Moderator = emerald outline, others = frosted glass.
  const look = mine
    ? "rounded-br-md border border-brand/40 bg-linear-to-br from-brand/35 to-brand/15 shadow-[0_8px_22px_-10px_rgb(34_197_94/0.7)]"
    : role === "host"
      ? "rounded-bl-md border border-gold/40 bg-linear-to-br from-gold/20 to-gold/5 shadow-[0_8px_22px_-12px_rgb(251_191_36/0.6)]"
      : role === "moderator"
        ? "rounded-bl-md border border-brand/30 bg-white/6"
        : "rounded-bl-md border border-cream/10 bg-white/6";

  return (
    <motion.div
      // New messages fly in from their own side (yours from the right, others from the left) with a
      // bouncy spring and a tiny tilt. History appears instantly (initial={false}).
      initial={animate ? { opacity: 0, x: mine ? 36 : -36, y: 12, scale: 0.8, rotate: mine ? 3 : -3 } : false}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 20, mass: 0.8 }}
      className={`flex gap-2 ${mine ? "flex-row-reverse" : ""} ${showHeader ? "pt-2" : ""}`}
      style={{ originX: mine ? 1 : 0, originY: 1 }}
    >
      {/* Avatar column keeps bubbles aligned: only the first bubble of a group shows the avatar. */}
      <div className="w-7 shrink-0">
        {showHeader && !mine && <Avatar name={message.username} avatar={avatar} seed={message.userId} size={28} role={role} />}
      </div>
      <div className={`flex min-w-0 max-w-[85%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {showHeader && !mine && (
          <div className="mb-0.5 flex items-center gap-1.5 px-1">
            <span className="max-w-32 truncate text-xs font-semibold text-cream/80">{message.username}</span>
            {special && <RoleBadge role={role} />}
          </div>
        )}

        {bigEmojis > 0 ? (
          // 1-3 emojis only: no bubble, just big emojis that pop and bounce.
          <motion.div
            className={`px-1 leading-none ${bigEmojis === 1 ? "text-5xl" : "text-4xl"}`}
            initial={animate ? { scale: 0.3, rotate: -20 } : false}
            animate={animate ? { scale: [0.3, 1.45, 1], rotate: [-20, 10, 0], y: [0, -10, 0] } : { scale: 1 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            {message.text.trim()}
          </motion.div>
        ) : (
          <div className={`relative overflow-hidden whitespace-pre-wrap wrap-break-word rounded-2xl px-3.5 py-2 text-sm leading-snug text-cream ${look}`}>
            {message.text}
            {/* One light sweep across a brand-new message, like a glint on glass. */}
            {animate && (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-linear-to-r from-transparent via-white/25 to-transparent"
                initial={{ x: "0%" }}
                animate={{ x: "340%" }}
                transition={{ duration: 0.9, delay: 0.2, ease: "easeInOut" }}
              />
            )}
          </div>
        )}

        {showHeader && <span className="mt-0.5 px-1 text-[10px] text-cream/35">{timeLabel(message.sentAt)}</span>}
      </div>
    </motion.div>
  );
}
