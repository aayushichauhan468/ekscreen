import Logo from "../components/Logo";

/** Shown for a moment after a refresh while we win our seat back. */
export default function RestoringPage() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo size={72} animated />
      <p className="text-cream/70">Rejoining your room…</p>
    </div>
  );
}
