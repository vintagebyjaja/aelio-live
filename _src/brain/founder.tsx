import { useState } from "react";
import { ago, post, put } from "./api";
import { Badge, Empty, Err, Num, Status, Tabs, useLoad } from "./ui";

const $ = (c: number) => "$" + (c / 100).toFixed(2);

export function CreditsBilling() {
  const { data: d, error, reload } = useLoad<any>("/api/brain/credits");
  const [err, setErr] = useState(""); const [edit, setEdit] = useState<any>(null);
  if (!d) return <><h1>Credits & Billing</h1><Err e={error} /></>;
  const e = d.economy;
  async function save(p: any) { setErr(""); try { await put(`/api/brain/packages/${p.id}`, p); setEdit(null); reload(); } catch (x: any) { setErr(x.message); } }
  return (
    <div className="grid">
      <div><h1>Credits & Billing</h1><p className="sub">AELIO Operations → the credit economy. All numbers come from the ledger. Estimates are labelled.</p></div>
      <div className={d.payments.usable ? "notice good" : "notice"}>Payments: <b>{d.payments.configured ? `Stripe ${d.payments.mode} mode` : "not configured"}</b>. {d.payments.mode === "live" && !d.payments.live_enabled ? "Live key present but live charges are disabled (AELIO_PAYMENTS_LIVE=0)." : ""} {!d.payments.configured && "Add STRIPE_SECRET_KEY (test key) and STRIPE_WEBHOOK_SECRET to the engine's .env."}</div>
      <Err e={err} />
      <div className="grid g4">
        {[["Credits sold", e.credits_sold], ["Gross revenue", "$" + e.gross_revenue_usd.toFixed(2)], ["Refunds", "$" + e.refunds_usd.toFixed(2)], ["Outstanding credits", e.outstanding_purchased_credits],
          ["Credits consumed", e.credits_consumed], ["Avg usage / customer", e.average_usage_per_customer], ["Est. compute cost", e.estimated_compute_cost_usd == null ? null : "$" + e.estimated_compute_cost_usd], ["Est. gross margin", e.estimated_gross_margin_usd == null ? null : "$" + e.estimated_gross_margin_usd]]
          .map(([l, v]: any) => <div className="card" key={l}><div className="dim">{l}</div><div className="stat">{v == null ? <span className="dim" style={{ fontSize: 16 }}>Data unavailable</span> : v}</div></div>)}
      </div>
      <p className="dim small">{e.payment_fees_note} {e.estimated_compute_note}</p>
      <div className="card">
        <div className="spread"><h2>Credit packages</h2><button className="dark-btn" onClick={() => setEdit({ id: "pkg_" + Math.random().toString(36).slice(2, 7), name: "New package", credits: 100, price_cents: 299, active: false, approved: false, promo: false, sort: 99 })}>+ New package</button></div>
        <p className="dim small">Packages can only be sold when they're both <b>approved</b> (needs a fresh authenticator code) and <b>active</b>. The four starter packages are illustrative and start off.</p>
        <table><thead><tr><th>Package</th><th>Credits</th><th>Price</th><th>Approved</th><th>Active</th><th>Promo</th><th></th></tr></thead><tbody>
          {d.packages.map((p: any) => <tr key={p.id}><td>{p.name}<div className="dim mono small">{p.id}</div></td><td>{p.credits}</td><td>{$(p.price_cents)}</td><td>{p.approved ? <Badge kind="ok">approved</Badge> : <Badge kind="warn">not approved</Badge>}</td><td>{p.active ? "on" : "off"}</td><td>{p.promo ? "yes" : ""}</td><td><button className="ghost sm" onClick={() => setEdit({ ...p, active: !!p.active, approved: !!p.approved, promo: !!p.promo })}>Edit</button></td></tr>)}
        </tbody></table>
        {edit && <div className="item" style={{ marginTop: 12, cursor: "default" }}>
          <div className="grid g4"><div><label>Name</label><input value={edit.name} onChange={(x: any) => setEdit({ ...edit, name: x.target.value })} /></div>
            <div><label>Credits</label><input type="number" value={edit.credits} onChange={(x: any) => setEdit({ ...edit, credits: +x.target.value })} /></div>
            <div><label>Price (cents)</label><input type="number" value={edit.price_cents} onChange={(x: any) => setEdit({ ...edit, price_cents: +x.target.value })} /></div>
            <div><label>Sort</label><input type="number" value={edit.sort} onChange={(x: any) => setEdit({ ...edit, sort: +x.target.value })} /></div></div>
          <div className="row" style={{ marginTop: 8 }}>{["approved", "active", "promo"].map(k => <label key={k} className="row" style={{ margin: 0 }}><input type="checkbox" style={{ width: "auto" }} checked={edit[k]} onChange={(x: any) => setEdit({ ...edit, [k]: x.target.checked })} />{k}</label>)}
            <button className="gold-btn sm" onClick={() => save(edit)}>Save</button><button className="ghost sm" onClick={() => setEdit(null)}>Cancel</button></div></div>}
      </div>
      <div className="card"><h2>Recent payments</h2>{d.recent_payments.length ? <table><tbody>{d.recent_payments.map((p: any) => <tr key={p.id}><td className="mono dim">{p.id}</td><td>{p.email}</td><td>{p.credits}</td><td>{$(p.amount_cents)}</td><td><Status s={p.status} /></td><td className="dim">{ago(p.created_at)}</td></tr>)}</tbody></table> : <Empty>No payments yet.</Empty>}</div>
    </div>);
}

export function UsageAccess() {
  const c = useLoad<any>("/api/brain/credits"); const u = useLoad<any>("/api/brain/users");
  const [tab, setTab] = useState("Plans"); const [err, setErr] = useState(""); const [reason, setReason] = useState("");
  const act = async (fn: () => Promise<any>) => { setErr(""); try { await fn(); c.reload(); u.reload(); } catch (x: any) { setErr(x.message); } };
  const r = c.data?.restriction;
  return (
    <div className="grid">
      <div><h1>Usage & Access</h1><p className="sub">Allowances, credit costs, accounts and emergency restrictions. Changes apply immediately without touching code.</p></div>
      <div className={r?.active ? "notice" : "notice good"}>{r?.active ? <>Workloads are <b>restricted</b>: {r.reason}. Everyone, including founder accounts, is paused.</> : "No workload restriction is active."}
        <div className="row" style={{ marginTop: 8 }}><input style={{ maxWidth: 320 }} placeholder="Reason (e.g. thermal alert)" value={reason} onChange={(e: any) => setReason(e.target.value)} />
          <button className={r?.active ? "dark-btn sm" : "danger sm"} onClick={() => act(() => post("/api/brain/restriction", { active: !r?.active, reason: reason || "founder action" }))}>{r?.active ? "Lift restriction" : "Restrict workloads"}</button></div></div>
      <Err e={err} />
      <Tabs tabs={["Plans", "Credit costs", "Accounts"]} on={tab} set={setTab} />
      {tab === "Plans" && c.data && <div className="grid g2">{c.data.plans.map((p: any) => <PlanEditor key={p.id} p={p} act={act} />)}</div>}
      {tab === "Credit costs" && c.data && <div className="card"><table><thead><tr><th>Operation</th><th>Credits</th><th>Unit</th><th>Est. infra cost (USD per unit)</th><th></th></tr></thead><tbody>
        {c.data.costs.map((x: any) => <CostRow key={x.op} x={x} act={act} />)}</tbody></table>
        <p className="dim small">Credit prices and infrastructure cost estimates are kept separate, so pricing can change without rebuilding anything.</p></div>}
      {tab === "Accounts" && <div className="card"><div className="tablewrap"><table><thead><tr><th>Account</th><th>Role</th><th>Plan</th><th>Allowance</th><th>Credits</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {(u.data?.users || []).map((x: any) => <tr key={x.id}><td>{x.email}<div className="dim small">{x.last_seen ? "seen " + ago(x.last_seen) : ""}</div></td><td>{x.role}{x.unlimited ? <> <Badge kind="ok">unlimited</Badge></> : null}</td>
          <td><select style={{ width: "auto" }} value={x.plan} onChange={(e: any) => act(() => post(`/api/brain/users/${x.id}/plan`, { plan: e.target.value }))}><option value="free">Free</option><option value="live">Live</option></select></td>
          <td className="mono">{x.window.remaining}/{x.window.allowance}</td><td className="mono">{x.balances.purchased} + {x.balances.promo} promo</td>
          <td><select style={{ width: "auto" }} value={x.status} onChange={(e: any) => act(() => post(`/api/brain/users/${x.id}/status`, { status: e.target.value }))}><option>active</option><option>review</option><option>suspended</option></select></td>
          <td><button className="dark-btn sm" onClick={() => { const n = prompt("Promotional credits to grant (negative to remove):", "50"); const note = n && prompt("Note for the audit log:", "promo"); if (n && note) act(() => post(`/api/brain/users/${x.id}/grant`, { amount: +n, bucket: "promo", note })); }}>Grant promo</button></td></tr>)}
      </tbody></table></div><p className="dim small">Every grant, adjustment, plan or status change is written to the audit log.</p></div>}
    </div>);
}

function PlanEditor({ p, act }: any) {
  const [f, setF] = useState({ allowance: p.allowance, window_hours: p.window_hours, member_discount_pct: p.member_discount_pct, features: p.features.join(", ") });
  return <div className="card"><h2>{p.name}</h2>
    <div className="grid g3"><div><label>Allowance (credits)</label><input type="number" value={f.allowance} onChange={(e: any) => setF({ ...f, allowance: e.target.value })} /></div>
      <div><label>Window (hours)</label><input type="number" step="0.5" value={f.window_hours} onChange={(e: any) => setF({ ...f, window_hours: e.target.value })} /></div>
      <div><label>Credit discount %</label><input type="number" value={f.member_discount_pct} onChange={(e: any) => setF({ ...f, member_discount_pct: e.target.value })} /></div></div>
    <label>Features</label><input value={f.features} onChange={(e: any) => setF({ ...f, features: e.target.value })} />
    <div className="row" style={{ marginTop: 10 }}><button className="gold-btn sm" onClick={() => act(() => put(`/api/brain/plans/${p.id}`, { ...f, allowance: +f.allowance, window_hours: +f.window_hours, member_discount_pct: +f.member_discount_pct, features: f.features.split(",").map((s: string) => s.trim()).filter(Boolean) }))}>Save {p.name}</button></div></div>;
}

function CostRow({ x, act }: any) {
  const [c, setC] = useState(x.credits); const [e, setE] = useState(x.est_cost_usd ?? "");
  return <tr><td>{x.note}<div className="dim mono small">{x.op}</div></td><td><input type="number" style={{ width: 90 }} value={c} onChange={(v: any) => setC(v.target.value)} /></td><td>{x.unit}</td>
    <td><input type="number" step="0.0001" style={{ width: 120 }} value={e} placeholder="not set" onChange={(v: any) => setE(v.target.value)} /></td>
    <td><button className="ghost sm" onClick={() => act(() => put(`/api/brain/costs/${x.op}`, { credits: +c, est_cost_usd: e === "" ? null : +e }))}>Save</button></td></tr>;
}

export function AgentTransferAdmin() {
  const { data: d, error, reload } = useLoad<any>("/api/brain/transfer");
  if (!d) return <><h1>Agent Transfer</h1><Err e={error} /></>;
  return (
    <div className="grid">
      <div><h1>Agent Transfer</h1><p className="sub">Import health and security. Conversation content is never shown here.</p></div>
      <div className="grid g4">
        <div className="card"><div className="dim">Imports</div><div className="stat">{d.imports}</div></div>
        <div className="card"><div className="dim">Success rate</div><div className="stat">{d.success_rate == null ? "—" : Math.round(d.success_rate * 100) + "%"}</div></div>
        <div className="card"><div className="dim">Security events</div><div className="stat">{d.security_events}</div><div className="dim small">{d.flagged_items} flagged items excluded</div></div>
        <div className="card"><div className="dim">Stored sources</div><div className="stat">{d.stored_sources}</div><div className="dim small"><Num v={d.stored_bytes / 1e6} unit="MB" /></div></div>
      </div>
      <div className="grid g2">
        <div className="card"><h2>By format</h2>{d.by_format.length ? <table><tbody>{d.by_format.map((r: any, i: number) => <tr key={i}><td>{r.method}</td><td>{r.format}</td><td><Status s={r.status === "ok" ? "passed" : "failed"} /></td><td>{r.n}</td></tr>)}</tbody></table> : <Empty>No imports yet.</Empty>}
          <h3>Parsing errors</h3>{d.errors.length ? d.errors.map((e: any) => <div key={e.error_kind}>{e.error_kind}: {e.n}</div>) : <Empty>None.</Empty>}</div>
        <div className="card"><h2>Personality reconstruction</h2>{d.preview_ratings.length ? d.preview_ratings.map((r: any) => <div key={r.rating}>{r.rating.replace("_", " ")}: {r.n}</div>) : <Empty>No preview ratings yet.</Empty>}
          <h3>Agents</h3>{d.agents.map((a: any) => <Badge key={a.kind}>{a.kind}: {a.n}</Badge>)}
          <h3>Supported formats</h3><div className="dim small">{d.supported_formats.join(" · ")}</div></div>
        <div className="card"><h2>Temporary file cleanup</h2><p className="dim small">Last run: {d.last_cleanup ? `${ago(d.last_cleanup.ts)}, removed ${d.last_cleanup.removed}` : "never"}</p>
          <button className="dark-btn" onClick={async () => { await post("/api/brain/transfer/cleanup"); reload(); }}>Run cleanup now</button></div>
        <div className="card"><h2>User-reported problems</h2>{d.reports.length ? <table><tbody>{d.reports.map((r: any) => <tr key={r.id}><td className="mono dim">{r.id}</td><td>{r.area}</td><td><Status s={r.status} /></td><td className="dim">{ago(r.created_at)}</td></tr>)}</tbody></table> : <Empty>No reports.</Empty>}</div>
      </div>
      <p className="dim small">{d.note} Tests use synthetic profiles only (engine repo: tests/test_transfer.py).</p>
    </div>);
}
