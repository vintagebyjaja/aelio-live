import { useEffect, useMemo, useRef, useState } from "react";
import { api, ago, post } from "./api";
import { Badge, Err, Tabs, useLoad } from "./ui";

// Which public page to preview for each section.
const PAGE: Record<string, string> = { home: "/", aelio: "/aelio/", dream: "/dream-beyond/", tech: "/technology/", create: "/create/",
  values: "/values/", campus: "/agent-campus/", live: "/live/", green: "/technology/green-guardians/" };
const asset = (id: string) => `/api/public/site-assets/${id}`;
const kb = (n: number) => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.round(n / 1024) + " KB";

function readFile(f: File): Promise<string> {
  return new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => bad(new Error("Couldn't read the file")); r.readAsDataURL(f); });
}

/** Founder-only Web Designer: change the public site's look (images, colours, type, buttons) without a redeploy. */
export function WebDesigner() {
  const { data, error, reload, setData } = useLoad<any>("/api/brain/site-design");
  const [tab, setTab] = useState("Page images");
  const [draft, setDraft] = useState<any>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [section, setSection] = useState("home");
  const [token, setToken] = useState(""); const [frameKey, setFrameKey] = useState(0);
  const fileIn = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (data && !dirty) setDraft(data.draft); }, [data]);
  useEffect(() => { post("/api/brain/site-design/preview").then((r: any) => setToken(r.token)).catch(() => {}); }, []);

  const set = (path: string[], v: any) => {
    setDraft((d: any) => { const n = structuredClone(d); let o = n; for (const k of path.slice(0, -1)) o = o[k]; o[path[path.length - 1]] = v; return n; });
    setDirty(true); setMsg("");
  };
  async function run(label: string, fn: () => Promise<any>, ok: string) {
    setBusy(label); setErr(""); setMsg("");
    try { await fn(); setMsg(ok); } catch (e: any) { setErr(e.message); }
    setBusy("");
  }
  const save = () => run("save", async () => { const r: any = await api("/api/brain/site-design", { method: "PUT", body: { design: draft } }); setData(r); setDraft(r.draft); setDirty(false); setFrameKey(k => k + 1); }, "Draft saved. The preview shows it; the live site doesn't change until you publish.");
  const publish = () => run("publish", async () => {
    if (dirty) { const r: any = await api("/api/brain/site-design", { method: "PUT", body: { design: draft } }); setDraft(r.draft); setDirty(false); }
    const note = prompt("Optional note for this version (for example: new Values photo)") || "";
    const r: any = await post("/api/brain/site-design/publish", { note }); reload(); setFrameKey(k => k + 1); return r;
  }, "Published. Visitors see the new design within a minute.");
  async function upload(files: FileList | null, forSection?: string) {
    if (!files || !files.length) return;
    await run("upload", async () => {
      let last: any = null;
      for (const f of Array.from(files)) {
        if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name} is larger than 10 MB`);
        last = await post("/api/brain/site-assets", { name: f.name, data_b64: await readFile(f) });
      }
      const r: any = await api("/api/brain/site-design"); setData({ ...r, draft: draft });
      if (forSection && last) set(["heroes", forSection, "image"], last.id);
    }, forSection ? "Image uploaded and placed. Save the draft to preview it." : "Image uploaded to the library.");
  }

  const previewUrl = useMemo(() => token ? `${PAGE[section]}?designPreview=${encodeURIComponent(token)}` : "", [token, section]);
  if (!data || !draft) return <><h1>Web Designer</h1><Err e={error} /></>;
  const th = draft.theme, h = draft.heroes[section];
  const sections: [string, string][] = Object.entries(data.sections);

  return (
    <div className="grid">
      <div className="spread"><div><h1>Web Designer</h1>
        <p className="sub">Change how aelio.live looks: page images, colours, headings and buttons. Edits stay in a private draft until you publish.</p></div>
        <div className="row">
          {dirty ? <Badge kind="warn">unsaved changes</Badge> : data.changed ? <Badge kind="warn">draft differs from live</Badge> : <Badge kind="ok">draft = live</Badge>}
          <span className="dim small">Live: {data.live.version ? `version ${data.live.version} · ${ago(data.live.published_at)}` : "built-in design"}</span>
          <button className="ghost" disabled={!dirty || !!busy} onClick={save}>Save draft</button>
          <button className="gold-btn" disabled={!!busy || (!dirty && !data.changed)} onClick={publish}>Publish to aelio.live</button>
        </div></div>
      {msg && <div className="notice good">{msg}</div>}<Err e={err} />

      <div className="designer">
        <div>
          <Tabs tabs={["Page images", "Style", "Image library", "History"]} on={tab} set={setTab} />

          {tab === "Page images" && <div className="card">
            <label htmlFor="ds-sec">Page</label>
            <select id="ds-sec" value={section} onChange={(e: any) => setSection(e.target.value)}>{sections.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <div className="ds-current">{h.image ? <img src={asset(h.image)} alt="" /> : <div className="dim small">Using the built-in animated scene for {data.sections[section]}.</div>}</div>
            <div className="row">
              <button className="ghost" onClick={() => fileIn.current?.click()} disabled={!!busy}>{busy === "upload" ? "Uploading…" : "Upload new image"}</button>
              <input ref={fileIn} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e: any) => { upload(e.target.files, section); e.target.value = ""; }} />
              {h.image && <button className="ghost" onClick={() => set(["heroes", section, "image"], null)}>Use built-in scene</button>}
            </div>
            {data.assets.length > 0 && <><label>Or pick from your library</label>
              <div className="ds-thumbs">{data.assets.map((a: any) => <button key={a.id} className={h.image === a.id ? "on" : ""} title={a.name} onClick={() => set(["heroes", section, "image"], a.id)}><img src={asset(a.id)} alt={a.name} loading="lazy" /></button>)}</div></>}
            {h.image && <>
              <label>Focus point, left to right: {h.focus_x}%</label><input type="range" min="0" max="100" value={h.focus_x} onChange={(e: any) => set(["heroes", section, "focus_x"], +e.target.value)} />
              <label>Focus point, top to bottom: {h.focus_y}%</label><input type="range" min="0" max="100" value={h.focus_y} onChange={(e: any) => set(["heroes", section, "focus_y"], +e.target.value)} />
              <label>Darkness behind the headline: {h.shade}%</label><input type="range" min="0" max="95" value={h.shade} onChange={(e: any) => set(["heroes", section, "shade"], +e.target.value)} />
              <label className="check"><input type="checkbox" checked={h.motion} onChange={(e: any) => set(["heroes", section, "motion"], e.target.checked)} /> Subtle slow motion on the image</label>
            </>}
            {section !== "home" && <label className="check"><input type="checkbox" checked={h.subpages} onChange={(e: any) => set(["heroes", section, "subpages"], e.target.checked)} /> Also use on every {data.sections[section]} subpage</label>}
            <p className="dim small">Tip: use wide images (at least 1920 × 1080) with no text, buttons or website screenshots in them. PNG, JPEG or WebP, up to 10 MB.</p>
          </div>}

          {tab === "Style" && <div className="card">
            <div className="grid g2">
              {[["gold", "Accent (gold)"], ["copper", "Second accent (copper)"], ["bg", "Background"], ["text", "Text"]].map(([k, l]) =>
                <div key={k}><label htmlFor={"ds-" + k}>{l}</label><div className="row"><input id={"ds-" + k} type="color" value={th[k]} onChange={(e: any) => set(["theme", k], e.target.value)} /><code>{th[k]}</code></div></div>)}
            </div>
            <label>Heading size: {Math.round(th.heading_scale * 100)}%</label><input type="range" min="70" max="130" value={Math.round(th.heading_scale * 100)} onChange={(e: any) => set(["theme", "heading_scale"], +e.target.value / 100)} />
            <label>Corner roundness: {th.radius}px</label><input type="range" min="0" max="32" value={th.radius} onChange={(e: any) => set(["theme", "radius"], +e.target.value)} />
            <label htmlFor="ds-btn">Button style</label>
            <select id="ds-btn" value={th.button} onChange={(e: any) => set(["theme", "button"], e.target.value)}><option value="rounded">Rounded</option><option value="pill">Pill</option><option value="square">Square</option></select>
            <label className="check"><input type="checkbox" checked={draft.intro.enabled} onChange={(e: any) => set(["intro", "enabled"], e.target.checked)} /> Play the 4-second entrance on the home page (once per visit)</label>
            <div className="row" style={{ marginTop: 14 }}><button className="ghost" onClick={() => { if (confirm("Reset the draft to the built-in design? The live site doesn't change until you publish.")) run("reset", async () => { const r: any = await post("/api/brain/site-design/reset"); setDraft(r.draft); setDirty(false); reload(); setFrameKey(k => k + 1); }, "Draft reset to the built-in design."); }}>Reset draft to built-in design</button></div>
          </div>}

          {tab === "Image library" && <div className="card">
            <div className="row"><button className="ghost" onClick={() => document.getElementById("ds-lib")?.click()} disabled={!!busy}>{busy === "upload" ? "Uploading…" : "Upload images"}</button>
              <input id="ds-lib" type="file" multiple accept="image/png,image/jpeg,image/webp" hidden onChange={(e: any) => { upload(e.target.files); e.target.value = ""; }} /></div>
            {data.assets.length === 0 ? <p className="dim">No images yet.</p> :
              <div className="ds-lib">{data.assets.map((a: any) => <div key={a.id} className="ds-item"><img src={asset(a.id)} alt="" loading="lazy" /><div className="small"><b>{a.name}</b><br /><span className="dim">{kb(a.bytes)} · {ago(a.created_at)}</span></div>
                <button className="ghost sm" onClick={() => run("del", async () => { await api(`/api/brain/site-assets/${a.id}`, { method: "DELETE" }); reload(); }, "Image removed.")}>Remove</button></div>)}</div>}
          </div>}

          {tab === "History" && <div className="card">
            {data.history.length === 0 ? <p className="dim">Nothing published yet. The site is using its built-in design.</p> :
              <table><thead><tr><th>Version</th><th>Published</th><th>Note</th><th></th></tr></thead><tbody>
                {data.history.map((v: any) => <tr key={v.version}><td>{v.version}{v.version === data.live.version && <> <Badge kind="ok">live</Badge></>}</td><td>{ago(v.published_at)}</td><td className="dim">{v.note || "—"}</td>
                  <td><button className="ghost sm" onClick={() => run("restore", async () => { const r: any = await post("/api/brain/site-design/restore", { version: v.version }); setDraft(r.draft); setDirty(false); reload(); setFrameKey(k => k + 1); }, `Version ${v.version} copied into the draft. Publish to make it live again.`)}>Restore to draft</button></td></tr>)}
              </tbody></table>}
          </div>}
        </div>

        <div className="card ds-preview">
          <div className="spread"><b>Preview (your draft)</b><div className="row">
            <button className="ghost sm" onClick={() => setFrameKey(k => k + 1)}>Reload</button>
            {previewUrl && <a className="ghost sm" href={previewUrl} target="_blank" rel="noopener">Open full page ↗</a>}</div></div>
          {dirty && <p className="small dim">Save the draft to see your latest changes here.</p>}
          {previewUrl ? <iframe key={frameKey + previewUrl} src={previewUrl} title="Draft preview" /> : <p className="dim">Preparing a private preview link…</p>}
          <p className="small dim">Only you can see the draft. The preview link expires after 30 minutes.</p>
        </div>
      </div>
    </div>);
}
