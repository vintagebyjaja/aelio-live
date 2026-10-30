// Minimal Supabase Auth client for AELIO and PATHD (no third-party script: plain fetch to the project's /auth/v1).
//
// One Supabase project serves aelio.live and mypathd.com, so the SAME email + password (or Google account) works on
// both sites. Each site keeps its own session in its own storage; nothing is shared between domains in the browser.
//
// Only the project URL and its publishable (anon) key are used here. Both are public by design: Row Level Security
// and the engine's own checks protect data. The service_role key never reaches a browser.

export type Session = { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email?: string } };
export type SupaConfig = { url: string; anonKey: string; product?: string; storageKey?: string };

type Storage = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

export class AuthError extends Error {
  status: number; code?: string;
  constructor(status: number, msg: string, code?: string) { super(msg); this.status = status; this.code = code; }
}

const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Human messages for the common failures; never echo raw server text that might include internals. */
function friendly(status: number, body: any): string {
  const code = body?.error_code || body?.code || body?.error;
  if (code === "invalid_credentials" || code === "invalid_grant") return "That email and password don't match.";
  if (code === "email_not_confirmed") return "Confirm your email first. We sent you a link.";
  if (code === "user_already_exists" || code === "email_exists") return "There's already an account with this email. Sign in instead.";
  if (code === "weak_password") return "Choose a stronger password (at least 10 characters).";
  if (status === 429 || code === "over_request_rate_limit") return "Too many attempts. Wait a minute and try again.";
  if (status >= 500) return "Sign-in is unavailable right now. Try again shortly.";
  return body?.msg || body?.error_description || body?.message || "Sign-in failed.";
}

export function createSupabaseAuth(cfg: SupaConfig, deps: { fetch?: typeof fetch; storage?: Storage; now?: () => number; crypto?: Crypto } = {}) {
  const base = cfg.url.replace(/\/$/, "") + "/auth/v1";
  const f = deps.fetch || fetch.bind(globalThis);
  const store: Storage = deps.storage || localStorage;
  const now = deps.now || (() => Date.now() / 1000);
  const cr: Crypto = deps.crypto || globalThis.crypto;
  const KEY = cfg.storageKey || "aelio.auth";
  const VERIFIER = KEY + ".pkce";
  const listeners = new Set<(s: Session | null) => void>();
  let memorySession: Session | null = null;
  let refreshing: Promise<Session | null> | null = null;

  async function call(path: string, body: any, extra: Record<string, string> = {}) {
    let res: Response;
    try {
      res = await f(base + path, { method: "POST", headers: { "content-type": "application/json", apikey: cfg.anonKey, ...extra }, body: JSON.stringify(body) });
    } catch { throw new AuthError(0, "Couldn't reach sign-in. Check your connection."); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new AuthError(res.status, friendly(res.status, data), data?.error_code || data?.error);
    return data;
  }

  function read(): Session | null {
    try { const s = JSON.parse(store.getItem(KEY) || "null"); return s && s.access_token && s.refresh_token ? s : memorySession; } catch { return memorySession; }
  }
  function save(d: any): Session {
    const s: Session = { access_token: d.access_token, refresh_token: d.refresh_token,
      expires_at: d.expires_at || Math.floor(now()) + (d.expires_in || 3600), user: { id: d.user?.id, email: d.user?.email } };
    memorySession = s;
    try { store.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: session lasts for this page only */ }
    listeners.forEach(l => l(s));
    return s;
  }
  function clear() { memorySession = null; try { store.removeItem(KEY); } catch { /* ignore */ } listeners.forEach(l => l(null)); }

  async function refresh(s: Session): Promise<Session | null> {
    if (!refreshing) refreshing = (async () => {
      try { return save(await call("/token?grant_type=refresh_token", { refresh_token: s.refresh_token })); }
      catch (e: any) { if (e.status >= 400 && e.status < 500) clear(); return null; }   // revoked/expired: signed out
      finally { refreshing = null; }
    })();
    return refreshing;
  }

  return {
    /** Current session, refreshed if it expires within a minute. */
    async session(): Promise<Session | null> {
      const s = read();
      if (!s) return null;
      return s.expires_at - now() > 60 ? s : refresh(s);
    },
    async accessToken(): Promise<string | null> { return (await this.session())?.access_token || null; },

    async signInWithPassword(email: string, password: string): Promise<Session> {
      return save(await call("/token?grant_type=password", { email: email.trim(), password }));
    },

    /** New account. Every signup also gets an AELIO identity (database trigger); `product` says which site it came from. */
    async signUp(email: string, password: string, redirectTo?: string, displayName = "", captchaToken?: string): Promise<{ session: Session | null; confirmEmail: boolean }> {
      const d = await call("/signup" + (redirectTo ? "?redirect_to=" + encodeURIComponent(redirectTo) : ""),
        { email: email.trim(), password, data: { signup_product: cfg.product || "aelio", display_name: displayName }, gotrue_meta_security: {captcha_token:captchaToken} });
      if (d.access_token) return { session: save(d), confirmEmail: false };
      return { session: null, confirmEmail: true };
    },

    async resetPassword(email: string, redirectTo: string): Promise<void> {
      const raw = new Uint8Array(32); cr.getRandomValues(raw);
      const verifier = b64url(raw);
      const challenge = b64url(await cr.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
      store.setItem(VERIFIER, verifier);
      await call("/recover?redirect_to=" + encodeURIComponent(redirectTo), { email: email.trim(), code_challenge: challenge, code_challenge_method:"s256" });
    },

    async updatePassword(password: string) {
      const s=await this.session(); if(!s) throw new AuthError(401,"Sign in again.");
      const r=await f(base+"/user",{method:"PUT",headers:{apikey:cfg.anonKey,authorization:"Bearer "+s.access_token,"content-type":"application/json"},body:JSON.stringify({password})});
      if(!r.ok) throw new AuthError(r.status,"Password could not be updated.");
    },

    /** Google sign-in with PKCE: returns the URL to send the browser to. */
    async oauthUrl(provider: "google", redirectTo: string): Promise<string> {
      const raw = new Uint8Array(32); cr.getRandomValues(raw);
      const verifier = b64url(raw);
      const challenge = b64url(await cr.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
      try { store.setItem(VERIFIER, verifier); } catch { /* ignore */ }
      const q = new URLSearchParams({ provider, redirect_to: redirectTo, code_challenge: challenge, code_challenge_method: "s256" });
      return `${base}/authorize?${q}`;
    },

    /** Finish Google sign-in on the redirect page (?code=...). The code is single-use and bound to this browser's verifier. */
    async exchangeCode(code: string): Promise<Session> {
      let verifier: string | null = null;
      try { verifier = store.getItem(VERIFIER); store.removeItem(VERIFIER); } catch { /* ignore */ }
      if (!verifier) throw new AuthError(400, "This sign-in link was started in another browser. Start again here.");
      return save(await call("/token?grant_type=pkce", { auth_code: code, code_verifier: verifier }));
    },

    async signOut(): Promise<void> {
      const s = read();
      clear();
      if (s) await call("/logout", {}, { authorization: "Bearer " + s.access_token }).catch(() => undefined);
    },

    onChange(fn: (s: Session | null) => void) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
