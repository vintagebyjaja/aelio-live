import {friendly} from "./Experience";
import React, { useState, useEffect } from "react";
import { auth, authConfigurationError, call, download } from "./client";
export const QUESTIONS = [
  "What was a nickname only your family used?",
  "What place holds a special memory for you?",
  "What was the name of your first creative project?",
  "What is a phrase you will remember?",
];
export function RecoveryFields({ qs, setQs, answers, setAnswers }: any) {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} className="recovery-row">
          <label>
            Recovery question {i + 1}
            <select
              aria-label={"Choose recovery question " + (i + 1)}
              value={QUESTIONS.includes(qs[i]) ? qs[i] : "custom"}
              onChange={(e: any) =>
                setQs(
                  qs.map((q: string, j: number) =>
                    j === i
                      ? e.target.value === "custom"
                        ? ""
                        : e.target.value
                      : q,
                  ),
                )
              }
            >
              {QUESTIONS.map((q) => (
                <option key={q}>{q}</option>
              ))}
              <option value="custom">Write my own question</option>
            </select>
          </label>
          {!QUESTIONS.includes(qs[i]) && (
            <input
              aria-label={"Custom question " + (i + 1)}
              value={qs[i]}
              maxLength={160}
              onChange={(e: any) =>
                setQs(
                  qs.map((q: string, j: number) =>
                    i === j ? e.target.value : q,
                  ),
                )
              }
            />
          )}
          <input
            aria-label={"Answer " + (i + 1)}
            type="password"
            autoComplete="off"
            value={answers[i]}
            onChange={(e: any) =>
              setAnswers(
                answers.map((a: string, j: number) =>
                  j === i ? e.target.value : a,
                ),
              )
            }
          />
        </div>
      ))}
    </>
  );
}
export function AuthPanel({ onDone, enroll = false }: any) {
  const [mode, setMode] = useState(
    enroll
      ? "enroll"
      : new URLSearchParams(location.search).get("mode") || "signin",
  );
  const [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [newPassword, setNewPassword] = useState("");
  const [qs, setQs] = useState(QUESTIONS.slice(0, 2)),
    [answers, setAnswers] = useState(["", ""]);
  const [generateCodes, setGenerateCodes] = useState(false);
  const [code, setCode] = useState(""),
    [codes, setCodes] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState("");
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("code");
    if (c && auth) {
      setBusy(true);
      auth
        .exchangeCode(c)
        .then(() => {
          history.replaceState(null, "", location.pathname);
          if (location.pathname.includes("/reset")) setMode("reset");
          else onDone();
        })
        .catch((e: any) => setError(friendly(e)))
        .finally(() => setBusy(false));
    }
  }, []);
  async function submit(e: any) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNote("");
    try {
      if (!auth) throw new Error(authConfigurationError);
      if (mode === "signup") {
        if (
          (window as any).AELIO_CONFIG?.turnstileSiteKey &&
          !(window as any).aelioCaptchaToken
        )
          throw new Error("Complete the abuse-prevention check.");
        if (password.length < 12)
          throw new Error("Use a password of at least 12 characters.");
        if (answers.some((a) => a.trim().length < 3) || qs[0] === qs[1])
          throw new Error("Complete two different recovery questions.");
        const r = await auth.signUp(
          email,
          password,
          location.origin + "/auth/callback/",
          name,
          (window as any).aelioCaptchaToken,
        );
        if (r.confirmEmail) {
          setNote(
            "Check your email to confirm your account, then return here. Your account already exists; you don’t need to register again.",
          );
          return;
        }
        setMode("enroll");
        try { await call("/recovery/enroll", "POST", {
          password,
          questions: qs,
          answers,
        });
        } catch { /* Account is already created: optional setup must not prevent entry. */ }
        onDone();
        setAnswers(["", ""]);
        setPassword("");
      } else if (mode === "enroll") {
        const r = await call("/recovery/enroll", "POST", {
          generate_codes: generateCodes,
          password,
          questions: qs,
          answers,
        });
        if (r.codes) setCodes(r.codes); else onDone();
        setAnswers(["", ""]);
        setPassword("");
      } else if (mode === "recover") {
        await call("/recovery/reset", "POST", {
          email,
          answers,
          code,
          password: newPassword,
        });
        setMode("signin");
        setNote("Password updated. Sign in with your new password.");
        setAnswers(["", ""]);
        setCode("");
      } else if (mode === "email") {
        await auth.resetPassword(email, location.origin + "/auth/reset/");
        setNote("If an account matches, a secure recovery link is on its way.");
      } else if (mode === "reset") {
        await auth.updatePassword(newPassword);
        await auth.signOut();
        setMode("signin");
        setNote("Password updated. Sign in again.");
      } else {
        await auth.signInWithPassword(email, password);
        setPassword("");
        onDone();
      }
    } catch (e: any) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  if (codes.length)
    return (
      <section className="auth-card">
        <h2>Save your recovery codes</h2>
        <p>
          Each code works once. Keep these somewhere private. They won’t be
          shown again.
        </p>
        <pre>{codes.join("\n")}</pre>
        <button
          onClick={() => download(codes.join("\n"), "AELIO-recovery-codes.txt")}
        >
          Download codes
        </button>
        <button
          onClick={() => {
            setCodes([]);
            onDone();
          }}
        >
          I saved them — continue
        </button>
      </section>
    );
  return (
    <section className="auth-card">
      <a className="brand" href="/chat/">
        AELIO
      </a>
      <h1>
        {(
          {
            signin: "Welcome back",
            signup: "Welcome in",
            enroll: "Account Security Setup",
            recover: "Recover your account",
            email: "Email recovery",
            reset: "Choose a new password",
          } as any
        )[mode] || "Welcome back"}
      </h1>
      <p>
        {mode === "enroll"
          ? "Your existing account is ready. Set up recovery once for AELIO and PATHD."
          : "One account for AELIO and PATHD. Independent plans. Your own space."}
      </p>
      <form onSubmit={submit}>
        {mode === "signup" && (
          <label>
            What should we call you?
            <input
              required
              value={name}
              maxLength={80}
              autoComplete="nickname"
              onChange={(e: any) => setName(e.target.value)}
            />
          </label>
        )}
        {!["enroll", "reset"].includes(mode) && (
          <label>
            Email
            <input
              required
              type="email"
              value={email}
              autoComplete="username"
              onChange={(e: any) => setEmail(e.target.value)}
            />
          </label>
        )}
        {["signin", "signup", "enroll"].includes(mode) && (
          <label>
            {mode === "enroll" ? "Confirm your current password" : "Password"}
            <input
              required
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
            />
          </label>
        )}
        {["signup", "enroll", "recover"].includes(mode) && (
          <RecoveryFields
            qs={qs}
            setQs={setQs}
            answers={answers}
            setAnswers={setAnswers}
          />
        )}
        {mode === "recover" && (
          <label>
            Unused recovery code
            <input
              required
              autoComplete="off"
              value={code}
              onChange={(e: any) => setCode(e.target.value)}
            />
          </label>
        )}
        {["recover", "reset"].includes(mode) && (
          <label>
            New password
            <input
              required
              minLength={12}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e: any) => setNewPassword(e.target.value)}
            />
          </label>
        )}
        {mode === "signup" &&
          (window as any).AELIO_CONFIG?.turnstileSiteKey && <Turnstile />}
        {["signup", "enroll"].includes(mode) && (
          <p className="muted">
            Saving answers leaves your password unchanged. Questions alone cannot
            reset a password. Secure email recovery remains available.
          </p>
        )}
        {mode === "enroll" && <label><input type="checkbox" checked={generateCodes} onChange={(e:any)=>setGenerateCodes(e.target.checked)} />Also generate new backup codes (optional; replaces old codes)</label>}
        <button disabled={busy}>
          {busy
            ? "One moment…"
            : mode === "signup"
              ? "Create Free account"
              : mode === "enroll"
                ? "Save recovery answers"
                : mode === "recover"
                  ? "Reset password"
                  : mode === "email"
                    ? "Send secure link"
                    : mode === "reset"
                      ? "Update password"
                      : "Sign in"}
        </button>
      </form>
      <p role="alert">{error}</p>
      <p role="status">{note}</p>
      <nav className="inline-nav">
        <button
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup" ? "Sign in" : "Create account"}
        </button>
        <button onClick={() => setMode("recover")}>Forgot password</button>
        {["recover", "enroll"].includes(mode) && (
          <button onClick={() => setMode("email")}>
            Use secure email recovery
          </button>
        )}
        <a href="/">Back to AELIO</a>
        <a href="/explore/">Explore the free site</a>
      </nav>
    </section>
  );
}

function Turnstile() {
  useEffect(() => {
    let live = true;
    const render = () => {
      if (live && (window as any).turnstile) {
        const host = document.getElementById("aelio-turnstile");
        if (host) {
          host.innerHTML = "";
          (window as any).turnstile.render(host, {
            sitekey: (window as any).AELIO_CONFIG.turnstileSiteKey,
            callback: (token: string) => {
              (window as any).aelioCaptchaToken = token;
            },
            "expired-callback": () => {
              (window as any).aelioCaptchaToken = null;
            },
          });
        }
      }
    };
    let script = document.querySelector(
      "script[data-aelio-captcha]",
    ) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.dataset.aelioCaptcha = "1";
      script.onload = render;
      document.head.appendChild(script);
    } else render();
    return () => {
      live = false;
      (window as any).aelioCaptchaToken = null;
    };
  }, []);
  return <div id="aelio-turnstile" />;
}
