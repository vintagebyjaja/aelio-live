import { createSupabaseAuth } from "../brain/supabase-auth";
const cfg = (window as any).AELIO_CONFIG?.supabase;
export const authConfigurationError =
  cfg?.configurationError?.message ||
  "Supabase sign-in needs a public publishable or anon key in Cloudflare. Your password has not been sent.";
export const auth =
  cfg?.url && cfg?.anonKey && !cfg?.configurationError
    ? createSupabaseAuth({
        url: cfg.url,
        anonKey: cfg.anonKey,
        product: "aelio",
      })
    : null;
export async function call(path: string, method = "GET", data?: any) {
  const token = await auth?.accessToken();
  let r: Response;
  try {
    r = await fetch("/api/platform" + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: "Bearer " + token } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch {
    throw new Error(
      "Couldn't reach AELIO. Check your connection and try again.",
    );
  }
  let d: any;
  try {
    d = await r.json();
  } catch {
    throw new Error(
      "AELIO returned an unexpected response. Try again shortly.",
    );
  }
  if (!r.ok) throw new Error(d.error || "Request failed.");
  return d;
}
export async function upload(
  file: File,
  category = "documents",
  conversation?: string,
) {
  const t = await auth?.accessToken();
  const r = await fetch("/api/platform/files", {
    method: "POST",
    headers: {
      authorization: "Bearer " + t,
      "content-type": file.type || "text/plain",
      "x-file-name": encodeURIComponent(file.name),
      "x-file-category": category,
      ...(conversation ? { "x-conversation-id": conversation } : {}),
    },
    body: file,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d.file;
}
export async function fileURL(id: string) {
  const t = await auth?.accessToken();
  const r = await fetch("/api/platform/files/" + id, {
    headers: { authorization: "Bearer " + t },
  });
  if (!r.ok) throw new Error("File unavailable.");
  return URL.createObjectURL(await r.blob());
}
export function download(data: string, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
