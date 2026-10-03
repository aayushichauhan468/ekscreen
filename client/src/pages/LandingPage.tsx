import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowLeft, MessageCircle, MonitorPlay, Pencil, Smile, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import Avatar from "../components/Avatar";
import AvatarDialog from "../components/AvatarDialog";
import HeroScreen from "../components/HeroScreen";
import Logo from "../components/Logo";
import { Button, Field } from "../components/ui";
import { createRoom, joinRoom } from "../lib/api";
import { PRESETS, encodeAvatar, loadAvatarCode, parseAvatar, saveAvatarCode, type AvatarConfig } from "../lib/avatarConfig";
import { extractRoomCode, roomFromUrl, setRoomInUrl } from "../lib/invite";
import { loadName, saveName, saveSession } from "../lib/session";
import { useRoomStore } from "../store/roomStore";

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const FEATURES = [
  { icon: MonitorPlay, label: "Synced playback" },
  { icon: MessageCircle, label: "Live chat" },
  { icon: Smile, label: "Emoji reactions" },
  { icon: UserPlus, label: "Invite friends" },
];

type Mode = "create" | "join";

function ActionPanel() {
  const invited = roomFromUrl(); // opened from an invite link like /?room=ABC123
  const [mode, setMode] = useState<Mode | null>(invited ? "join" : null);
  const [name, setName] = useState(loadName());
  const [code, setCode] = useState(invited ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // The face this person will have in the room: their last pick in this browser, else a random ready-made look.
  const [avatar, setAvatar] = useState<AvatarConfig>(
    () => parseAvatar(loadAvatarCode()) ?? PRESETS[Math.floor(Math.random() * PRESETS.length)]
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const username = name.trim();
    if (!username) return setError("Please enter your name.");
    if (mode === "join" && code.length !== 6) return setError("Room codes have 6 letters or numbers.");

    setLoading(true);
    const avatarCode = encodeAvatar(avatar);
    const res = mode === "create" ? await createRoom(username, avatarCode) : await joinRoom(code, username, avatarCode);
    setLoading(false);

    if (!res.ok) return setError(res.message);
    saveName(username);
    saveAvatarCode(avatarCode); // remembered for next time (this browser only)
    saveSession({ roomId: res.roomId, token: res.token, username });
    setRoomInUrl(res.roomId);
    useRoomStore.getState().applyJoined(res);
  }

  return (
    <>
    <AnimatePresence mode="wait" initial={false}>
      {mode === null ? (
        <motion.div
          key="choose"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="flex flex-wrap gap-3"
        >
          <Button onClick={() => setMode("create")}>Create room</Button>
          <Button variant="ghost" onClick={() => setMode("join")}>
            Join room
          </Button>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          onSubmit={submit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="glass w-full max-w-md space-y-4 p-5 sm:p-6"
          noValidate
        >
          <div>
            <h2 className="font-display text-2xl font-semibold">{mode === "create" ? "Start a room" : "Join a room"}</h2>
            <p className="mt-1 text-sm text-cream/60">
              {mode === "create"
                ? "You'll be the Host. Share the code and your friends can hop in."
                : "Ask the Host for the 6-character code, or open their invite link."}
            </p>
          </div>

          <Field
            label="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="e.g. Aayushi"
            autoComplete="nickname"
            autoFocus={mode === "create" || !!invited}
          />
          {mode === "join" && (
            <Field
              label="Room code"
              value={code}
              onChange={(e) => setCode(extractRoomCode(e.target.value))}
              placeholder="ABC123 or paste the invite link"
              autoComplete="off"
              spellCheck={false}
              className="text-center font-semibold uppercase tracking-[0.4em]"
              autoFocus={!invited}
            />
          )}

          {/* Avatar: one compact row. "Change" opens the full picker as a pop-up, so the form never grows. */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-haspopup="dialog"
            className="group flex w-full items-center gap-3 rounded-2xl border border-cream/10 bg-ink/40 p-2.5 pr-3 text-left transition hover:border-gold/40 hover:bg-ink/60"
          >
            <Avatar name="You" avatar={encodeAvatar(avatar)} size={48} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Your avatar</span>
              <span className="block truncate text-xs text-cream/55">Pick a look that feels like you</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cream/20 px-3 py-1.5 text-xs font-medium text-cream/85 transition group-hover:border-gold/60 group-hover:text-gold">
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Change
            </span>
          </button>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <Button type="button" variant="quiet" onClick={() => { setMode(null); setError(null); }}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
            <Button type="submit" loading={loading}>
              {mode === "create" ? (loading ? "Creating…" : "Create room") : loading ? "Joining…" : "Join room"}
            </Button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>

    {/* Rendered outside the form (a pop-up floating above the page). */}
    <AnimatePresence>
      {pickerOpen && <AvatarDialog value={avatar} onChange={setAvatar} onClose={() => setPickerOpen(false)} />}
    </AnimatePresence>
    </>
  );
}

export default function LandingPage() {
  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-5 pb-10 pt-6 sm:px-8">
      <header>
        <Logo size={40} />
      </header>

      <main className="grid flex-1 items-start gap-14 pb-10 pt-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-14">
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
          <motion.h1 variants={item} className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Your next movie night awaits.
          </motion.h1>
          <motion.p variants={item} className="max-w-lg text-lg text-cream/70">
            Watch YouTube together with your friends, perfectly in sync. Chat, react and make it special.
          </motion.p>
          <motion.div variants={item}>
            <ActionPanel />
          </motion.div>
          <motion.ul variants={item} className="flex flex-wrap gap-x-6 gap-y-3 pt-2 text-sm text-cream/60">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-gold/80" aria-hidden />
                {label}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        {/* Pinned near the top: it never slides down when the form on the left gets taller (join mode, errors). */}
        <motion.div
          className="lg:sticky lg:top-24 lg:mt-10"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <HeroScreen />
        </motion.div>
      </main>
    </div>
  );
}
