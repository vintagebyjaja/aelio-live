import { useState } from "react";
import { ECOSYSTEM_APPS, ecosystemHandoff } from "../shared/ecosystem.js";
import { Icon } from "./Icon";
export function ConnectedApps() {
  const [details, setDetails] = useState("");
  return (
    <section className="panel connected-workspace">
      <p className="workspace-eyebrow">AELIO CONNECT</p>
      <h1>Your world, connected thoughtfully.</h1>
      <p>
        Open familiar experiences without creating duplicate accounts. Private
        account linking is available only after an integration is configured and
        verified.
      </p>
      <div className="app-library">
        {ECOSYSTEM_APPS.map((app) => (
          <article key={app.id}>
            <div className="app-card-heading">
              <span className="app-symbol">
                <Icon name={app.icon} />
              </span>
              <div>
                <h2>{app.name}</h2>
                <p>{app.description}</p>
              </div>
              <span className="connection-status">Available</span>
            </div>
            <ul>
              {app.capabilities.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="muted">
              {app.id === "pathd"
                ? "AELIO and PATHD share identity, with separate website sessions and subscriptions."
                : "Website handoff only. API access and account linking are not configured."}
            </p>
            <p className="muted">
              Permissions granted: none. No synchronization or private data
              access.
            </p>
            <div className="app-card-actions">
              <a href={app.url} target="_blank" rel="noreferrer">
                Open {app.name} <Icon name="arrow" size={16} />
              </a>
              <button
                onClick={() => setDetails(details === app.id ? "" : app.id)}
                aria-expanded={details === app.id}
              >
                Connection details
              </button>
            </div>
            {details === app.id && (
              <div className="connection-details">
                <p>
                  No linked credential is stored for this app, so there is no
                  account connection to disconnect. We never link accounts by
                  matching email alone.
                </p>
                <p>
                  {app.id === "pathd"
                    ? "Sign in independently with your shared Supabase account. Your AELIO plan does not change your PATHD plan."
                    : "Verified API/OAuth documentation, provider registration, approved permission scopes and server-side encrypted token storage are required before account linking can be enabled."}
                </p>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
export function HandoffCard({ proposal, onMila }: any) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState("");
  let p;
  try {
    p = ecosystemHandoff(proposal);
  } catch {
    return null;
  }
  return (
    <article className="handoff-card">
      <p className="workspace-eyebrow">OPTIONAL HANDOFF · NOT AN API RESULT</p>
      <h3>{p.name}</h3>
      <p>{p.summary}</p>
      {p.origin && <p>From: {p.origin}</p>}
      {p.destination && <p>To: {p.destination}</p>}
      {p.mode && <p>Mode: {p.mode}</p>}
      <small>
        No route, travel time, venue availability or private account data has
        been retrieved. Confirm these planning details before using them.
      </small>
      <div>
        {p.app === "pathd" && onMila && (
          <button onClick={onMila}>Talk to MILA</button>
        )}
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                [
                  p.summary,
                  p.origin ? "Origin: " + p.origin : "",
                  p.destination ? "Destination: " + p.destination : "",
                  p.mode ? "Mode: " + p.mode : "",
                ]
                  .filter(Boolean)
                  .join("\n"),
              );
              setCopied(true);
            } catch {
              setError(
                "Clipboard is unavailable. You can select and copy the planning details above.",
              );
            }
          }}
        >
          {copied ? "Copied" : "Copy planning details"}
        </button>
        <a href={p.url} target="_blank" rel="noreferrer">
          Open {p.name} <Icon name="arrow" size={16} />
        </a>
      </div>
      <small>
        Opening the site sends no conversation text, location or account token.
        Paste details there only if you choose.
      </small>
      {error && <p role="status">{error}</p>}
    </article>
  );
}
