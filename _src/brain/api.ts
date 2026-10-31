// Supabase-only browser identity; the existing engine remains a separate same-origin service.
import { createSupabaseAuth } from "./supabase-auth";
const CFG: any = (window as any).AELIO_CONFIG || {};
export const provider = "supabase";
export const supa = CFG.supabase?.url && CFG.supabase?.anonKey ? createSupabaseAuth({url:CFG.supabase.url,anonKey:CFG.supabase.anonKey,product:"aelio"}) : null;
export const ENGINE: string = (CFG.engine || "").replace(/\/$/, "");
export const isDev = () => CFG.dev === true;
const DEV_KEY = "aelio_dev_token";

export async function token(): Promise<string | null> {
  if (isDev()) { try { return localStorage.getItem(DEV_KEY); } catch { return null; } }
  if (supa) return supa.accessToken();
  return null;
}

export function setDevToken(t: string | null) { try { t ? localStorage.setItem(DEV_KEY, t) : localStorage.removeItem(DEV_KEY); } catch { /* ignore */ } }

/** Resolves once we know whether someone is signed in (Supabase restores the locally persisted session). */
export async function currentUser(): Promise<{ email: string } | null> {
  if (isDev()) return (await token()) ? { email: "dev" } : null;
  if (supa) { const s = await supa.session(); return s ? { email: s.user.email || "" } : null; }
  return null;
}

export async function signOut() {
  if (isDev()) setDevToken(null); else if (supa) await supa.signOut();
}

export class ApiError extends Error {
  status: number; data: any;
  constructor(status: number, msg: string, data: any) { super(msg); this.status = status; this.data = data; }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: any; headers?: Record<string, string> } = {}): Promise<T> {
  const t = await token();
  let res: Response;
  try {
    res = await fetch(ENGINE + path, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json", ...(opts.headers || {}), ...(t ? { Authorization: "Bearer " + t } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "The AELIO engine isn't reachable right now.", null);
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || res.statusText, data);
  return data as T;
}

/** POST that reads a server-sent event stream. Refusals (limits, consent, pause) arrive as normal JSON errors. */
export async function streamPost(path: string, body: any, onEvent: (ev: any) => void, signal?: AbortSignal): Promise<void> {
  const t = await token();
  let res: Response;
  try {
    res = await fetch(ENGINE + path, {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...(t ? { Authorization: "Bearer " + t } : {}) },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    if (e?.name === "AbortError") return;
    throw new ApiError(0, "The AELIO engine isn't reachable right now.", null);
  }
  if (!res.ok || !res.body) {
    let data: any = null;
    try { data = await res.json(); } catch { /* empty */ }
    throw new ApiError(res.status, (data && data.error) || res.statusText, data);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = chunk.split("\n").find(l => l.startsWith("data: "));
        if (line) { try { onEvent(JSON.parse(line.slice(6))); } catch { /* skip malformed */ } }
      }
    }
  } catch (e: any) {
    if (e?.name !== "AbortError") throw e;
  }
}

export const post = (p: string, body: any = {}) => api(p, { method: "POST", body });
export const put = (p: string, body: any = {}) => api(p, { method: "PUT", body });
export const del = (p: string) => api(p, { method: "DELETE" });

export async function waitJob(id: string, onTick?: (j: any) => void): Promise<any> {
  for (;;) {
    const j = await api(`/api/jobs/${id}`);
    onTick && onTick(j);
    if (["succeeded", "failed", "cancelled", "timed_out"].includes(j.status)) return j;
    await new Promise((r) => setTimeout(r, 1500));
  }
}

export const ts = (t?: number | null) => (t ? new Date(t * 1000).toLocaleString() : "—");
export const ago = (t?: number | null) => {
  if (!t) return "—";
  const s = Date.now() / 1000 - t;
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};
export const until = (t?: number | null) => {
  if (!t) return "";
  const s = Math.max(0, t - Date.now() / 1000), h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h} hour${h > 1 ? "s" : ""} and ${m} minute${m === 1 ? "" : "s"}` : `${m} minute${m === 1 ? "" : "s"}`;
};

export async function openStudio(){const access=await token();const response=await fetch('/api/studio/ai/session',{method:'POST',headers:{'content-type':'application/json',...(access?{authorization:'Bearer '+access}:{})},body:'{}',credentials:'same-origin'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Studio Brain is private.');location.assign(data.url);}
