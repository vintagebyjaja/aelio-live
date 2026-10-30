// Brain app deep links: /brain/my/<anything> and /studiobrain/<anything> load that app's shell (index.html),
// and the app routes on the client. Used by the Worker (wrangler.jsonc) and by Pages Functions, so neither needs
// _redirects rewrites (which can loop on Workers static assets with trailing-slash handling).
export const APP_SHELLS = ["/chat/", "/account/", "/auth/callback/", "/auth/reset/", "/brain/my/", "/studiobrain/"];

export function shellFor(pathname) {
  return APP_SHELLS.find((p) => pathname === p.slice(0, -1) || pathname.startsWith(p)) || null;
}

/** Serve the real file if it exists, otherwise the app shell. env.ASSETS is the static-assets binding. */
export async function serveAppShell({ request, env }) {
  const url = new URL(request.url);
  const shell = shellFor(url.pathname);
  const res = await env.ASSETS.fetch(request);
  if (!shell || res.status !== 404 || !["GET", "HEAD"].includes(request.method)) return res;
  const shellRes = await env.ASSETS.fetch(new Request(new URL(shell, url), { method: request.method, headers: request.headers }));
  const headers = new Headers(shellRes.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(shellRes.body, { status: shellRes.status === 404 ? 404 : 200, headers });
}
