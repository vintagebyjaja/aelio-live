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
