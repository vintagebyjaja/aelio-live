import {CalendarConnections} from "./CalendarConnections";
import { useState } from "react";
import { ECOSYSTEM_APPS, ecosystemHandoff } from "../shared/ecosystem.js";
import { Icon } from "./Icon";
export function ConnectedApps({onPlan,onMila}:{onPlan?:(topic:string[])=>void;onMila?:()=>void}) {
  return <section className="panel connected-workspace">
    <p className="workspace-eyebrow">AELIO CONNECT</p><h1>More ways to follow your vibe.</h1>
    <p>Plan here with AELIO, then open the experience you want to explore.</p>
    <div className="app-library">{ECOSYSTEM_APPS.map(app=><article key={app.id}>
      <div className="app-card-heading"><span className="app-symbol"><Icon name={app.icon}/></span><div><h2>{app.name}</h2><p>{app.description}</p></div></div>
      <ul>{app.capabilities.map(c=><li key={c}>{c}</li>)}</ul>
      <div className="app-card-actions"><a href={app.url} target="_blank" rel="noreferrer">{app.id==='vybr8'?'Explore VYBR8':'Open '+app.name}<Icon name="arrow" size={16}/></a>
      {app.id==='groove-guide'&&onPlan&&<button onClick={()=>onPlan(['Plan a Trip','',"Help me plan a trip. Ask about where I’d like to go, my dates and my budget.",''])}>Plan a Trip</button>}
      {app.id==='vybr8'&&onPlan&&<button onClick={()=>onPlan(['Find your vibe','',"Help me explore food, drinks and activities that fit my vibe. Ask about my preferences and location before making suggestions. Don’t invent live availability.",''])}>Explore ideas</button>}
      {app.id==='pathd'&&onMila&&<button onClick={onMila}>Talk to MILA</button>}</div>
      {app.id==='pathd'&&<small>Your PATHD plan stays separate from AELIO.</small>}
    </article>)}</div><CalendarConnections/>
  </section>;
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
      <p className="workspace-eyebrow">YOUR NEXT STEP</p>
      <h3>{p.name}</h3>
      <p>{p.summary}</p>
      {p.origin && <p>From: {p.origin}</p>}
      {p.destination && <p>To: {p.destination}</p>}
      {p.mode && <p>Mode: {p.mode}</p>}
      <small>
        These are planning ideas. Check current routes, prices and availability
        in the experience you open.
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
