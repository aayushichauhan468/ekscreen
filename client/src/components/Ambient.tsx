/** Slow-moving warm light behind every screen: emerald top-left, lantern gold bottom-right, a few bokeh dots. */
const BOKEH = [
  { left: "12%", top: "62%", size: 10, delay: "0s" },
  { left: "28%", top: "18%", size: 7, delay: "-4s" },
  { left: "46%", top: "78%", size: 12, delay: "-9s" },
  { left: "63%", top: "12%", size: 8, delay: "-2s" },
  { left: "78%", top: "55%", size: 14, delay: "-11s" },
  { left: "90%", top: "24%", size: 9, delay: "-6s" },
  { left: "6%", top: "34%", size: 6, delay: "-13s" },
];

export default function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="animate-drift absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-brand/15 blur-3xl" />
      <div
        className="animate-drift absolute -bottom-56 -right-40 h-[40rem] w-[40rem] rounded-full bg-gold/10 blur-3xl"
        style={{ animationDirection: "alternate-reverse" }}
      />
      {BOKEH.map((b, i) => (
        <span
          key={i}
          className="animate-bokeh absolute rounded-full bg-gold/40 blur-[3px]"
          style={{ left: b.left, top: b.top, width: b.size, height: b.size, animationDelay: b.delay }}
        />
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(11_15_12/0.75)_100%)]" />
    </div>
  );
}
