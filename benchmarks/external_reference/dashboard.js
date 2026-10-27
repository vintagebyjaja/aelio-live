// EXTERNAL-ASSISTED REFERENCE. Written by Claude (Anthropic) as a development assistant.
// This is NOT AELIO Native output and is NOT training-eligible. See PROVENANCE.json.

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const STYLE = `
.aelio-dash{box-sizing:border-box;max-width:1100px;margin:0 auto;padding:16px;display:grid;gap:16px}
.aelio-dash *{box-sizing:border-box}
.aelio-dash section{background:#121a2b;border:1px solid #23314d;border-radius:12px;padding:16px;min-width:0}
.aelio-dash h2{margin:0 0 10px;font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#9fb0c8}
.aelio-dash .state{font-weight:700;text-transform:capitalize}
.aelio-dash .state.operational{color:#5fd39a}.aelio-dash .state.degraded{color:#f2b84b}.aelio-dash .state.down{color:#ff6b6b}
.aelio-dash ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.aelio-dash li{display:flex;gap:12px;overflow-wrap:anywhere}.aelio-dash time{color:#9fb0c8;flex:none}
.aelio-dash .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.aelio-dash .metric{background:#0d1422;border-radius:10px;padding:14px}
.aelio-dash .metric .v{font-size:28px;font-weight:700}.aelio-dash .metric .u{color:#9fb0c8;margin-left:4px}
@media (max-width:640px){.aelio-dash .metrics{grid-template-columns:1fr}}`;

export function renderDashboard(data) {
  const status = data?.status ?? {};
  const activity = (data?.activity ?? []).slice(0, 5);
  const metrics = (data?.metrics ?? []).slice(0, 3);
  const items = activity.length
    ? `<ul>${activity.map((a) => `<li><time>${esc(a.time)}</time><span>${esc(a.text)}</span></li>`).join("")}</ul>`
    : `<p>No recent activity</p>`;
  const cards = metrics
    .map((m) => `<div class="metric" data-metric="${esc(m.label)}"><div class="l">${esc(m.label)}</div><div><span class="v">${esc(m.value)}</span><span class="u">${esc(m.unit)}</span></div></div>`)
    .join("");
  return `<style>${STYLE}</style><div class="aelio-dash">
<section data-section="status" aria-label="System status"><h2>System status</h2><p><span class="state ${esc(status.state)}">${esc(status.state)}</span> — ${esc(status.message)}</p><p><small>Updated ${esc(status.updatedAt)}</small></p></section>
<section data-section="metrics" aria-label="Performance metrics"><h2>Performance</h2><div class="metrics">${cards}</div></section>
<section data-section="activity" aria-label="Recent activity"><h2>Recent activity</h2>${items}</section>
</div>`;
}
