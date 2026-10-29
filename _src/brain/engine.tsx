import { ago } from "./api";
import { A } from "./portal";
import { Badge, Empty, Err, useLoad } from "./ui";

const AREAS: [string, string, string][] = [
  ["/studiobrain/web-designer", "Web Designer", "Change the public site: page images, colours, headings, buttons; preview, publish, roll back"],
  ["/studiobrain/core", "AELIO Core", "One AI for aelio.live and PATHD: services, products, sign-in migration"],
  ["/studiobrain/intelligence", "Intelligence", "OpenAI GPT today, AELIO Native later: models, routing, costs, pause switch"],
  ["/studiobrain/code-studio", "Code Studio", "Projects, files, AI-proposed changes, branches, tests"],
  ["/studiobrain/native-lab", "Native Lab", "AELIO Native research models and training"],
  ["/studiobrain/agent-campus", "Agent Campus", "AELIO's platform agents and their permissions"],
  ["/brain/my/agents", "Create & manage agents", "Your own agents, Agent Transfer imports, chat"],
  ["/studiobrain/usage-access", "Users & limits", "Accounts, plans, allowances, suspensions"],
  ["/studiobrain/credits", "Credits & billing", "Wallet ledger, packages, payments"],
  ["/studiobrain/operations", "Operations", "Deployments needing approval, guardians, jobs"],
  ["/studiobrain/settings", "Settings & secrets", "Server-side keys (never shown), authenticator"],
];
const KIND: Record<string, string> = { ok: "ok", not_configured: "warn", problem: "bad" };
const LABEL: Record<string, string> = { ok: "ok", not_configured: "not set up", problem: "needs attention" };

function uptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

/** Founder back office hub: the engine's health and a door to every area, all inside aelio.live. */
export function Engine() {
  const { data: d, error, reload } = useLoad<any>("/api/brain/engine");
  if (!d) return <><h1>Engine</h1><Err e={error} /></>;
  const problems = d.checks.filter((c: any) => c.status === "problem").length;
  return (
    <div className="grid">
      <div className="spread"><div><h1>AELIO Engine</h1><p className="sub">Everything behind aelio.live, in one place. The engine is reached only through this site; it has no public address of its own.</p></div>
        <button className="dark-btn" onClick={reload}>Refresh</button></div>
      <div className={problems ? "notice" : "notice good"}>{problems ? `${problems} check${problems > 1 ? "s need" : " needs"} attention.` : "Engine is running."} Version {d.version} · up {uptime(d.uptime_s)} · Python {d.python}</div>
      <div className="grid g4">
        {[["Accounts", d.counts.users], ["User agents", d.counts.agents], ["Conversations", d.counts.conversations], ["AI requests (24h)", d.counts.ai_requests_24h]]
          .map(([l, v]: any) => <div className="card" key={l}><div className="dim">{l}</div><div className="stat">{v}</div></div>)}
      </div>
      <div className="card"><h2>System health</h2>
        <table><tbody>{d.checks.map((c: any) => <tr key={c.name}><td><b>{c.name}</b></td><td><Badge kind={KIND[c.status]}>{LABEL[c.status]}</Badge></td><td className="dim">{c.detail}</td></tr>)}</tbody></table></div>
      <div className="card"><h2>Back office</h2>
        <div className="grid g3">{AREAS.map(([href, t, s]) => <A key={href} href={href} className="item"><b>{t}</b><div className="dim small">{s}</div></A>)}</div></div>
      <div className="card"><h2>Recent activity</h2>{d.recent_activity.length ? <table><tbody>{d.recent_activity.map((a: any, i: number) => <tr key={i}><td className="dim">{ago(a.ts)}</td><td>{a.action}</td><td className="dim">{a.actor_type}</td><td className="dim mono small">{a.target || ""}</td></tr>)}</tbody></table> : <Empty>No activity yet.</Empty>}</div>
    </div>);
}
