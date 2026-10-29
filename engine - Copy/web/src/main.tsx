import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, post, setCsrf } from "./api";
import { Login } from "./login";
import { CodeStudio, NativeLab, Overview } from "./pages1";
import { AgentCampus, LiveLab, Operations, QualityLab, Settings, VisionLab, VoiceLab } from "./pages2";
import { Badge } from "./ui";
import "./styles.css";

const NAV: [string, string][] = [
  ["overview", "Overview"], ["native", "Native Lab"], ["code", "Code Studio"], ["quality", "Quality Lab"],
  ["voice", "Voice Lab"], ["vision", "Vision Lab"], ["live", "Live Lab"], ["agents", "Agent Campus"],
  ["operations", "Operations"], ["settings", "Settings"],
];

function App() {
  const [me, setMe] = useState<any>(null);
  const [page, setPage] = useState<string>((location.hash.slice(1) || "overview"));
  const [reverify, setReverify] = useState(false);
  const [code, setCode] = useState(""); const [err, setErr] = useState("");

  const refresh = () => api("/api/auth/me").then((m: any) => { setMe(m); if (m.csrf) setCsrf(m.csrf); }).catch(() => setMe({ authenticated: false }));
  useEffect(() => { refresh(); const h = () => refresh(); window.addEventListener("aelio:unauth", h); return () => window.removeEventListener("aelio:unauth", h); }, []);
  useEffect(() => { const h = () => setPage(location.hash.slice(1) || "overview"); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
  const go = (p: string) => { location.hash = p; setPage(p); };

  if (!me) return <div className="login"><div className="muted">Loading…</div></div>;
  if (!me.authenticated || !me.mfa_complete) return <Login me={me} onDone={refresh} />;

  async function doReverify() { setErr(""); try { await post("/api/auth/mfa", { code }); setReverify(false); setCode(""); refresh(); } catch (e: any) { setErr(e.message); } }
  async function logout() { await post("/api/auth/logout"); refresh(); }

  const Page: any = { overview: Overview, native: NativeLab, code: CodeStudio, quality: QualityLab, voice: VoiceLab, vision: VisionLab, live: LiveLab, agents: AgentCampus, operations: Operations, settings: Settings }[page] || Overview;
  return (
    <div className="app">
      <aside className="side">
        <div className="brand">ΛEL<b>I</b>O</div>
        <div className="brand-sub">Native Studio 1.0</div>
        <nav className="nav" aria-label="Studio sections">
          {NAV.map(([k, label]) => <button key={k} className={page === k ? "on" : ""} aria-current={page === k ? "page" : undefined} onClick={() => go(k)}><span className="dot" />{label}</button>)}
        </nav>
      </aside>
      <main className="main">
        <div className="top">
          <div className="row"><Badge kind="gold">Private</Badge><span className="dim" style={{ fontSize: 12 }}>studio.aelio.live · founder access only</span></div>
          <div className="who">
            <span>{me.email}</span>
            {me.mfa_fresh ? <Badge kind="ok">MFA fresh</Badge> : <button className="ghost" onClick={() => setReverify(true)}>Re-verify MFA</button>}
            <button className="ghost" onClick={logout}>Sign out</button>
          </div>
        </div>
        {reverify && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row"><span className="muted">Authenticator code (needed to approve, publish or change secrets)</span><input style={{ width: 130 }} inputMode="numeric" value={code} onChange={(e: any) => setCode(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && doReverify()} /><button className="primary" onClick={doReverify}>Verify</button><button className="ghost" onClick={() => setReverify(false)}>Cancel</button></div>
            {err && <div className="err">{err}</div>}
          </div>
        )}
        <Page go={go} me={me} reverify={() => setReverify(true)} />
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
