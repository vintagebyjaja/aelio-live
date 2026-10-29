import { useEffect, useState } from "react";
import { ago, api, post, put, waitJob } from "./api";
import { Badge, Empty, Err, JobLog, LineChart, Num, Performer, Status, Tabs, useLoad } from "./ui";

const STATE_KIND: any = { untrained: "bad", deterministic: "" };

/* ------------------------------------------------------------ Overview */
export function Overview({ go }: any) {
  const { data: d, error, reload } = useLoad<any>("/api/overview");
  useEffect(() => { const t = setInterval(reload, 8000); return () => clearInterval(t); }, [reload]);
  if (!d) return <><h1>Overview</h1><Err e={error} /></>;
  const fr = d.first_run;
  return (
    <div className="grid">
      <div><h1>Overview</h1><p className="sub">System status, model readiness, work in progress and approvals. Every figure comes from the database. Nothing here is a placeholder.</p></div>
      {fr && (
        <div className={`notice ${fr.all_passed ? "good" : ""}`}>
          First-run verification: <b>{Object.values(fr.tests).filter((t: any) => t.passed).length}/{Object.keys(fr.tests).length}</b> checks passed ({ago(fr.finished)}).{" "}
          <a href="#" onClick={(e: any) => { e.preventDefault(); go("quality"); }}>See results in Quality Lab</a>
        </div>
      )}
      <div className="card">
        <h2>Engine readiness</h2>
        <div className="grid g3">
          {d.engines.map((e: any) => (
            <div key={e.family} className="item" style={{ cursor: "default" }}>
              <div className="spread"><b>{e.engine}</b><Badge kind={STATE_KIND[e.state] ?? "warn"}>{e.state}</Badge></div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{e.detail}</div>
              {e.metrics && (
                <div className="dim mono" style={{ fontSize: 11.5, marginTop: 6 }}>
                  {e.metrics.val_loss !== undefined && <>val_loss {e.metrics.val_loss} · ppl {e.metrics.val_ppl} </>}
                  {e.metrics.accuracy !== undefined && <>accuracy {(e.metrics.accuracy * 100).toFixed(1)}% </>}
                  · {e.metrics.params?.toLocaleString()} params
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="grid g4">
        {["running", "queued", "succeeded", "failed"].map((k) => (
          <div className="card" key={k}><div className="muted">Jobs {k}</div><div className="stat">{d.jobs[k] || 0}</div></div>
        ))}
      </div>
      <div className="grid g2">
        <div className="card">
          <h2>Running and queued</h2>
          {d.running.length ? <table><tbody>{d.running.map((j: any) => <tr key={j.id}><td className="mono">{j.kind}</td><td><Status s={j.status} /></td><td className="dim">{ago(j.started_at)}</td></tr>)}</tbody></table> : <Empty>Nothing running.</Empty>}
          <h3>Recent experiments</h3>
          {d.experiments.length ? <table><tbody>{d.experiments.map((j: any) => <tr key={j.id}><td className="mono">{j.kind}</td><td><Status s={j.status} /></td><td className="dim">{ago(j.finished_at)}</td></tr>)}</tbody></table> : <Empty>No training jobs yet.</Empty>}
        </div>
        <div className="card">
          <h2>Recent tests</h2>
          {d.recent_tests.length ? <table><tbody>{d.recent_tests.map((r: any) => <tr key={r.id}><td>{r.suite}</td><td><Status s={r.status} /></td><td className="mono">{r.passed}/{r.total}</td><td className="dim">{ago(r.created_at)}</td></tr>)}</tbody></table> : <Empty>No test runs yet.</Empty>}
        </div>
        <div className="card">
          <h2>Alerts</h2>
          {d.alerts.length ? d.alerts.map((a: any) => <div key={a.id} style={{ marginBottom: 8 }}><Status s={a.severity} /> {a.simulated ? <Badge kind="violet">SIMULATED</Badge> : null} <span className="muted">{a.message}</span></div>) : <Empty>No open warnings.</Empty>}
        </div>
        <div className="card">
          <h2>Pending approvals</h2>
          <div className="kv">
            <div>Deployments awaiting review</div><div>{d.pending_approvals.deployments.length}</div>
            <div>Guardian actions (medium/high risk)</div><div>{d.pending_approvals.guardian_actions}</div>
            <div>Evaluated checkpoints</div><div>{d.pending_approvals.checkpoints.length}</div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button onClick={() => go("operations")}>Deployments</button><button onClick={() => go("native")}>Checkpoints</button>
          </div>
        </div>
      </div>
      <div className="card">
        <h2>Sandbox isolation</h2>
        {d.sandbox ? <div className="row"><Status s={d.sandbox.passed ? "passed" : "failed"} /><span className="muted">backend {d.sandbox.backend} · network {d.sandbox.network} · secrets visible: {String(d.sandbox.secrets_visible)} · db visible: {String(d.sandbox.db_visible)}</span></div> : <Empty>Not verified yet. Run the self-test in Settings.</Empty>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Native Lab */
export function NativeLab() {
  const [tab, setTab] = useState("Models");
  const m = useLoad<any>("/api/models");
  const ds = useLoad<any>("/api/datasets");
  return (
    <div>
      <h1>Native Lab</h1>
      <p className="sub">AELIO Native models trained from random initialisation on licensed data. Architecture, datasets, training runs, checkpoints and evaluations.</p>
      <Tabs tabs={["Models", "Train", "Datasets", "Inference", "Compare", "Architecture"]} on={tab} set={setTab} />
      <Err e={m.error || ds.error} />
      {tab === "Models" && <Models data={m.data} reload={m.reload} />}
      {tab === "Train" && <Train datasets={ds.data?.datasets || []} onDone={m.reload} />}
      {tab === "Datasets" && <Datasets data={ds.data} reload={ds.reload} />}
      {tab === "Inference" && <Inference models={m.data?.models || []} />}
      {tab === "Compare" && <Compare models={m.data?.models || []} />}
      {tab === "Architecture" && <Architecture />}
    </div>
  );
}

function Models({ data, reload }: any) {
  const [err, setErr] = useState("");
  if (!data) return null;
  if (!data.models.length) return <Empty>No models yet. Build a dataset and start a training run in the Train tab, or run <code>python -m aelio.cli first-run</code>.</Empty>;
  const evalsFor = (cid: string) => data.evaluations.filter((e: any) => e.checkpoint_id === cid);
  async function setStatus(cid: string, status: string) {
    setErr("");
    try { await post(`/api/checkpoints/${cid}/status`, { status }); reload(); } catch (e: any) { setErr(e.message); }
  }
  return (
    <div className="grid">
      <Err e={err} />
      {data.models.map((mdl: any) => (
        <div className="card" key={mdl.id}>
          <div className="spread"><div><b>{mdl.name}</b> <Badge kind="cyan">{mdl.engine}</Badge> <Badge>{mdl.origin}</Badge></div><span className="dim mono">{mdl.id}</span></div>
          <div className="dim mono" style={{ fontSize: 11.5, margin: "6px 0" }}>{JSON.stringify(mdl.architecture)}</div>
          {mdl.checkpoints.map((c: any) => {
            const ev = evalsFor(c.id);
            const curve = ev.find((e: any) => e.details?.curve)?.details.curve;
            return (
              <div key={c.id} className="item" style={{ cursor: "default", marginTop: 8 }}>
                <div className="spread">
                  <div className="row"><span className="mono">{c.id}</span><Status s={c.status} /><span className="dim">{ago(c.created_at)}</span></div>
                  <div className="row">
                    <button onClick={() => setStatus(c.id, "approved")}>Approve</button>
                    <button onClick={() => setStatus(c.id, "published")} title="Lists the model on the public endpoint for aelio.live">Publish</button>
                    <button className="danger" onClick={() => setStatus(c.id, "rejected")}>Reject</button>
                  </div>
                </div>
                <div className="grid g2" style={{ marginTop: 8 }}>
                  <div>
                    <table><tbody>{Object.entries(c.metrics).filter(([, v]) => typeof v !== "object").map(([k, v]: any) => <tr key={k}><td className="muted">{k}</td><td className="mono">{v === null ? <span className="dim">Data unavailable</span> : String(v)}</td></tr>)}</tbody></table>
                  </div>
                  <div>
                    {curve && <LineChart xLabel="step" yLabel="loss (nats/token)" series={[
                      { name: "validation", color: "#5ad1e6", points: curve.map((p: any) => [p.step, p.val_loss]) },
                      { name: "train (EMA)", color: "#ffb83e", points: curve.filter((p: any) => p.train_loss !== null).map((p: any) => [p.step, p.train_loss]) }]} />}
                    {ev.map((e: any) => (
                      <div key={e.id} style={{ marginTop: 6 }}>
                        <div className="row"><Badge>{e.suite}</Badge><Status s={e.passed ? "passed" : "failed"} /><span className="mono dim" style={{ fontSize: 11.5 }}>{Object.entries(e.metrics).filter(([k]) => /pass_at|accuracy|val_loss/.test(k)).map(([k, v]) => `${k}=${v}`).join(" ")}</span></div>
                        {e.details?.sample && <pre style={{ maxHeight: 120 }}>{e.details.sample_prompt}{e.details.sample}</pre>}
                        {e.details?.confusion && <Confusion m={e.details.confusion} />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function Confusion({ m }: any) {
  const max = Math.max(...m.flat());
  return (
    <div className="tablewrap"><div className="dim" style={{ fontSize: 11 }}>Confusion matrix (rows = true digit, cols = predicted)</div>
      <table className="conf"><tbody>{m.map((r: number[], i: number) => <tr key={i}><td className="dim">{i}</td>{r.map((v, j) => <td key={j} style={{ background: `rgba(90,209,230,${v / max * 0.8})` }}>{v || ""}</td>)}</tr>)}</tbody></table>
    </div>
  );
}

function Train({ datasets, onDone }: any) {
  const [f, setF] = useState<any>({ kind: "text", steps: 1500, n_layer: 3, n_head: 4, n_embd: 128, block_size: 64, vocab_size: 768, epochs: 40 });
  const [job, setJob] = useState<any>(null); const [err, setErr] = useState("");
  const eligible = datasets.filter((d: any) => d.training_eligible && (f.kind === "vision" ? d.modality === "image" : d.modality !== "image"));
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function start() {
    setErr("");
    try {
      const r: any = await post("/api/train", { ...f, dataset_id: f.dataset_id || eligible[0]?.id });
      waitJob(r.job_id, setJob).then(onDone);
    } catch (e: any) { setErr(e.message); }
  }
  return (
    <div className="grid g2">
      <div className="card">
        <h2>New training run</h2>
        <label>Engine</label>
        <select value={f.kind} onChange={set("kind")}><option value="text">Reasoning Core (text LM)</option><option value="code">Code Engine (code LM)</option><option value="vision">Vision Engine (digits classifier)</option></select>
        <label>Dataset (training-eligible only)</label>
        <select value={f.dataset_id || ""} onChange={set("dataset_id")}>{eligible.map((d: any) => <option key={d.id} value={d.id}>{d.name} v{d.version} · {d.license}</option>)}</select>
        {f.kind !== "vision" ? (
          <div className="grid g3">
            {["steps", "n_layer", "n_head", "n_embd", "block_size", "vocab_size"].map((k) => <div key={k}><label>{k}</label><input type="number" value={f[k]} onChange={set(k)} /></div>)}
          </div>
        ) : <div><label>epochs</label><input type="number" value={f.epochs} onChange={set("epochs")} /></div>}
        <div className="row" style={{ marginTop: 12 }}><button className="primary" disabled={!eligible.length} onClick={start}>Start training job</button></div>
        {!eligible.length && <div className="muted" style={{ marginTop: 8 }}>No eligible dataset. Build one in the Datasets tab.</div>}
        <Err e={err} />
        <div className="notice info" style={{ marginTop: 12 }}>Weights always start from a seeded random initialisation. This host trains on CPU with the NumPy backend: about 0.3–0.5 s per step at the default size. Bigger models need the GPU backend described in docs/INFRASTRUCTURE.md.</div>
      </div>
      <div className="card"><h2>Job</h2>{job ? <JobLog job={job} /> : <Empty>Start a run to watch its log here.</Empty>}</div>
    </div>
  );
}

function Datasets({ data, reload }: any) {
  const [err, setErr] = useState(""); const [busy, setBusy] = useState("");
  const [up, setUp] = useState<any>({ name: "", license: "Grooveville-Owned", source: "", origin: "licensed-corpus", text: "" });
  if (!data) return null;
  async function build(name: string) { setBusy(name); setErr(""); try { await post("/api/datasets/builtin", { name }); reload(); } catch (e: any) { setErr(e.message); } setBusy(""); }
  async function upload() { setErr(""); try { await post("/api/datasets/upload", up); reload(); setUp({ ...up, text: "" }); } catch (e: any) { setErr(e.message); } }
  return (
    <div className="grid">
      <div className="card">
        <div className="spread"><h2>Registered datasets</h2>
          <div className="row">{["psf-stdlib-docstrings", "psf-stdlib-code", "uci-optdigits-8x8"].map((n) => <button key={n} disabled={!!busy} onClick={() => build(n)}>{busy === n ? "Building…" : `+ ${n}`}</button>)}</div>
        </div>
        <Err e={err} />
        <div className="tablewrap"><table>
          <thead><tr><th>Name</th><th>Ver</th><th>Modality</th><th>License</th><th>Origin</th><th>Size</th><th>Status</th><th>Trainable</th><th>SHA-256</th></tr></thead>
          <tbody>{data.datasets.map((d: any) => <tr key={d.id}><td>{d.name}<div className="dim" style={{ fontSize: 11 }}>{d.source}</div></td><td>{d.version}</td><td>{d.modality}</td><td>{d.license}</td><td>{d.provenance?.origin}</td><td className="mono">{(d.size_bytes / 1e6).toFixed(2)} MB</td><td><Status s={d.status} /></td><td>{d.training_eligible ? <Badge kind="ok">yes</Badge> : <Badge kind="bad">no</Badge>}</td><td className="mono dim">{d.sha256?.slice(0, 12)}</td></tr>)}</tbody>
        </table></div>
        {!data.datasets.length && <Empty>No datasets yet.</Empty>}
      </div>
      <div className="card">
        <h2>Upload a text dataset</h2>
        <p className="muted">Data must be licensed and its origin declared. Output from another company's AI model is never training-eligible. Allowed licenses: {data.license_allowlist.join(", ")}.</p>
        <div className="grid g3">
          <div><label>Name</label><input value={up.name} onChange={(e: any) => setUp({ ...up, name: e.target.value })} /></div>
          <div><label>License</label><input value={up.license} onChange={(e: any) => setUp({ ...up, license: e.target.value })} /></div>
          <div><label>Origin</label><select value={up.origin} onChange={(e: any) => setUp({ ...up, origin: e.target.value })}><option value="licensed-corpus">Licensed corpus</option><option value="grooveville-authored">Written by Grooveville people</option><option value="external-ai-output">Output of an external AI (not trainable)</option></select></div>
        </div>
        <label>Source / attribution</label><input value={up.source} onChange={(e: any) => setUp({ ...up, source: e.target.value })} />
        <label>Text</label><textarea rows={6} value={up.text} onChange={(e: any) => setUp({ ...up, text: e.target.value })} />
        <div className="row" style={{ marginTop: 10 }}><button className="primary" disabled={!up.name || !up.source || up.text.length < 1000} onClick={upload}>Validate and register</button><span className="dim">min 1,000 characters</span></div>
      </div>
    </div>
  );
}

function lmCheckpoints(models: any[]) {
  return models.filter((m: any) => m.family !== "vision").flatMap((m: any) => m.checkpoints.map((c: any) => ({ ...c, name: m.name })));
}

function Inference({ models }: any) {
  const cks = lmCheckpoints(models);
  const [cid, setCid] = useState(""); const [prompt, setPrompt] = useState("Return the"); const [out, setOut] = useState<any>(null); const [err, setErr] = useState("");
  async function run() { setErr(""); try { setOut(await post("/api/infer", { checkpoint_id: cid || cks[0]?.id, prompt, max_new: 80 })); } catch (e: any) { setErr(e.message); } }
  return (
    <div className="card">
      <h2>Inference playground</h2>
      <div className="notice info">Raw output from small native language models. Expect fragments of plausible-looking text, not reliable answers. Generating text is not reasoning.</div>
      <label>Checkpoint</label>
      <select value={cid} onChange={(e: any) => setCid(e.target.value)}>{cks.map((c: any) => <option key={c.id} value={c.id}>{c.name} · {c.id} · {c.status}</option>)}</select>
      <label>Prompt</label><textarea rows={3} value={prompt} onChange={(e: any) => setPrompt(e.target.value)} />
      <div className="row" style={{ marginTop: 10 }}><button className="primary" disabled={!cks.length} onClick={run}>Generate</button></div>
      <Err e={err} />
      {out && <><div className="row" style={{ marginTop: 10 }}><Performer p={out.performer} /><span className="dim">{out.latency_ms} ms</span></div><pre>{out.prompt}<span style={{ color: "#5ad1e6" }}>{out.completion}</span></pre></>}
    </div>
  );
}

function Compare({ models }: any) {
  const cks = models.flatMap((m: any) => m.checkpoints.map((c: any) => ({ ...c, name: m.name })));
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [r, setR] = useState<any>(null); const [err, setErr] = useState("");
  async function cmp() { setErr(""); try { setR(await api(`/api/checkpoints/compare?a=${a || cks[1]?.id}&b=${b || cks[0]?.id}`)); } catch (e: any) { setErr(e.message); } }
  const opt = cks.map((c: any) => <option key={c.id} value={c.id}>{c.name} · {c.id}</option>);
  return (
    <div className="card">
      <h2>Checkpoint comparison</h2>
      <div className="grid g2"><div><label>Baseline</label><select value={a} onChange={(e: any) => setA(e.target.value)}><option value="">(select)</option>{opt}</select></div><div><label>Candidate</label><select value={b} onChange={(e: any) => setB(e.target.value)}><option value="">(select)</option>{opt}</select></div></div>
      <div className="row" style={{ marginTop: 10 }}><button className="primary" disabled={cks.length < 2} onClick={cmp}>Compare</button>{cks.length < 2 && <span className="dim">Needs two checkpoints.</span>}</div>
      <Err e={err} />
      {r && <><div className="row" style={{ margin: "10px 0" }}>{r.verdicts.map((v: string) => <Badge key={v} kind={v === "regressing" ? "bad" : "cyan"}>{v}</Badge>)}<Badge kind={r.ready_for_additional_testing ? "ok" : "bad"}>{r.ready_for_additional_testing ? "ready for additional testing" : "not ready"}</Badge></div>
        <table><thead><tr><th>Metric</th><th>Baseline</th><th>Candidate</th><th>Δ</th></tr></thead><tbody>{r.rows.map((x: any) => <tr key={x.metric}><td>{x.metric}</td><td className="mono">{x.baseline}</td><td className="mono">{x.candidate}</td><td className="mono" style={{ color: x.improved === null ? "" : x.improved ? "#4fc58a" : "#ff6b6b" }}>{+x.delta.toFixed(4)}</td></tr>)}</tbody></table></>}
    </div>
  );
}

function Architecture() {
  return (
    <div className="grid g2">
      <div className="card">
        <h2>aelio-native-decoder-v1</h2>
        <div className="kv">
          <div>Type</div><div>Decoder-only transformer (pre-LayerNorm, causal multi-head attention, GELU MLP)</div>
          <div>Tokenizer</div><div>AELIO byte-level BPE, trained per run on the run's own training split</div>
          <div>Initialisation</div><div>Seeded random normal (σ=0.02, residual projections scaled by 1/√(2L))</div>
          <div>Optimiser</div><div>AdamW, warmup + cosine decay, gradient clipping at 1.0</div>
          <div>Backend</div><div>NumPy, hand-written forward/backward, verified by numerical gradient check</div>
          <div>Scaling</div><div>Layers, width, heads, context and vocabulary are config values. A PyTorch/GPU backend must reproduce this checkpoint format.</div>
          <div>External weights</div><div><Badge kind="ok">none: the loader rejects them</Badge></div>
        </div>
      </div>
      <div className="card">
        <h2>Engine families</h2>
        <table><tbody>
          <tr><td>Reasoning Core</td><td>text LM prototype</td></tr>
          <tr><td>Code Engine</td><td>code LM prototype + protected code tasks</td></tr>
          <tr><td>Vision Engine</td><td>8×8 digit classifier (Milestone D)</td></tr>
          <tr><td>Voice Engine</td><td className="muted">untrained: needs a consented speech dataset</td></tr>
          <tr><td>Video + Live Engine</td><td className="muted">untrained: capture pipeline only</td></tr>
          <tr><td>Memory + Tools Engine</td><td className="muted">deterministic software (no weights)</td></tr>
        </tbody></table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Code Studio */
export function CodeStudio() {
  const p = useLoad<any>("/api/projects");
  const t = useLoad<any>("/api/tasks");
  const [pid, setPid] = useState(""); const [tid, setTid] = useState(""); const [tab, setTab] = useState("Tasks");
  const [err, setErr] = useState(""); const [gh, setGh] = useState({ remote_url: "", name: "" });
  useEffect(() => { if (!pid && p.data?.projects?.length) setPid(p.data.projects[0].id); }, [p.data]);
  useEffect(() => { const x = setInterval(t.reload, 5000); return () => clearInterval(x); }, [t.reload]);
  async function sample() { setErr(""); try { const r: any = await post("/api/projects", { sample: "dashboard-benchmark" }); p.reload(); setPid(r.project.id); } catch (e: any) { setErr(e.message); } }
  async function connect() { setErr(""); try { const r: any = await post("/api/projects", { ...gh, production: true }); p.reload(); setPid(r.project.id); } catch (e: any) { setErr(e.message); } }
  const proj = p.data?.projects?.find((x: any) => x.id === pid);
  return (
    <div>
      <h1>Code Studio</h1>
      <p className="sub">Projects, coding tasks and the full workflow: Inspect → Diagnose → Plan → Build → Test → Evaluate → Repair → Review → Deploy. Every step shows who did the work.</p>
      <div className="split">
        <div className="card">
          <h2>Projects</h2>
          <div className="list">{(p.data?.projects || []).map((x: any) => <div key={x.id} className={`item ${x.id === pid ? "on" : ""}`} onClick={() => setPid(x.id)}><b>{x.name}</b><div className="row" style={{ marginTop: 4 }}><Badge>{x.kind}</Badge>{x.is_production ? <Badge kind="gold">production</Badge> : null}</div></div>)}</div>
          <div className="grid" style={{ marginTop: 12 }}>
            <button onClick={sample}>+ Benchmark sample project</button>
            <label>Connect a GitHub repository (read-only clone)</label>
            <input placeholder="https://github.com/owner/repo" value={gh.remote_url} onChange={(e: any) => setGh({ ...gh, remote_url: e.target.value })} />
            <button disabled={!gh.remote_url} onClick={connect}>Connect</button>
            <div className="dim" style={{ fontSize: 11.5 }}>Private repositories need a GITHUB_TOKEN secret (Settings). Connected repositories are marked as production: agents can't run tasks on them, and studio edits go to aelio/* branches only.</div>
          </div>
          <Err e={err || p.error} />
        </div>
        <div>
          <Tabs tabs={["Tasks", "Files", "Diagnose", "History"]} on={tab} set={setTab} />
          {tab === "Tasks" && <Tasks tasks={t.data?.tasks || []} proj={proj} reload={t.reload} tid={tid} setTid={setTid} />}
          {tab === "Files" && proj && <Files proj={proj} />}
          {tab === "Diagnose" && proj && <Diagnose proj={proj} />}
          {tab === "History" && proj && <History proj={proj} />}
          {!proj && tab !== "Tasks" && <Empty>Select or create a project.</Empty>}
        </div>
      </div>
    </div>
  );
}

const STAGES = ["inspect", "diagnose", "plan", "build", "test", "evaluate", "repair", "review", "deploy_request"];

function Tasks({ tasks, proj, reload, tid, setTid }: any) {
  const [instr, setInstr] = useState("Create a simple responsive dashboard component that displays system status, recent activity, and three performance metrics.");
  const [mode, setMode] = useState("native"); const [err, setErr] = useState("");
  async function submit() {
    setErr("");
    try { const r: any = await post("/api/tasks", { instruction: instr, project_id: proj.id, mode, max_retries: 2 }); setTid(r.task_id); reload(); } catch (e: any) { setErr(e.message); }
  }
  return (
    <div className="grid">
      <div className="card">
        <h2>New coding task</h2>
        <textarea rows={3} value={instr} onChange={(e: any) => setInstr(e.target.value)} />
        <div className="row" style={{ marginTop: 8 }}>
          <select style={{ width: "auto" }} value={mode} onChange={(e: any) => setMode(e.target.value)}>
            <option value="native">AELIO Native only</option>
            <option value="external-comparison">External-assisted comparison (labelled)</option>
          </select>
          <button className="primary" disabled={!proj} onClick={submit}>Submit to orchestrator</button>
          <span className="dim">acceptance suite: dashboard_benchmark_v1 · max 2 repairs</span>
        </div>
        {!proj && <div className="muted">Create the benchmark sample project first.</div>}
        <Err e={err} />
      </div>
      <div className="card">
        <h2>Tasks</h2>
        {tasks.length ? <table><thead><tr><th>Task</th><th>Mode</th><th>Stage</th><th>Status</th><th>Tests</th><th></th></tr></thead><tbody>{tasks.map((x: any) => (
          <tr key={x.id}><td>{x.title}<div className="mono dim" style={{ fontSize: 11 }}>{x.id}</div></td><td>{x.mode === "native" ? <Badge kind="cyan">native</Badge> : <Badge kind="violet">external comparison</Badge>}</td><td>{x.stage}</td><td><Status s={x.status} /></td><td className="mono">{x.result?.passed !== undefined ? `${x.result.passed}/${x.result.passed + x.result.failed}` : "—"}</td><td><button onClick={() => setTid(x.id)}>Open</button></td></tr>
        ))}</tbody></table> : <Empty>No tasks yet.</Empty>}
      </div>
      {tid && <TaskDetail tid={tid} />}
    </div>
  );
}

function TaskDetail({ tid }: any) {
  const { data: t, reload } = useLoad<any>(`/api/tasks/${tid}`, [tid]);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { const x = setInterval(reload, 3000); return () => clearInterval(x); }, [reload]);
  if (!t) return null;
  const st: any = {}; t.steps.forEach((s: any) => { st[s.stage] = s.status; });
  return (
    <div className="card">
      <div className="spread"><h2>{t.title}</h2><Status s={t.status} /></div>
      <div className="pipeline">{STAGES.map((s) => <span key={s} className={`stage ${st[s] === "ok" || st[s] === "passed" ? "ok" : st[s] ? "failed" : ""}`}>{s.replace("_request", "")}</span>)}</div>
      {t.result?.reason && <div className="notice">Stopped at <b>{t.result.stopped_at || t.stage}</b>: {t.result.reason}</div>}
      <table style={{ marginTop: 10 }}><thead><tr><th>#</th><th>Stage</th><th>Performed by</th><th>Result</th><th></th></tr></thead><tbody>
        {t.steps.map((s: any, i: number) => (
          <tr key={s.id}><td className="dim">{i + 1}</td><td>{s.stage}</td><td><Performer p={s.performer} /></td><td><Status s={s.status} /></td><td><button className="ghost" onClick={() => setOpen(open === i ? null : i)}>{open === i ? "Hide" : "Details"}</button></td></tr>
        ))}
      </tbody></table>
      {open !== null && t.steps[open] && <StepDetail s={t.steps[open]} />}
    </div>
  );
}

function StepDetail({ s }: any) {
  const d = s.detail || {};
  return (
    <div style={{ marginTop: 10 }}>
      {d.strategy && <div className="muted">Strategy: {d.strategy}</div>}
      {d.diff && <><h3>Diff</h3><pre>{d.diff}</pre></>}
      {d.failures && <><h3>Failures</h3>{d.failures.map((f: any, i: number) => <div key={i} style={{ marginBottom: 6 }}><Badge kind="bad">FAIL</Badge> {f.name}<pre style={{ maxHeight: 140 }}>{f.detail}</pre></div>)}</>}
      {d.findings && <><h3>Findings</h3>{d.findings.map((f: any, i: number) => <div key={i}><Status s={f.severity} /> {f.check}: {f.message} <span className="dim">{f.file}</span></div>)}</>}
      {!d.diff && !d.failures && !d.findings && <pre>{JSON.stringify(d, null, 2)}</pre>}
    </div>
  );
}

function Files({ proj }: any) {
  const tr = useLoad<any>(`/api/projects/${proj.id}/tree`, [proj.id]);
  const [path, setPath] = useState(""); const [content, setContent] = useState(""); const [orig, setOrig] = useState("");
  const [q, setQ] = useState(""); const [hits, setHits] = useState<any[]>([]); const [err, setErr] = useState(""); const [branch, setBranch] = useState("");
  async function open(p: string) { setErr(""); try { const r: any = await api(`/api/projects/${proj.id}/file?path=${encodeURIComponent(p)}`); setPath(p); setContent(r.content); setOrig(r.content); } catch (e: any) { setErr(e.message); } }
  async function save() { setErr(""); try { await put(`/api/projects/${proj.id}/file`, { path, content }); setOrig(content); tr.reload(); } catch (e: any) { setErr(e.message); } }
  async function commit() { setErr(""); try { await post(`/api/projects/${proj.id}/commit`, { message: `Edit ${path}` }); tr.reload(); } catch (e: any) { setErr(e.message); } }
  async function search() { try { setHits((await api<any>(`/api/projects/${proj.id}/search?q=${encodeURIComponent(q)}`)).hits); } catch (e: any) { setErr(e.message); } }
  async function br(body: any) { setErr(""); try { await post(`/api/projects/${proj.id}/branch`, body); tr.reload(); } catch (e: any) { setErr(e.message); } }
  return (
    <div className="grid">
      <div className="card">
        <div className="row">
          <span className="muted">Branch</span>
          <select style={{ width: "auto" }} value={tr.data?.head || ""} onChange={(e: any) => br({ checkout: e.target.value })}>{(tr.data?.branches || []).map((b: string) => <option key={b}>{b}</option>)}</select>
          <input style={{ width: 200 }} placeholder="aelio/my-change" value={branch} onChange={(e: any) => setBranch(e.target.value)} />
          <button disabled={!branch} onClick={() => br({ name: branch })}>Create branch</button>
          <input style={{ width: 180 }} placeholder="Search code" value={q} onChange={(e: any) => setQ(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && search()} />
        </div>
        <Err e={err || tr.error} />
        {hits.length > 0 && <div style={{ marginTop: 8 }}>{hits.slice(0, 30).map((h, i) => <div key={i} className="mono" style={{ fontSize: 12, cursor: "pointer" }} onClick={() => open(h.path)}><span className="dim">{h.path}:{h.line}</span> {h.text}</div>)}</div>}
      </div>
      <div className="split">
        <div className="card files">{(tr.data?.files || []).map((f: any) => <div key={f.path} className={f.path === path ? "on" : ""} onClick={() => open(f.path)}>{f.path}</div>)}</div>
        <div className="card">
          {path ? <>
            <div className="spread"><span className="mono">{path}</span><div className="row"><button disabled={content === orig} onClick={save}>Save</button><button onClick={commit}>Commit to branch</button></div></div>
            <textarea rows={22} style={{ marginTop: 8 }} value={content} onChange={(e: any) => setContent(e.target.value)} spellCheck={false} />
          </> : <Empty>Pick a file to view or edit.</Empty>}
        </div>
      </div>
      <AskAelio proj={proj} path={path} onApplied={() => { tr.reload(); if (path) open(path); }} />
    </div>
  );
}

/** Ask the AI (through the AELIO Intelligence Gateway) for a change, review the diff, then apply or reject. */
function AskAelio({ proj, path, onApplied }: any) {
  const [ask, setAsk] = useState(""); const [extra, setExtra] = useState(""); const [busy, setBusy] = useState(false);
  const [prop, setProp] = useState<any>(null); const [err, setErr] = useState(""); const [done, setDone] = useState("");
  const paths = [path, ...extra.split(",").map((x: string) => x.trim())].filter(Boolean);
  async function propose() {
    setErr(""); setDone(""); setProp(null); setBusy(true);
    try { setProp(await post(`/api/projects/${proj.id}/ai/propose`, { instruction: ask, paths })); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }
  async function decide(action: "apply" | "reject") {
    setErr("");
    try { const r: any = await post(`/api/projects/${proj.id}/ai/proposals/${prop.id}/${action}`); setDone(action === "apply" ? `Applied to ${r.applied.join(", ")} on ${r.branch}. Review, then commit.` : "Rejected. Nothing was changed."); setProp(null); if (action === "apply") onApplied(); }
    catch (e: any) { setErr(e.message); }
  }
  return (
    <div className="card">
      <div className="spread"><h2>Ask AELIO for a change</h2><span className="dim small">GPT via the AELIO Intelligence Gateway · nothing is written until you apply</span></div>
      <textarea rows={3} placeholder={path ? `e.g. "Add input validation to ${path}"` : "Open a file above, then describe the change"} value={ask} onChange={(e: any) => setAsk(e.target.value)} />
      <div className="row" style={{ marginTop: 8 }}>
        <input style={{ flex: 1 }} placeholder="Other files to include (comma-separated, optional)" value={extra} onChange={(e: any) => setExtra(e.target.value)} />
        <button className="gold-btn" disabled={busy || !ask.trim() || !paths.length} onClick={propose}>{busy ? "Thinking…" : "Propose change"}</button></div>
      <div className="dim small" style={{ marginTop: 6 }}>Sends: {paths.length ? paths.join(", ") : "no files yet"} plus the project's file list. Never sends .env files, keys or CI workflows.</div>
      <Err e={err} />{done && <div className="notice good" style={{ marginTop: 8 }}>{done}</div>}
      {prop && <div style={{ marginTop: 12 }}>
        <p><b>Proposal:</b> {prop.summary}</p>
        {prop.files.length ? <>
          <div className="dim small">{prop.files.map((f: any) => `${f.path}${f.new_file ? " (new)" : ""}: ${f.reason}`).join(" · ")} · {prop.model} · {prop.credits_charged ? prop.credits_charged + " credits" : "no credits charged"}</div>
          <pre className="diff">{prop.diff.split("\n").map((l: string, i: number) => <div key={i} className={l.startsWith("+") && !l.startsWith("+++") ? "add" : l.startsWith("-") && !l.startsWith("---") ? "del" : l.startsWith("@@") ? "hunk" : ""}>{l || " "}</div>)}</pre>
          <div className="row"><button className="gold-btn" onClick={() => decide("apply")}>Apply to working copy</button><button className="dark-btn" onClick={() => decide("reject")}>Reject</button></div>
        </> : <div className="notice">No changes proposed.</div>}
      </div>}
    </div>);
}

function Diagnose({ proj }: any) {
  const { data: d, error, reload } = useLoad<any>(`/api/projects/${proj.id}/diagnose`, [proj.id]);
  return (
    <div className="card">
      <div className="spread"><h2>Self-diagnosis</h2><div className="row"><Performer p="deterministic:diagnose-v1" /><button onClick={reload}>Re-run</button></div></div>
      <Err e={error} />
      {d && <>
        <div className="row" style={{ marginBottom: 10 }}>{d.frameworks.map((f: string) => <Badge key={f} kind="cyan">{f}</Badge>)}<span className="dim">{d.files} files</span>{Object.entries(d.counts).map(([k, v]: any) => <Badge key={k}>{k}: {v}</Badge>)}</div>
        {d.findings.length ? <table><tbody>{d.findings.map((f: any, i: number) => <tr key={i}><td><Status s={f.severity} /></td><td>{f.check}</td><td>{f.message}</td><td className="mono dim">{f.file}{f.line ? `:${f.line}` : ""}</td></tr>)}</tbody></table> : <Empty>No findings.</Empty>}
        <h3>Checks performed</h3><div className="muted">{d.checks_performed.join(" · ")}</div>
        <h3>Not yet implemented</h3><div className="dim">{d.checks_not_yet_implemented.join(" · ")}</div>
      </>}
    </div>
  );
}

function History({ proj }: any) {
  const { data } = useLoad<any>(`/api/projects/${proj.id}/log`, [proj.id]);
  return (
    <div className="card"><h2>Commit history</h2>
      {data && <table><tbody>{data.commits.map((c: any) => <tr key={c.sha}><td className="mono dim">{c.sha.slice(0, 8)}</td><td>{c.subject}<div className="dim" style={{ fontSize: 11 }}>{c.refs}</div></td><td className="dim">{c.date}</td></tr>)}</tbody></table>}
    </div>
  );
}
