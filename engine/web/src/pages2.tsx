import { useEffect, useRef, useState } from "react";
import { ago, api, post, put, ts, waitJob } from "./api";
import { Confusion } from "./pages1";
import { Badge, Empty, Err, JobLog, LineChart, Num, Status, Tabs, useLoad } from "./ui";

/* ------------------------------------------------------------ Quality Lab */
export function QualityLab() {
  const s = useLoad<any>("/api/quality/suites");
  const r = useLoad<any>("/api/quality/runs");
  const p = useLoad<any>("/api/projects");
  const o = useLoad<any>("/api/overview");
  const [tab, setTab] = useState("Runs"); const [rid, setRid] = useState(""); const [job, setJob] = useState<any>(null); const [err, setErr] = useState("");
  const [suite, setSuite] = useState("dashboard_benchmark_v1"); const [pid, setPid] = useState("");
  async function run() { setErr(""); try { const x: any = await post("/api/quality/run", { suite, project_id: pid || p.data?.projects?.[0]?.id }); waitJob(x.job_id, setJob).then(() => r.reload()); } catch (e: any) { setErr(e.message); } }
  const fr = o.data?.first_run;
  return (
    <div>
      <h1>Quality Lab</h1>
      <p className="sub">Independent testing. Protected suites are hash-locked: coding agents can't edit them or change how they're scored. Results are parsed from raw test output inside the sandbox.</p>
      <Tabs tabs={["Runs", "Suites", "First-run report"]} on={tab} set={setTab} />
      <Err e={err || s.error || r.error} />
      {tab === "Runs" && <div className="grid">
        <div className="card">
          <h2>Run a protected suite</h2>
          <div className="row">
            <select style={{ width: "auto" }} value={suite} onChange={(e: any) => setSuite(e.target.value)}>{(s.data?.suites || []).filter((x: any) => x.steps.length).map((x: any) => <option key={x.id}>{x.id}</option>)}</select>
            <select style={{ width: "auto" }} value={pid} onChange={(e: any) => setPid(e.target.value)}>{(p.data?.projects || []).map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <button className="primary" disabled={!p.data?.projects?.length} onClick={run}>Run in sandbox</button>
          </div>
          {job && <JobLog job={job} />}
        </div>
        <div className="card">
          <h2>Evaluation history</h2>
          <div className="tablewrap"><table><thead><tr><th>Run</th><th>Suite</th><th>Status</th><th>Passed</th><th>Failed</th><th>Time</th><th>Suite hash</th><th></th></tr></thead><tbody>
            {(r.data?.runs || []).map((x: any) => <tr key={x.id}><td className="mono dim">{x.id}</td><td>{x.suite}</td><td><Status s={x.status} /></td><td>{x.passed}</td><td>{x.failed}</td><td className="dim">{x.duration_s}s · {ago(x.created_at)}</td><td className="mono dim">{x.suite_sha256?.slice(0, 10)}</td><td><button onClick={() => setRid(x.id)}>Open</button></td></tr>)}
          </tbody></table></div>
          {!r.data?.runs?.length && <Empty>No runs yet.</Empty>}
        </div>
        {rid && <RunDetail rid={rid} />}
      </div>}
      {tab === "Suites" && <div className="grid">{(s.data?.suites || []).map((x: any) => (
        <div className="card" key={x.id}>
          <div className="spread"><b>{x.id}</b>{x.intact ? <Badge kind="ok">locked · intact</Badge> : <Badge kind="bad">hash mismatch: runs refused</Badge>}</div>
          <div className="muted">{x.description}</div>
          <div className="mono dim" style={{ fontSize: 11.5, marginTop: 6 }}>sha256 {x.sha256}</div>
          <div className="row" style={{ marginTop: 6 }}>{x.steps.map((st: any) => <Badge key={st.name}>{st.category}: {st.name}</Badge>)}</div>
          <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>{x.files.join(" · ")}</div>
        </div>))}</div>}
      {tab === "First-run report" && (fr ? <FirstRun fr={fr} /> : <Empty>No first-run report yet. Run <code>python -m aelio.cli first-run</code> on the server.</Empty>)}
    </div>
  );
}

function RunDetail({ rid }: any) {
  const { data: r } = useLoad<any>(`/api/quality/runs/${rid}`, [rid]);
  if (!r) return null;
  return (
    <div className="card">
      <div className="spread"><h2>Run {r.id}</h2><Status s={r.status} /></div>
      <div className="muted" style={{ fontSize: 12.5 }}>Sandbox: {r.sandbox?.backend} · network {r.sandbox?.network} · timeout {r.sandbox?.timeout_s}s · secrets visible: {String(r.sandbox?.secrets_visible)}</div>
      <table style={{ marginTop: 8 }}><tbody>{r.results.map((c: any, i: number) => <tr key={i}><td>{c.passed ? <Badge kind="ok">PASS</Badge> : <Badge kind="bad">FAIL</Badge>}</td><td>{c.name}<div className="dim" style={{ fontSize: 11 }}>{c.category} · {c.step}</div></td><td className="mono dim" style={{ fontSize: 11.5, maxWidth: 420 }}>{c.detail?.slice(0, 300)}</td></tr>)}</tbody></table>
      <h3>Raw log</h3><pre>{r.log}</pre>
    </div>
  );
}

function FirstRun({ fr }: any) {
  const [open, setOpen] = useState("");
  return (
    <div className="card">
      <div className="spread"><h2>First-run verification</h2><Badge kind={fr.all_passed ? "ok" : "bad"}>{fr.all_passed ? "all checks passed" : "some checks failed"}</Badge></div>
      <div className="dim">Host {fr.host} · {ts(fr.started)} → {ts(fr.finished)}</div>
      <table style={{ marginTop: 8 }}><tbody>{Object.entries(fr.tests).map(([k, v]: any) => (
        <tr key={k}><td>{v.passed ? <Badge kind="ok">PASS</Badge> : <Badge kind="bad">FAIL</Badge>}</td><td>{k}<div className="dim" style={{ fontSize: 11 }}>{v.seconds}s</div>{open === k && <pre>{JSON.stringify(v.detail, null, 2)}</pre>}</td><td><button className="ghost" onClick={() => setOpen(open === k ? "" : k)}>{open === k ? "Hide" : "Evidence"}</button></td></tr>))}
      </tbody></table>
    </div>
  );
}

/* ------------------------------------------------------------ Voice Lab */
export function VoiceLab() {
  const { data, error, reload } = useLoad<any>("/api/voices");
  const [sel, setSel] = useState("aelio-voice-groove"); const [text, setText] = useState("In two hundred feet, turn left onto Grooveville Avenue.");
  const [edit, setEdit] = useState<any>(null); const [err, setErr] = useState(""); const [job, setJob] = useState<any>(null);
  const v = data?.voices?.find((x: any) => x.voice_id === sel);
  useEffect(() => { if (v) setEdit({ description: v.description, ...v.params }); }, [sel, data]);
  async function synth() { setErr(""); try { const r: any = await post(`/api/voices/${sel}/synthesize`, { text }); waitJob(r.job_id, setJob).then(reload); } catch (e: any) { setErr(e.message); } }
  async function save() { setErr(""); try { const { description, ...params } = edit; await put(`/api/voices/${sel}`, { description, params }); reload(); } catch (e: any) { setErr(e.message); } }
  async function approve() { setErr(""); try { await post(`/api/voices/${sel}/approve`); reload(); } catch (e: any) { setErr(e.message); } }
  return (
    <div>
      <h1>Voice Lab</h1>
      <p className="sub">One shared AELIO Voice service with six AELIO-owned identities. A voice can speak only after a native speech model is trained and approved for it.</p>
      <Err e={error || err} />
      <div className="grid g3">{(data?.voices || []).map((x: any) => (
        <div key={x.voice_id} className={`item ${x.voice_id === sel ? "on" : ""}`} onClick={() => setSel(x.voice_id)}>
          <div className="spread"><b style={{ letterSpacing: ".12em" }}>{x.name}</b><Status s={x.status} /></div>
          <div className="muted" style={{ fontSize: 12.5 }}>{x.description}</div>
          <div className="dim" style={{ fontSize: 11.5, marginTop: 4 }}>Best for: {x.use_cases}</div>
          <div className="mono dim" style={{ fontSize: 11 }}>{x.voice_id}</div>
        </div>))}</div>
      {v && edit && <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card">
          <h2>{v.name}: profile</h2>
          <label>Description</label><textarea rows={3} style={{ fontFamily: "inherit" }} value={edit.description} onChange={(e: any) => setEdit({ ...edit, description: e.target.value })} />
          <div className="grid g3">{["rate", "pitch_semitones", "energy"].map((k) => <div key={k}><label>{k}</label><input type="number" step="0.05" value={edit[k]} onChange={(e: any) => setEdit({ ...edit, [k]: e.target.value })} /></div>)}</div>
          <div className="row" style={{ marginTop: 10 }}><button onClick={save}>Save profile</button><button disabled={!v.native_checkpoint_id} onClick={approve} title={v.native_checkpoint_id ? "" : "Needs a trained native speech checkpoint"}>Approve voice</button></div>
          <h3>Native model</h3>
          <div className="muted">{v.native_checkpoint_id || "No native speech checkpoint. Synthesis returns 'awaiting training' with no audio."}</div>
        </div>
        <div className="card">
          <h2>Synthesis test</h2>
          <label>Sample script</label><textarea rows={3} style={{ fontFamily: "inherit" }} value={text} onChange={(e: any) => setText(e.target.value)} />
          <div className="row" style={{ marginTop: 10 }}><button className="primary" onClick={synth}>Submit synthesis job</button></div>
          {job && <div style={{ marginTop: 8 }}><Status s={job.result?.status || job.status} /> <span className="muted">{job.result?.message}</span></div>}
        </div>
      </div>}
      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card">
          <h2>Synthesis jobs and latency</h2>
          {data?.synth?.length ? <table><tbody>{data.synth.map((s: any) => <tr key={s.id}><td>{s.voice_id.replace("aelio-voice-", "").toUpperCase()}</td><td><Status s={s.status} /></td><td className="dim">{s.latency_ms ?? "—"} ms</td><td className="dim">{ago(s.created_at)}</td></tr>)}</tbody></table> : <Empty>No jobs yet.</Empty>}
          <div className="dim" style={{ fontSize: 12 }}>Latency here is the pipeline's processing time. No audio is generated until a voice is trained.</div>
        </div>
        <div className="card">
          <h2>Speech datasets and training</h2>
          {data?.speech_datasets?.length ? <table><tbody>{data.speech_datasets.map((d: any) => <tr key={d.id}><td>{d.name}</td><td>{d.license}</td><td><Status s={d.status} /></td></tr>)}</tbody></table> : <Empty>No speech datasets registered.</Empty>}
          <div className="notice info">Each voice needs recordings from a voice performer who has signed a consent and licence agreement with Grooveville LLC, roughly 2–20 hours of clean speech per voice, plus GPU compute. See docs/VOICE.md. Groove Guide can already address any voice by ID through <code>/v1/voices</code>; synthesis returns 409 until the voice is approved.</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Vision Lab */
export function VisionLab() {
  const m = useLoad<any>("/api/models"); const ds = useLoad<any>("/api/datasets");
  const [job, setJob] = useState<any>(null); const [err, setErr] = useState("");
  const vis = (m.data?.models || []).filter((x: any) => x.family === "vision");
  const ev = (m.data?.evaluations || []).filter((e: any) => e.details?.confusion);
  async function train() {
    setErr("");
    try {
      let d = ds.data?.datasets?.find((x: any) => x.modality === "image");
      if (!d) { await post("/api/datasets/builtin", { name: "uci-optdigits-8x8" }); const r: any = await api("/api/datasets"); d = r.datasets.find((x: any) => x.modality === "image"); }
      const r: any = await post("/api/train", { kind: "vision", dataset_id: d.id, epochs: 40 });
      waitJob(r.job_id, setJob).then(m.reload);
    } catch (e: any) { setErr(e.message); }
  }
  return (
    <div>
      <h1>Vision Lab</h1>
      <p className="sub">Image understanding, document analysis, architectural drawings and visual evaluation. Version 1 includes one narrow, real prototype. Everything else is listed with what it needs.</p>
      <Err e={err} />
      <div className="grid g2">
        <div className="card">
          <div className="spread"><h2>Prototype: handwritten digit classifier</h2><button className="primary" onClick={train}>Train new checkpoint</button></div>
          <div className="muted">8×8 greyscale digits (UCI, CC BY 4.0). MLP from random initialisation. Held-out 20% test split.</div>
          {vis.flatMap((x: any) => x.checkpoints).slice(0, 3).map((c: any) => <div key={c.id} className="row" style={{ marginTop: 8 }}><span className="mono">{c.id}</span><Status s={c.status} /><Badge kind="cyan">accuracy {(c.metrics.accuracy * 100).toFixed(1)}%</Badge><span className="dim">chance 10% · {c.metrics.test_images} test images</span></div>)}
          {!vis.length && <Empty>Not trained yet.</Empty>}
          {ev[0] && <div style={{ marginTop: 10 }}><Confusion m={ev[0].details.confusion} /></div>}
          {job && <JobLog job={job} />}
        </div>
        <div className="card">
          <h2>Capabilities and readiness</h2>
          <table><tbody>
            {[["Narrow image classification", "prototype", "Digits benchmark above"],
              ["Document interpretation (OCR, layout)", "untrained", "Licensed scanned-document dataset with labels"],
              ["Architectural drawing analysis (DrawUp)", "untrained", "Grooveville-owned annotated drawings; symbol and dimension labels"],
              ["UI screenshot comparison", "deterministic", "Pixel diffing can run in Quality Lab browser tests. No learned model."],
              ["Visual quality evaluation", "untrained", "Human-rated image pairs"],
              ["Image generation", "not started", "Interface reserved; requires large licensed image corpus + GPUs"]].map(([a, b, c]) => <tr key={a}><td>{a}</td><td><Status s={b} /></td><td className="muted">{c}</td></tr>)}
          </tbody></table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Live Lab */
export function LiveLab() {
  const video = useRef<any>(null);
  const [kind, setKind] = useState(""); const [stats, setStats] = useState<any>(null); const [err, setErr] = useState("");
  const stream = useRef<any>(null);
  async function start(k: string) {
    setErr(""); stop();
    try {
      const md: any = navigator.mediaDevices;
      const s = k === "screen" ? await md.getDisplayMedia({ video: true }) : await md.getUserMedia(k === "camera" ? { video: true, audio: false } : { audio: true });
      stream.current = s; setKind(k);
      if (video.current && k !== "microphone") video.current.srcObject = s;
      const t0 = performance.now(); let frames = 0;
      if (k === "microphone") {
        const ctx = new AudioContext(); const an = ctx.createAnalyser(); ctx.createMediaStreamSource(s).connect(an);
        const buf = new Float32Array(an.fftSize);
        const tick = () => { if (!stream.current) return ctx.close(); an.getFloatTimeDomainData(buf); const rms = Math.sqrt(buf.reduce((a, b) => a + b * b, 0) / buf.length); setStats({ rms: rms.toFixed(4), sampleRate: ctx.sampleRate, secs: ((performance.now() - t0) / 1000).toFixed(1) }); requestAnimationFrame(tick); };
        tick();
      } else {
        const v = video.current;
        const tick = () => { if (!stream.current) return; frames++; const tr = s.getVideoTracks()[0]?.getSettings() || {}; setStats({ width: tr.width, height: tr.height, measuredFps: (frames / ((performance.now() - t0) / 1000)).toFixed(1) }); (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(tick) : requestAnimationFrame(tick)); };
        tick();
      }
    } catch (e: any) { setErr(e.message || String(e)); }
  }
  function stop() { stream.current?.getTracks().forEach((t: any) => t.stop()); stream.current = null; setKind(""); }
  useEffect(() => stop, []);
  return (
    <div>
      <h1>Live Lab</h1>
      <p className="sub">Real-time audio, video, camera and screen-sharing experiments. This tests the capture pipeline in your browser. AELIO has no real-time multimodal understanding yet, and this page doesn't claim any.</p>
      <div className="grid g2">
        <div className="card">
          <h2>Capture pipeline test</h2>
          <div className="row"><button onClick={() => start("camera")}>Camera</button><button onClick={() => start("microphone")}>Microphone</button><button onClick={() => start("screen")}>Screen share</button><button className="danger" disabled={!kind} onClick={stop}>Stop</button></div>
          <Err e={err} />
          <div style={{ marginTop: 10 }}><video ref={video} autoPlay muted playsInline style={{ display: kind && kind !== "microphone" ? "block" : "none" }} /></div>
          {stats && <pre>{JSON.stringify({ source: kind, ...stats, processed_by: "browser only; no frames leave this page" }, null, 2)}</pre>}
        </div>
        <div className="card">
          <h2>Readiness</h2>
          <table><tbody>
            {[["Camera / mic / screen capture", "working (browser)"], ["Streaming to AELIO server", "not started"], ["Speech recognition (native)", "untrained"],
              ["Turn-taking and interruption handling", "untrained"], ["Video temporal understanding", "untrained"], ["End-to-end live multimodal session", "not demonstrated"]].map(([a, b]) => <tr key={a}><td>{a}</td><td><Status s={b} /></td></tr>)}
          </tbody></table>
          <div className="notice info" style={{ marginTop: 10 }}>The next measurable step is a native speech-recognition prototype scored by word error rate on a licensed held-out set (Milestone C).</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Agent Campus */
export function AgentCampus() {
  const { data, error } = useLoad<any>("/api/agents");
  return (
    <div>
      <h1>Agent Campus</h1>
      <p className="sub">Registry of AELIO agents with their capabilities, tools and permissions. Agents call tools only through permission-checked interfaces. No agent can grant itself permissions, because no such route exists.</p>
      <Err e={error} />
      <div className="grid g2">{(data?.agents || []).map((a: any) => (
        <div className="card" key={a.id}>
          <div className="spread"><b>{a.name}</b><div className="row"><Badge kind={a.division === "Green Guardians" ? "ok" : "gold"}>{a.division}</Badge><Status s={a.status} /></div></div>
          <div className="muted" style={{ fontSize: 12.5 }}>Engine: {a.engine} · {a.kind}</div>
          <h3>Capabilities</h3><div className="row">{(a.capabilities || []).map((c: string) => <Badge key={c}>{c}</Badge>)}</div>
          <h3>Tools</h3><div className="row">{(a.tools || []).map((c: string) => <Badge key={c} kind="cyan">{c}</Badge>)}</div>
          <h3>Permissions</h3><div className="mono dim" style={{ fontSize: 11.5 }}>{JSON.stringify(a.permissions)}</div>
        </div>))}</div>
    </div>
  );
}

/* ------------------------------------------------------------ Operations */
export function Operations() {
  const [tab, setTab] = useState("Green Guardians");
  return (
    <div>
      <h1>Operations</h1>
      <p className="sub">Infrastructure, GPUs, training, API traffic, deployments, costs and Green Guardians. Real readings where the host provides them; missing data says "Data unavailable".</p>
      <Tabs tabs={["Green Guardians", "Infrastructure", "Training", "API", "Deployments", "Financial"]} on={tab} set={setTab} />
      {tab === "Green Guardians" ? <Guardians /> : tab === "Deployments" ? <Deployments /> : <OpsPanel tab={tab} />}
    </div>
  );
}

function OpsPanel({ tab }: any) {
  const { data: d, error } = useLoad<any>("/api/operations");
  if (!d) return <Err e={error} />;
  if (tab === "Infrastructure") return (
    <div className="grid g2">
      <div className="card"><h2>Host</h2><div className="kv">
        <div>Host</div><div>{d.infrastructure.host}</div><div>CPUs</div><div>{d.infrastructure.cpus}</div><div>Memory</div><div>{d.infrastructure.mem_gb} GB</div>
        <div>Disk free</div><div>{d.infrastructure.disk_free_gb} GB</div><div>Sandbox backend</div><div>{d.infrastructure.sandbox_backend}</div>
        <div>GPU</div><div>{d.gpu.available ? "present" : <span className="dim">{d.gpu.note}</span>}</div></div></div>
      <div className="card"><h2>Latest telemetry</h2><table><tbody>{Object.values(d.infrastructure.telemetry).map((t: any) => <tr key={t.metric}><td>{t.metric}</td><td className="mono"><Num v={t.value} unit={t.unit} /></td><td className="dim">{t.source}</td></tr>)}</tbody></table>
        {!Object.keys(d.infrastructure.telemetry).length && <Empty>No telemetry yet. Run a Guardian cycle.</Empty>}</div>
    </div>);
  if (tab === "Training") return <div className="card"><h2>Training operations</h2><table><thead><tr><th>Job</th><th>Kind</th><th>Status</th><th>Duration</th><th>Error</th></tr></thead><tbody>{d.training.map((j: any) => <tr key={j.id}><td className="mono dim">{j.id}</td><td>{j.kind}</td><td><Status s={j.status} /></td><td className="dim">{j.finished_at && j.started_at ? `${(j.finished_at - j.started_at).toFixed(0)}s` : "—"}</td><td className="err">{j.error}</td></tr>)}</tbody></table></div>;
  if (tab === "API") return <div className="card"><h2>API operations (last 24 hours)</h2>{d.api.length ? <table><thead><tr><th>Route</th><th>Requests</th><th>Avg latency</th><th>Errors</th></tr></thead><tbody>{d.api.map((a: any) => <tr key={a.route}><td className="mono">{a.route}</td><td>{a.n}</td><td>{a.avg_ms?.toFixed(1)} ms</td><td>{a.errors}</td></tr>)}</tbody></table> : <Empty>No gateway traffic yet.</Empty>}</div>;
  return <div className="card"><h2>Financial operations</h2><div className="kv"><div>Infrastructure cost</div><div><Num v={d.finance.infrastructure_cost} /></div><div>API cost</div><div><Num v={d.finance.api_cost} /></div><div>Artifact storage</div><div>{(d.finance.storage_bytes / 1e6).toFixed(1)} MB</div></div><div className="muted" style={{ marginTop: 8 }}>{d.finance.note}</div></div>;
}

function Guardians() {
  const { data, error, reload } = useLoad<any>("/api/guardians");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function act(path: string, body: any = {}) { setErr(""); setBusy(true); try { await post(path, body); reload(); } catch (e: any) { setErr(e.message); } setBusy(false); }
  if (!data) return <Err e={error} />;
  const series = (m: string, color: string, name: string) => ({ name, color, points: data.history.filter((h: any) => h.metric === m && !h.simulated).map((h: any) => [Math.round((h.ts - Date.now() / 1000) / 60), h.value]) });
  const temps = data.history.filter((h: any) => h.metric === "cpu_temp_c" && !h.simulated && h.value !== null);
  return (
    <div className="grid">
      <div className="notice good">Mission: prevent unnecessary heat before more cooling is needed. Mode: <b>{data.mode}</b>. Guardians never change firmware, fans, power limits or cooling hardware.</div>
      <Err e={err} />
      <div className="row"><button className="primary" disabled={busy} onClick={() => act("/api/guardians/cycle")}>Run monitoring cycle (real telemetry)</button><button disabled={busy} onClick={() => act("/api/guardians/simulate")}>Run synthetic thermal scenario</button></div>
      <div className="grid g2">
        <div className="card"><h2>Utilisation (24 hours)</h2><LineChart xLabel="minutes ago" yLabel="%" series={[series("cpu_util_pct", "#5ad1e6", "CPU"), series("mem_used_pct", "#ffb83e", "Memory")]} /></div>
        <div className="card"><h2>Temperature (24 hours)</h2>{temps.length ? <LineChart xLabel="minutes ago" yLabel="°C" series={[series("cpu_temp_c", "#ff6b6b", "CPU")]} /> : <Empty>CPU temperature: Data unavailable on this host.</Empty>}</div>
      </div>
      <div className="grid g3">{data.agents.map((a: any) => <div className="card" key={a.id}><b>{a.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{(a.capabilities || []).join(", ")}</div><div className="row" style={{ marginTop: 6 }}><Badge kind="ok">{a.permissions?.mode}</Badge><Badge>hardware write: {String(a.permissions?.hardware_write)}</Badge></div></div>)}</div>
      <div className="card">
        <h2>Recommendations and learning history</h2>
        <div className="tablewrap"><table><thead><tr><th>When</th><th>Agent</th><th>Severity</th><th>Recommendation</th><th>Decision</th><th></th></tr></thead><tbody>
          {data.events.map((e: any) => <tr key={e.id}><td className="dim">{ago(e.ts)}</td><td>{e.agent.replace("guardian-", "")}</td><td><Status s={e.severity} />{e.simulated ? <> <Badge kind="violet">SIMULATED</Badge></> : null}</td><td>{e.message}<div className="mono dim" style={{ fontSize: 11 }}>{JSON.stringify(e.recommendation)}</div>{e.result && <div className="mono dim" style={{ fontSize: 11 }}>result: {JSON.stringify(e.result)}</div>}</td><td><Status s={e.action_status} /></td>
            <td>{e.action_status === "recommended" && (e.recommendation?.requires_approval
              ? <div className="row"><button onClick={() => act(`/api/guardians/events/${e.id}/decide`, { approve: true })}>Approve</button><button className="ghost" onClick={() => act(`/api/guardians/events/${e.id}/decide`, { approve: false })}>Dismiss</button></div>
              : <button className="ghost" onClick={() => act(`/api/guardians/events/${e.id}/decide`, { approve: false })}>Acknowledge</button>)}</td></tr>)}
        </tbody></table></div>
        {!data.events.length && <Empty>No events yet. Run a cycle.</Empty>}
        <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>Energy and water savings appear only when backed by measurements. No measured savings are recorded yet.</div>
      </div>
    </div>
  );
}

function Deployments() {
  const { data, error, reload } = useLoad<any>("/api/deployments");
  const [code, setCode] = useState(""); const [err, setErr] = useState("");
  async function approve(id: string) { setErr(""); try { await post(`/api/deployments/${id}/approve`, { code }); reload(); } catch (e: any) { setErr(e.message); } }
  async function reject(id: string) { setErr(""); try { await post(`/api/deployments/${id}/reject`); reload(); } catch (e: any) { setErr(e.message); } }
  return (
    <div className="grid">
      <div className="notice">Production releases require your approval with a fresh authenticator code. AELIO holds no production credentials, and an approved deployment is recorded but not executed until a production target is configured.</div>
      <Err e={err || error} />
      {(data?.deployments || []).map((d: any) => (
        <div className="card" key={d.id}>
          <div className="spread"><div className="row"><b className="mono">{d.id}</b><Badge>{d.target}</Badge><Status s={d.status} /></div><span className="dim">{ago(d.created_at)} · requested by {d.requested_by}</span></div>
          <div className="pipeline">{d.stages.map((s: any) => <span key={s.stage} className={`stage ${/done|approved/.test(s.status) ? "ok" : /fail|blocked/.test(s.status) ? "failed" : ""}`}>{s.stage.replace(/_/g, " ")}: {s.status}</span>)}</div>
          <pre style={{ maxHeight: 160 }}>{JSON.stringify(d.plan, null, 2)}</pre>
          {d.status === "awaiting_founder_review" && <div className="row"><input style={{ width: 140 }} placeholder="6-digit code" value={code} onChange={(e: any) => setCode(e.target.value)} /><button className="primary" onClick={() => approve(d.id)}>Approve for production</button><button className="danger" onClick={() => reject(d.id)}>Reject</button></div>}
        </div>))}
      {!data?.deployments?.length && <Empty>No deployment requests yet.</Empty>}
    </div>
  );
}

/* ------------------------------------------------------------ Settings */
export function Settings({ me, reverify }: any) {
  const [tab, setTab] = useState("Security");
  const s = useLoad<any>("/api/settings"); const a = useLoad<any>("/api/apps"); const au = useLoad<any>("/api/audit");
  const [sec, setSec] = useState({ name: "", value: "" }); const [app, setApp] = useState<any>({ name: "", slug: "", scopes: ["status:read"] });
  const [key, setKey] = useState(""); const [err, setErr] = useState(""); const [st, setSt] = useState<any>(null);
  async function addSecret() { setErr(""); try { await post("/api/secrets", sec); setSec({ name: "", value: "" }); s.reload(); } catch (e: any) { setErr(e.message); } }
  async function addApp() { setErr(""); try { const r: any = await post("/api/apps", app); setKey(r.api_key_shown_once); a.reload(); } catch (e: any) { setErr(e.message); } }
  async function selftest() { setErr(""); try { setSt(await post("/api/security/selftest")); } catch (e: any) { setErr(e.message); } }
  const d = s.data;
  return (
    <div>
      <h1>Settings</h1>
      <p className="sub">Authentication, permissions, secrets, applications, audit log and system policies.</p>
      <Tabs tabs={["Security", "Applications", "Audit log"]} on={tab} set={setTab} />
      <Err e={err || s.error} />
      {tab === "Security" && d && <div className="grid g2">
        <div className="card"><h2>Authentication</h2><div className="kv">
          <div>Mode</div><div>{d.auth.mode}</div><div>Founder</div><div>{d.auth.founder}</div>
          <div>Founder allow-list</div><div>{d.auth.mode === "supabase" ? (d.auth.founder_allowlist_configured ? "configured" : <span className="err">not configured</span>) : "n/a (local)"}</div>
          <div>Session length</div><div>{d.auth.session_hours} h</div><div>High-impact actions</div><div>authenticator code within {d.auth.mfa_fresh_minutes} min</div>
          <div>MFA right now</div><div>{me.mfa_fresh ? <Badge kind="ok">fresh</Badge> : <><Badge kind="warn">stale</Badge> <button onClick={reverify}>Re-verify</button></>}</div></div></div>
        <div className="card"><h2>Policies</h2><div className="kv">{Object.entries(d.policies).flatMap(([k, v]: any) => [<div key={k + ":k"}>{k.replace(/_/g, " ")}</div>, <div key={k + ":v"}>{v}</div>])}</div></div>
        <div className="card"><h2>Secrets</h2><div className="muted" style={{ fontSize: 12.5 }}>Stored on the server with owner-only file permissions. Values are never shown again, never sent to the browser, and never visible to sandboxed code.</div>
          <div className="row" style={{ margin: "8px 0" }}>{d.secrets.map((n: string) => <Badge key={n}>{n}</Badge>)}{!d.secrets.length && <span className="dim">none</span>}</div>
          <div className="grid g2"><input placeholder="NAME (e.g. GITHUB_TOKEN)" value={sec.name} onChange={(e: any) => setSec({ ...sec, name: e.target.value })} /><input type="password" placeholder="value" value={sec.value} onChange={(e: any) => setSec({ ...sec, value: e.target.value })} /></div>
          <div className="row" style={{ marginTop: 8 }}><button disabled={!sec.name || !sec.value} onClick={addSecret}>Store secret</button><span className="dim">needs fresh MFA · existing secrets are not overwritten</span></div></div>
        <div className="card"><h2>Sandbox self-test</h2><button onClick={selftest}>Run isolation self-test</button>{st && <pre>{JSON.stringify(st, null, 2)}</pre>}</div>
      </div>}
      {tab === "Applications" && <div className="grid">
        <div className="card"><h2>Register a Grooveville application</h2>
          <div className="muted" style={{ fontSize: 12.5 }}>Each app gets its own key, scopes, daily quota and audit trail, and shares the same AELIO model services. Registering an app here doesn't change the app itself.</div>
          <div className="grid g3"><div><label>Name</label><input value={app.name} onChange={(e: any) => setApp({ ...app, name: e.target.value })} list="eco" /><datalist id="eco">{(a.data?.ecosystem || []).map((x: string) => <option key={x} value={x} />)}</datalist></div><div><label>Slug</label><input value={app.slug} onChange={(e: any) => setApp({ ...app, slug: e.target.value })} /></div>
            <div><label>Scopes</label><div className="row">{(a.data?.scopes || []).map((sc: string) => <label key={sc} className="row" style={{ margin: 0, gap: 4 }}><input type="checkbox" style={{ width: "auto" }} checked={app.scopes.includes(sc)} onChange={(e: any) => setApp({ ...app, scopes: e.target.checked ? [...app.scopes, sc] : app.scopes.filter((x: string) => x !== sc) })} />{sc}</label>)}</div></div></div>
          <div className="row" style={{ marginTop: 10 }}><button className="primary" disabled={!app.name || !app.slug} onClick={addApp}>Register</button></div>
          {key && <div className="notice" style={{ marginTop: 10 }}>API key. This is the only time it's shown, so store it in the app's secret manager now:<pre>{key}</pre></div>}</div>
        <div className="card"><h2>Registered applications</h2><table><thead><tr><th>App</th><th>Key</th><th>Scopes</th><th>Quota/day</th><th>24h</th><th>Active</th></tr></thead><tbody>{(a.data?.apps || []).map((x: any) => <tr key={x.id}><td>{x.name}<div className="dim mono" style={{ fontSize: 11 }}>{x.slug}</div></td><td className="mono">{x.key_prefix}…</td><td>{x.scopes.join(", ")}</td><td>{x.quota_per_day}</td><td>{x.requests_24h}</td><td>{x.active ? "yes" : "no"}</td></tr>)}</tbody></table></div>
      </div>}
      {tab === "Audit log" && <div className="card"><h2>Audit log (append-only)</h2><div className="tablewrap"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead><tbody>{(au.data?.entries || []).map((e: any) => <tr key={e.id}><td className="dim">{ts(e.ts)}</td><td>{e.actor_type}<div className="dim mono" style={{ fontSize: 11 }}>{e.actor_id}</div></td><td>{e.action}</td><td className="mono dim">{e.target}</td><td className="mono dim" style={{ fontSize: 11, maxWidth: 360 }}>{e.detail}</td></tr>)}</tbody></table></div></div>}
    </div>
  );
}
