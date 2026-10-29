import { useState } from "react";
import { ago, post, put } from "./api";
import { Badge, Empty, Err, Status, Tabs, useLoad } from "./ui";

const usd = (v: number | null | undefined, d = 4) => v == null ? "—" : "$" + Number(v).toFixed(d);
const ms = (v: number | null | undefined) => v == null ? "—" : v >= 1000 ? (v / 1000).toFixed(1) + " s" : v + " ms";
const n = (v: number | null | undefined) => v == null ? "—" : Number(v).toLocaleString();

/** Founder-only: providers, models, usage, cost, errors, latency, routing controls and AELIO Native status. */
export function Intelligence() {
  const { data: d, error, reload } = useLoad<any>("/api/brain/intelligence");
  const [tab, setTab] = useState("Overview"); const [err, setErr] = useState(""); const [win, setWin] = useState("24h");
  const [test, setTest] = useState({ prompt: "Say hello in one sentence.", tier: "standard" }); const [testOut, setTestOut] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null); const [needConsent, setNeedConsent] = useState(false);
  if (!d) return <><h1>Intelligence</h1><Err e={error} /></>;
  const s = d.settings, w = d.windows[win];
  const act = async (fn: () => Promise<any>) => { setErr(""); try { await fn(); reload(); } catch (x: any) { setErr(x.message); } };
  const enabled = d.models.filter((m: any) => m.enabled && m.provider !== "test");
  const ed = draft || { standard: s.tiers.standard.model, advanced: s.tiers.advanced.model, usd_per_credit: s.usd_per_credit,
    exempt_daily_usd_cap: s.exempt_daily_usd_cap, global_daily_usd_cap: s.global_daily_usd_cap,
    user_requests_per_minute: s.user_requests_per_minute, user_concurrency: s.user_concurrency };
  return (
    <div className="grid">
      <div className="spread"><div><h1>Intelligence</h1><p className="sub">The AELIO Intelligence Gateway: every AI request from AELIO Live goes through here. Message content is never shown.</p></div>
        {s.paused ? <button className="gold-btn" onClick={() => act(() => post("/api/brain/intelligence/pause", { paused: false }))}>Resume AI requests</button>
          : <button className="dark-btn" onClick={() => act(() => post("/api/brain/intelligence/pause", { paused: true }))}>Pause all AI requests</button>}</div>
      {s.paused && <div className="notice">All AI requests are paused. Users see a notice and nothing is charged.</div>}
      {d.secrets.OPENAI_API_KEY !== "set" && <div className="notice">OpenAI isn't connected: add <span className="mono">OPENAI_API_KEY</span> to the engine server (see Settings → Secrets, or the engine's .env). Until then chat shows "not connected" and charges nothing.</div>}
      <Err e={err} />
      <Tabs tabs={["Overview", "Routing & limits", "Models & prices", "Test", "AELIO Native"]} on={tab} set={setTab} />

      {tab === "Overview" && <>
        <div className="row">{["24h", "7d", "30d"].map(k => <button key={k} className={k === win ? "gold-btn sm" : "ghost sm"} onClick={() => setWin(k)}>{k}</button>)}
          <span className="dim small">Spent today (UTC): {usd(d.spend_today_usd)} of {usd(s.global_daily_usd_cap, 2)} cap</span></div>
        <div className="grid g4">
          {[["Requests", n(w.requests)], ["Errors", n(w.errors)], ["Input tokens", n(w.input_tokens)], ["Output tokens", n(w.output_tokens)],
            ["Est. provider cost", usd(w.cost_usd)], ["Latency p50", ms(w.latency_p50_ms)], ["Latency p95", ms(w.latency_p95_ms)], ["First token p50", ms(w.ttft_p50_ms)]]
            .map(([l, v]: any) => <div className="card" key={l}><div className="dim">{l}</div><div className="stat">{v}</div></div>)}
        </div>
        <div className="card"><h2>Providers</h2><table><thead><tr><th>Provider</th><th>Status</th><th>Sends data outside AELIO</th><th>Used for</th></tr></thead><tbody>
          {Object.entries(d.providers).map(([k, p]: any) => <tr key={k}><td>{k === "openai" ? "OpenAI (GPT)" : k === "aelio-native" ? "AELIO Native" : "Test provider (not AI)"}</td>
            <td>{p.configured ? <Badge kind="ok">connected</Badge> : <Badge kind="warn">not connected</Badge>}</td><td>{p.external ? "yes" : "no"}</td><td>{p.used_by.join(", ") || "—"}</td></tr>)}
        </tbody></table></div>
        <div className="card"><h2>By model (30 days)</h2>{d.by_model.length ? <table><thead><tr><th>Model</th><th>Requests</th><th>Errors</th><th>Tokens in / out</th><th>Est. cost</th><th>Credits</th></tr></thead><tbody>
          {d.by_model.map((r: any) => <tr key={r.provider + r.model}><td>{r.model}<div className="dim small">{r.provider}</div></td><td>{n(r.requests)}</td><td>{n(r.errors)}</td><td>{n(r.input_tokens)} / {n(r.output_tokens)}</td><td>{usd(r.cost_usd)}</td><td>{n(r.credits)}</td></tr>)}
        </tbody></table> : <Empty>No AI requests yet.</Empty>}</div>
        <div className="card"><h2>Recent errors</h2>{d.recent_errors.length ? <table><tbody>{d.recent_errors.map((e: any, i: number) => <tr key={i}><td className="dim">{ago(e.ts)}</td><td>{e.provider} · {e.model}</td><td><Status s={e.error_code} /></td><td className="dim">{e.purpose}</td></tr>)}</tbody></table> : <Empty>No errors.</Empty>}</div>
        <p className="dim small">{d.content_note} Costs are estimates from the price list (Models & prices); OpenAI's usage dashboard is the billing source of truth.</p>
      </>}

      {tab === "Routing & limits" && <div className="card">
        <h2>Routing</h2><p className="dim small">Ordinary chat uses the standard model. Code tasks, long messages and code-heavy messages use the advanced model; if it fails before writing anything, the standard model answers instead. Changes need a fresh authenticator code and are audited.</p>
        <div className="grid g4">
          {(["standard", "advanced"] as const).map(t => <div key={t}><label>{t === "standard" ? "Standard model" : "Advanced model"}</label>
            <select value={ed[t]} onChange={(e: any) => setDraft({ ...ed, [t]: e.target.value })}>{enabled.map((m: any) => <option key={m.id} value={m.id}>{m.label || m.id}</option>)}</select></div>)}
          {[["usd_per_credit", "Provider $ per credit"], ["exempt_daily_usd_cap", "Founder/unlimited daily cap ($)"], ["global_daily_usd_cap", "All accounts daily cap ($)"],
            ["user_requests_per_minute", "Requests / minute / user"], ["user_concurrency", "Parallel replies / user"]].map(([k, l]) =>
            <div key={k}><label>{l}</label><input type="number" step="any" value={ed[k]} onChange={(e: any) => setDraft({ ...ed, [k]: +e.target.value })} /></div>)}
        </div>
        <div className="row" style={{ marginTop: 12 }}><button className="gold-btn" disabled={!draft} onClick={() => act(async () => {
          await put("/api/brain/intelligence/settings", { tiers: { standard: { provider: "openai", model: ed.standard }, advanced: { provider: "openai", model: ed.advanced } },
            usd_per_credit: ed.usd_per_credit, exempt_daily_usd_cap: ed.exempt_daily_usd_cap, global_daily_usd_cap: ed.global_daily_usd_cap,
            user_requests_per_minute: ed.user_requests_per_minute, user_concurrency: ed.user_concurrency }); setDraft(null); })}>Save settings</button>
          {draft && <button className="ghost" onClick={() => setDraft(null)}>Discard</button>}</div>
      </div>}

      {tab === "Models & prices" && <div className="card"><h2>Price list (USD per 1M tokens)</h2>
        <p className="dim small">Used for cost estimates and credit charges. Check against OpenAI's pricing page; edit here when prices change.</p>
        <table><thead><tr><th>Model</th><th>Input</th><th>Cached input</th><th>Output</th><th>Enabled</th><th>Source</th></tr></thead><tbody>
          {d.models.map((m: any) => <tr key={m.id}><td>{m.label}<div className="dim mono small">{m.id}</div></td><td>{usd(m.input_per_m, 2)}</td><td>{usd(m.cached_input_per_m, 2)}</td><td>{usd(m.output_per_m, 2)}</td>
            <td>{m.provider === "test" ? <span className="dim">tests only</span> : <button className="ghost sm" onClick={() => act(() => put(`/api/brain/intelligence/models/${m.id}`, { enabled: m.enabled ? 0 : 1 }))}>{m.enabled ? "on" : "off"}</button>}</td>
            <td className="dim small">{m.price_source}</td></tr>)}
        </tbody></table></div>}

      {tab === "Test" && <div className="card"><h2>Internal test</h2><p className="dim small">Sends one prompt through the gateway exactly like a user request (metered, logged, counted in today's spend).</p>
        <textarea rows={3} value={test.prompt} onChange={(e: any) => setTest({ ...test, prompt: e.target.value })} />
        <div className="row" style={{ marginTop: 8 }}><select style={{ width: "auto" }} value={test.tier} onChange={(e: any) => setTest({ ...test, tier: e.target.value })}><option value="standard">Standard</option><option value="advanced">Advanced</option></select>
          <button className="gold-btn" onClick={async () => { setErr(""); setNeedConsent(false); try { setTestOut(await post("/api/brain/intelligence/test", test)); reload(); } catch (x: any) { if (x.data?.code === "consent_required") setNeedConsent(true); else setErr(x.message); } }}>Run test</button></div>
        {needConsent && <div className="notice" style={{ marginTop: 12 }}>Your account hasn't accepted the AI disclosure yet, so AELIO won't send your prompt to OpenAI.
          <div className="row" style={{ marginTop: 8 }}><button className="gold-btn sm" onClick={() => act(async () => { await put("/api/my/settings", { external_ai_consent: true }); setNeedConsent(false); })}>Accept the disclosure for my account</button></div></div>}
        {testOut && <div className="item" style={{ marginTop: 12, cursor: "default" }}><div style={{ whiteSpace: "pre-wrap" }}>{testOut.text || <span className="dim">(no text)</span>}</div>
          <div className="dim small">{testOut.meta?.provider} · {testOut.meta?.model} · {testOut.final?.type === "done" ? `${n(testOut.final.usage.input_tokens)} in / ${n(testOut.final.usage.output_tokens)} out · ${usd(testOut.final.cost_usd, 6)}` : testOut.final?.message}</div></div>}
      </div>}

      {tab === "AELIO Native" && <div className="card"><h2>AELIO Native status</h2>
        <p>{d.native.note}</p>
        <div className="row"><span>Rollout stage:</span><Badge kind={s.native.stage === "off" ? "warn" : "ok"}>{s.native.stage}</Badge>
          <span className="dim">Product-approved checkpoints: {d.native.product_approved.length || "none"}</span></div>
        <h3 style={{ marginTop: 16 }}>Latest checkpoints (research)</h3>
        {d.native.checkpoints.length ? <table><tbody>{d.native.checkpoints.map((c: any) => <tr key={c.id}><td className="mono small">{c.id}</td><td>{c.name}</td><td>{c.family}</td><td><Status s={c.status} /></td><td className="dim">{ago(c.created_at)}</td></tr>)}</tbody></table> : <Empty>No checkpoints yet.</Empty>}
        <p className="dim small">Rollout path once a model passes the product gate: founder only → a small percentage of users → wider, with one-click rollback to GPT. GPT responses and user conversations are never used to train AELIO Native.</p>
      </div>}
    </div>);
}
