import { ago } from "./api";
import { Badge, Err, useLoad } from "./ui";

const KIND: Record<string, string> = { configured_unverified:"warn",recently_verified:"ok",test_only:"warn", operational: "ok", partial: "warn", not_connected: "warn", not_available: "bad" };
const LABEL: Record<string, string> = { configured_unverified:"configured; inference unverified",recently_verified:"successful inference in last 10 minutes",test_only:"offline test provider; not AI", operational: "operational", partial: "partial", not_connected: "not connected", not_available: "not built yet" };
const NAMES: Record<string, string> = { reasoning: "Reasoning", coding: "Coding", memory: "Memory", vision: "Vision", voice: "Voice", agents: "Agents" };

/** AELIO Core: the one AI behind every product, and the Firebase -> Supabase sign-in migration. Founder only. */
export function Core() {
  const { data: d, error, reload } = useLoad<any>("/api/brain/core");
  if (!d) return <><h1>AELIO Core</h1><Err e={error} /></>;
  const svc = Object.entries(d.services) as [string, any][];
  const up = svc.filter(([, v]) => v.status === "operational").length;
  const prov: string[] = d.identity.providers_enabled;
  const stage = prov.includes("supabase") ? "Supabase only" : "Supabase configuration missing";
  return (
    <div className="grid">
      <div className="spread"><div><h1>AELIO Core</h1><p className="sub">One AI for every product. Each request is planned across specialised services; people see a single answer.</p></div>
        <button className="dark-btn" onClick={reload}>Refresh</button></div>
      <div className="notice">{up} of {svc.length} local services operational. External inference is labeled separately as configured, recently verified, or test-only.</div>

      <div className="card"><h2>Services</h2>
        <table><tbody>{svc.map(([k, v]) => <tr key={k}><td><b>{NAMES[k] || k}</b></td><td><Badge kind={KIND[v.status] || "warn"}>{LABEL[v.status] || v.status}</Badge></td><td className="dim">{v.detail}</td></tr>)}</tbody></table></div>

      <div className="grid g2">
        <div className="card"><h2>Products</h2>
          <table><thead><tr><th>Product</th><th>Connection</th><th>Requests (24h)</th></tr></thead><tbody>
            {Object.entries(d.products).map(([id, name]: any) => {
              const app = d.product_apps.find((a: any) => a.slug === id);
              return <tr key={id}><td><b>{name}</b></td>
                <td>{id === "aelio" ? <Badge kind="ok">built in</Badge> : app ? <Badge kind={app.active ? "ok" : "bad"}>{app.active ? "key issued" : "key disabled"}</Badge> : <Badge kind="warn">no key yet</Badge>}</td>
                <td>{d.requests_24h[id] || 0}</td></tr>;
            })}</tbody></table>
          <p className="small dim">Products reach AELIO through a private Cloudflare service binding with a product key plus the person's own sign-in. There is no public engine address.</p></div>

        <div className="card"><h2>Sign-in migration</h2>
          <p><Badge kind={prov.includes("supabase") ? "ok" : "warn"}>{stage}</Badge></p>
          <table><tbody>
            <tr><td>Supabase project</td><td>{d.identity.supabase_configured ? <Badge kind="ok">configured</Badge> : <Badge kind="warn">not set up</Badge>}</td></tr>
            <tr><td>Historical legacy identity mappings</td><td>{d.identity.linked.firebase || 0}</td></tr>
            <tr><td>Linked Supabase sign-ins</td><td>{d.identity.linked.supabase || 0}</td></tr>
            <tr><td>People from products (e.g. PATHD)</td><td>{d.identity.product_users}</td></tr>
            <tr><td>Latest verified backup</td><td>{d.backups.latest ? <>{ago(d.backups.latest.created_at)} · <Badge kind={d.backups.latest.integrity === "ok" ? "ok" : "bad"}>{d.backups.latest.integrity}</Badge></> : <Badge kind="warn">none yet</Badge>}</td></tr>
          </tbody></table>
          <p className="small dim">Firebase runtime sign-in is removed. Keep historical backups and reviewed mappings until migration verification is complete. Configuration alone does not verify a live Supabase connection.</p></div>
      </div>
    </div>);
}
