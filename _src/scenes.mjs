// Cinematic hero environments for the public site, one family per section.
// Everything is drawn in code (SVG + CSS + small canvases in /assets/scene.js): no screenshots, no text baked into images.
// Photographic plates are used only where a clean original exists (see VISUAL_ASSETS.md); every other scene is layered
// vector art with its own motion (drifting clouds and mist, water shimmer, swaying trees, light pulses).
//
// scene(key, opts) -> HTML for the absolutely-positioned environment behind a hero.
//   opts.seed     varies ridgelines/stars so subpages of a section aren't identical
//   opts.links    [{href,label,x,y}] interactive hotspots placed inside the scene (portals, buildings)

const rng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export const hash = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const f = (n) => Math.round(n * 10) / 10;

/** A mountain ridge as a closed path across a 1600-wide canvas. */
function ridge(r, base, amp, rough, w = 1600, h = 900) {
  const pts = []; let y = base; const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    y += (r() - .5) * rough * 1.6; y = Math.max(base - amp, Math.min(base + amp * .3, y + (base - y) * .15));
    const swell = Math.sin(i / steps * Math.PI * (1.2 + r() * .8) + r()) * amp * .5;
    pts.push([x, y - Math.max(0, swell)]);
  }
  let d = `M0 ${h} L0 ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; d += ` Q${f(x0)} ${f(y0)} ${f((x0 + x1) / 2)} ${f((y0 + y1) / 2)}`; }
  return d + ` L${w} ${f(pts[pts.length - 1][1])} L${w} ${h} Z`;
}

/** Soft cloud bank made of blurred ellipses. */
function clouds(r, id, n, y0, y1, color, opacity) {
  let s = "";
  for (let i = 0; i < n; i++) {
    const cx = r() * 1800 - 100, cy = y0 + r() * (y1 - y0), rx = 120 + r() * 260, ry = 18 + r() * 40;
    s += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${color}" opacity="${f(opacity * (.5 + r() * .5) * 100) / 100}"/>`;
  }
  return `<g filter="url(#${id}-blur)">${s}</g>`;
}

const svgOpen = (cls) => `<svg class="env-svg ${cls || ""}" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">`;
const blur = (id, d = 22) => `<filter id="${id}-blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${d}"/></filter>`;

function hotspots(links) {
  if (!links || !links.length) return "";
  return `<div class="env-spots">${links.map(l => `<a class="spot" href="${l.href}" style="left:${l.x}%;top:${l.y}%"><span class="spot-dot"></span><span class="spot-label">${l.label}</span></a>`).join("")}</div>`;
}

// ---------------------------------------------------------------- scenes
const SCENES = {
  /** Home: night ocean that continues the entrance, dawn on the horizon, the official emblem floating above the water. */
  night(o) {
    const r = rng(o.seed || 11);
    return `<div class="env env-night" data-env="night">
      <canvas class="env-canvas" data-stars="${o.stars || 260}" data-seed="${o.seed || 11}"></canvas>
      ${svgOpen("env-sky")}<defs>${blur("nc", 26)}
        <linearGradient id="n-hz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb35a" stop-opacity="0"/><stop offset=".72" stop-color="#ff9a3c" stop-opacity=".22"/><stop offset="1" stop-color="#ffcf8a" stop-opacity=".55"/></linearGradient>
        <radialGradient id="n-moon" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff3d8"/><stop offset=".55" stop-color="#f4d9a4" stop-opacity=".9"/><stop offset="1" stop-color="#f4d9a4" stop-opacity="0"/></radialGradient>
      </defs>
        <rect y="330" width="1600" height="270" fill="url(#n-hz)"/>
        <g class="moon"><circle cx="880" cy="170" r="110" fill="url(#n-moon)" opacity=".16"/><circle cx="880" cy="170" r="34" fill="#f6e3bb" opacity=".8"/></g>
        <g class="drift d-slow">${clouds(r, "nc", 10, 380, 560, "#2b2433", .9)}</g>
        <g class="drift d-mid">${clouds(r, "nc", 8, 450, 590, "#c27a3c", .35)}</g>
        <path d="${ridge(r, 600, 26, 14)}" fill="#0a0d16" opacity=".9"/>
      </svg>
      <div class="env-water"><canvas class="env-canvas" data-water="gold" data-seed="${o.seed || 11}"></canvas></div>
      ${o.emblem === false ? "" : `<div class="emblem-float"><img class="emblem" src="/assets/img/brand/dream-beyond-logo-675.webp" alt="Dream Beyond emblem" width="675" height="350">
        <img class="emblem-reflect" src="/assets/img/brand/dream-beyond-logo-675.webp" alt="" width="675" height="350" aria-hidden="true"></div>`}
      <div class="env-shade env-shade-left"></div>
    </div>`;
  },

  /** Meet AELIO: the intelligence sphere (clean original plate) with live particles and water light. */
  sphere(o) {
    return `<div class="env env-sphere" data-env="sphere">
      <div class="plate plate-right"><img src="/assets/img/env/intelligence-sphere.webp" alt="" width="735" height="499" fetchpriority="high"></div>
      <div class="sphere-pulse"></div>
      <canvas class="env-canvas" data-motes="gold" data-seed="${o.seed || 3}"></canvas>
      <div class="env-shade env-shade-left"></div>${hotspots(o.links)}
    </div>`;
  },

  /** Dream Beyond: layered mountain ranges at dusk, drifting mist, glowing portals on terraces. */
  dusk(o) {
    const r = rng(o.seed || 21);
    const layers = [[470, 120, 40, "#3a2a44", .55], [540, 110, 34, "#2a2036", .75], [610, 90, 30, "#1b1626", .9], [690, 70, 24, "#110e18", 1], [770, 50, 18, "#08070c", 1]];
    return `<div class="env env-dusk" data-env="dusk">
      <canvas class="env-canvas" data-stars="90" data-seed="${o.seed || 21}"></canvas>
      ${svgOpen()}<defs>${blur("dc", 24)}
        <radialGradient id="d-sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff0c8"/><stop offset=".3" stop-color="#ffb04a" stop-opacity=".85"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient>
        <linearGradient id="d-mist" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f3b37a" stop-opacity="0"/><stop offset=".5" stop-color="#e9a26a" stop-opacity=".28"/><stop offset="1" stop-color="#e9a26a" stop-opacity="0"/></linearGradient>
        <linearGradient id="d-pin" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffe9c0" stop-opacity=".35"/><stop offset="1" stop-color="#ff9a3c" stop-opacity=".05"/></linearGradient><linearGradient id="d-portal" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffe2a6"/><stop offset="1" stop-color="#ff9a3c" stop-opacity=".2"/></linearGradient>
      </defs>
        <circle cx="${o.sunX || 1060}" cy="470" r="260" fill="url(#d-sun)" opacity=".75"/>
        <g class="drift d-slow">${clouds(r, "dc", 9, 170, 360, "#e7a06a", .32)}</g>
        ${layers.map(([b, a, ro, c, op], i) => `<path d="${ridge(r, b, a, ro)}" fill="${c}" opacity="${op}"/>${i === 1 || i === 3 ? `<rect class="mist m${i}" x="-200" y="${b - 40}" width="2000" height="110" fill="url(#d-mist)"/>` : ""}`).join("")}
        ${[[820, 655, .95], [1110, 705, 1.2], [1400, 660, 1]].map(([x, y, s], i) => { const l = (o.links || [])[i];
          const g = `<g class="portal p${i}" transform="translate(${x} ${y}) scale(${s})">
          <ellipse cx="0" cy="8" rx="96" ry="14" fill="#ffb35a" opacity=".22"/><rect x="-80" y="0" width="160" height="10" rx="3" fill="#1d1712" stroke="#c9742c" stroke-opacity=".6"/>
          <path d="M-34 0 V-96 A34 34 0 0 1 34 -96 V0" fill="none" stroke="url(#d-portal)" stroke-width="5"/>
          <path d="M-26 0 V-94 A26 26 0 0 1 26 -94 V0 Z" fill="url(#d-pin)" class="portal-glow"/>${l ? `<text x="0" y="-146" text-anchor="middle">${l.label}</text>` : ""}</g>`;
          return l ? `<a href="${l.href}" class="portal-link" aria-label="${l.label}">${g}</a>` : g; }).join("")}
      </svg><div class="env-shade env-shade-left"></div>
    </div>`;
  },

  /** Technology: a one-point-perspective compute hall, light pulses running to the AELIO Native core. */
  hall(o) {
    const r = rng(o.seed || 31); const VX = 1030, VY = 430;
    let racks = "";
    for (let i = 0; i < 9; i++) {
      const t = i / 9, t2 = (i + .82) / 9; const lerp = (a, b, k) => a + (b - a) * k;
      for (const side of [-1, 1]) {
        const x0 = VX + side * lerp(980, 60, Math.pow(t, .55)), x1 = VX + side * lerp(980, 60, Math.pow(t2, .55));
        const top0 = lerp(-60, VY - 90, Math.pow(t, .55)), top1 = lerp(-60, VY - 90, Math.pow(t2, .55));
        const bot0 = lerp(980, VY + 70, Math.pow(t, .55)), bot1 = lerp(980, VY + 70, Math.pow(t2, .55));
        racks += `<path d="M${f(x0)} ${f(top0)} L${f(x1)} ${f(top1)} L${f(x1)} ${f(bot1)} L${f(x0)} ${f(bot0)} Z" fill="#0b1018" stroke="#1e2a3a" stroke-width="1"/>`;
        for (let k = 0; k < 7; k++) { const yy = lerp(top0, bot0, .12 + k * .11), yy2 = lerp(top1, bot1, .12 + k * .11);
          if (r() < .8) racks += `<line x1="${f(x0)}" y1="${f(yy)}" x2="${f(x1)}" y2="${f(yy2)}" stroke="${r() < .2 ? "#5ad1e6" : "#ffb83e"}" stroke-opacity="${f(.25 + r() * .5)}" stroke-width="${f(1 + (1 - t) * 2)}" class="${r() < .3 ? "blink" : ""}" style="animation-delay:${f(r() * 4)}s"/>`; }
      }
    }
    let floor = ""; for (let i = -10; i <= 10; i++) floor += `<line x1="${VX}" y1="${VY + 70}" x2="${VX + i * 220}" y2="900" stroke="#ffb83e" stroke-opacity=".12"/>`;
    for (let i = 0; i < 6; i++) { const y = VY + 70 + Math.pow(i / 6, 1.8) * 470; floor += `<line x1="0" y1="${f(y)}" x2="1600" y2="${f(y)}" stroke="#ffb83e" stroke-opacity="${f(.04 + i * .02)}"/>`; }
    const pulses = [-6, -3, 2, 5].map((k, i) => `<line class="pulse" x1="${VX + k * 220}" y1="900" x2="${VX}" y2="${VY + 70}" stroke="#ffd58a" stroke-width="2.5" style="animation-delay:${i * .9}s"/>`).join("");
    return `<div class="env env-hall" data-env="hall">
      ${svgOpen()}<defs>
        <radialGradient id="h-core" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff2cf"/><stop offset=".25" stop-color="#ffb83e" stop-opacity=".8"/><stop offset="1" stop-color="#ff8a1f" stop-opacity="0"/></radialGradient>
        <linearGradient id="h-ceil" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#121a26"/><stop offset="1" stop-color="#05070b"/></linearGradient>
      </defs>
        <rect width="1600" height="900" fill="#05070b"/><rect width="1600" height="${VY}" fill="url(#h-ceil)" opacity=".7"/>
        ${[0, 1, 2, 3].map(i => `<line x1="${VX - 900 + i * 40}" y1="0" x2="${VX - 30 + i * 20}" y2="${VY - 95}" stroke="#ffe2b0" stroke-opacity=".18" stroke-width="2"/><line x1="${VX + 900 - i * 40}" y1="0" x2="${VX + 30 - i * 20}" y2="${VY - 95}" stroke="#ffe2b0" stroke-opacity=".18" stroke-width="2"/>`).join("")}
        ${floor}${pulses}${racks}
        <circle cx="${VX}" cy="${VY}" r="170" fill="url(#h-core)" class="core-breathe"/>
        <path d="M${VX - 34} ${VY}c0-17 25-17 34 0s34 17 34 0-25-17-34 0-34 17-34 0z" fill="none" stroke="#fff1cc" stroke-width="4"/>
        <ellipse cx="${VX}" cy="${VY + 75}" rx="120" ry="10" fill="#ffb83e" opacity=".35"/>
      </svg>${hotspots(o.links)}<div class="env-shade env-shade-left"></div>
    </div>`;
  },

  /** Create: a holographic studio with a blueprint floor and floating wireframe work in progress. */
  studio(o) {
    let grid = ""; const VX = 1000, VY = 520;
    for (let i = -14; i <= 14; i++) grid += `<line x1="${VX + i * 30}" y1="${VY}" x2="${VX + i * 170}" y2="900" stroke="#5ad1e6" stroke-opacity=".16"/>`;
    for (let i = 1; i < 9; i++) { const y = VY + Math.pow(i / 9, 1.7) * 380; grid += `<line x1="0" y1="${f(y)}" x2="1600" y2="${f(y)}" stroke="#5ad1e6" stroke-opacity=".12"/>`; }
    const iso = (x, y, w, h, d, cls) => `<g transform="translate(${x} ${y})"><g class="holo-obj ${cls}"><path d="M0 0 L${w} ${-w * .5} L${w + d} ${-w * .5 + d * .5} L${d} ${d * .5} Z M0 0 V${h} M${w} ${-w * .5} V${-w * .5 + h} M${w + d} ${-w * .5 + d * .5} V${-w * .5 + d * .5 + h} M${d} ${d * .5} V${d * .5 + h} M0 ${h} L${d} ${d * .5 + h} L${w + d} ${-w * .5 + d * .5 + h} L${w} ${-w * .5 + h} Z" fill="none" stroke="#ffcf86" stroke-width="1.6"/>
      ${[.25, .5, .75].map(k => `<path d="M0 ${h * k} L${d} ${d * .5 + h * k} L${w + d} ${-w * .5 + d * .5 + h * k}" fill="none" stroke="#ffcf86" stroke-opacity=".4"/>`).join("")}</g></g>`;
    const sphereW = (x, y, rr) => `<g transform="translate(${x} ${y})"><g class="holo-obj spin-y"><circle r="${rr}" fill="none" stroke="#5ad1e6" stroke-opacity=".8"/>${[.3, .6, .85].map(k => `<ellipse rx="${rr}" ry="${f(rr * k)}" fill="none" stroke="#5ad1e6" stroke-opacity=".35"/><ellipse rx="${f(rr * k)}" ry="${rr}" fill="none" stroke="#5ad1e6" stroke-opacity=".35"/>`).join("")}</g></g>`;
    const wave = (x, y) => `<g class="holo-obj wave" transform="translate(${x} ${y})">${Array.from({ length: 24 }, (_, i) => `<rect x="${i * 9}" y="${-f(10 + Math.abs(Math.sin(i * .7)) * 46)}" width="5" height="${f(20 + Math.abs(Math.sin(i * .7)) * 92)}" rx="2" fill="#ffb83e" opacity=".75" style="animation-delay:${f(i * .07)}s"/>`).join("")}</g>`;
    const terrain = (x, y) => { let s = ""; for (let j = 0; j < 7; j++) { let d = ""; for (let i = 0; i <= 12; i++) { const xx = i * 22 + j * 10, yy = j * 12 - Math.sin(i * .6 + j) * 12 - Math.cos(i * .3) * 10; d += (i ? " L" : "M") + f(xx) + " " + f(yy); } s += `<path d="${d}" fill="none" stroke="#7be0a4" stroke-opacity="${f(.25 + j * .08)}"/>`; } return `<g transform="translate(${x} ${y})"><g class="holo-obj float2">${s}</g></g>`; };
    return `<div class="env env-studio" data-env="studio">
      ${svgOpen()}<defs><radialGradient id="s-amb" cx="60%" cy="45%" r="60%"><stop offset="0" stop-color="#1b2a3a"/><stop offset="1" stop-color="#05070b"/></radialGradient>
        <linearGradient id="s-beam" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5ad1e6" stop-opacity=".0"/><stop offset="1" stop-color="#5ad1e6" stop-opacity=".22"/></linearGradient></defs>
        <rect width="1600" height="900" fill="url(#s-amb)"/>
        <rect x="1180" y="80" width="360" height="230" rx="10" fill="#0b1520" stroke="#5ad1e6" stroke-opacity=".35"/><path d="M1200 280 L1260 220 L1310 250 L1380 160 L1450 200 L1520 120" fill="none" stroke="#ffb83e" stroke-width="2"/>
        <rect x="640" y="70" width="260" height="170" rx="10" fill="#0b1520" stroke="#ffb83e" stroke-opacity=".3"/>${[0, 1, 2, 3].map(i => `<rect x="660" y="${92 + i * 34}" width="${180 - i * 30}" height="10" rx="5" fill="#ffcf86" opacity="${f(.5 - i * .08)}"/>`).join("")}
        ${grid}
        <polygon points="${VX - 160},${VY + 10} ${VX + 160},${VY + 10} ${VX + 250},900 ${VX - 250},900" fill="url(#s-beam)" opacity=".5"/>
        ${iso(840, 400, 120, 110, 90, "float1")}${sphereW(1110, 280, 70)}${wave(1220, 470)}${terrain(1150, 600)}
        <ellipse cx="${VX}" cy="${VY + 230}" rx="320" ry="40" fill="none" stroke="#5ad1e6" stroke-opacity=".3"/>
      </svg>${hotspots(o.links)}<div class="env-shade env-shade-left"></div>
    </div>`;
  },

  /** Our Values: the glass pavilion at sunset (clean original plate) with a luminous globe. */
  pavilion(o) {
    let globe = ""; for (let i = 1; i < 6; i++) globe += `<ellipse rx="${f(110 * Math.sin(i / 6 * Math.PI))}" ry="110" fill="none" stroke="#ffd58a" stroke-opacity=".38"/><ellipse rx="110" ry="${f(Math.abs(110 * Math.cos(i / 6 * Math.PI)))}" fill="none" stroke="#ffd58a" stroke-opacity=".25"/>`;
    return `<div class="env env-pavilion" data-env="pavilion">
      <div class="plate plate-right"><img src="/assets/img/env/values-pavilion.webp" alt="" width="635" height="320" fetchpriority="high"></div>
      <canvas class="env-canvas" data-motes="warm" data-seed="${o.seed || 5}"></canvas>
      <svg class="globe" viewBox="-130 -130 260 300" aria-hidden="true"><defs><radialGradient id="v-gl" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff1cf" stop-opacity=".55"/><stop offset=".6" stop-color="#ffb83e" stop-opacity=".12"/><stop offset="1" stop-color="#ffb83e" stop-opacity="0"/></radialGradient></defs>
        <circle r="112" fill="url(#v-gl)"/><g class="spin-slow">${globe}</g><circle r="110" fill="none" stroke="#ffe3a8" stroke-opacity=".7"/>
        <path d="M-24 0c0-12 18-12 24 0s24 12 24 0-18-12-24 0-24 12-24 0z" fill="none" stroke="#fff1cc" stroke-width="3"/>
        <ellipse cy="150" rx="90" ry="9" fill="#ffb83e" opacity=".3"/></svg>
      <div class="env-shade env-shade-left"></div>
    </div>`;
  },

  /** Sunset city across the water, framed by trees: the Values family for subpages (code-drawn). */
  sunset(o) {
    const r = rng(o.seed || 81);
    let city = ""; for (let i = 0; i < 80; i++) { const w = 10 + r() * 30, h = 20 + Math.pow(r(), 2.2) * 230, x = 600 + i * 12 + r() * 6; city += `<rect x="${f(x)}" y="${f(560 - h)}" width="${f(w)}" height="${f(h)}" fill="#1a1216" opacity="${f(.75 + r() * .25)}"/>`; }
    const leaves = Array.from({ length: 40 }, () => `<ellipse cx="${f(r() * 340)}" cy="${f(r() * 260)}" rx="${f(18 + r() * 34)}" ry="${f(10 + r() * 18)}" fill="#0d140f" opacity="${f(.85 + r() * .15)}"/>`).join("");
    return `<div class="env env-sunset" data-env="sunset">
      ${svgOpen()}<defs>${blur("sc", 24)}
        <linearGradient id="u-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#120d18"/><stop offset=".45" stop-color="#5a2b25"/><stop offset=".62" stop-color="#e2813a"/><stop offset=".64" stop-color="#ffcf86"/></linearGradient>
        <radialGradient id="u-sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff4d0"/><stop offset=".4" stop-color="#ffc061" stop-opacity=".7"/><stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/></radialGradient></defs>
        <rect width="1600" height="580" fill="url(#u-sky)"/><circle cx="${o.sunX || 1120}" cy="540" r="190" fill="url(#u-sun)"/>
        <g class="drift d-slow">${clouds(r, "sc", 9, 230, 430, "#f0a066", .35)}</g>
        <path d="${ridge(r, 545, 40, 16)}" fill="#2a1a20" opacity=".7"/>${city}
        <rect y="560" width="1600" height="340" fill="#0c0a0e"/>
        <g class="tree sway" style="transform-origin:120px 900px">${leaves.replace(/cx="/g, 'cx="').replace(/<ellipse cx="([\d.]+)" cy="([\d.]+)"/g, (m, x, y) => `<ellipse cx="${f(+x - 60)}" cy="${f(+y - 40)}"`)}</g>
      </svg><div class="env-water env-water-sunset"><canvas class="env-canvas" data-water="gold" data-seed="${o.seed || 81}"></canvas></div>
      <div class="env-shade env-shade-left"></div>
    </div>`;
  },

  /** Agent Campus: an isometric night campus; every building is a real link to that part of the campus. */
  campus(o) {
    const B = o.buildings || [];
    const iso = (gx, gy) => [1020 + (gx - gy) * 64, 300 + (gx + gy) * 34];
    const building = (b, i) => {
      const [x, y] = iso(b.gx, b.gy); const w = 62, d = 62, h = b.h;
      const top = `M${x} ${y - h} L${x + w} ${y - h + w * .5} L${x + w - d} ${y - h + w * .5 + d * .5} L${x - d} ${y - h + d * .5} Z`;
      const left = `M${x - d} ${y - h + d * .5} L${x + w - d} ${y - h + w * .5 + d * .5} L${x + w - d} ${y + w * .5 + d * .5} L${x - d} ${y + d * .5} Z`;
      const right = `M${x + w - d} ${y - h + w * .5 + d * .5} L${x + w} ${y - h + w * .5} L${x + w} ${y + w * .5} L${x + w - d} ${y + w * .5 + d * .5} Z`;
      let win = ""; for (let k = 1; k * 18 < h - 6; k++) win += `<line x1="${x - d + 10}" y1="${f(y - h + d * .5 + k * 18 + 6)}" x2="${x + w - d - 10}" y2="${f(y - h + w * .5 + d * .5 + k * 18 + 6 - (w - 20) * .0)}" stroke="#ffcf86" stroke-opacity="${(i * 7 + k) % 3 ? .55 : .15}" stroke-width="3"/>`;
      return `<a href="${b.href}" class="bld" aria-label="${b.label}"><title>${b.label}</title>
        <path d="${left}" fill="#121722"/><path d="${right}" fill="#0b0f17"/><path d="${top}" fill="${b.accent || "#2a2216"}" class="bld-top"/>${win}
        <text x="${x}" y="${y - h - 14}" class="bld-label" text-anchor="middle">${b.label}</text></a>`;
    };
    const order = [...B].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
    let paths = ""; for (let i = 0; i < B.length - 1; i++) { const [x1, y1] = iso(B[i].gx + .5, B[i].gy + .5), [x2, y2] = iso(B[i + 1].gx + .5, B[i + 1].gy + .5); paths += `<path d="M${f(x1)} ${f(y1)} L${f(x2)} ${f(y1 + (x2 - x1) * .0)} L${f(x2)} ${f(y2)}" class="path-glow" fill="none"/>`; }
    const trees = Array.from({ length: 22 }, (_, i) => { const r = rng(i * 13 + 5); const [x, y] = iso(r() * 9 - 1, r() * 7 - 1); return `<g class="tree sway" style="animation-delay:${f(r() * 3)}s"><line x1="${f(x)}" y1="${f(y)}" x2="${f(x)}" y2="${f(y - 14)}" stroke="#2b2017" stroke-width="3"/><circle cx="${f(x)}" cy="${f(y - 22)}" r="${f(9 + r() * 5)}" fill="#163a2a" opacity=".9"/></g>`; }).join("");
    const ground = [iso(-1.5, -1.5), iso(8.5, -1.5), iso(8.5, 6.5), iso(-1.5, 6.5)].map(p => p.map(f).join(",")).join(" ");
    return `<div class="env env-campus" data-env="campus">
      <canvas class="env-canvas" data-stars="140" data-seed="41"></canvas>
      ${svgOpen("campus-svg")}<defs><radialGradient id="c-gr" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#1a2016"/><stop offset="1" stop-color="#07090c"/></radialGradient></defs>
        <polygon points="${ground}" fill="url(#c-gr)" stroke="#ffb83e" stroke-opacity=".15"/>${paths}${trees}${order.map(building).join("")}
      </svg><div class="env-shade env-shade-left"></div>
    </div>`;
  },

  /** AELIO Live: a night plaza where agents orbit the marketplace tower. */
  market(o) {
    const r = rng(o.seed || 61);
    let city = ""; for (let i = 0; i < 70; i++) { const w = 14 + r() * 36, h = 40 + r() * 220, x = i * 24 - 20; city += `<rect x="${f(x)}" y="${f(640 - h)}" width="${f(w)}" height="${f(h)}" fill="#0b0e15"/>${r() < .6 ? `<rect x="${f(x + 4)}" y="${f(650 - h)}" width="2" height="${f(h * .6)}" fill="#ffcf86" opacity="${f(.15 + r() * .3)}"/>` : ""}`; }
    const orbit = (rx, ry, n, dur, cls) => `<g class="orbit ${cls}" style="--dur:${dur}s">${Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return `<g transform="translate(${f(1060 + Math.cos(a) * rx)} ${f(470 + Math.sin(a) * ry)})"><circle r="15" fill="#0d121c" stroke="#ffb83e" stroke-opacity=".8"/><circle r="5" fill="${["#ffb83e", "#5ad1e6", "#7be0a4", "#f4d9a4"][i % 4]}"/></g>`; }).join("")}</g>`;
    return `<div class="env env-market" data-env="market">
      <canvas class="env-canvas" data-stars="120" data-seed="${o.seed || 61}"></canvas>
      ${svgOpen()}<defs><linearGradient id="m-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#05070b"/><stop offset=".7" stop-color="#1a1220"/><stop offset="1" stop-color="#3a2216"/></linearGradient>
        <linearGradient id="m-tw" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff0cc"/><stop offset="1" stop-color="#ff9a3c" stop-opacity=".1"/></linearGradient></defs>
        <rect width="1600" height="660" fill="url(#m-sky)"/>${city}<rect y="640" width="1600" height="260" fill="#07080c"/>
        <ellipse cx="1060" cy="700" rx="420" ry="60" fill="none" stroke="#ffb83e" stroke-opacity=".25"/><ellipse cx="1060" cy="700" rx="300" ry="42" fill="#1a130c" opacity=".7"/>
        <path d="M1040 700 L1050 260 L1070 260 L1080 700 Z" fill="url(#m-tw)" opacity=".85"/>
        ${[300, 380, 460, 540, 620].map((y, i) => `<ellipse cx="1060" cy="${y}" rx="${50 + i * 12}" ry="${8 + i * 2}" fill="none" stroke="#ffcf86" stroke-opacity=".55" class="ring-pulse" style="animation-delay:${i * .4}s"/>`).join("")}
        ${orbit(300, 90, 8, 60, "o1")}${orbit(200, 60, 5, 42, "o2")}
      </svg><div class="env-shade env-shade-left"></div>
    </div>`;
  },

  /** Green Guardians: rolling green hills, trees in the breeze, a glass conservatory and a still pond at morning. */
  green(o) {
    const r = rng(o.seed || 71);
    const hills = [[520, 70, 26, "#2f5a44", .55], [590, 60, 22, "#1f4632", .8], [660, 50, 18, "#143423", 1], [740, 40, 14, "#0c2216", 1]];
    const trees = Array.from({ length: 16 }, () => { const x = r() * 1600, y = 600 + r() * 160, s = .6 + r() * .9; return `<g class="tree sway" style="transform-origin:${f(x)}px ${f(y)}px;animation-delay:${f(r() * 4)}s"><line x1="${f(x)}" y1="${f(y)}" x2="${f(x)}" y2="${f(y - 40 * s)}" stroke="#1b140e" stroke-width="${f(4 * s)}"/><ellipse cx="${f(x)}" cy="${f(y - 58 * s)}" rx="${f(22 * s)}" ry="${f(30 * s)}" fill="#1f5236"/><ellipse cx="${f(x - 6 * s)}" cy="${f(y - 66 * s)}" rx="${f(12 * s)}" ry="${f(16 * s)}" fill="#2e6e48" opacity=".9"/></g>`; }).join("");
    return `<div class="env env-green" data-env="green">
      ${svgOpen()}<defs>${blur("gc", 26)}
        <linearGradient id="g-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#06100c"/><stop offset=".55" stop-color="#173a2c"/><stop offset="1" stop-color="#d8c487"/></linearGradient>
        <linearGradient id="g-mist" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e6f2dc" stop-opacity="0"/><stop offset=".5" stop-color="#e6f2dc" stop-opacity=".22"/><stop offset="1" stop-color="#e6f2dc" stop-opacity="0"/></linearGradient>
        <linearGradient id="g-glass" x1="0" x2="1"><stop offset="0" stop-color="#bfe7d2" stop-opacity=".08"/><stop offset="1" stop-color="#bfe7d2" stop-opacity=".22"/></linearGradient></defs>
        <rect width="1600" height="900" fill="url(#g-sky)"/><circle cx="1180" cy="430" r="200" fill="#fff0c4" opacity=".16"/>
        <g class="drift d-slow">${clouds(r, "gc", 8, 160, 340, "#d9e8d0", .22)}</g>
        ${hills.map(([b, a, ro, c, op], i) => `<path d="${ridge(r, b, a, ro)}" fill="${c}" opacity="${op}"/>${i === 1 ? `<rect class="mist m1" x="-200" y="${b - 30}" width="2000" height="100" fill="url(#g-mist)"/>` : ""}`).join("")}
        <g transform="translate(980 470)"><path d="M0 210 V60 A160 160 0 0 1 320 60 V210 Z" fill="url(#g-glass)" stroke="#c9a45a" stroke-opacity=".7" stroke-width="2"/>
          ${[64, 128, 192, 256].map(x => `<line x1="${x}" y1="${x < 160 ? 60 - Math.sqrt(160 * 160 - (160 - x) ** 2) + 160 - 160 : 0}" x2="${x}" y2="210" stroke="#c9a45a" stroke-opacity=".45"/>`).join("")}
          <path d="M40 210 Q80 140 120 210 M150 210 Q200 120 250 210" fill="#2e6e48" opacity=".8"/></g>
        ${trees}
        <rect y="780" width="1600" height="120" fill="#0a1a12"/><ellipse cx="1140" cy="800" rx="330" ry="26" fill="#8fc9a8" opacity=".14"/>
      </svg><div class="env-water env-water-green"><canvas class="env-canvas" data-water="green" data-seed="${o.seed || 71}"></canvas></div>
      <div class="env-shade env-shade-left"></div>
    </div>`;
  },
};

export function scene(key, opts = {}) {
  const fn = SCENES[key];
  if (!fn) throw new Error("unknown scene " + key);
  return fn(opts);
}

/** Which environment each section of the site lives in. */
export const SECTION_SCENE = { home: "night", aelio: "sphere", dream: "dusk", tech: "hall", create: "studio", values: "pavilion", campus: "campus", live: "market", green: "green" };
