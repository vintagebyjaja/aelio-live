import { useEffect, useRef, useState } from "react";

// SYNAPSE: watch the neurons fire, then repeat the pattern. Keys 1-6 work too.
const N = 6;
const POS = Array.from({ length: N }, (_, i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
  return [200 + Math.cos(a) * 130, 200 + Math.sin(a) * 130];
});
const COLORS = ["#ffb83e", "#5ad1e6", "#ff8a5b", "#4fc58a", "#ffd88a", "#a78bfa"];

export function BrainGame() {
  const [seq, setSeq] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [lit, setLit] = useState<number | null>(null);
  const [mode, setMode] = useState<"idle" | "show" | "input" | "over">("idle");
  const [best, setBest] = useState<number>(() => { try { return +(localStorage.getItem("aelio_synapse_best") || 0); } catch { return 0; } });
  const timers = useRef<any[]>([]);
  const level = Math.max(0, seq.length - (mode === "over" ? 1 : 0));
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);

  function play(s: number[]) {
    clear(); setMode("show"); setStep(0);
    const gap = Math.max(260, 620 - s.length * 25);
    s.forEach((n, i) => {
      timers.current.push(setTimeout(() => setLit(n), 500 + i * gap));
      timers.current.push(setTimeout(() => setLit(null), 500 + i * gap + gap * 0.6));
    });
    timers.current.push(setTimeout(() => setMode("input"), 500 + s.length * gap));
  }
  function start() { const s = [Math.floor(Math.random() * N)]; setSeq(s); play(s); }
  function press(n: number) {
    if (mode !== "input") return;
    setLit(n); timers.current.push(setTimeout(() => setLit(null), 180));
    if (seq[step] !== n) {
      setMode("over");
      const score = seq.length - 1;
      if (score > best) { setBest(score); try { localStorage.setItem("aelio_synapse_best", String(score)); } catch { /* ignore */ } }
      return;
    }
    if (step + 1 === seq.length) {
      const s = [...seq, Math.floor(Math.random() * N)];
      setSeq(s); timers.current.push(setTimeout(() => play(s), 600));
    } else setStep(step + 1);
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => { const d = parseInt(e.key, 10); if (d >= 1 && d <= N) press(d - 1); if (e.key === "Enter" && (mode === "idle" || mode === "over")) start(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  const msg = mode === "idle" ? "Watch the neurons fire, then repeat the pattern."
    : mode === "show" ? "Watch…" : mode === "input" ? `Your turn: ${step + 1} of ${seq.length}`
    : `Synapse lost at level ${seq.length}. You remembered ${seq.length - 1}.`;
  return (
    <div className="game">
      <div className="game-head">
        <div><div className="eyebrow">AELIO Brain Game</div><h1>SYN<span className="gold">APSE</span></h1></div>
        <div className="game-score"><div><small>LEVEL</small><b>{level}</b></div><div><small>BEST</small><b>{best}</b></div></div>
      </div>
      <svg viewBox="0 0 400 400" className="game-board" role="group" aria-label="Synapse game board">
        <defs><radialGradient id="core"><stop offset="0" stopColor="#fff3d6" /><stop offset=".4" stopColor="#ffb83e" stopOpacity=".7" /><stop offset="1" stopColor="#ff8a1f" stopOpacity="0" /></radialGradient></defs>
        {POS.map(([x, y], i) => POS.slice(i + 1).map(([x2, y2], j) => <line key={i + "-" + j} x1={x} y1={y} x2={x2} y2={y2} stroke="#ffcf7a" strokeOpacity={lit === i || lit === i + j + 1 ? .7 : .1} />))}
        <circle cx="200" cy="200" r="70" fill="url(#core)" opacity={mode === "show" ? .9 : .45} className={reduced ? "" : "core-pulse"} />
        <text x="200" y="207" textAnchor="middle" fill="#1a1108" fontSize="20" fontWeight="800">{mode === "over" ? "✕" : level || "∞"}</text>
        {POS.map(([x, y], i) => (
          <g key={i} role="button" tabIndex={0} aria-label={`Neuron ${i + 1}`} onClick={() => press(i)} onKeyDown={(e: any) => (e.key === " " || e.key === "Enter") && press(i)} style={{ cursor: mode === "input" ? "pointer" : "default" }}>
            <circle cx={x} cy={y} r="38" fill={lit === i ? COLORS[i] : "#0d121c"} stroke={COLORS[i]} strokeWidth="2.5" style={{ filter: lit === i ? `drop-shadow(0 0 18px ${COLORS[i]})` : "none", transition: "fill .12s" }} />
            <text x={x} y={y + 6} textAnchor="middle" fontSize="16" fontWeight="700" fill={lit === i ? "#111" : "#9aa1ad"}>{i + 1}</text>
          </g>
        ))}
      </svg>
      <p className="game-msg" aria-live="polite">{msg}</p>
      {(mode === "idle" || mode === "over") && <button className="gold-btn" onClick={start}>{mode === "over" ? "Play again" : "Start"} →</button>}
      <p className="dim small">Tip: use keys 1–6. Your best score stays in this browser only.</p>
    </div>
  );
}
