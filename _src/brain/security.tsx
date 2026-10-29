import { useEffect, useState } from "react";
import { ago, api, post } from "./api";
import { Badge, Empty, Err, useLoad } from "./ui";

const BLANK = Array.from({ length: 5 }, () => ({ question: "", answer: "" }));
const until = (t: number) => new Date(t * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function QuestionsForm({ submitLabel, onSubmit, intro }: any) {
  const [qs, setQs] = useState(BLANK.map(x => ({ ...x }))); const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const ready = qs.every(q => q.question.trim().length >= 5 && q.answer.trim().length >= 2) && pw.length >= 12 && pw === pw2;
  async function go() { setErr(""); setBusy(true); try { await onSubmit(qs, pw); } catch (e: any) { setErr(e.message); } setBusy(false); }
  return (<div className="grid">
    {intro}
    {qs.map((q, i) => <div key={i} className="grid g2">
      <div><label>Question {i + 1}</label><input value={q.question} placeholder="Write your own question" onChange={(e: any) => setQs(qs.map((x, j) => j === i ? { ...x, question: e.target.value } : x))} /></div>
      <div><label>Answer</label><input type="password" autoComplete="off" value={q.answer} onChange={(e: any) => setQs(qs.map((x, j) => j === i ? { ...x, answer: e.target.value } : x))} /></div></div>)}
    <div className="dim small">Answers ignore capital letters and extra spaces (Groove99 = groove99), but numbers and symbols must match exactly. They're stored only as one-way hashes.</div>
    <div className="grid g2"><div><label>Studio Brain passphrase (12+ characters, case-sensitive)</label><input type="password" autoComplete="new-password" value={pw} onChange={(e: any) => setPw(e.target.value)} /></div>
      <div><label>Repeat passphrase</label><input type="password" autoComplete="new-password" value={pw2} onChange={(e: any) => setPw2(e.target.value)} /></div></div>
    <button className="gold-btn" disabled={!ready || busy} onClick={go}>{busy ? "Saving…" : submitLabel}</button><Err e={err} />
  </div>);
}

/** Shown before Studio Brain opens: first-time setup, the challenge, or the locked screen. */
export function StudioGate({ status, onDone }: any) {
  const [ch, setCh] = useState<any>(null); const [ans, setAns] = useState<string[]>([]); const [pw, setPw] = useState("");
  const [err, setErr] = useState<any>(null); const [sent, setSent] = useState("");
  async function newChallenge() { setErr(null); try { const c: any = await post("/api/studio/security/challenge"); setCh(c); setAns(c.questions.map(() => "")); } catch (e: any) { setErr(e); } }
  useEffect(() => { if (status.enrolled && !status.locked) newChallenge(); }, [status.enrolled, status.locked]);
  async function unlock() {
    setErr(null);
    try { await post("/api/studio/security/unlock", { challenge_id: ch.challenge_id, answers: ans, passphrase: pw }); onDone(); }
    catch (e: any) { setErr(e); setPw(""); if (e.data?.code === "studio_locked_out") onDone(); else newChallenge(); }
  }
  async function recover() { setErr(null); try { await post("/api/studio/security/recovery/request"); setSent("Recovery requested. A notice for both of your email addresses was recorded (it's emailed once email sending is connected). Sign in to your personal AELIO account and open Security to continue."); } catch (e: any) { setErr(e); } }
  let body;
  if (!status.enrolled) body = <>
    <h2>Set up Studio Brain security</h2>
    <p className="dim">One time. Studio Brain will ask for your passphrase and two of these questions each time you open it.</p>
    <QuestionsForm submitLabel="Save and open Studio Brain" onSubmit={async (qs: any, p: string) => { await post("/api/studio/security/enroll", { questions: qs, passphrase: p }); onDone(); }} />
    <p className="dim small">Next, in Studio Brain → Security: link your personal account for emergency recovery and test it.</p></>;
  else if (status.locked) body = <>
    <h2>Studio Brain is locked</h2>
    <p>{status.hard_locked ? "Too many wrong answers. Studio Brain stays locked until emergency recovery." : `Too many wrong answers. Try again after ${status.locked_until ? until(status.locked_until) : "the lock ends"}, or use emergency recovery.`}</p>
    {status.recovery.active ? <button className="gold-btn" onClick={recover}>Request Emergency Recovery</button>
      : <div className="notice">Emergency recovery isn't set up yet, so it can't be used. Wait for the lock to end.</div>}
    {sent && <div className="notice good" style={{ marginTop: 10 }}>{sent}</div>}</>;
  else body = <>
    <h2>Studio Brain challenge</h2>
    {ch ? <div className="grid">{ch.questions.map((q: string, i: number) => <div key={i}><label>{q}</label><input type="password" autoComplete="off" value={ans[i] || ""} onChange={(e: any) => setAns(ans.map((a, j) => j === i ? e.target.value : a))} /></div>)}
      <div><label>Studio Brain passphrase</label><input type="password" autoComplete="current-password" value={pw} onChange={(e: any) => setPw(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && unlock()} /></div>
      <button className="gold-btn wide" disabled={!pw || ans.some(a => !a)} onClick={unlock}>Open Studio Brain</button>
      <div className="dim small">{status.attempts_left} attempt{status.attempts_left === 1 ? "" : "s"} left before Studio Brain locks.</div></div> : <p className="dim">Preparing your challenge…</p>}</>;
  return (<div className="center-pad"><div className="signin card" style={{ maxWidth: status.enrolled ? 440 : 760 }}>
    <div className="eyebrow">Studio Brain</div>{body}
    {err && <Err e={err.message + (err.data?.attempts_left != null ? ` ${err.data.attempts_left} left.` : "")} />}</div></div>);
}

/** Studio Brain → Security: setup checklist, recovery linking, change questions, tamper-evident log. */
export function StudioSecurity({ me, reverify }: any) {
  const s = useLoad<any>("/api/studio/security"); const ev = useLoad<any>("/api/studio/security/events");
  const [err, setErr] = useState(""); const [change, setChange] = useState(false);
  if (!s.data) return <><h1>Security</h1><Err e={s.error} /></>;
  const d = s.data, r = d.recovery;
  const act = async (fn: () => Promise<any>) => { setErr(""); try { await fn(); s.reload(); ev.reload(); } catch (x: any) { setErr(x.message); } };
  const steps: [string, boolean][] = [["Five security questions and answers", d.enrolled], ["Studio Brain passphrase", d.enrolled], ["Authenticator app (MFA) on jaja@vybr8.live", true],
    [`Recovery account linked (${r.account || "not configured"})`, r.linked], ["Recovery account's own authenticator enrolled", r.account_mfa], ["Recovery tested", r.tested]];
  return (<div className="grid">
    <div><h1>Security</h1><p className="sub">Studio Brain belongs only to jaja@vybr8.live. Your personal account is the emergency-recovery account and never gets Studio Brain access.</p></div>
    <Err e={err} />
    <div className="card"><h2>Setup checklist</h2>
      <table><tbody>{steps.map(([t, ok]) => <tr key={t}><td>{t}</td><td>{ok ? <Badge kind="ok">done</Badge> : <Badge kind="warn">to do</Badge>}</td></tr>)}</tbody></table>
      <p className="dim small">Emergency recovery turns on only when every step is done: {r.active ? <b>active</b> : <b>not active yet</b>}.</p>
      {!r.linked && <div className="row"><button className="gold-btn" onClick={() => act(async () => { if (!me.mfa_fresh) { reverify(); throw new Error("Enter a fresh authenticator code, then link again."); } await post("/api/studio/security/recovery/link"); })}>Link my personal account for recovery</button>
        <span className="dim small">Sign in once with vintagebyjaja@gmail.com first.</span></div>}
      {r.linked && !r.tested && <div className="notice" style={{ marginTop: 8 }}>Now sign in to your personal account → My AELIO → Security to enroll its authenticator and run the recovery test.</div>}
    </div>
    <div className="card"><div className="spread"><h2>Questions and passphrase</h2><div className="row">
      <button className="dark-btn" onClick={() => setChange(!change)}>{change ? "Cancel" : "Change them"}</button>
      <button className="ghost" onClick={() => act(() => post("/api/studio/security/lock"))}>Lock Studio Brain now</button></div></div>
      {change && <QuestionsForm submitLabel="Save new questions" onSubmit={async (qs: any, p: string) => { if (!me.mfa_fresh) { reverify(); throw new Error("Enter a fresh authenticator code first."); } await post("/api/studio/security/enroll", { questions: qs, passphrase: p }); setChange(false); s.reload(); }} />}</div>
    <div className="card"><div className="spread"><h2>Security log</h2>{ev.data && (ev.data.chain.ok ? <Badge kind="ok">tamper check passed · {ev.data.chain.events} events</Badge> : <Badge kind="bad">tamper check FAILED at event {ev.data.chain.broken_at}</Badge>)}</div>
      {ev.data?.events.length ? <table><tbody>{ev.data.events.slice(0, 30).map((e: any) => <tr key={e.id}><td className="dim">{ago(e.ts)}</td><td>{e.event}</td><td className="dim">{e.actor}</td></tr>)}</tbody></table> : <Empty>No security events yet.</Empty>}
      <h3>Notifications</h3>{ev.data?.notifications.length ? <table><tbody>{ev.data.notifications.map((n: any, i: number) => <tr key={i}><td className="dim">{ago(n.ts)}</td><td>{n.subject}</td><td className="dim">{n.to_email}</td><td>{n.status === "sent" ? <Badge kind="ok">sent</Badge> : <Badge kind="warn">{n.status === "not_configured" ? "email not set up" : n.status}</Badge>}</td></tr>)}</tbody></table> : <Empty>None yet.</Empty>}
      <p className="dim small">Email delivery needs an email-sending service connected to the engine (AELIO_NOTIFY_WEBHOOK_URL). Until then notifications are kept here.</p></div>
  </div>);
}

/** My AELIO → Security (everyone). Recovery tools appear only for the registered recovery account. */
export function MySecurity({ me }: any) {
  const rec = useLoad<any>("/api/my/recovery");
  const [code, setCode] = useState(""); const [err, setErr] = useState(""); const [msg, setMsg] = useState("");
  const [session, setSession] = useState<string | null>(null);
  const r = rec.data;
  const act = async (fn: () => Promise<any>) => { setErr(""); setMsg(""); try { await fn(); setCode(""); rec.reload(); } catch (x: any) { setErr(x.message); } };
  return (<div className="grid">
    <div><div className="eyebrow">My AELIO</div><h1>Security</h1></div>
    <div className="card"><h2>Your account</h2>
      <p>Signed in as <b>{me.email}</b> with Firebase. {me.level === "personal_founder" && <Badge kind="gold">Founder</Badge>}</p>
      {me.level === "personal_founder" && <div className="notice good" style={{ marginBottom: 8 }}>Founder perks on this account: Founder badge, unlimited usage (with a daily safety cap), early access and preview features as they're released. Studio Brain stays on jaja@vybr8.live only.</div>}
      <p className="dim small">Password and Google sign-in are managed by your AELIO login. Extra sign-in protection (authenticator app or passkey) for every account is planned; it's optional and never uses Studio Brain's security questions.</p></div>
    {r?.is_recovery_account && <div className="card"><h2>Emergency recovery for Studio Brain</h2>
      <p className="dim">This personal account can restore the founder's Studio Brain if it gets locked. It never opens Studio Brain itself.</p>
      <Err e={err} />{msg && <div className="notice good">{msg}</div>}
      {!r.linked ? <div className="notice">Not linked yet. In Studio Brain → Security, choose "Link my personal account for recovery".</div>
      : !r.account_mfa ? <div className="grid"><b>1. Add this account's own authenticator</b>
          <div className="notice">Add this key to your authenticator app as a separate entry: <pre>{r.mfa_setup?.secret}</pre><div className="dim small" style={{ wordBreak: "break-all" }}>{r.mfa_setup?.uri}</div></div>
          <div className="row"><input inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e: any) => setCode(e.target.value)} /><button className="gold-btn" disabled={code.length < 6} onClick={() => act(() => post("/api/my/recovery/mfa", { code }))}>Confirm</button></div></div>
      : !r.tested ? <div className="grid"><b>2. Test recovery</b><p className="dim small">Enter a fresh code to prove this account can verify a recovery.</p>
          <div className="row"><input inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e: any) => setCode(e.target.value)} /><button className="gold-btn" disabled={code.length < 6} onClick={() => act(async () => { await post("/api/my/recovery/test", { code }); setMsg("Recovery is active."); })}>Run test</button></div></div>
      : session ? <div className="grid"><b>Recovery session (15 minutes): set new Studio Brain security</b>
          <p className="dim small">This session can only reset the security questions and passphrase. Afterwards, sign in as jaja@vybr8.live to open Studio Brain.</p>
          <QuestionsFormWrap session={session} done={() => { setSession(null); setMsg("Done. Sign in with jaja@vybr8.live and answer your new challenge."); rec.reload(); }} /></div>
      : r.pending_request ? <div className="grid"><b>Recovery requested {ago(r.pending_request.created_at)}</b>
          <p className="dim small">If you requested this, verify with this account's authenticator. A link or email alone never grants access.</p>
          <div className="row"><input inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e: any) => setCode(e.target.value)} />
            <button className="gold-btn" disabled={code.length < 6} onClick={() => act(async () => {
              const v: any = await post("/api/my/recovery/verify", { request_id: r.pending_request.id, code });
              const s: any = await post("/api/my/recovery/session", { authorization: v.authorization }); setSession(s.recovery_session); })}>Verify and continue</button></div></div>
      : <div className="notice good">Recovery is active. Nothing to do. If Studio Brain ever locks, request recovery from its locked screen.</div>}
    </div>}
  </div>);
}

function QuestionsFormWrap({ session, done }: any) {
  return <QuestionsForm submitLabel="Reset Studio Brain security" onSubmit={async (qs: any, p: string) => {
    await api("/api/my/recovery/reset", { method: "POST", body: { questions: qs, passphrase: p }, headers: { "x-aelio-recovery-session": session } });
    done(); }} />;
}
