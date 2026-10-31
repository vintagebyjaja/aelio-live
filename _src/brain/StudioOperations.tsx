import "./studio-operations.css";
import React,{useEffect,useState} from "react";
import {token} from "./api";
import {consumerMessage} from "../shared/experience.js";
const friendly=(e:any)=>consumerMessage(e?.code,e?.message);
const amount=(n:any)=>'$'+Number(n||0).toFixed(2);
async function studioCall(path:string,method='GET',data?:any){
 const access=await token();
 const r=await fetch('/api/studio/ai/'+path,{method,headers:{'content-type':'application/json',...(access?{authorization:'Bearer '+access}:{})},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});
 const d=await r.json();if(!r.ok)throw Object.assign(new Error(d.error||'Studio Brain is unavailable.'),{code:d.code});return d;
}
export function AIOperations() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    studioCall("operations")
      .then(setData)
      .catch((e) => setError(friendly(e)));
  }, []);
  return (
    <section className="panel ai-operations">
      <p className="workspace-eyebrow">FOUNDER · PRIVATE</p>
      <h1>AI Operations</h1>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <div className="allowance-grid">
            <article>
              <h2>Today</h2>
              <strong>{amount(data.daily_usd)}</strong>
            </article>
            <article>
              <h2>This month</h2>
              <strong>{amount(data.monthly_usd)}</strong>
            </article>
            <article>
              <h2>Fallback requests</h2>
              <strong>{data.fallbacks}</strong>
            </article>
          </div>
          <p>
            Usage comes from the ledger. Provider costs are token-price estimates, not reconciled provider invoices. Uncertain provider requests retain
            conservative cost estimates.
          </p>
          {data.providers.map((p: any) => (
            <article key={p.provider}>
              <h2>{p.provider}</h2>
              <p>
                {p.requests} requests · {p.failures} incomplete/rejected
                attempts · {p.average_latency_ms ?? "—"} ms average
              </p>
              <p>
                {amount(p.cost_usd)} settled · {amount(p.pending_usd)} reserved
                · {p.estimated_attempts} estimates
              </p>
            </article>
          ))}
          <RouterControls
            settings={data.settings || {}}
            providers={data.configured_providers || {}}
            health={data.provider_health || {}}
          />
          <h2>Subscriber allocations</h2>
          {data.allocation.map((a: any, i: number) => (
            <article key={i}>
              <strong>
                {a.product} · {a.plan}
              </strong>
              <p>
                {amount(a.paid_usd)} paid · {amount(a.budget_usd)} allocated ·{" "}
                {amount(a.spent_usd)} spent · {amount(a.subsidy_usd)}{" "}
                minimum-allowance subsidy
              </p>
            </article>
          ))}
        </>
      )}
    </section>
  );
}

function RouterControls({ settings, providers, health }: any) {
  const [draft, setDraft] = useState<any>(settings),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="workspace-form"
      onSubmit={async (e: any) => {
        e.preventDefault();
        setBusy(true);
        try {
          await studioCall("operations", "PATCH", { settings: draft });
          setMessage(
            "Routing settings saved. New requests use these settings.",
          );
        } catch (e) {
          setMessage(friendly(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Provider routing & limits</h2>
      <p>
        Changes affect new requests. Keys stay server-only. Credential presence
        and circuit state do not prove a live provider response.
      </p>
      {[
        ["AELIO_PRIMARY_PROVIDER", "Primary provider"],
        ["AELIO_SECONDARY_PROVIDER", "Secondary provider"],
        ["AELIO_EMERGENCY_PROVIDER", "Emergency provider"],
      ].map(([key, label], i) => (
        <label key={key}>
          {label}
          <select
            aria-label={label}
            value={draft[key] || ["gemini", "groq", "openai"][i]}
            onChange={(e: any) => setDraft({ ...draft, [key]: e.target.value })}
          >
            {["gemini", "groq", "openai"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      ))}
      {["GEMINI", "GROQ", "OPENAI"].map((p) => (
        <fieldset key={p}>
          <legend>{p}</legend>
          <p>
            {providers[p.toLowerCase()]
              ? "Server credential configured"
              : "Server credential absent"}{" "}
            ·{" "}
            {health[p.toLowerCase()]?.circuit_open
              ? "Circuit temporarily open"
              : "No open circuit observed here"}
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={draft["AELIO_" + p + "_ENABLED"] !== "false"}
              onChange={(e: any) =>
                setDraft({
                  ...draft,
                  ["AELIO_" + p + "_ENABLED"]: String(e.target.checked),
                })
              }
            />
            Enable provider
          </label>
          {[
            ["MODEL", "Standard model"],
            ["COMPLEX_MODEL", "Complex model (optional)"],
            ["INPUT_USD_PER_MILLION", "Input price per million tokens ($)"],
            ["OUTPUT_USD_PER_MILLION", "Output price per million tokens ($)"],
            [
              "COMPLEX_INPUT_USD_PER_MILLION",
              "Complex-model input price ($/million)",
            ],
            [
              "COMPLEX_OUTPUT_USD_PER_MILLION",
              "Complex-model output price ($/million)",
            ],
            ["TIMEOUT_MS", "Request timeout (milliseconds)"],
            ["DAILY_BUDGET_USD", "Provider daily ceiling ($)"],
            ["MONTHLY_BUDGET_USD", "Provider monthly ceiling ($)"],
          ].map(([suffix, label]) => (
            <label key={suffix}>
              {label}
              <input
                aria-label={p + " " + label}
                type={suffix.endsWith("MODEL") ? "text" : "number"}
                min={suffix === "TIMEOUT_MS" ? 1000 : 0}
                step="any"
                value={draft[p + "_" + suffix] || ""}
                onChange={(e: any) =>
                  setDraft({ ...draft, [p + "_" + suffix]: e.target.value })
                }
              />
            </label>
          ))}
        </fieldset>
      ))}
      {[
        ["AELIO_DAILY_AI_BUDGET_USD", "Daily platform ceiling ($)"],
        ["AELIO_MONTHLY_AI_BUDGET_USD", "Monthly platform ceiling ($)"],
        [
          "AELIO_OPENAI_EMERGENCY_BUDGET_USD",
          "Emergency OpenAI monthly ceiling ($)",
        ],
      ].map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            type="number"
            min="0"
            step="any"
            value={draft[key] || ""}
            onChange={(e: any) => setDraft({ ...draft, [key]: e.target.value })}
          />
        </label>
      ))}
      <button disabled={busy}>Save routing controls</button>
      <p role="status">{message}</p>
    </form>
  );
}
