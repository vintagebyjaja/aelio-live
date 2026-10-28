import { useEffect, useState } from "react";
import { api, post, setCsrf } from "./api";
import { Err } from "./ui";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";

function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error("could not load " + src));
    document.head.appendChild(s);
  });
}

export function Login({ onDone, me }: any) {
  const [cfg, setCfg] = useState<any>(null);
  const [step, setStep] = useState<string>(me && me.authenticated && !me.mfa_complete ? "mfa" : "signin");
  const [enroll, setEnroll] = useState<any>(null);
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [code, setCode] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => { api("/api/auth/config").then(setCfg).catch((e) => setErr(e.message)); }, []);

  async function firebaseSignIn(method: "google" | "password") {
    setBusy(true); setErr("");
    try {
      await loadScript(FB + "firebase-app-compat.js");
      await loadScript(FB + "firebase-auth-compat.js");
      if (!firebase.apps.length) firebase.initializeApp(cfg.firebase);
      const auth = firebase.auth();
      const cred = method === "google"
        ? await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
        : await auth.signInWithEmailAndPassword(email, pw);
      const idToken = await cred.user.getIdToken(true);
      const r: any = await post("/api/auth/firebase", { idToken });
      await auth.signOut(); // the studio session cookie is the only credential kept
      setCsrf(r.csrf);
      if (r.mfa === "enroll") setEnroll({ secret: r.totp_secret, uri: r.totp_uri });
      setStep("mfa");
    } catch (e: any) { setErr(e.message || String(e)); }
    setBusy(false);
  }

  async function localSignIn() {
    setBusy(true); setErr("");
    try { const r: any = await post("/api/auth/login", { email, password: pw, code }); setCsrf(r.csrf); onDone(); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  async function verify() {
    setBusy(true); setErr("");
    try { await post("/api/auth/mfa", { code }); onDone(); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div className="login">
      <div className="card">
        <div className="brand" style={{ padding: 0 }}>ΛEL<b>I</b>O</div>
        <div className="muted" style={{ margin: "4px 0 18px" }}>Native Studio · private back office</div>
        {!cfg && !err && <div className="muted">Loading…</div>}
        {cfg && step === "signin" && cfg.mode === "firebase" && (
          <div className="grid">
            <button className="primary" disabled={busy} onClick={() => firebaseSignIn("google")}>Sign in with Google</button>
            <div className="dim" style={{ textAlign: "center", fontSize: 12 }}>or with your Firebase email account</div>
            <div><label htmlFor="em">Email</label><input id="em" value={email} onChange={(e: any) => setEmail(e.target.value)} autoComplete="username" /></div>
            <div><label htmlFor="pw">Password</label><input id="pw" type="password" value={pw} onChange={(e: any) => setPw(e.target.value)} autoComplete="current-password" /></div>
            <button disabled={busy || !email || !pw} onClick={() => firebaseSignIn("password")}>Sign in</button>
          </div>
        )}
        {cfg && step === "signin" && cfg.mode === "local" && (
          <div className="grid">
            <div className="notice info">Local sign-in (development mode). Set FIREBASE_PROJECT_ID to switch to Firebase.</div>
            <div><label htmlFor="em">Email</label><input id="em" value={email} onChange={(e: any) => setEmail(e.target.value)} autoComplete="username" /></div>
            <div><label htmlFor="pw">Password</label><input id="pw" type="password" value={pw} onChange={(e: any) => setPw(e.target.value)} autoComplete="current-password" /></div>
            <div><label htmlFor="cd">Authenticator code</label><input id="cd" inputMode="numeric" value={code} onChange={(e: any) => setCode(e.target.value)} autoComplete="one-time-code" /></div>
            <button className="primary" disabled={busy} onClick={localSignIn}>Sign in</button>
          </div>
        )}
        {step === "mfa" && (
          <div className="grid">
            {enroll ? (
              <div className="notice">
                <b>Set up your authenticator (one time).</b> Add this key to Google Authenticator, 1Password or Authy, then enter the 6-digit code.
                <pre style={{ marginTop: 8 }}>{enroll.secret}</pre>
                <div className="dim" style={{ fontSize: 11, wordBreak: "break-all" }}>{enroll.uri}</div>
              </div>
            ) : <div className="muted">Enter the 6-digit code from your authenticator app.</div>}
            <div><label htmlFor="cd2">Authenticator code</label><input id="cd2" inputMode="numeric" autoFocus value={code} onChange={(e: any) => setCode(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && verify()} autoComplete="one-time-code" /></div>
            <button className="primary" disabled={busy || code.length < 6} onClick={verify}>Verify</button>
          </div>
        )}
        <Err e={err} />
        <div className="dim" style={{ fontSize: 11, marginTop: 16 }}>Access is limited to the founder allow-list. All sign-ins are audited.</div>
      </div>
    </div>
  );
}
