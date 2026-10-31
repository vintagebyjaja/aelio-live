import { useEffect, useRef, useState } from "react";
import { ago, api, ApiError, del, post, put, streamPost, ts, until } from "./api";
import { Badge, Empty, Err, Status, useLoad } from "./ui";

export const VOICES = [["aelio-voice-groove", "GROOVE"], ["aelio-voice-nova", "NOVA"], ["aelio-voice-sol", "SOL"], ["aelio-voice-sage", "SAGE"], ["aelio-voice-echo", "ECHO"], ["aelio-voice-aura", "AURA"]];
const go = (p: string) => { history.pushState({}, "", p); dispatchEvent(new PopStateEvent("popstate")); };
const A = ({ href, children, className }: any) => <a href={href} className={className} onClick={(e: any) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go(href); }}>{children}</a>;
export { A, go };

/* ---------------------------------------------------------------- usage notices */
export function UsageNotice({ err, onRetry }: any) {
  if (!err) return null;
  const d = err.data || {};
  if (d.code === "limit_reached") return (
    <div className="limit-card" role="alert">
      <b>You've reached your AELIO usage limit.</b>
      <p>{d.resets_at ? <>Your allowance refreshes in {until(d.resets_at)} ({new Date(d.resets_at * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}).</> : "Your allowance refreshes on a rolling five-hour window."} Want to keep going?</p>
      <div className="row"><A className="gold-btn" href={`/brain/my/wallet?return=${encodeURIComponent(location.pathname)}`}>Buy More Credits</A><button className="dark-btn" onClick={onRetry}>Wait for Reset</button></div>
    </div>);
  if (d.code === "restricted") return <div className="limit-card" role="alert"><b>AELIO is temporarily limiting workloads.</b><p>To protect the hardware, new requests are paused for now. Nothing was charged.</p></div>;
  if (d.code === "native_unavailable") return <div className="notice" role="alert">{err.message}</div>;
  if (d.code === "feature_unavailable") return <div className="notice" role="alert">{err.message}</div>;
  return <Err e={err.message} />;
}

function Meter({ u }: any) {
  if (!u) return null;
  if (u.exempt) return <div className="meter"><div className="row"><b>Unlimited</b><Badge kind="ok">no usage limits on this account</Badge></div></div>;
  const w = u.window, pct = w.allowance ? Math.round(100 * w.remaining / w.allowance) : 0;
  return (
    <div className="meter">
      <div className="spread"><b>{u.plan_name}</b><span className="dim">{w.remaining} of {w.allowance} left · rolling {w.window_hours}h</span></div>
      <div className="bar"><i style={{ width: pct + "%" }} /></div>
      <div className="spread small"><span className="dim">{w.resets_at ? `Next refresh in ${until(w.resets_at)}` : "Full allowance available"}</span>
        <span>Credits: <b>{u.balances.purchased}</b> purchased · <b>{u.balances.promo}</b> promo</span></div>
      {u.low_credit_warning && <div className="notice">You're running low on AELIO Credits. <A href="/brain/my/wallet">Add Credits</A></div>}
    </div>);
}

/* ---------------------------------------------------------------- home */
export function MyHome() {
  const { data: d, error } = useLoad<any>("/api/my/home");
  if (!d) return <><h1>My AELIO</h1><Err e={error} /></>;
  return (
    <div className="grid">
      <div><div className="eyebrow">My AELIO</div><h1>Welcome back.</h1><p className="sub">Your agents, history and usage in one place.</p></div>
      {d.usage.restriction && <div className="notice">AELIO is temporarily limiting workloads to protect infrastructure.</div>}
      <div className="card"><h2>Usage</h2><Meter u={d.usage} /></div>
      <div className="grid g2">
        <div className="card"><div className="spread"><h2>My agents</h2><A href="/brain/my/agents">All agents →</A></div>
          <div className="list">{d.agents.map((a: any) => <A key={a.id} href={`/brain/my/chat/${a.id}`} className="item"><div className="spread"><b>{a.name}</b>{a.is_default ? <Badge kind="gold">default</Badge> : a.origin_label ? <Badge kind="violet">{a.origin_label}</Badge> : null}</div><div className="dim small">{a.last_chat_at ? "Last chat " + ago(a.last_chat_at) : "No conversations yet"}</div></A>)}</div>
          <div className="row" style={{ marginTop: 12 }}><A className="dark-btn" href="/brain/my/import">Import My Agent</A><A className="dark-btn" href="/brain/my/agents?new=1">Create a New Agent</A></div></div>
        <div className="card"><div className="spread"><h2>Recent conversations</h2><A href="/brain/my/history">History →</A></div>
          {d.conversations.length ? <div className="list">{d.conversations.map((c: any) => <A key={c.id} href={`/brain/my/chat/${c.agent_id}?c=${c.id}`} className="item"><b>{c.title}</b><div className="dim small">{ago(c.updated_at)}</div></A>)}</div> : <Empty>No conversations yet.</Empty>}
          {!d.chat_available && <div className="notice" style={{ marginTop: 10 }}>AI chat isn't connected on this server yet. Your agents and history are safe; chats will work once it's connected.</div>}
        </div>
      </div>
    </div>);
}

/* ---------------------------------------------------------------- agents */
export function MyAgents() {
  const { data, error, reload } = useLoad<any>("/api/my/agents");
  const [creating, setCreating] = useState(location.search.includes("new=1"));
  const [f, setF] = useState<any>({ name: "", role: "", personality: "", humor: "", communication_style: "", specialties: "", memory_preferences: "Only remember what I approve", voice_id: "aelio-voice-groove" });
  const [err, setErr] = useState("");
  const groups: [string, (a: any) => boolean][] = [["My Main Pal", a => a.kind === "main_pal"], ["Imported Agents", a => a.kind === "imported" && a.status !== "archived"],
    ["Custom Agents", a => a.kind === "custom" && a.status !== "archived"], ["Agent Teams", a => a.kind === "team"], ["Archived Agents", a => a.status === "archived" && a.kind !== "main_pal"]];
  async function create() { setErr(""); try { const r: any = await post("/api/my/agents", f); go(`/brain/my/agents/${r.agent_id}`); } catch (e: any) { setErr(e.message); } }
  return (
    <div className="grid">
      <div className="spread"><div><div className="eyebrow">My AELIO</div><h1>My Agents</h1></div>
        <div className="row"><A className="gold-btn" href="/brain/my/import">Import My Agent</A><button className="dark-btn" onClick={() => setCreating(!creating)}>Create a New Agent</button></div></div>
      <Err e={error || err} />
      {creating && <div className="card"><h2>Create a new agent</h2>
        <div className="grid g3">
          {[["name", "Name"], ["role", "Role"], ["personality", "Personality"], ["humor", "Humor"], ["communication_style", "Communication style"], ["specialties", "Specialties"]].map(([k, l]) => <div key={k}><label>{l}</label><input value={f[k]} onChange={(e: any) => setF({ ...f, [k]: e.target.value })} /></div>)}
          <div><label>Voice</label><select value={f.voice_id} onChange={(e: any) => setF({ ...f, voice_id: e.target.value })}>{VOICES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></div>
          <div><label>Memory preferences</label><input value={f.memory_preferences} onChange={(e: any) => setF({ ...f, memory_preferences: e.target.value })} /></div>
        </div><div className="row" style={{ marginTop: 12 }}><button className="gold-btn" disabled={!f.name} onClick={create}>Create agent</button></div></div>}
      {data && groups.map(([title, fn]) => { const list = data.agents.filter(fn); return (
        <div key={title}><h3>{title}</h3>{list.length ? <div className="grid g3">{list.map((a: any) => <AgentCard key={a.id} a={a} reload={reload} />)}</div> : <Empty>{title === "Agent Teams" ? "Create a group conversation with your agents in Chat." : "None yet."}</Empty>}</div>); })}
    </div>);
}

function AgentCard({ a, reload }: any) {
  const [err, setErr] = useState("");
  async function exp() { const d = await api(`/api/my/agents/${a.id}/export`); const b = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }); const u = URL.createObjectURL(b); const l = document.createElement("a"); l.href = u; l.download = `${a.name.replace(/\W+/g, "-")}.aelio-agent.json`; l.click(); URL.revokeObjectURL(u); }
  async function remove() { if (!confirm(`Delete ${a.name}? Its profile, memories and uploads are removed.`)) return; try { await del(`/api/my/agents/${a.id}`); reload(); } catch (e: any) { setErr(e.message); } }
  return (
    <div className="card agent-card">
      <div className="spread"><div className="row"><span className="avatar">{(a.avatar || a.name[0] || "A").slice(0, 2)}</span><b>{a.name}</b></div>
        {a.is_default ? <Badge kind="gold">default</Badge> : a.origin_label ? <Badge kind="violet">{a.origin_label}</Badge> : null}</div>
      <div className="dim small" style={{ margin: "8px 0" }}>{a.description || a.personality || "No description yet."}</div>
      <div className="dim small">Voice: {(VOICES.find(v => v[0] === a.voice_id) || ["", "—"])[1]} · {a.last_chat_at ? "last chat " + ago(a.last_chat_at) : "no chats yet"}</div>
      <div className="row" style={{ marginTop: 10 }}>
        <A className="gold-btn sm" href={`/brain/my/chat/${a.id}`}>Continue Chat</A><A className="dark-btn sm" href={`/brain/my/agents/${a.id}`}>Edit</A>
        <button className="dark-btn sm" onClick={exp}>Export</button>{a.kind !== "main_pal" && <button className="ghost sm danger" onClick={remove}>Delete</button>}</div>
      <Err e={err} />
    </div>);
}

/* ---------------------------------------------------------------- agent detail */
const TESTS = ["Hey, what's good?", "Help me plan a project.", "Tell me something funny.", "I need advice.", "Explain this in your usual style."];
export function MyAgent({ id }: any) {
  const { data: a, error, reload, setData } = useLoad<any>(`/api/my/agents/${id}`, [id]);
  const [err, setErr] = useState<any>(null); const [pv, setPv] = useState<any>(null); const [saved, setSaved] = useState("");
  if (!a) return <Err e={error} />;
  const prof = a.profile || {};
  const setProf = (k: string, v: any) => setData({ ...a, profile: { ...prof, [k]: v } });
  async function save() { setErr(null); try { await put(`/api/my/agents/${id}`, { name: a.name, description: a.description, voice_id: a.voice_id, avatar: a.avatar, profile: a.profile, memories: a.memories }); setSaved("Saved"); setTimeout(() => setSaved(""), 1600); } catch (e: any) { setErr(e); } }
  async function preview(prompt: string) { setErr(null); setPv({ prompt, loading: true }); try { setPv(await post(`/api/my/agents/${id}/preview`, { prompt })); } catch (e: any) { setPv(null); setErr(e); } }
  async function rate(r: string) { await post(`/api/my/previews/${pv.preview_id}/rate`, { rating: r }); setPv({ ...pv, rated: r }); reload(); }
  return (
    <div className="grid">
      <div className="spread"><div><A href="/brain/my/agents" className="dim small">← My Agents</A><h1>{a.name}</h1>{a.origin_label && <><Badge kind="violet">{a.origin_label}</Badge> <span className="dim small">Recreated from a user-provided profile. Not a copy of the original assistant.</span></>}</div>
        <div className="row"><A className="gold-btn" href={`/brain/my/chat/${id}`}>Start talking</A><button className="dark-btn" onClick={async () => { await put(`/api/my/agents/${id}`, { is_default: true }); reload(); }}>{a.is_default ? "Default companion ✓" : "Set as default"}</button><button className="dark-btn" onClick={async () => { await put(`/api/my/agents/${id}`, { status: a.status === "archived" ? "active" : "archived" }); reload(); }}>{a.status === "archived" ? "Unarchive" : "Archive"}</button></div></div>
      <UsageNotice err={err} onRetry={() => setErr(null)} />
      <div className="grid g2">
        <div className="card"><h2>Identity & personality</h2>
          <label>Name</label><input value={a.name} onChange={(e: any) => setData({ ...a, name: e.target.value })} />
          <label>Description</label><input value={a.description || ""} onChange={(e: any) => setData({ ...a, description: e.target.value })} />
          <div className="grid g2"><div><label>Avatar (emoji or initials)</label><input value={a.avatar || ""} onChange={(e: any) => setData({ ...a, avatar: e.target.value })} /></div>
            <div><label>Voice</label><select value={a.voice_id || ""} onChange={(e: any) => setData({ ...a, voice_id: e.target.value })}>{VOICES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></div></div>
          {["personality", "communication_style", "humor", "response_length", "working_habits", "expertise"].map(k => <div key={k}><label>{k.replace(/_/g, " ")}</label><textarea rows={2} value={typeof prof[k] === "string" ? prof[k] : (prof[k] || []).join?.("\n") || ""} onChange={(e: any) => setProf(k, e.target.value)} /></div>)}
          <label>Common phrases (one per line)</label><textarea rows={3} value={(prof.phrases || []).join("\n")} onChange={(e: any) => setProf("phrases", e.target.value.split("\n").filter(Boolean))} />
          <div className="row" style={{ marginTop: 10 }}><button className="gold-btn" onClick={save}>Save changes</button><span className="dim">{saved}</span></div></div>
        <div className="grid">
          <div className="card"><h2>Memory review</h2><p className="dim small">Your agent only uses memories you keep switched on. Flagged items start switched off.</p>
            {a.memories.length ? a.memories.map((m: any, i: number) => (
              <label key={m.id} className="mem"><input type="checkbox" checked={!!m.include} onChange={(e: any) => { const ms = [...a.memories]; ms[i] = { ...m, include: e.target.checked }; setData({ ...a, memories: ms }); }} />
                <span><span>{m.text}</span><span className="dim small"> · {m.category} · {m.source}</span>{m.flags?.map((f: string) => <Badge key={f} kind="warn">{f}</Badge>)}</span>
                <button className="ghost sm" onClick={(e: any) => { e.preventDefault(); setData({ ...a, memories: a.memories.filter((x: any) => x.id !== m.id) }); }} aria-label="Remove memory">✕</button></label>)) : <Empty>No memories.</Empty>}
            <div className="row" style={{ marginTop: 8 }}><button className="dark-btn sm" onClick={save}>Save memory choices</button></div></div>
          <div className="card"><h2>Personality preview</h2><p className="dim small">Try your agent before you commit. This preview uses a research model; its replies may be limited.</p>
            <div className="row">{TESTS.map(t => <button key={t} className="dark-btn sm" onClick={() => preview(t)}>{t}</button>)}</div>
            {pv && (pv.loading ? <p className="dim">Thinking…</p> : <div className="grid g2" style={{ marginTop: 12 }}>
              <div><h3>Imported personality profile</h3><pre>{JSON.stringify(pv.imported_profile_expectation, null, 2) || "—"}</pre></div>
              <div><h3>AELIO reconstructed response</h3><pre>{pv.aelio_response.text}</pre><div className="dim small">{pv.aelio_response.note}</div>
                <div className="row" style={{ marginTop: 8 }}>{[["familiar", "Sounds familiar"], ["close", "Close, but needs adjustments"], ["not_right", "Doesn't sound right"]].map(([k, l]) => <button key={k} className={pv.rated === k ? "gold-btn sm" : "dark-btn sm"} onClick={() => rate(k)}>{l}</button>)}</div></div></div>)}
          </div>
        </div>
      </div>
    </div>);
}

/* ---------------------------------------------------------------- import */
export function MyImport() {
  const [method, setMethod] = useState("paste"); const [text, setText] = useState(""); const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false); const [keep, setKeep] = useState(0); const [prop, setProp] = useState<any>(null);
  const [err, setErr] = useState<any>(null); const [busy, setBusy] = useState(false); const [name, setName] = useState(""); const [voice, setVoice] = useState("aelio-voice-groove");
  const [promptTxt, setPromptTxt] = useState("");
  useEffect(() => { api("/api/transfer/prompt").then((d: any) => setPromptTxt(d.prompt)).catch(() => {}); }, []);
  async function parse() {
    setErr(null); setBusy(true);
    try {
      const fs = await Promise.all(files.map(f => new Promise<any>((res, rej) => { const r = new FileReader(); r.onload = () => res({ name: f.name, data_b64: String(r.result).split(",")[1] }); r.onerror = rej; r.readAsDataURL(f); })));
      const p: any = await post("/api/my/import/parse", { method, text, files: fs, consent, keep_days: keep });
      setProp(p); setName(p.profile.name || "");
    } catch (e: any) { setErr(e); }
    setBusy(false);
  }
  async function save() { try { const r: any = await post("/api/my/import/save", { proposal: prop, name, voice_id: voice }); go(`/brain/my/agents/${r.agent_id}`); } catch (e: any) { setErr(e); } }
  const steps = ["Choose", "Review", "Save"]; const cur = prop ? 1 : 0;
  return (
    <div className="grid">
      <div><div className="eyebrow">Agent Transfer</div><h1>Bring your agent.</h1><p className="sub">Same familiar energy. A new home in AELIO.</p>
        <div className="steps">{steps.map((s, i) => <span key={s} className={i <= cur ? "on" : ""}>{i + 1}. {s}</span>)}</div></div>
      <UsageNotice err={err} onRetry={() => setErr(null)} />
      {!prop ? <div className="grid g2">
        <div className="card">
          <div className="tabs">{[["paste", "Paste a profile"], ["file", "Upload a file"], ["history", "Import history"], ["manual", "Create from scratch"]].map(([k, l]) => <button key={k} className={method === k ? "on" : ""} onClick={() => setMethod(k)}>{l}</button>)}</div>
          {method === "paste" && <><label>Paste what your current AI wrote about itself</label><textarea rows={12} value={text} onChange={(e: any) => setText(e.target.value)} placeholder="## Preferred name&#10;Nova&#10;&#10;## Personality&#10;…" /></>}
          {(method === "file" || method === "history") && <>
            <label>{method === "history" ? "Conversation export (JSON, or a ZIP containing it)" : "TXT, Markdown, JSON, PDF, DOCX, or a ZIP of them (max 10 MB)"}</label>
            <div className="drop" onDragOver={(e: any) => e.preventDefault()} onDrop={(e: any) => { e.preventDefault(); setFiles([...e.dataTransfer.files].slice(0, 5)); }}>
              <input type="file" multiple accept=".txt,.md,.markdown,.json,.pdf,.docx,.zip" onChange={(e: any) => setFiles([...e.target.files].slice(0, 5))} />
              <span>{files.length ? files.map(f => f.name).join(", ") : "Drop files here or choose them"}</span></div>
            {method === "history" && <label className="mem"><input type="checkbox" checked={consent} onChange={(e: any) => setConsent(e.target.checked)} /><span>I consent to AELIO processing this conversation history to build a profile. Nothing is remembered until I review it, and it is never used to train AELIO.</span></label>}
            <label>Keep the original file?</label><select value={keep} onChange={(e: any) => setKeep(+e.target.value)}><option value={0}>No, delete it after reading (recommended)</option><option value={7}>Keep encrypted for 7 days</option><option value={30}>Keep encrypted for 30 days</option></select>
          </>}
          {method === "manual" ? <p>Prefer to start fresh? <A href="/brain/my/agents?new=1">Create a new agent</A> with your own personality, voice and specialties.</p> :
            <div className="row" style={{ marginTop: 12 }}><button className="gold-btn" disabled={busy || (method === "paste" ? text.length < 20 : !files.length) || (method === "history" && !consent)} onClick={parse}>{busy ? "Reading…" : "Build my agent profile"}</button></div>}
        </div>
        <div className="card"><h2>Ask your current AI to introduce itself</h2>
          <ol className="dim small"><li>Copy this prompt.</li><li>Paste it into your current AI assistant.</li><li>Copy its response or download the permitted export.</li><li>Come back here and paste or upload it.</li><li>Review your reconstructed agent.</li><li>Start talking.</li></ol>
          <div className="row"><button className="dark-btn sm" onClick={() => navigator.clipboard.writeText(promptTxt)}>Copy prompt</button></div>
          <pre style={{ maxHeight: 300 }}>{promptTxt || "Loading…"}</pre>
          <p className="dim small">Other providers may not offer exports. A pasted text answer works fine.</p></div>
      </div> : <div className="grid g2">
        <div className="card"><h2>Proposed agent profile</h2><p className="dim small">Built by {prop.performer.replace("deterministic:", "AELIO's deterministic extractor ")}. Nothing is saved until you click Save. {prop.credits_charged ? `${prop.credits_charged} credits used.` : ""}</p>
          <label>Agent name</label><input value={name} onChange={(e: any) => setName(e.target.value)} />
          <label>Voice</label><select value={voice} onChange={(e: any) => setVoice(e.target.value)}>{VOICES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
          <h3>What AELIO found</h3>
          {Object.entries(prop.profile).length ? Object.entries(prop.profile).map(([k, v]: any) => <div key={k} className="kvrow"><span className="dim">{k.replace(/_/g, " ")}</span><span>{Array.isArray(v) ? v.join(" · ") : String(v).slice(0, 400)}</span></div>) : <Empty>No profile fields recognised. You can still save and edit by hand.</Empty>}
          {prop.stats && <div className="dim small" style={{ marginTop: 8 }}>{Object.entries(prop.stats).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ")}</div>}
        </div>
        <div className="card"><h2>Choose what it remembers</h2><p className="dim small">Untick anything you don't want kept. Instruction-like text and contact details start unticked.</p>
          {prop.memories.length ? prop.memories.map((m: any, i: number) => <label key={m.id} className="mem"><input type="checkbox" checked={m.include} onChange={(e: any) => { const ms = [...prop.memories]; ms[i] = { ...m, include: e.target.checked }; setProp({ ...prop, memories: ms }); }} />
            <span><span>{m.text}</span><span className="dim small"> · {m.category} · {m.source}</span>{m.flags.map((f: string) => <Badge key={f} kind="warn">{f}</Badge>)}</span></label>) : <Empty>No memories proposed.</Empty>}
          <div className="row" style={{ marginTop: 12 }}><button className="gold-btn" onClick={save}>Save agent</button><button className="dark-btn" onClick={() => setProp(null)}>Start over</button></div>
          <button className="ghost sm" onClick={async () => { const m = prompt("What went wrong with this import?"); if (m) await post("/api/my/report", { area: "agent_transfer", message: m }); }}>Report a problem</button>
        </div>
      </div>}
    </div>);
}

/* ---------------------------------------------------------------- chat */
const providerLabel = (_message:any) => 'AELIO · AI-generated response';

function Disclosure({ info, onAccept }: any) {
  const [busy, setBusy] = useState(false);
  return (<div className="card disclosure">
    <div className="eyebrow">Before you chat</div><h2>{info.disclosure.title}</h2>
    <p>{info.disclosure.text}</p>
    <div className="row"><button className="gold-btn" disabled={busy} onClick={async () => { setBusy(true); try { await put("/api/my/settings", { external_ai_consent: true }); onAccept(); } finally { setBusy(false); } }}>I understand, start chatting</button></div>
    <div className="dim small">You can withdraw this any time in Settings. Withdrawing stops new messages from being processed by external AI services.</div>
  </div>);
}

export function MyChat({ agentId }: any) {
  const agents = useLoad<any>("/api/my/agents");
  const ai = useLoad<any>("/api/my/ai");
  const aid = agentId || agents.data?.agents?.find((a: any) => a.is_default)?.id;
  const [cid, setCid] = useState<string | null>(new URLSearchParams(location.search).get("c"));
  const [msgs, setMsgs] = useState<any[]>([]);
  const key = "aelio_draft_" + (aid || "x");
  const [draft, setDraft] = useState(() => { try { return sessionStorage.getItem(key) || ""; } catch { return ""; } });
  const [err, setErr] = useState<any>(null); const [busy, setBusy] = useState(false); const [usage, setUsage] = useState<any>(null);
  const [persona, setPersona] = useState<string>("");
  const stop = useRef<AbortController | null>(null);
  const end = useRef<any>(null);
  useEffect(() => { if (cid) api(`/api/my/conversations/${cid}`).then((c: any) => setMsgs(c.messages)).catch(() => {}); }, [cid]);
  useEffect(() => { try { sessionStorage.setItem(key, draft); } catch { /* ignore */ } }, [draft]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);
  useEffect(() => { if (ai.data?.personality_id) setPersona(ai.data.personality_id); }, [ai.data]);
  const patchLast = (f: (m: any) => any) => setMsgs(ms => ms.map((m, i) => i === ms.length - 1 ? f(m) : m));
  async function send() {
    if (!draft.trim() || !aid || busy) return;
    setErr(null); setBusy(true); const text = draft; setDraft("");
    setMsgs(m => [...m, { role: "user", text }, { role: "assistant", text: "", pending: true }]);
    const ctl = new AbortController(); stop.current = ctl;
    try {
      await streamPost(`/api/my/agents/${aid}/chat/stream`, { message: text, conversation_id: cid, personality_id: persona || undefined }, (ev: any) => {
        if (ev.type === "meta") patchLast(m => ({ ...m, provider: ev.provider, model: ev.model }));
        else if (ev.type === "delta") patchLast(m => ({ ...m, text: m.text + ev.text }));
        else if (ev.type === "notice") patchLast(m => ({ ...m, notice: ev.text }));
        else if (ev.type === "done") { patchLast(m => ({ ...m, pending: false, provider: ev.provider, model: ev.model, credits: ev.credits_charged })); setCid(ev.conversation_id); setUsage(ev.usage); }
        else if (ev.type === "error") { patchLast(m => ({ ...m, pending: false, failed: ev.message })); if (ev.conversation_id) setCid(ev.conversation_id); setUsage(ev.usage); }
      }, ctl.signal);
      patchLast(m => m.pending ? { ...m, pending: false, stopped: true } : m);
    } catch (e: any) {
      setMsgs(m => m.slice(0, -2)); setDraft(text); setErr(e);   // refused before sending: nothing was charged, text stays
      if (e?.data?.code === "consent_required") ai.reload();
    }
    stop.current = null; setBusy(false);
  }
  const agent = agents.data?.agents?.find((a: any) => a.id === aid);
  const info = ai.data;
  const needsConsent = info && info.provider.external && !info.consent_at;
  return (
    <div className="chat">
      <div className="spread"><div><div className="eyebrow">Conversation</div><h1>{agent?.name || "Chat"}</h1></div>
        <div className="row">
          {info && agent?.kind !== "main_pal" && <select aria-label="Personality" style={{ width: "auto" }} value={persona} onChange={async (e: any) => { setPersona(e.target.value); try { await put("/api/my/settings", { personality_id: e.target.value }); } catch { /* keep local choice */ } }}>
            <option value="">Agent's own style</option>{info.personalities.filter((p: any) => p.id !== "default").map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
          <select aria-label="Agent" style={{ width: "auto" }} value={aid || ""} onChange={(e: any) => { setCid(null); setMsgs([]); go(`/brain/my/chat/${e.target.value}`); }}>{(agents.data?.agents || []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div></div>
      {info?.paused && <div className="notice">AELIO's AI features are paused right now. Nothing will be charged.</div>}
      {info && !info.provider.configured && <div className="notice">AI chat isn't connected yet on this server. Messages won't be sent and nothing is charged.</div>}
      {needsConsent ? <Disclosure info={info} onAccept={() => ai.reload()} /> : <>
      {info?.provider.external && <div className="dim small">AELIO responses are AI-generated and may be inaccurate. Review the AI disclosure for processing and privacy details.</div>}
      <div className="msgs" aria-live="polite">{msgs.length ? msgs.map((m, i) => <div key={i} className={"msg " + m.role + (m.failed ? " failed" : "")}>
        <div>{m.text || (m.pending ? <span className="dim">Thinking…</span> : null)}</div>
        {m.role === "assistant" && <div className="dim small">{providerLabel(m)}{m.credits ? ` · ${m.credits} credit${m.credits > 1 ? "s" : ""}` : ""}{m.notice ? ` · ${m.notice}` : ""}{m.stopped ? " · stopped" : ""}{(m.failed || m.status === "error") ? " · reply failed, not charged" : ""}</div>}
      </div>) : <Empty>Say hello to start.</Empty>}<div ref={end} /></div>
      <UsageNotice err={err} onRetry={() => setErr(null)} />
      <div className="composer"><textarea rows={2} value={draft} placeholder="Message…" onChange={(e: any) => setDraft(e.target.value)} onKeyDown={(e: any) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        {busy ? <button className="dark-btn" onClick={() => stop.current?.abort()}>Stop</button> : <button className="gold-btn" disabled={!draft.trim()} onClick={send}>Send</button>}</div>
      </>}
      {usage && !usage.exempt && <div className="dim small">{usage.window.remaining} allowance left · {usage.balances.purchased + usage.balances.promo} credits</div>}
    </div>);
}

/* ---------------------------------------------------------------- history */
export function MyHistory() {
  const { data, reload } = useLoad<any>("/api/my/conversations");
  return (<div className="grid"><div><div className="eyebrow">My AELIO</div><h1>History</h1></div>
    <div className="card">{data?.conversations?.length ? <table><tbody>{data.conversations.map((c: any) => <tr key={c.id}><td><A href={`/brain/my/chat/${c.agent_id}?c=${c.id}`}>{c.title}</A></td><td className="dim">{c.agent}</td><td className="dim">{ago(c.updated_at)}</td><td><button className="ghost sm" onClick={async () => { await del(`/api/my/conversations/${c.id}`); reload(); }}>Delete</button></td></tr>)}</tbody></table> : <Empty>No conversations yet.</Empty>}</div></div>);
}

/* ---------------------------------------------------------------- usage */
export function MyUsage() {
  const { data } = useLoad<any>("/api/my/usage");
  if (!data) return null;
  return (<div className="grid"><div><div className="eyebrow">My AELIO</div><h1>Usage Overview</h1></div>
    <div className="card"><Meter u={data.overview} /></div>
    <div className="grid g2">
      <div className="card"><h2>What things cost</h2><table><tbody>{data.costs.map((c: any) => <tr key={c.op}><td>{c.note}</td><td className="mono">{c.credits} / {c.unit}</td></tr>)}</tbody></table>
        <p className="dim small">Plan allowance is used first, then promotional credits, then purchased credits. Expensive tasks show an estimate first. Unused reserved credits are returned automatically.</p></div>
      <div className="card"><h2>Recent usage</h2>{data.recent.length ? <table><tbody>{data.recent.map((r: any, i: number) => <tr key={i}><td className="dim">{ts(r.ts)}</td><td>{r.op.replace(/_/g, " ")}</td><td className="mono">{r.credits}</td><td><Badge>{r.source}</Badge></td></tr>)}</tbody></table> : <Empty>No usage yet.</Empty>}</div>
    </div></div>);
}

/* ---------------------------------------------------------------- wallet */
export function MyWallet() {
  const { data, reload } = useLoad<any>("/api/my/wallet");
  const qs = new URLSearchParams(location.search);
  const [pay, setPay] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => {
    const pid = qs.get("payment"); if (qs.get("checkout") !== "success" || !pid) return;
    let n = 0; const t = setInterval(async () => { n++; try { const p: any = await api(`/api/my/payments/${pid}`); setPay(p); if (p.status !== "pending" || n > 20) { clearInterval(t); reload(); } } catch { clearInterval(t); } }, 1500);
    return () => clearInterval(t);
  }, []);
  async function buy(id: string) { setErr(""); try { const r: any = await post("/api/my/checkout", { package_id: id, return_to: qs.get("return") || "/brain/my/wallet" }); location.href = r.url; } catch (e: any) { setErr(e.message); } }
  if (!data) return null;
  const o = data.overview;
  return (<div className="grid"><div><div className="eyebrow">My AELIO</div><h1>My Credit Wallet</h1></div>
    {qs.get("checkout") === "success" && <div className={pay?.status === "paid" ? "notice good" : "notice"}>{pay?.status === "paid" ? <><b>You're ready to keep creating.</b> {pay.credits} AELIO Credits have been added to your wallet. {pay.return_to && <A href={pay.return_to}>Continue →</A>}</> : "Confirming your payment with Stripe… Credits are added only after Stripe confirms it."}</div>}
    {qs.get("checkout") === "canceled" && <div className="notice">Checkout canceled. Nothing was charged.</div>}
    <div className="grid g3">
      <div className="card"><div className="dim">Purchased credits</div><div className="stat">{o.exempt ? "∞" : o.balances.purchased}</div></div>
      <div className="card"><div className="dim">Promotional credits</div><div className="stat">{o.exempt ? "∞" : o.balances.promo}</div></div>
      <div className="card"><div className="dim">Plan allowance left</div><div className="stat">{o.exempt ? "∞" : o.window.remaining}<small> / {o.window.allowance}</small></div></div>
    </div>
    <div className="card" id="buy"><h2>Buy Credits</h2><Err e={err} />
      {o.exempt ? <p>This account has unlimited usage. No credits are needed.</p> : !data.payments.configured ? <p className="dim">Credit purchases aren't available yet.</p> : !data.packages.length ? <p className="dim">No credit packages are on sale right now.</p> :
        <div className="grid g4">{data.packages.map((p: any) => <div key={p.id} className="item pkg"><b>{p.name}</b><div className="stat">{p.credits}<small> credits</small></div><div>${(p.price_cents / 100).toFixed(2)}{p.list_price_cents !== p.price_cents && <s className="dim"> ${(p.list_price_cents / 100).toFixed(2)}</s>}</div><button className="gold-btn sm" onClick={() => buy(p.id)}>Buy</button></div>)}</div>}
      {data.payments.mode === "test" && <p className="dim small">Payments are in test mode. No real money moves.</p>}
      <p className="dim small">{data.policy.order} {data.policy.expiry} {data.policy.auto_charge} Buying credits doesn't change your plan or unlock plan features.</p></div>
    <div className="grid g2">
      <div className="card"><h2>Transaction History</h2>{data.transactions.length ? <table><tbody>{data.transactions.map((t: any) => <tr key={t.id}><td className="dim">{ts(t.ts)}</td><td>{t.type.replace(/_/g, " ")}</td><td><Badge>{t.bucket}</Badge></td><td className="mono" style={{ color: t.amount < 0 ? "#ff9a8a" : "#7be0a6" }}>{t.amount > 0 ? "+" : ""}{t.amount}</td></tr>)}</tbody></table> : <Empty>No transactions yet.</Empty>}</div>
      <div className="card"><h2>Purchases & receipts</h2>{data.purchases.length ? <table><tbody>{data.purchases.map((p: any) => <tr key={p.id}><td className="mono dim">{p.id}</td><td>{p.credits} credits</td><td>${(p.amount_cents / 100).toFixed(2)}</td><td><Status s={p.status} /></td></tr>)}</tbody></table> : <Empty>No purchases yet.</Empty>}</div>
    </div></div>);
}

export function MyBilling({ me }: any) {
  const { data } = useLoad<any>("/api/my/wallet");
  return (<div className="grid"><div><div className="eyebrow">My AELIO</div><h1>Billing Settings</h1></div>
    <div className="card"><div className="kv"><div>Account</div><div>{me.email}</div><div>Plan</div><div>{data?.overview.plan_name}{data?.overview.exempt ? " · unlimited" : ""}</div>
      <div>Payment provider</div><div>Stripe hosted checkout. AELIO never sees or stores your card.</div><div>Automatic charges</div><div>Never</div>
      <div>Credit expiry</div><div>{data?.policy.expiry}</div></div>
      <p className="dim small">Plan upgrades aren't open yet. AELIO Live pricing is proposed at $14.99/month and isn't billed.</p></div></div>);
}
