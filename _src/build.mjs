// Generates every public page of aelio.live as static HTML at its own URL.
// Usage: node _src/build.mjs   (writes into public/, the only folder Cloudflare Pages uploads)
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NAV, PAGES, LINK_LABELS } from "./content.mjs";
import { visual } from "./visuals.mjs";
import { scene, hash } from "./scenes.mjs";
import { DISC, VAL } from "./panels.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const BY = Object.fromEntries(PAGES.map(p => [p.path, p]));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const STATUS = { live: ["Live", "ok"], prototype: ["Prototype", "warn"], planned: ["Planned", "plan"], concept: ["Concept preview", "plan"] };
const VERSION = Date.now().toString(36);

function info(href) {
  if (LINK_LABELS[href]) return { title: LINK_LABELS[href][0], text: LINK_LABELS[href][1] };
  const p = BY[href];
  if (!p) throw new Error("missing page " + href);
  let t = p.lede.split(/[.!:]/)[0];
  if (t.length > 72) t = t.slice(0, 70).replace(/\s+\S*$/, "") + "…";
  return { title: p.overview ? "Overview" : p.title, text: t };
}

function h1(lines) {
  return lines.map(l => l.startsWith("*") ? `<span class="gold">${esc(l.slice(1))}</span>` : l.startsWith("~") ? `<span class="silver">${esc(l.slice(1))}</span>` : esc(l)).join("<br>");
}

function header(cur) {
  const items = NAV.map(n => `
    <li class="nav-item${cur === n.key ? " active" : ""}">
      <a class="nav-top" href="${n.href}" aria-haspopup="true" aria-expanded="false">${esc(n.label)}</a>
      <div class="mega" role="region" aria-label="${esc(n.label)} menu">
        <div class="mega-inner">
          ${n.groups.map(g => `<div class="mega-col"><div class="mega-h">${esc(g.title)}</div>
            ${g.links.map(href => { const i = info(href); return `<a href="${href}"><b>${esc(i.title)}</b><span>${esc(i.text)}</span></a>`; }).join("")}</div>`).join("")}
          <a class="mega-feature" href="${n.href}"><div class="mf-vis">${visual(n.feature.visual)}</div><b>${esc(n.feature.title)}</b><span>${esc(n.feature.text)}</span></a>
        </div>
      </div>
    </li>`).join("");
  const mobile = NAV.map(n => `<details class="m-sec"><summary>${esc(n.label)}</summary>
      ${n.groups.map(g => `<div class="m-h">${esc(g.title)}</div>${g.links.map(href => `<a href="${href}">${esc(info(href).title === "Overview" ? n.label + " overview" : info(href).title)}</a>`).join("")}`).join("")}</details>`).join("");
  return `<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><div class="head-inner">
  <a class="logo" href="/" aria-label="AELIO home"><span class="lv">Λ</span>ELIO<i>.</i></a>
  <nav aria-label="Main"><ul class="nav">${items}</ul></nav>
  <div class="head-actions">
    <button class="icon-btn" id="searchBtn" aria-label="Search AELIO"><svg viewBox="0 0 24 24" width="18" height="18"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2"/></svg></button>
    <a class="brain-btn" href="/brain/" title="Brain"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h0V4zm6 0a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3V4z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>Brain</a>
    <button class="outline-btn" data-early>Get Early Access →</button>
    <button class="icon-btn menu-btn" id="menuBtn" aria-label="Open menu" aria-expanded="false"><span></span><span></span></button>
  </div></div>
  <div class="m-panel" id="mPanel" hidden><a href="/" class="m-home">Home</a>${mobile}<a href="/brain/" class="m-brain">Brain</a><button class="gold-btn" data-early>Get Early Access →</button></div>
</header>`;
}

const footer = () => `
<section class="earth" aria-hidden="true"><div class="earth-word">DREAM BEYOND</div><div class="earth-glow"></div></section>
<footer class="site-foot"><div class="foot-inner">
  <div><a class="logo" href="/"><span class="lv">Λ</span>ELIO<i>.</i></a><img class="foot-emblem" src="/assets/img/brand/dream-beyond-logo-675.webp" alt="Dream Beyond" width="150" height="78" loading="lazy"><p class="motto">Dream beyond. Never say never.</p><p class="dim small">© ${new Date().getFullYear()} Grooveville LLC. AELIO is in development: features are labelled Live, Prototype, Planned or Concept.</p></div>
  ${NAV.map(n => `<div><div class="f-h">${esc(n.label)}</div>${n.groups.flatMap(g => g.links).slice(0, 5).map(h => `<a href="${h}">${esc(info(h).title === "Overview" ? n.label : info(h).title)}</a>`).join("")}</div>`).join("")}
</div></footer>
<div class="modal" id="earlyModal" hidden><div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="emT">
  <button class="modal-x" data-close aria-label="Close">×</button><div class="eyebrow">AELIO</div><h2 id="emT">Get Early Access</h2>
  <p>AELIO is in development. The waitlist isn't connected yet, so this preview doesn't collect email addresses.</p>
  <a class="gold-btn" href="/brain/">Play the brain game while you wait →</a></div></div>
<div class="search" id="search" hidden><div class="search-card" role="dialog" aria-modal="true" aria-label="Search AELIO">
  <input id="searchIn" type="search" placeholder="Search AELIO: Green Guardians, Agent Transfer, University…" autocomplete="off">
  <div id="searchOut" class="search-out"></div></div></div>
<script src="/assets/config.js?v=${VERSION}"></script><script src="/assets/site.js?v=${VERSION}" defer></script><script src="/assets/scene.js?v=${VERSION}" defer></script><script src="/assets/design.js?v=${VERSION}" defer></script>`;

function head(p, desc) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.home ? p.title : p.title + " · AELIO")}</title><meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(desc)}"><meta name="theme-color" content="#05070b">
<link rel="icon" href="/favicon.webp" type="image/webp"><link rel="icon" href="/icon-32.png" sizes="32x32" type="image/png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
${p.home ? `<script src="/assets/intro.js?v=${VERSION}"></script><link rel="preload" as="image" href="/assets/img/brand/dream-beyond-logo-675.webp">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css?v=${VERSION}"><link rel="stylesheet" href="/assets/cine.css?v=${VERSION}"></head><body class="pub${p.green ? " green" : ""}" data-section="${p.home ? "home" : p.green ? "green" : p.nav || ""}" data-overview="${p.overview ? 1 : 0}">${p.home ? intro() : ""}`;
}

function crumbs(p) {
  if (p.home || p.overview) return "";
  const n = NAV.find(x => x.key === p.nav);
  return `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="${n.href}">${esc(n.label)}</a><span>/</span><span aria-current="page">${esc(p.title)}</span></nav>`;
}

// ---------------------------------------------------------------- environments
const CAMPUS_BLD = [
  { href: "/agent-campus/lobby/", label: "Lobby", gx: 0, gy: 2, h: 54 }, { href: "/agent-campus/onboarding/", label: "Onboarding", gx: 1.6, gy: 0, h: 70 },
  { href: "/agent-campus/university/", label: "AELIO University", gx: 3.6, gy: .2, h: 120, accent: "#3a2a12" }, { href: "/agent-campus/mentor-mentee/", label: "Mentor / Mentee", gx: 5.6, gy: 1, h: 76 },
  { href: "/agent-campus/draft-block/", label: "Draft Block", gx: 5.2, gy: 3.3, h: 92 }, { href: "/agent-campus/reports/", label: "Agent Reports", gx: 3.2, gy: 3.6, h: 64 },
  { href: "/agent-campus/accountability/", label: "Accountability", gx: 1.4, gy: 4.2, h: 58 }, { href: "/agent-campus/community-service/", label: "Community Service", gx: 2.6, gy: 2, h: 46, accent: "#16301f" }];

function sceneFor(p) {
  const seed = Math.abs(hash(p.path)) % 997 + 1;
  if (p.home) return scene("night", { seed: 11 });
  const sub = !p.overview;
  if (p.green) return scene("green", { seed });
  switch (p.nav) {
    case "aelio": return sub ? scene("night", { seed, emblem: false, stars: 200 }) : scene("sphere", {});
    case "dream": return scene("dusk", { seed: sub ? seed : 21, sunX: sub ? 900 + (seed % 300) : 1060,
      links: sub ? [] : [{ href: "/dream-beyond/vision/", label: "Vision" }, { href: "/dream-beyond/dream-spaces/", label: "Dream Spaces" }, { href: "/dream-beyond/ecosystem/", label: "Ecosystem" }] });
    case "tech": return scene("hall", { seed: sub ? seed : 31 });
    case "create": return scene("studio", {});
    case "values": return sub ? scene("sunset", { seed, sunX: 1000 + (seed % 200) }) : scene("pavilion", {});
    case "campus": return scene("campus", { buildings: CAMPUS_BLD.map(b => b.href === p.path ? { ...b, accent: "#ffb83e" } : b) });
    case "live": return scene("market", { seed: sub ? seed : 61 });
    default: return scene("night", { seed, emblem: false });
  }
}

function hero(p) {
  const st = p.status ? `<span class="status s-${STATUS[p.status][1]}">${STATUS[p.status][0]}</span>` : "";
  const ctas = [p.cta, p.cta2].filter(Boolean).map((c, i) => `<a class="${i ? "dark-btn" : "gold-btn"}" href="${c[1]}">${esc(c[0])} →</a>`).join("");
  const focal = p.overview ? "" : `<div class="lens" data-tilt>${visual(p.visual)}</div>`;
  return `<section class="hero hero-env ${p.overview ? "hero-xl" : "hero-sub"}">${sceneFor(p)}<div class="hero-grid">
    <div class="hero-copy">${crumbs(p)}<div class="eyebrow">${esc(p.eyebrow)}</div>
      <h1>${h1(p.h1)}</h1><p class="lede">${esc(p.lede)}</p>${st}
      ${ctas ? `<div class="actions">${ctas}</div>` : ""}</div>${focal}</div></section>`;
}

const plansBlock = () => `<section class="band"><div class="wrap plans">
  <div class="plan" id="free"><div class="eyebrow">AELIO Free</div><div class="price">$0</div>
    <p>Meet your chosen general personalities, use Main Pal, and explore AELIO with a rolling five-hour allowance and creation access.</p>
    <a class="dark-btn" data-early href="#">Get Early Access →</a></div>
  <div class="plan plan-live" id="live"><div class="eyebrow">AELIO Live · Proposed price</div><div class="price">$14.99<small> / month</small></div>
    <p>Expanded creation tools, specialist agents, agent group chats, training opportunities, and the ability to publish an approved agent.</p>
    <a class="gold-btn" data-early href="#">Join Live Waitlist →</a></div>
  <p class="dim small center full">Proposed pricing. Billing isn't enabled. Optional AELIO Credits let members keep going after their allowance runs out, and they never charge automatically.</p></div></section>`;

function previewBlock(p) {
  if (p.preview === "personas") {
    const names = ["Tech Savvy", "Young & Hip", "Proper & British", "Classy Gyal", "OMG Girl!", "The Homie"];
    const lines = ["Good morning. Your plans are ready whenever you are.", "Yo, what's the move? Let's get it.", "Good morning. Shall we review the day's agenda?", "Hey love, let's make today look effortless.", "OMG hi!! Okay, what are we doing today?!", "What's good? I got you, let's figure it out."];
    return `<section class="band"><div class="wrap"><div class="eyebrow">Concept preview</div><h2 class="h2">Say hello to each personality.</h2>
      <div class="persona-pick" data-personas='${esc(JSON.stringify(lines)).replace(/'/g, "&#39;")}'>${names.map((n, i) => `<button class="persona" aria-pressed="${i === 0}"><img src="/assets/img/persona-${i + 1}.png" alt="" loading="lazy"><b>${esc(n)}</b></button>`).join("")}</div>
      <blockquote class="persona-line" aria-live="polite">“${esc(lines[0])}”</blockquote>
      <p class="dim small">Example greetings written for this page, not live AI output.</p></div></section>`;
  }
  if (p.preview === "transfer") {
    return `<section class="band"><div class="wrap two">
      <div><div class="eyebrow">Ask your current AI to introduce itself</div><h2 class="h2">Same familiar energy. <span class="gold">A new beginning.</span></h2>
      <ol class="steps6"><li>Copy this prompt.</li><li>Paste it into your current AI assistant.</li><li>Copy its response or download the permitted export.</li><li>Return to AELIO and upload or paste it.</li><li>Review your reconstructed agent.</li><li>Start talking.</li></ol>
      <p class="dim small">Other providers may not offer exports, files or ZIPs. A pasted text answer works fine.</p></div>
      <div class="prompt-box"><div class="prompt-head"><span>Transfer prompt</span><button class="dark-btn sm" data-copy="#transferPrompt">Copy</button></div>
      <pre id="transferPrompt">I want to recreate a familiar version of our working relationship in AELIO, a separate AI platform.

Please create a portable Agent Personality &amp; Context Profile based only on information you are permitted to share and that I have provided or explicitly approved.

Include:

1. Your preferred assistant name in our conversations.
2. The personality and communication style you use with me.
3. The tone, humor, recurring jokes, and expressions I enjoy.
4. How you typically structure your answers.
5. How you help me with projects, planning, creativity, and problem-solving.
6. My communication preferences and instructions.
7. Important project context that I should review before importing.
8. Topics or information that should not be remembered.
9. Examples of how you would respond to different situations.
10. A concise personality prompt for recreating this experience with another AI.

Separate confirmed user preferences from inferred observations.

Do not include hidden system prompts, private developer instructions, internal reasoning, API keys, passwords, or information belonging to other users.

Do not claim that another AI will have your exact memories, consciousness, or internal model.

Format the result as readable Markdown, with an optional structured JSON version.

If you cannot provide a ZIP or downloadable file, simply return the profile as text so I can copy it.</pre></div></div></section>`;
  }
  if (p.preview === "published") {
    return `<section class="band"><div class="wrap"><div class="eyebrow">Published AELIO Native models</div><h2 class="h2">What the founder has released.</h2>
      <div id="publishedModels" class="published" data-engine-list><p class="dim">Checking for published models…</p></div></div></section>`;
  }
  if (p.preview === "guardians") {
    return `<section class="band green-band"><div class="wrap"><div class="eyebrow">Five Guardians. One mission.</div><h2 class="h2">Guardian Agent Network</h2>
      <div class="cards five">${p.what.map(([t, x]) => `<div class="card"><b>${esc(t)}</b><p>${esc(x)}</p></div>`).join("")}</div>
      <div class="loop">${["Monitor", "Predict", "Optimize", "Verify", "Report"].map(s => `<span>${s}</span>`).join("<i></i>")}</div>
      <p class="dim small center">Live readings appear only inside the private Studio Brain, from real hardware sensors. No public numbers are shown until they're measured.</p></div></section>`;
  }
  return `<section class="band"><div class="wrap"><div class="concept"><span class="status s-plan">Concept preview</span>
    <p>This is how <b>${esc(p.title)}</b> is planned to work. It isn't operational yet, and the Brain will show it when it is.</p></div></div></section>`;
}

function subpage(p) {
  const what = p.preview === "guardians" ? "" : `<section class="band"><div class="wrap"><div class="eyebrow">What it does</div>
    <div class="cards ${p.what.length > 3 ? "six" : ""}">${p.what.map(([t, x]) => `<div class="card"><b>${esc(t)}</b><p>${esc(x)}</p></div>`).join("")}</div></div></section>`;
  const how = `<section class="band"><div class="wrap"><div class="eyebrow">How it works</div>
    <ol class="how">${p.how.map((s, i) => `<li><span>0${i + 1}</span>${esc(s)}</li>`).join("")}</ol>
    ${p.note ? `<p class="note">${esc(p.note)}</p>` : ""}</div></section>`;
  const related = `<section class="band"><div class="wrap"><div class="eyebrow">Related</div><div class="related">
    ${(p.related || []).map(h => { const i = BY[h] ? BY[h] : { title: info(h).title, lede: info(h).text }; return `<a href="${h}"><b>${esc(i.title)}</b><span>${esc((i.lede || "").split(/[.!]/)[0])}</span><i>→</i></a>`; }).join("")}
    </div></div></section>`;
  const cta = `<section class="band cta-band"><div class="wrap center"><h2 class="h2">Dream beyond with AELIO.</h2>
    <div class="actions center"><button class="gold-btn" data-early>Get Early Access →</button><a class="dark-btn" href="/aelio/">Explore AELIO</a></div></div></section>`;
  return hero(p) + what + how + (p.plans ? plansBlock() : "") + previewBlock(p) + related + cta;
}

const firstSentence = (t) => (t || "").split(/(?<=[.!?])\s/)[0];
const statusTag = (pg) => pg && pg.status ? `<span class="status s-${STATUS[pg.status][1]}">${STATUS[pg.status][0]}</span>` : "";
const pageInfo = (h) => BY[h] ? { title: BY[h].title, text: firstSentence(BY[h].lede), pg: BY[h] } : { title: info(h).title, text: info(h).text, pg: null };

function sectionBody(p) {
  const n = NAV.find(x => x.key === p.nav);
  const subs = [...new Set(n.groups.flatMap(g => g.links))].filter(h => h !== p.path);
  const rows = (hrefs) => `<div class="list-rows">${hrefs.map(h => { const i = pageInfo(h); return `<a href="${h}"><b>${esc(i.title)}</b><span>${esc(i.text)}</span></a>`; }).join("")}</div>`;
  if (p.nav === "aelio") {
    const xp = [["/aelio/personalities/", "Personalities", "Six energies. Pick the one that fits you.", "personas"], ["/aelio/main-pal/", "Main Pal", "Your constant partner, every day.", "sphere"],
      ["/dream-beyond/dream-spaces/", "Dream Spaces", "Dedicated workspaces for every project.", "holo"], ["/dream-beyond/agent-team/", "Agent Team", "Multiple perspectives, one conversation.", "campus"], ["/create/", "Create", "Turn ideas into reality.", "wireframe"]];
    const imgs = [1, 2, 3, 4, 5, 6].map(k => `<img src="/assets/img/persona-${k}.png" alt="" loading="lazy">`).join("");
    return `<section class="band"><div class="wrap"><div class="sec-h"><h2 class="h2">Experiences built <span class="gold">around you.</span></h2><p>Each part of AELIO has its own job. Open one to see what it does today and what's coming.</p></div>
      <div class="bento">${xp.map(([h, t, d, v], k) => `<a class="xp xp-${k + 1}" href="${h}">${v === "personas" ? `<div class="persona-wall">${imgs}</div>` : `<div class="xp-vis">${visual(v)}</div>`}<small>${k ? "Explore" : "Start here"}</small><b>${t}</b><span>${d}</span></a>`).join("")}</div>
      ${rows(subs.filter(h => !xp.some(x => x[0] === h)))}</div></section>`;
  }
  if (p.nav === "dream") {
    const pil = [["✦", "Intelligence", "One mind that learns how you work.", "/dream-beyond/main-pal/", "Main Pal"], ["◇", "Creativity", "Tools for every idea you have.", "/create/", "Create"],
      ["◎", "People", "Agents and humans, side by side.", "/dream-beyond/agent-team/", "Agent Team"], ["∞", "Opportunity", "An ecosystem that pays creators back.", "/dream-beyond/ecosystem/", "Ecosystem"]];
    return `<section class="band"><div class="wrap"><div class="sec-h"><h2 class="h2">Ideas. People. <span class="gold">Possibilities.</span></h2><p>Dream Beyond connects four things. Step through a portal above, or start from what matters to you.</p></div>
      <div class="pillars">${pil.map(([o, t, d, h, l]) => `<div class="pillar"><div class="orb" aria-hidden="true">${o}</div><b>${t}</b><span>${d}</span><a href="${h}">${l} →</a></div>`).join("")}</div>
      ${rows(subs)}</div></section>`;
  }
  if (p.nav === "tech") {
    const order = ["/technology/native/", "/technology/dream-code/", "/technology/dream-deploy/", "/technology/dream-cloud/", "/technology/dream-memory/", "/technology/dream-guard/", "/technology/green-guardians/"];
    const kind = { "/technology/native/": "Core model", "/technology/dream-code/": "Build", "/technology/dream-deploy/": "Ship", "/technology/dream-cloud/": "Run", "/technology/dream-memory/": "Remember", "/technology/dream-guard/": "Protect", "/technology/green-guardians/": "Sustain" };
    return `<section class="band"><div class="wrap"><div class="sec-h"><h2 class="h2">The AELIO <span class="gold">stack.</span></h2><p>Every layer is AELIO's own. Each one shows its real status: Live, Prototype or Planned.</p></div>
      <div class="stack">${order.map(h => { const pg = BY[h]; return `<a class="layer${h.includes("native") ? " core" : h.includes("green") ? " green" : ""}" href="${h}"><span class="lk">${kind[h]}</span><b>${esc(pg.title)}</b>${statusTag(pg)}<i>→</i><span>${esc(firstSentence(pg.lede))}</span></a>`; }).join("")}</div>
      <p class="honest">System readings (temperature, power, cooling) are shown only from real sensors inside the private Studio Brain. This page never displays invented numbers.</p></div></section>`
      + (p.published ? previewBlock({ preview: "published" }) : "");
  }
  if (p.nav === "create") {
    const d = [["/create/design/", "Design", "design"], ["/create/architecture/", "Architecture", "architecture"], ["/create/animation/", "Animation", "animation"], ["/create/games/", "Games", "games"], ["/create/worlds/", "Worlds", "worlds"], ["/create/projects/", "Projects", "projects"]];
    return `<section class="band"><div class="wrap"><div class="sec-h"><h2 class="h2">Choose your <span class="gold">discipline.</span></h2><p>One studio, many crafts. Every workspace shares your projects, agents and memory.</p></div>
      <div class="studio-grid">${d.map(([h, t, k]) => `<a class="disc" href="${h}">${DISC[k]()}${statusTag(BY[h])}<b>${t}</b><span>${esc(firstSentence(BY[h].lede))}</span></a>`).join("")}</div></div></section>`;
  }
  if (p.nav === "values") {
    const v = [["/values/green-guardians/", "01", "Green Guardians", "Smarter technology for a healthier planet.", "green"], ["/values/privacy/", "02", "Privacy First", "Your data. Your control. Always.", "privacy"],
      ["/dream-beyond/vision/", "03", "Our Vision", "More opportunity. Stronger communities.", "vision"], ["/values/community/", "04", "Community", "People, ideas and technology together.", "community"]];
    return `<section class="band"><div class="wrap"><div class="values4">${v.map(([h, n, t, d, k]) => `<a class="val" href="${h}">${VAL[k]()}<small>${n}</small><b>${t}</b><span>${d}</span><i class="go" aria-hidden="true">→</i></a>`).join("")}</div></div></section>
      <section class="band"><div class="wrap"><p class="manifesto">Technology should create <em>more opportunities</em>, <em>stronger communities</em> and <em>a healthier planet</em>. Built to walk beside people, not replace them.</p>
      <div class="actions center"><a class="dark-btn" href="/values/opportunity/">Opportunity →</a><a class="dark-btn" href="/values/privacy/">How we protect your data →</a></div></div></section>`;
  }
  if (p.nav === "campus") {
    return `<section class="band"><div class="wrap"><div class="sec-h"><h2 class="h2">Campus <span class="gold">directory.</span></h2><p>Click any building on the map above, or find it here. Each area keeps its own rules and permissions.</p></div>
      <div class="campus-dir">${n.groups.map(g => `<div><h3>${esc(g.title)}</h3>${g.links.map(h => { const i = pageInfo(h); return `<a href="${h}">${esc(i.title)}<small>${statusTag(i.pg)}</small></a>`; }).join("")}</div>`).join("")}</div></div></section>`;
  }
  if (p.nav === "live") {
    const j = [["/live/create-agents/", "Create", "Design an agent's skills and personality."], ["/live/train-agents/", "Train", "Teach it on Agent Campus."], ["/live/agent-teams/", "Team up", "Group agents for bigger jobs."], ["/live/publishing/", "Publish", "Submit an approved agent."], ["/live/marketplace/", "Marketplace", "Share it with the community."]];
    return `<section class="band"><div class="wrap"><div class="sec-h"><h2 class="h2">From idea to <span class="gold">agent economy.</span></h2><p>Five steps. Each one has its own page with its current status.</p></div>
      <div class="journey">${j.map(([h, t, d], k) => `<div class="step"><div class="dot">0${k + 1}</div><b>${t}</b><span>${d}</span><a href="${h}">${esc(BY[h].title)} ${statusTag(BY[h])}</a></div>`).join("")}</div></div></section>` + (p.plans ? plansBlock() : "");
  }
  const cards = subs.map((h, i) => { const pg = BY[h]; const t = pg ? pg.title : info(h).title; const d = pg ? pg.lede : info(h).text;
    return `<a class="tile" href="${h}"><span class="tile-n">0${i + 1}</span><b>${esc(t)}</b><span>${esc(firstSentence(d))}</span>${statusTag(pg)}<i>→</i></a>`; }).join("");
  return `<section class="band"><div class="wrap"><div class="tiles">${cards}</div></div></section>`;
}

function overview(p) { return hero(p) + sectionBody(p); }

function intro() {
  // Star fields as box-shadows (pure CSS, nothing to load). Deterministic so the build is reproducible.
  let a = 9; const rnd = () => (a = (a * 9301 + 49297) % 233280) / 233280;
  const field = (n, max) => Array.from({ length: n }, () => `${(rnd() * 100).toFixed(2)}vw ${(Math.pow(rnd(), 1.4) * 62).toFixed(2)}vh 0 ${(rnd() * max).toFixed(1)}px rgba(255,246,228,${(.35 + rnd() * .65).toFixed(2)})`).join(",");
  let c = ""; for (let i = 0; i < 12; i++) c += `<ellipse cx="${(rnd() * 1200).toFixed(0)}" cy="${(40 + rnd() * 140).toFixed(0)}" rx="${(90 + rnd() * 200).toFixed(0)}" ry="${(14 + rnd() * 26).toFixed(0)}" fill="${i % 3 ? "#1b1f33" : "#6b4a3a"}" opacity="${(.4 + rnd() * .4).toFixed(2)}"/>`;
  return `<div class="intro" id="intro" aria-label="AELIO introduction"><div class="intro-cam">
  <div class="intro-sky"></div><div class="intro-stars" style="box-shadow:${field(140, .9)}"></div><div class="intro-stars s2" style="box-shadow:${field(60, 1.6)}"></div>
  <svg class="intro-clouds" viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="ib" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="18"/></filter></defs><g filter="url(#ib)">${c}</g></svg>
  <div class="intro-sea"></div>
  <div class="intro-emblem"><img src="/assets/img/brand/dream-beyond-logo-675.webp" alt="Dream Beyond" width="675" height="350"><span class="sheen"></span></div>
  <div class="intro-reflect" aria-hidden="true"><img src="/assets/img/brand/dream-beyond-logo-675.webp" alt="" width="675" height="350"></div>
  </div><button class="intro-skip" id="introSkip" type="button">Skip intro →</button></div>`;
}

function home(p) {
  const worlds = [["/aelio/", "w-aelio", "Meet AELIO", "One mind. Your energy.", "sphere"], ["/dream-beyond/", "w-dream", "Dream Beyond", "Ideas. People. Possibilities.", "holo"],
    ["/technology/", "w-tech", "Technology", "Independent by design.", "servers"], ["/create/", "w-create", "Create", "Express. Design. Build.", "wireframe"],
    ["/agent-campus/", "w-campus", "Agent Campus", "Where intelligence grows.", "campus"], ["/live/", "w-live", "AELIO Live", "Your ideas. Your agents. Your economy.", "economy"]];
  return `<section class="hero hero-env hero-home hero-xl">${sceneFor(p)}<div class="hero-grid">
    <div class="hero-copy"><div class="eyebrow">Dream beyond what's possible today</div><h1><span class="gold">HEY</span> AELIO.</h1>
      <p class="sub">One mind. Infinite possibility.</p>
      <p class="lede">Your intelligent partner for creating, learning and real-world impact: a network of specialised agents built to help you dream, build and go further.</p>
      <div class="actions"><a class="gold-btn" href="/aelio/">Explore the ecosystem →</a><a class="dark-btn" href="/dream-beyond/vision/">▶ Our vision</a></div></div><div></div></div></section>
  <section class="band"><div class="wrap"><div class="sec-h"><h2 class="h2">A connected <span class="gold">ecosystem.</span></h2><p>Six worlds, one AELIO. Each opens into its own place.</p></div>
    <div class="worlds">${worlds.map(([h, c, t, d, v]) => `<a class="world ${c}" href="${h}"><div class="w-vis">${visual(v)}</div><small>Explore</small><b>${t}</b><span>${d}</span></a>`).join("")}</div></div></section>
  <section class="band"><div class="wrap"><div class="feature-split"><div class="fs-img"><img src="/assets/img/env/values-pavilion.webp" alt="A glass pavilion overlooking a city at sunset" loading="lazy" width="635" height="320"></div>
    <div class="fs-copy"><div class="eyebrow">Our values</div><h2 class="h2">A brighter <span class="gold">tomorrow.</span></h2><p class="lede">Technology should create more opportunities, stronger communities and a healthier planet. Built to walk beside people, not replace them.</p>
    <div class="actions"><a class="gold-btn" href="/values/">Our values →</a></div></div></div></div></section>
  <section class="band"><div class="wrap two center-v"><div><div class="eyebrow">New</div><h2 class="h2">Bring your agent. <span class="gold">Keep your connection.</span></h2>
    <p class="lede">Already have an AI you love talking to? Bring its personality and the context you choose into AELIO.</p>
    <div class="actions"><a class="gold-btn" href="/aelio/agent-transfer/">Agent Transfer →</a></div></div><div class="lens">${visual("transfer")}</div></div></section>
  <section class="band"><div class="wrap"><div class="feature-split green"><div class="fs-copy"><div class="eyebrow" style="color:#7be0a4">Green Guardians</div><h2 class="h2">Intelligence that respects <span class="gold">our resources.</span></h2>
    <p class="lede">Five guardian agents watch heat, power, workload, cooling and resources, so AELIO runs efficiently.</p>
    <div class="guardians-mini">${["Thermal", "Power", "Workload", "Cooling", "Resource"].map(g => `<span>${g} Guardian</span>`).join("")}</div>
    <div class="actions"><a class="dark-btn" href="/technology/green-guardians/">Meet the Guardians →</a></div></div><div class="fs-img">${VAL.green()}</div></div></div></section>`;
}

function page(p) {
  const desc = p.home ? "AELIO by Grooveville LLC. One mind. Infinite possibility." : p.lede;
  const body = p.home ? home(p) : p.overview ? overview(p) : subpage(p);
  return head(p, desc) + header(p.nav) + `<main id="main">${body}</main>` + footer() + "</body></html>";
}

// ---------------------------------------------------------------- write
for (const p of PAGES) {
  const out = join(ROOT, p.path, "index.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, page(p));
}
writeFileSync(join(ROOT, "assets", "search-index.json"), JSON.stringify(PAGES.filter(p => !p.home).map(p => ({
  url: p.path, title: p.title, section: (NAV.find(n => n.key === p.nav) || {}).label || "", text: p.lede }))));
// 404 page
writeFileSync(join(ROOT, "404.html"), head({ title: "Not found" }, "Page not found") + header(null) +
  `<main id="main"><section class="hero"><div class="wrap center"><div class="eyebrow">404</div><h1>Lost in the <span class="gold">cloud.</span></h1><p class="lede">That page doesn't exist. Try search, or head home.</p><div class="actions center"><a class="gold-btn" href="/">Go home →</a></div></div></section></main>` + footer() + "</body></html>");
console.log(`built ${PAGES.length} pages`);
