import { publicKeyProblem } from "../shared/supabase-config.js";
// Minimal Supabase Auth client for AELIO and PATHD (no third-party script: plain fetch to the project's /auth/v1).
//
// One Supabase project serves aelio.live and mypathd.com, so the SAME email + password (or Google account) works on
// both sites. Each site keeps its own session in its own storage; nothing is shared between domains in the browser.
//
// Only the project URL and its publishable (anon) key are used here. Both are public by design: Row Level Security
// and the engine's own checks protect data. The service_role key never reaches a browser.

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
};
export type SupaConfig = {
  url: string;
  anonKey: string;
  product?: string;
  storageKey?: string;
};

type Storage = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
};

export class AuthError extends Error {
  status: number;
  code?: string;
  constructor(status: number, msg: string, code?: string) {
    super(msg);
    this.status = status;
    this.code = code;
  }
}

const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Human messages for the common failures; never echo raw server text that might include internals. */
function friendly(status: number, body: any): string {
  const code = body?.error_code || body?.code || body?.error;
  if (
    /invalid api key|invalid.*apikey/i.test(
      String(body?.msg || body?.message || body?.error_description || ""),
    )
  )
    return "Supabase rejected the configured public key. Check the public key and project URL in Cloudflare.";
  if (code === "captcha_failed")
    return "The security check failed. Complete it and try again.";
  if (code === "signup_disabled")
    return "Account creation is disabled in this Supabase project. Contact the site owner.";
  if (code === "invalid_credentials" || code === "invalid_grant")
    return "That email and password don't match.";
  if (code === "email_not_confirmed")
    return "Confirm your email first. We sent you a link.";
  if (code === "user_already_exists" || code === "email_exists")
    return "There's already an account with this email. Sign in instead.";
  if (code === "weak_password")
    return "Choose a stronger password (at least 10 characters).";
  if (status === 429 || code === "over_request_rate_limit")
    return "Too many attempts. Wait a minute and try again.";
  if (status >= 500)
    return "Sign-in is unavailable right now. Try again shortly.";
  return "Sign-in could not be completed. Check your details and try again.";
}

export function createSupabaseAuth(
  cfg: SupaConfig,
  deps: {
    fetch?: typeof fetch;
    storage?: Storage;
    now?: () => number;
    crypto?: Crypto;
  } = {},
) {
  const keyProblem = publicKeyProblem(cfg.anonKey);
  if (keyProblem)
    throw new AuthError(
      0,
      keyProblem === "missing_public_key"
        ? "Supabase public configuration is missing. Your password has not been sent."
        : "Supabase public configuration contains an invalid or privileged key. Your password has not been sent.",
      "auth_not_configured",
    );
  let project: URL;
  try {
    project = new URL(cfg.url);
    if (
      !["https:", "http:"].includes(project.protocol) ||
      project.username ||
      project.password ||
      project.search ||
      project.hash ||
      project.pathname !== "/"
    )
      throw Error();
  } catch {
    throw new AuthError(
      0,
      "Supabase project URL is invalid. Your password has not been sent.",
      "auth_url_invalid",
    );
  }
  const base = project.origin + "/auth/v1";
  const f = deps.fetch || fetch.bind(globalThis);
  const store: Storage = deps.storage || localStorage;
  const now = deps.now || (() => Date.now() / 1000);
  const cr: Crypto = deps.crypto || globalThis.crypto;
  const KEY = cfg.storageKey || "aelio.auth";
  const VERIFIER = KEY + ".pkce";
  const listeners = new Set<(s: Session | null) => void>();
  let memorySession: Session | null = null;
  let refreshing: Promise<Session | null> | null = null;
  let epoch = 0;
  let storageWritable = true;

  async function call(
    path: string,
    body: any,
    extra: Record<string, string> = {},
  ) {
    let res: Response;
    try {
      res = await f(base + path, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: cfg.anonKey,
          ...extra,
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new AuthError(
        0,
        "Couldn't reach sign-in. Check your connection.",
        "auth_network_error",
      );
    }
    let data: any = {};
    if (res.status !== 204)
      try {
        data = await res.json();
      } catch {
        throw new AuthError(
          502,
          "The sign-in service returned an invalid response. Try again shortly.",
          "auth_response_invalid",
        );
      }
    if (!res.ok) {
      const invalidKey = /invalid api key|invalid.*apikey/i.test(
        String(data?.msg || data?.message || data?.error_description || ""),
      );
      throw new AuthError(
        res.status,
        friendly(res.status, data),
        invalidKey
          ? "auth_key_rejected"
          : data?.error_code || data?.error || data?.code,
      );
    }
    return data;
  }

  function read(): Session | null {
    let raw: string | null;
    try {
      raw = store.getItem(KEY);
    } catch {
      return memorySession;
    }
    if (!raw) return storageWritable ? null : memorySession;
    try {
      const s = JSON.parse(raw);
      return s?.access_token && s?.refresh_token ? s : null;
    } catch {
      return null;
    }
  }
  function save(d: any, expectedEpoch = epoch): Session {
    if (expectedEpoch !== epoch)
      throw new AuthError(
        401,
        "This sign-in session changed. Sign in again.",
        "session_changed",
      );
    if (!d?.access_token || !d?.refresh_token || !d?.user?.id)
      throw new AuthError(
        502,
        "The sign-in service returned an incomplete session. Try again shortly.",
        "auth_response_invalid",
      );
    const s: Session = {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: d.expires_at || Math.floor(now()) + (d.expires_in || 3600),
      user: { id: d.user?.id, email: d.user?.email },
    };
    memorySession = s;
    try {
      store.setItem(KEY, JSON.stringify(s));
      storageWritable = true;
    } catch {
      storageWritable = false; /* private mode: session lasts for this page only */
    }
    listeners.forEach((l) => l(s));
    return s;
  }
  function clear() {
    epoch++;
    memorySession = null;
    try {
      store.removeItem(KEY);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l(null));
  }

  async function refresh(s: Session): Promise<Session | null> {
    if (!refreshing) {
      const expected = epoch;
      refreshing = (async () => {
        try {
          return save(
            await call("/token?grant_type=refresh_token", {
              refresh_token: s.refresh_token,
            }),
            expected,
          );
        } catch (e: any) {
          if (expected !== epoch) return null;
          if (
            [400, 401, 403].includes(e.status) &&
            e.code !== "auth_key_rejected"
          ) {
            clear();
            return null;
          }
          // Keep persisted credentials on network, service, configuration or rate-limit failures.
          throw e;
        } finally {
          refreshing = null;
        }
      })();
    }
    return refreshing;
  }

  return {
    /** Current session, refreshed if it expires within a minute. */
    async session(): Promise<Session | null> {
      const s = read();
      if (!s) return null;
      return s.expires_at - now() > 60 ? s : refresh(s);
    },
    async accessToken(): Promise<string | null> {
      return (await this.session())?.access_token || null;
    },

    async signInWithPassword(
      email: string,
      password: string,
    ): Promise<Session> {
      const expected = ++epoch;
      return save(
        await call("/token?grant_type=password", {
          email: email.trim(),
          password,
        }),
        expected,
      );
    },

    /** New account. Every signup also gets an AELIO identity (database trigger); `product` says which site it came from. */
    async signUp(
      email: string,
      password: string,
      redirectTo?: string,
      displayName = "",
      captchaToken?: string,
    ): Promise<{ session: Session | null; confirmEmail: boolean }> {
      const d = await call(
        "/signup" +
          (redirectTo ? "?redirect_to=" + encodeURIComponent(redirectTo) : ""),
        {
          email: email.trim(),
          password,
          data: {
            signup_product: cfg.product || "aelio",
            display_name: displayName,
          },
          gotrue_meta_security: { captcha_token: captchaToken },
        },
      );
      if (d.access_token) return { session: save(d), confirmEmail: false };
      return { session: null, confirmEmail: true };
    },

    async resetPassword(email: string, redirectTo: string): Promise<void> {
      const raw = new Uint8Array(32);
      cr.getRandomValues(raw);
      const verifier = b64url(raw);
      const challenge = b64url(
        await cr.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
      );
      store.setItem(VERIFIER, verifier);
      await call("/recover?redirect_to=" + encodeURIComponent(redirectTo), {
        email: email.trim(),
        code_challenge: challenge,
        code_challenge_method: "s256",
      });
    },

    async updatePassword(password: string) {
      const s = await this.session();
      if (!s) throw new AuthError(401, "Sign in again.");
      let r: Response;
      try {
        r = await f(base + "/user", {
          method: "PUT",
          headers: {
            apikey: cfg.anonKey,
            authorization: "Bearer " + s.access_token,
            "content-type": "application/json",
          },
          body: JSON.stringify({ password }),
        });
      } catch {
        throw new AuthError(
          0,
          "Couldn't reach sign-in. Check your connection.",
          "auth_network_error",
        );
      }
      if (!r.ok)
        throw new AuthError(r.status, "Password could not be updated.");
    },

    /** Google sign-in with PKCE: returns the URL to send the browser to. */
    async oauthUrl(provider: "google" | "apple", redirectTo: string, link = false): Promise<string> {
      const raw = new Uint8Array(32);
      cr.getRandomValues(raw);
      const verifier = b64url(raw);
      const challenge = b64url(
        await cr.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
      );
      try {
        store.setItem(VERIFIER, verifier);
      } catch {
        /* ignore */
      }
      const q = new URLSearchParams({
        provider,
        redirect_to: redirectTo,
        code_challenge: challenge,
        code_challenge_method: "s256",
      });
      if(link){
        q.set("skip_http_redirect","true");
        const current=await this.session();if(!current)throw new AuthError(401,"Sign in before linking a provider.");
        store.setItem(VERIFIER+":linked-user",current.user.id);
        const response=await f(`${base}/user/identities/authorize?${q}`,{headers:{apikey:cfg.anonKey,authorization:"Bearer "+current.access_token}});
        const result=await response.json();if(!response.ok||!result.url)throw new AuthError(response.status,"This provider could not be linked. Try signing in again, or use your existing method.");
        const destination=new URL(result.url);if(destination.protocol!=="https:")throw new AuthError(400,"Invalid provider redirect.");return destination.href;
      }
      store.removeItem(VERIFIER+":linked-user");
      return `${base}/authorize?${q}`;
    },

    /** Finish Google sign-in on the redirect page (?code=...). The code is single-use and bound to this browser's verifier. */
    async exchangeCode(code: string): Promise<Session> {
      let verifier: string | null = null;
      try {
        verifier = store.getItem(VERIFIER);
        store.removeItem(VERIFIER);
      } catch {
        /* ignore */
      }
      if (!verifier)
        throw new AuthError(
          400,
          "This sign-in link was started in another browser. Start again here.",
        );
      const result=await call("/token?grant_type=pkce",{auth_code:code,code_verifier:verifier});
      const expected=store.getItem(VERIFIER+":linked-user");store.removeItem(VERIFIER+":linked-user");
      if(expected&&result.user?.id!==expected)throw new AuthError(403,"This sign-in did not match your existing account. Your original session has been preserved.");
      return save(result);
    },

    async acceptSession(value: any): Promise<Session>{
      const response=await f(base+"/user",{headers:{apikey:cfg.anonKey,authorization:"Bearer "+value.access_token}});
      const verified=await response.json();if(!response.ok||verified.id!==value.user?.id)throw new AuthError(401,"This session could not be verified.");return save(value);
    },
    async signOutOthers():Promise<void>{const current=await this.session();if(!current)throw new AuthError(401,"Sign in again.");await call('/logout?scope=others',{}, {authorization:'Bearer '+current.access_token});},
    async signOut(): Promise<void> {
      const s = read();
      clear();
      if (s) {
        try {
          await call(
            "/logout?scope=local",
            {},
            { authorization: "Bearer " + s.access_token },
          );
        } catch {
          throw new AuthError(
            0,
            "Signed out on this device, but the server could not confirm session revocation. Other browser sessions are unchanged.",
            "signout_remote_failed",
          );
        }
      }
    },

    onChange(fn: (s: Session | null) => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
