import React, { useEffect, useState } from "react";
import { call } from "./client";
import { friendly } from "./Experience";
const amount = (n: any) => "$" + Number(n || 0).toFixed(2);
export function AllowancePanel({ signedIn, onSignIn }: any) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  async function load() {
    try {
      setData(await call("/billing/access"));
      setError("");
    } catch (e) {
      setError(friendly(e));
    }
  }
  useEffect(() => {
    if (signedIn) load();
  }, [signedIn]);
  return (
    <section className="panel allowance-panel">
      <p className="workspace-eyebrow">YOUR SUBSCRIPTIONS & AI</p>
      <h1>Plans & allowance</h1>
      {!signedIn ? (
        <>
          <p>Sign in to see your actual plans and usage.</p>
          <button onClick={onSignIn}>Sign in</button>
        </>
      ) : (
        <>
          {error && (
            <p role="alert">
              {error}
              <button onClick={load}>Retry</button>
            </p>
          )}
          {data && !data.configured && (
            <p>
              Subscription allowances are not active yet. Your existing account
              and saved work remain available.
            </p>
          )}
          {data?.configured && (
            <>
              <p>
                Companions on PATHD:{" "}
                <strong>
                  {data.companion_access
                    ? "Included"
                    : "Requires an eligible paid plan"}
                </strong>
                {data.funding_source &&
                  " · funded by " + data.funding_source.toUpperCase()}
              </p>
              <div className="allowance-grid">
                {data.subscriptions.map((s: any, i: number) => (
                  <article key={i}>
                    <h2>
                      {s.product.toUpperCase()} · {s.plan}
                    </h2>
                    <p>{s.status}</p>
                    <p>
                      Paid through{" "}
                      {s.paid_until
                        ? new Date(s.paid_until).toLocaleDateString()
                        : "—"}
                    </p>
                  </article>
                ))}
              </div>
              {!data.subscriptions.length && (
                <p>No verified paid subscriptions.</p>
              )}
              <div className="allowance-grid">
                {data.allowances.map((a: any, i: number) => (
                  <article key={i}>
                    <h2>{a.product.toUpperCase()} AI allowance</h2>
                    <strong>{amount(a.remaining_usd)} remaining</strong>
                    <p>
                      {amount(a.used_usd)} used of {amount(a.allocated_usd)}{" "}
                      allocated
                    </p>
                    <progress
                      max={Number(a.allocated_usd) || 1}
                      value={Number(a.used_usd)}
                    />
                    <p>
                      Current period ends{" "}
                      {new Date(a.period_end).toLocaleDateString()}
                    </p>
                    <small>
                      Replenishes after successful payment. No automatic extra
                      charges.
                    </small>
                  </article>
                ))}
              </div>
              <p>
                Your AELIO and PATHD balances stay separate. Eligible AELIO
                subscriptions fund companion use inside PATHD first; you are
                never debited from both balances for one request.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
export function AIOperations() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    call("/billing/operations")
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
          await call("/billing/operations", "PATCH", { settings: draft });
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
