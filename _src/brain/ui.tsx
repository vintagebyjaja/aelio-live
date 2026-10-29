import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useLoad<T = any>(path: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>("");
  const reload = useCallback(() => {
    if (!path) return;
    api<T>(path).then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message));
  }, [path, ...deps]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload, setData };
}

export function Badge({ kind, children }: any) {
  return <span className={`badge ${kind ? "b-" + kind : ""}`}>{children}</span>;
}

export function Status({ s }: any) {
  const v = String(s || "");
  const k = /succeeded|passed|done|ok|approved|validated|published|active|production/.test(v) ? "ok"
    : /fail|reject|timed_out|blocked|critical|error/.test(v) ? "bad"
    : /running|queued|await|waiting|warning|pending|candidate|evaluated|dry-run|prototype/.test(v) ? "warn" : "";
  return <Badge kind={k}>{v || "—"}</Badge>;
}

/** Who actually did the work: deterministic software, AELIO Native model, or external assistance. */
export function Performer({ p }: any) {
  const v = String(p || "");
  if (v.startsWith("native:")) return <Badge kind="cyan">AELIO Native · {v.slice(7, 40)}</Badge>;
  if (v.startsWith("external")) return <Badge kind="violet">External · {v.replace(/^external:/, "").slice(0, 46)}</Badge>;
  if (v.startsWith("deterministic")) return <Badge>Deterministic · {v.replace(/^deterministic:/, "")}</Badge>;
  return <Badge>{v}</Badge>;
}

export function Err({ e }: any) { return e ? <div className="err">⚠ {e}</div> : null; }

export function Empty({ children }: any) { return <div className="muted" style={{ padding: "10px 0" }}>{children}</div>; }

export function Unavailable() { return <span className="dim">Data unavailable</span>; }

export function Num({ v, unit, digits = 1 }: any) {
  if (v === null || v === undefined || Number.isNaN(v)) return <Unavailable />;
  return <span>{typeof v === "number" ? +v.toFixed(digits) : v}{unit ? <span className="dim"> {unit}</span> : null}</span>;
}

/** Small multi-series line chart in SVG. series: [{name, color, points:[[x,y],...]}] */
export function LineChart({ series, height = 180, yLabel = "", xLabel = "" }: any) {
  const pts = series.flatMap((s: any) => s.points).filter((p: any) => p[1] !== null && p[1] !== undefined);
  if (!pts.length) return <Empty>No data points yet.</Empty>;
  const W = 600, H = height, P = { l: 44, r: 12, t: 10, b: 26 };
  const xs = pts.map((p: any) => p[0]), ys = pts.map((p: any) => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 1; x1 += 1; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = (y1 - y0) * 0.1 || 1; y0 -= pad; y1 += pad;
  const X = (x: number) => P.l + ((x - x0) / (x1 - x0)) * (W - P.l - P.r);
  const Y = (y: number) => H - P.b - ((y - y0) / (y1 - y0)) * (H - P.t - P.b);
  const ticks = [0, 0.5, 1].map((f) => y0 + f * (y1 - y0));
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={yLabel}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={Y(t)} y2={Y(t)} stroke="#1f2d47" strokeDasharray="3 4" />
            <text x={P.l - 6} y={Y(t) + 4} fill="#5f7190" fontSize="10" textAnchor="end">{+t.toFixed(2)}</text>
          </g>
        ))}
        <text x={W - P.r} y={H - 6} fill="#5f7190" fontSize="10" textAnchor="end">{xLabel}</text>
        {series.map((s: any, i: number) => {
          const p = s.points.filter((q: any) => q[1] !== null && q[1] !== undefined);
          return (
            <g key={i}>
              <polyline fill="none" stroke={s.color} strokeWidth="2" points={p.map((q: any) => `${X(q[0])},${Y(q[1])}`).join(" ")} />
              {p.map((q: any, j: number) => <circle key={j} cx={X(q[0])} cy={Y(q[1])} r="2.5" fill={s.color} />)}
            </g>
          );
        })}
      </svg>
      <div className="row" style={{ fontSize: 12 }}>
        {series.map((s: any, i: number) => <span key={i} className="row" style={{ gap: 5 }}><i style={{ width: 10, height: 3, background: s.color, display: "inline-block" }} />{s.name}</span>)}
        {yLabel && <span className="dim">· {yLabel}</span>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, on, set }: any) {
  return <div className="tabs" role="tablist">{tabs.map((t: string) => <button key={t} role="tab" aria-selected={on === t} className={on === t ? "on" : ""} onClick={() => set(t)}>{t}</button>)}</div>;
}

export function JobLog({ job }: any) {
  if (!job) return null;
  return (
    <div>
      <div className="row"><Status s={job.status} /><span className="mono dim">{job.id}</span><span className="dim">{job.kind}</span></div>
      {job.error && <Err e={job.error} />}
      <pre>{job.log || "(no log yet)"}</pre>
    </div>
  );
}
