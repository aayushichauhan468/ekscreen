import Logo from "./components/Logo";
import { useConnectionStatus } from "./hooks/useConnectionStatus";

/** Step 0 shell: proves the theme, logo and WebSocket link work. Real UI starts in step 2. */
export default function App() {
  const connected = useConnectionStatus();

  return (
    <div className="grain relative flex min-h-full flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* slow ambient emerald glow */}
      <div className="animate-drift pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <Logo size={64} animated showTagline />

        <div className="glass inline-flex items-center gap-3 px-5 py-3 text-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-brand shadow-[0_0_10px_var(--color-brand)]" : "bg-gold"}`}
          />
          {connected ? "Server connected" : "Connecting to server..."}
        </div>
      </div>
    </div>
  );
}
