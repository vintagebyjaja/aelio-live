import {consumerMessage} from "../shared/experience.js";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, ApiError, currentUser, isDev, post, setDevToken, signOut, supa } from "./api";
import { AgentTransferAdmin, CreditsBilling, UsageAccess } from "./founder";
import { BrainGame } from "./game";
import { Core } from "./core";
import { WebDesigner } from "./designer";
import { Engine } from "./engine";
import { Intelligence } from "./intelligence";
import { MySecurity, StudioGate, StudioSecurity } from "./security";
import { CodeStudio, NativeLab, Overview } from "./pages1";
import { AgentCampus, LiveLab, Operations, QualityLab, Settings, VisionLab, VoiceLab } from "./pages2";
import { A, go, MyAgent, MyAgents, MyBilling, MyChat, MyHistory, MyHome, MyImport, MyUsage, MyWallet } from "./portal";
import { Badge, Err } from "./ui";
import "./styles.css";

const STUDIO: [string, string, any][] = [
  ["", "Overview", Overview], ["engine", "Engine", Engine], ["core", "AELIO Core", Core], ["web-designer", "Web Designer", WebDesigner], ["intelligence", "Intelligence", Intelligence], ["native-lab", "Native Lab", NativeLab], ["code-studio", "Code Studio", CodeStudio], ["quality-lab", "Quality Lab", QualityLab],
  ["voice-lab", "Voice Lab", VoiceLab], ["vision-lab", "Vision Lab", VisionLab], ["live-lab", "Live Lab", LiveLab], ["agent-campus", "Agent Campus", AgentCampus],
  ["operations", "Operations", Operations], ["credits", "Credits & Billing", CreditsBilling], ["usage-access", "Usage & Access", UsageAccess],
  ["agent-transfer", "Agent Transfer", AgentTransferAdmin], ["security", "Security", StudioSecurity], ["settings", "Settings", Settings],
];
const MY: [string, string][] = [["", "Home"], ["agents", "My Agents"], ["import", "Import an Agent"], ["chat", "Chat"], ["history", "History"], ["usage", "Usage"], ["wallet", "Credit Wallet"], ["billing", "Billing Settings"], ["security", "Security"]];

function usePath() {
  const [p, setP] = useState(location.pathname);
  useEffect(() => { const h = () => setP(location.pathname); addEventListener("popstate", h); return () => removeEventListener("popstate", h); }, []);
  return p;
}

/* ---------------------------------------------------------------- sign in */
function SignIn({ onDone, note }: any) {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [code, setCode] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  // Finish Google sign-in after the redirect back from Supabase (?code=...).
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("code");
    if (!supa || !c) return;
    history.replaceState(null, "", location.pathname);
    setBusy(true);
    supa.exchangeCode(c).then(() => onDone(), (e: any) => { setErr(e.message); setBusy(false); });
  }, []);
  async function fb(kind: "google" | "email" | "reset") {
    setBusy(true); setErr(""); setMsg("");
    try {
      if (isDev()) { const r: any = await post("/api/auth/login", { email, password: pw, code }); setDevToken(r.token); }
      else if (supa) {
        const back = location.origin + location.pathname;
        if (kind === "google") { location.assign(await supa.oauthUrl("google", back)); return; }
        if (kind === "reset") { await supa.resetPassword(email, location.origin + "/settings/security"); setMsg("If that email has an account, a reset link is on its way."); setBusy(false); return; }
        if (mode === "up") {
          const r = await supa.signUp(email, pw, back);
          if (r.confirmEmail) { setMsg("Check your email to confirm your account, then sign in."); setBusy(false); return; }
        } else await supa.signInWithPassword(email, pw);
      }
      else { throw new Error("Sign-in needs a moment. Please try again shortly."); }
      onDone();
    } catch (e: any) { setErr(consumerMessage(e.code,e.message)); }
    setBusy(false);
  }
  return (
    <div className="signin card">
      <div className="eyebrow">Brain</div><h2>Sign in to AELIO</h2>
      {note && <p className="dim small">{note}</p>}
      {!isDev() && <button className="gold-btn wide" disabled={busy} onClick={() => fb("google")}>Continue with Google</button>}
      {!isDev() && <div className="or">or</div>}
      <label htmlFor="si-e">Email</label><input id="si-e" autoComplete="username" value={email} onChange={(e: any) => setEmail(e.target.value)} />
      <label htmlFor="si-p">Password</label><input id="si-p" type="password" autoComplete="current-password" value={pw} onChange={(e: any) => setPw(e.target.value)} />
      {isDev() && <><label htmlFor="si-c">Authenticator code (dev)</label><input id="si-c" inputMode="numeric" value={code} onChange={(e: any) => setCode(e.target.value)} /></>}
      <button className="dark-btn wide" disabled={busy || !email || !pw} onClick={() => fb("email")}>{mode === "up" ? "Create account" : "Sign in"}</button>
      {supa && <p className="small dim">
        {mode === "in" ? <>New here? <button className="link" onClick={() => location.assign("/account/?mode=signup")}>Create an account</button> · <button className="link" disabled={!email} onClick={() => location.assign("/account/?mode=recover")}>Forgot password</button></>
          : <>Have an account? <button className="link" onClick={() => setMode("in")}>Sign in</button></>}
        <br />The same account works on aelio.live and mypathd.com.</p>}
      {msg && <p className="small" role="status">{msg}</p>}
      <Err e={err} />
    </div>);
}

/* ---------------------------------------------------------------- /brain : game or route by role */
function BrainEntry() {
  const [state, setState] = useState<any>({ loading: true });
  async function check() {
    setState({ loading: true });
    const u = await currentUser().catch(() => null);
    if (!u) return setState({ signedIn: false });
    try {
      const me: any = await api("/api/me");
      if (me.destination === "studiobrain") return go("/studiobrain/");
      if (me.destination === "my") return go("/brain/my/");
      setState({ signedIn: true, visitor: true, email: me.email });
    } catch (e: any) { setState({ signedIn: true, offline: e.status === 0, error: e.message }); }
  }
  useEffect(() => { check(); }, []);
  return (
    <div className="brain-entry">
      <BrainGame />
      <aside>
        {state.loading ? <p className="dim">Checking your account…</p>
          : !state.signedIn ? <SignIn onDone={check} note="Have an AELIO account? Sign in to reach your AELIO. Everyone else, enjoy the game." />
          : <div className="card"><div className="eyebrow">Brain</div>
              {state.visitor ? <><h2>Almost there.</h2><p>Open Chat to talk to AELIO, or Account to manage your profile and recovery.</p></>
                : <><h2>Can't reach AELIO</h2><p>{state.error}</p><p><a href="/account/">Open your account dashboard</a> · <a href="/chat/">Open Chat</a></p><button className="dark-btn" onClick={check}>Try again</button></>}
              <button className="ghost" onClick={async () => { await signOut(); check(); }}>Sign out</button></div>}
      </aside>
    </div>);
}

/* ---------------------------------------------------------------- guards */
function useMe(require: "member" | "founder") {
  const [me, setMe] = useState<any>(null); const [err, setErr] = useState<any>(null);
  const load = async () => {
    const u = await currentUser().catch(() => null);
    if (!u) return go("/brain/");
    try {
      const m: any = await api("/api/me");
      if (require === "founder" && m.role !== "founder") return go(m.role === "member" ? "/brain/my/" : "/brain/");
      if (require === "member" && !["member", "founder"].includes(m.role)) return go("/brain/");
      setMe(m);
    } catch (e: any) { setErr(e); }
  };
  useEffect(() => { load(); }, []);
  return { me, err, reload: load };
}

function Shell({ brand, nav, base, cur, me, children, extra }: any) {
  const [open, setOpen] = useState(false);
  return (
    <div className="app">
      <aside className={"side" + (open ? " open" : "")}>
        <div className="spread"><a href="/" className="brand">ΛEL<b>I</b>O<i>.</i></a><button className="ghost menu-t" aria-label="Menu" onClick={() => setOpen(!open)}>☰</button></div>
        <div className="brand-sub">{brand}</div>
        <nav className="nav" aria-label={brand}>{nav.map(([k, l]: any) => <A key={k} href={base + k + (k ? "" : "")} className={cur === k ? "on" : ""}><span className="dot" />{l}</A>)}</nav>
        {extra}
      </aside>
      <main className="main">
        <div className="top"><div className="row"><a href="/" className="dim small">← aelio.live</a></div>
          <div className="who"><span>{me.email}</span>{(me.perks || []).includes("founder_badge") && <Badge kind="gold">Founder</Badge>}{me.unlimited && <Badge kind="ok">unlimited</Badge>}<button className="ghost" onClick={async () => { await signOut(); go("/brain/"); }}>Sign out</button></div></div>
        {children}
      </main>
    </div>);
}

function MyApp({ path }: any) {
  const { me, err } = useMe("member");
  if (err) return <div className="center-pad"><Err e={err.message} /></div>;
  if (!me) return <div className="center-pad dim">Loading your AELIO…</div>;
  const rest = path.replace(/^\/brain\/my\/?/, "").split("/");
  const page = rest[0] || "";
  let body;
  if (page === "agents" && rest[1]) body = <MyAgent id={rest[1]} />;
  else if (page === "chat") body = <MyChat agentId={rest[1]} />;
  else body = ({ "": <MyHome />, agents: <MyAgents />, import: <MyImport />, history: <MyHistory />, usage: <MyUsage />, wallet: <MyWallet />, billing: <MyBilling me={me} />, security: <MySecurity me={me} /> } as any)[page] || <MyHome />;
  return <Shell brand="My AELIO" nav={MY} base="/brain/my/" cur={page} me={me}
    extra={me.role === "founder" ? <A href="/studiobrain/" className="dark-btn sm" >Open Studio Brain →</A> : null}>{body}</Shell>;
}

function Mfa({ me, onDone }: any) {
  const [code, setCode] = useState(""); const [err, setErr] = useState("");
  async function v() { setErr(""); try { await post("/api/auth/mfa", { code }); onDone(); } catch (e: any) { setErr(e.message); } }
  return (
    <div className="center-pad"><div className="signin card"><div className="eyebrow">Studio Brain</div><h2>Verify it's you</h2>
      {me.mfa === "enroll" ? <div className="notice"><b>Set up your authenticator (one time).</b> Add this key to Google Authenticator, Authy or 1Password, then enter the 6-digit code.<pre>{me.totp_secret}</pre><div className="dim small" style={{ wordBreak: "break-all" }}>{me.totp_uri}</div></div>
        : <p className="dim">Enter the 6-digit code from your authenticator app.</p>}
      <label htmlFor="mfa">Code</label><input id="mfa" inputMode="numeric" autoFocus value={code} onChange={(e: any) => setCode(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && v()} />
      <button className="gold-btn wide" disabled={code.length < 6} onClick={v}>Verify</button><Err e={err} /></div></div>);
}

function StudioApp({ path }: any) {
  const { me, err, reload } = useMe("founder");
  const [reverify, setReverify] = useState(false);
  if (err) return <div className="center-pad"><Err e={err.message} /></div>;
  if (!me) return <div className="center-pad dim">Opening Studio Brain…</div>;
  if (me.mfa !== "ok") return <Mfa me={me} onDone={reload} />;
  return <StudioGated path={path} me={me} reload={reload} reverify={reverify} setReverify={setReverify} />;
}

function StudioGated({ path, me, reload, reverify, setReverify }: any) {
  const [sec, setSec] = useState<any>(null); const [err, setErr] = useState<any>(null);
  const loadSec = () => api("/api/studio/security").then(setSec).catch(setErr);
  useEffect(() => { loadSec(); }, []);
  if (err) return <div className="center-pad"><Err e={err.message} /></div>;
  if (!sec) return <div className="center-pad dim">Checking Studio Brain security…</div>;
  if (sec.gate_enabled && (!sec.enrolled || sec.locked || !sec.unlocked)) return <StudioGate status={sec} onDone={loadSec} />;
  const key = path.replace(/^\/studiobrain\/?/, "").split("/")[0];
  const entry = STUDIO.find(s => s[0] === key) || STUDIO[0];
  const Page = entry[2];
  return (
    <Shell brand="Studio Brain" nav={STUDIO.map(([k, l]) => [k, l])} base="/studiobrain/" cur={entry[0]} me={me} extra={<><A href="/brain/my/" className="dark-btn sm">My AELIO →</A><A href="/chat/#ai-operations" className="dark-btn sm">Worker AI Operations →</A></>}>
      {!me.mfa_fresh && <div className="notice" style={{ marginBottom: 14 }}>Approving, publishing and changing secrets need a fresh code. <button className="ghost sm" onClick={() => setReverify(true)}>Re-verify</button></div>}
      {reverify && <Mfa me={{ mfa: "verify" }} onDone={() => { setReverify(false); reload(); }} />}
      <Page go={(p: string) => go("/studiobrain/" + (({ native: "native-lab", quality: "quality-lab", operations: "operations" } as any)[p] || ""))} me={{ ...me, mfa_fresh: me.mfa_fresh }} reverify={() => setReverify(true)} />
    </Shell>);
}

function App() {
  const path = usePath();
  if (path.startsWith("/studiobrain")) return <StudioApp path={path} />;
  if (path.startsWith("/brain/my")) return <MyApp path={path} />;
  return <BrainEntry />;
}

createRoot(document.getElementById("root")!).render(<App />);
