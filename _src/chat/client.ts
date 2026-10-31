import {consumerMessage} from "../shared/experience.js";
import { createSupabaseAuth } from "../brain/supabase-auth";
const cfg = (window as any).AELIO_CONFIG?.supabase;
export const authConfigurationError =
  consumerMessage("auth_not_configured",cfg?.configurationError?.message);
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
      signal: AbortSignal.timeout(20000),
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
  if (!r.ok) throw Object.assign(new Error(consumerMessage(d.code,d.error)),{code:d.code,requestId:d.request_id});
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
  if (!r.ok) throw new Error(consumerMessage(d.code,d.error));
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

export async function openStudio(){
 const token=await auth?.accessToken();
 const r=await fetch('/api/studio/ai/session',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:'{}',credentials:'same-origin'});
 const d=await r.json();if(!r.ok)throw Object.assign(new Error(d.error||'Studio Brain is private.'),{code:d.code});location.assign(d.url);
}
