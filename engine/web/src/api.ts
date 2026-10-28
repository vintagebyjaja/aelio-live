let csrf = "";
export const setCsrf = (t: string) => { csrf = t || ""; };

export class ApiError extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const method = opts.method || "GET";
  const res = await fetch(path, {
    method, credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(method !== "GET" ? { "X-CSRF-Token": csrf } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    if (res.status === 401 && path !== "/api/auth/me") window.dispatchEvent(new Event("aelio:unauth"));
    throw new ApiError(res.status, (data && data.error) || res.statusText);
  }
  return data as T;
}

export const post = (p: string, body: any = {}) => api(p, { method: "POST", body });
export const put = (p: string, body: any = {}) => api(p, { method: "PUT", body });

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
