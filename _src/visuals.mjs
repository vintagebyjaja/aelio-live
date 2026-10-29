// Original visuals in SVG and CSS (no reference images are pasted in).
// Each returns markup for the hero "stage". Motion respects prefers-reduced-motion via CSS.

const defs = (id, a = "#ffb83e", b = "#ff8a1f") => `
<defs>
  <radialGradient id="${id}g" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#fff3d6" stop-opacity=".95"/><stop offset=".35" stop-color="${a}" stop-opacity=".75"/><stop offset="1" stop-color="${b}" stop-opacity="0"/></radialGradient>
  <linearGradient id="${id}l" x1="0" x2="1"><stop offset="0" stop-color="${a}" stop-opacity="0"/><stop offset=".5" stop-color="${a}"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></linearGradient>
  <filter id="${id}f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
</defs>`;

const platform = (id, cx = 300, cy = 470, w = 230) => `
  <ellipse cx="${cx}" cy="${cy}" rx="${w}" ry="${w * .16}" fill="none" stroke="url(#${id}l)" stroke-width="2.5" class="v-pulse"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${w * .72}" ry="${w * .11}" fill="none" stroke="#ffb83e" stroke-opacity=".45" stroke-width="1.5"/>
  <ellipse cx="${cx}" cy="${cy + 6}" rx="${w * 1.05}" ry="${w * .2}" fill="url(#${id}g)" opacity=".18"/>`;

function sphere(id = "sp") {
  const orbits = [0, 30, 60, 90, 120, 150].map(r => `<ellipse cx="300" cy="250" rx="150" ry="52" transform="rotate(${r} 300 250)" fill="none" stroke="#ffcf7a" stroke-opacity=".38" stroke-width="1"/>`).join("");
  const dots = Array.from({ length: 28 }, (_, i) => { const a = i * 2.39996, r = 40 + (i * 37) % 110; return `<circle cx="${(300 + Math.cos(a) * r).toFixed(1)}" cy="${(250 + Math.sin(a) * r * .9).toFixed(1)}" r="${1 + (i % 3) * .6}" fill="#fff2cc" opacity="${.35 + (i % 4) * .15}"/>`; }).join("");
  return `<svg viewBox="0 0 600 520" class="vis" role="img" aria-label="AELIO intelligence sphere">${defs(id)}
  <circle cx="300" cy="250" r="190" fill="url(#${id}g)" opacity=".28" filter="url(#${id}f)"/>
  <circle cx="300" cy="250" r="160" fill="#0b0f18" fill-opacity=".55" stroke="#ffd58a" stroke-opacity=".55" stroke-width="1.5"/>
  <g class="v-spin">${orbits}</g>${dots}
  <path d="M255 250c0-20 30-20 45 0s45 20 45 0-30-20-45 0-45 20-45 0z" fill="none" stroke="#ffcf6b" stroke-width="7" stroke-linecap="round" filter="drop-shadow(0 0 10px #ffad3a)"/>
  <circle cx="300" cy="250" r="160" fill="none" stroke="url(#${id}l)" stroke-width="3" class="v-pulse"/>
  ${platform(id)}</svg>`;
}

function holo(id = "ho") {
  const panel = (x, y, w, h, icon, label, sub) => `<g class="v-float" style="animation-delay:${(x % 3) * .6}s">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#141019" fill-opacity=".72" stroke="#ffb83e" stroke-opacity=".75"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="url(#${id}g)" opacity=".12"/>
    <text x="${x + w / 2}" y="${y + h * .42}" text-anchor="middle" font-size="30" fill="#ffb83e">${icon}</text>
    <text x="${x + w / 2}" y="${y + h * .66}" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" letter-spacing=".04em">${label}</text>
    <text x="${x + w / 2}" y="${y + h * .8}" text-anchor="middle" font-size="11" fill="#cfc6b8">${sub}</text></g>`;
  return `<svg viewBox="0 0 600 520" class="vis" role="img" aria-label="Holographic workspaces">${defs(id)}
  ${platform(id, 300, 455, 260)}
  ${panel(70, 150, 150, 190, "☁", "MAIN PAL", "Your constant partner")}
  ${panel(220, 110, 160, 230, "⬡", "DREAM SPACES", "Dedicated workspaces")}
  ${panel(380, 150, 150, 190, "♣", "AGENT TEAM", "Multiple perspectives")}
  <path d="M145 345 Q300 400 455 345" fill="none" stroke="#ffb83e" stroke-opacity=".5" stroke-dasharray="4 6" class="v-dash"/></svg>`;
}

function servers(id = "sv") {
  let racks = "";
  for (let i = 0; i < 5; i++) {
    const x = 40 + i * 52, h = 300 - i * 30, y = 110 + i * 15;
    racks += `<rect x="${x}" y="${y}" width="${40 - i * 3}" height="${h}" fill="#0b0f18" stroke="#2a3b5c"/>`;
    racks += `<rect x="${560 - x - (40 - i * 3)}" y="${y}" width="${40 - i * 3}" height="${h}" fill="#0b0f18" stroke="#2a3b5c"/>`;
    for (let j = 0; j < 12; j++) {
      const yy = y + 14 + j * (h - 20) / 12;
      racks += `<rect x="${x + 6}" y="${yy}" width="${20 - i * 2}" height="2" fill="${j % 3 ? "#5ad1e6" : "#ffb83e"}" class="v-blink" style="animation-delay:${(i * 7 + j) % 9 * .23}s"/>`;
      racks += `<rect x="${560 - x - (40 - i * 3) + 6}" y="${yy}" width="${20 - i * 2}" height="2" fill="${j % 4 ? "#5ad1e6" : "#4fc58a"}" class="v-blink" style="animation-delay:${(i * 5 + j) % 7 * .31}s"/>`;
    }
  }
  return `<svg viewBox="0 0 600 520" class="vis" role="img" aria-label="Server corridor">${defs(id)}
  <rect x="260" y="160" width="80" height="200" fill="url(#${id}g)" opacity=".35" filter="url(#${id}f)"/>
  <path d="M250 165h100v190h-100z" fill="#0f2a1c" stroke="#4fc58a" stroke-opacity=".4"/>
  <path d="M262 340c10-40 30-60 38-110 8 50 28 70 38 110z" fill="#2f7a4c" opacity=".7"/>
  ${racks}
  <path d="M0 470 L250 360 M600 470 L350 360" stroke="#ffb83e" stroke-opacity=".5"/>
  <path d="M40 90 L250 160 M560 90 L350 160" stroke="#ffb83e" stroke-width="2" stroke-opacity=".75"/></svg>`;
}

function wireframe(id = "wf") {
  const box = (x, y, w, h, d) => `<g><path d="M${x} ${y}h${w}v${h}h-${w}z M${x} ${y}l${d} -${d * .6}h${w}l-${d} ${d * .6} M${x + w} ${y}l${d} -${d * .6}v${h}l-${d} ${d * .6}" fill="none"/></g>`;
  return `<svg viewBox="0 0 600 520" class="vis v-wire" role="img" aria-label="Wireframe architecture becoming a render">${defs(id, "#5ad1e6", "#2b6cff")}
  <g stroke="#7fdcff" stroke-width="1.4" class="v-draw">${box(140, 230, 240, 150, 70)}${box(200, 140, 170, 90, 60)}${box(250, 80, 110, 60, 45)}
  ${Array.from({ length: 8 }, (_, i) => `<path d="M${150 + i * 28} 240v130"/>`).join("")}</g>
  <g class="v-fill"><rect x="150" y="300" width="60" height="70" fill="#ffb83e" opacity=".55"/><rect x="230" y="160" width="40" height="60" fill="#ffb83e" opacity=".45"/>
  <circle cx="420" cy="330" r="34" fill="#2f7a4c" opacity=".8"/><circle cx="110" cy="350" r="24" fill="#2f7a4c" opacity=".8"/></g>
  ${platform(id, 300, 430, 260)}</svg>`;
}

function skyline(id = "sk") {
  let towers = "";
  [[120, 220], [190, 160], [270, 100], [350, 140], [430, 200]].forEach(([x, top], i) => {
    towers += `<rect x="${x}" y="${top}" width="56" height="${420 - top}" fill="#0b120e" fill-opacity=".8" stroke="#ffcf6b" stroke-width="1.6"/>`;
    for (let y = top + 18; y < 410; y += 22) towers += `<path d="M${x} ${y}h56" stroke="#ffcf6b" stroke-opacity=".35"/><circle cx="${x + 10 + (y % 3) * 14}" cy="${y - 7}" r="5" fill="#3f9a5e" opacity=".85"/>`;
    towers += `<circle cx="${x + 28}" cy="${top}" r="10" fill="#4fc58a" opacity=".8"/>`;
  });
  return `<svg viewBox="0 0 600 520" class="vis" role="img" aria-label="Green and gold skyline">${defs(id)}
  <circle cx="470" cy="120" r="70" fill="url(#${id}g)" opacity=".6"/>${towers}
  ${platform(id, 300, 440, 270)}</svg>`;
}

function campus(id = "cp") {
  const panes = [[90, 140], [170, 110], [380, 110], [460, 140]].map(([x, y], i) => `<rect x="${x}" y="${y}" width="56" height="120" rx="6" fill="#141019" fill-opacity=".6" stroke="#ffcf7a" stroke-opacity=".6" class="v-float" style="animation-delay:${i * .5}s"/>`).join("");
  return `<svg viewBox="0 0 600 520" class="vis" role="img" aria-label="Agent Campus">${defs(id)}
  ${panes}
  <circle cx="300" cy="230" r="110" fill="url(#${id}g)" opacity=".35"/>
  <circle cx="300" cy="230" r="95" fill="#0b0f18" fill-opacity=".5" stroke="#ffd58a" stroke-opacity=".7"/>
  <g class="v-spin">${[0, 60, 120].map(r => `<ellipse cx="300" cy="230" rx="95" ry="30" transform="rotate(${r} 300 230)" fill="none" stroke="#ffcf7a" stroke-opacity=".35"/>`).join("")}</g>
  <path d="M270 270 L300 190 L330 270" fill="none" stroke="#ffcf6b" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" filter="drop-shadow(0 0 8px #ffad3a)"/>
  ${platform(id, 300, 420, 240)}
  ${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="${110 + i * 76}" cy="${470 - (i % 2) * 10}" r="5" fill="#cfc6b8"/><rect x="${106 + i * 76}" y="${476 - (i % 2) * 10}" width="8" height="18" rx="3" fill="#cfc6b8" opacity=".7"/>`).join("")}</svg>`;
}

function economy(id = "ec") {
  const nodes = Array.from({ length: 22 }, (_, i) => { const a = i * 2.4, r = 30 + (i * 41) % 110; return [300 + Math.cos(a) * r, 240 + Math.sin(a) * r * .95]; });
  const lines = nodes.map((n, i) => { const m = nodes[(i * 7 + 3) % nodes.length]; return `<path d="M${n[0].toFixed(0)} ${n[1].toFixed(0)}L${m[0].toFixed(0)} ${m[1].toFixed(0)}" stroke="#ffcf7a" stroke-opacity=".28"/>`; }).join("");
  const card = (x, y, t, s) => `<g class="v-float"><rect x="${x}" y="${y}" width="120" height="70" rx="8" fill="#141019" fill-opacity=".75" stroke="#ffcf7a" stroke-opacity=".7"/><text x="${x + 14}" y="${y + 30}" font-size="15" font-weight="700" fill="#fff">${t}</text><text x="${x + 14}" y="${y + 50}" font-size="11" fill="#cfc6b8">${s}</text></g>`;
  return `<svg viewBox="0 0 600 520" class="vis" role="img" aria-label="Agent economy network">${defs(id)}
  <circle cx="300" cy="240" r="130" fill="url(#${id}g)" opacity=".3"/>
  <circle cx="300" cy="240" r="125" fill="#0b0f18" fill-opacity=".55" stroke="#ffd58a" stroke-opacity=".6"/>
  <g class="v-spin-slow">${lines}${nodes.map(n => `<circle cx="${n[0].toFixed(0)}" cy="${n[1].toFixed(0)}" r="2.6" fill="#ffe2a6"/>`).join("")}</g>
  <path d="M275 275 L300 205 L325 275" fill="none" stroke="#ffcf6b" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  ${card(30, 120, "CREATE", "Build agents")}${card(450, 110, "DEPLOY", "Launch to the world")}${card(40, 300, "TRAIN", "Shape their skills")}${card(440, 300, "EARN", "Creativity to opportunity")}
  ${platform(id, 300, 450, 250)}</svg>`;
}

function guardians(id = "gg") {
  const steps = ["Monitor", "Predict", "Optimize", "Verify", "Report"];
  const pts = steps.map((s, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [300 + Math.cos(a) * 150, 240 + Math.sin(a) * 150, s]; });
  return `<svg viewBox="0 0 600 520" class="vis" role="img" aria-label="Green Guardians efficiency loop">${defs(id, "#4fc58a", "#1f6b45")}
  <circle cx="300" cy="240" r="150" fill="none" stroke="#4fc58a" stroke-opacity=".35" stroke-width="2" stroke-dasharray="6 8" class="v-dash"/>
  <circle cx="300" cy="240" r="90" fill="url(#${id}g)" opacity=".45"/>
  <path d="M300 300c-55-25-60-85-5-125 45 40 50 95 5 125z M300 300v-90" fill="#123a26" stroke="#7be0a6" stroke-width="2.5"/>
  ${pts.map(([x, y, s]) => `<g><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="30" fill="#0b1510" stroke="#4fc58a"/><text x="${x.toFixed(0)}" y="${(y + 4).toFixed(0)}" text-anchor="middle" font-size="11" fill="#c8f0da">${s}</text></g>`).join("")}
  ${platform(id, 300, 460, 230)}</svg>`;
}

function transfer(id = "tr") {
  return `<svg viewBox="0 0 600 520" class="vis" role="img" aria-label="A familiar assistant profile becoming a new AELIO agent">${defs(id)}
  <path d="M120 250 C210 180 390 180 480 250" fill="none" stroke="url(#${id}l)" stroke-width="3" class="v-dash" stroke-dasharray="2 10"/>
  <g class="v-float"><rect x="40" y="180" width="140" height="150" rx="14" fill="#141019" fill-opacity=".7" stroke="#8fa1bb" stroke-opacity=".7"/>
  <circle cx="110" cy="225" r="20" fill="none" stroke="#cfd8e6"/><rect x="65" y="260" width="90" height="6" rx="3" fill="#8fa1bb" opacity=".6"/><rect x="65" y="276" width="70" height="6" rx="3" fill="#8fa1bb" opacity=".4"/><rect x="65" y="292" width="80" height="6" rx="3" fill="#8fa1bb" opacity=".4"/>
  <text x="110" y="350" text-anchor="middle" font-size="11" fill="#8fa1bb">Your profile</text></g>
  <circle cx="300" cy="230" r="80" fill="url(#${id}g)" opacity=".5"/><circle cx="300" cy="230" r="62" fill="#0b0f18" fill-opacity=".6" stroke="#ffd58a" stroke-opacity=".8"/>
  <g class="v-spin">${[0, 60, 120].map(r => `<ellipse cx="300" cy="230" rx="62" ry="20" transform="rotate(${r} 300 230)" fill="none" stroke="#ffcf7a" stroke-opacity=".4"/>`).join("")}</g>
  <g class="v-float" style="animation-delay:1s"><rect x="420" y="180" width="140" height="150" rx="14" fill="#1a130a" fill-opacity=".75" stroke="#ffb83e"/>
  <circle cx="490" cy="225" r="20" fill="#ffb83e" opacity=".85"/><rect x="445" y="260" width="90" height="6" rx="3" fill="#ffb83e" opacity=".7"/><rect x="445" y="276" width="70" height="6" rx="3" fill="#ffb83e" opacity=".5"/><rect x="445" y="292" width="80" height="6" rx="3" fill="#ffb83e" opacity=".5"/>
  <text x="490" y="350" text-anchor="middle" font-size="11" fill="#ffcf7a">New AELIO agent</text></g>
  ${platform(id, 300, 440, 230)}</svg>`;
}

const icon = (id, glyph, label, color = "#ffb83e") => `<svg viewBox="0 0 600 520" class="vis" role="img" aria-label="${label}">${defs(id, color)}
  <circle cx="300" cy="230" r="150" fill="url(#${id}g)" opacity=".28"/>
  <rect x="190" y="120" width="220" height="220" rx="32" fill="#10131c" fill-opacity=".8" stroke="${color}" stroke-opacity=".75" class="v-float"/>
  <text x="300" y="270" text-anchor="middle" font-size="120" fill="${color}" class="v-float">${glyph}</text>
  ${platform(id, 300, 430, 230)}</svg>`;

export function visual(key) {
  switch (key) {
    case "sphere": return sphere();
    case "holo": return holo();
    case "servers": return servers();
    case "wireframe": return wireframe();
    case "skyline": return skyline();
    case "campus": return campus();
    case "economy": return economy();
    case "guardians": return guardians();
    case "transfer": return transfer();
    case "code": return icon("cd", "⌘", "Dream Code");
    case "deploy": return icon("dp", "⧉", "Dream Deploy");
    case "memory": return icon("mm", "◎", "Dream Memory", "#5ad1e6");
    case "shield": return icon("sh", "⛉", "Security and control");
    case "cloud": return `<div class="cloud-art"><img src="/assets/img/hero-cloud.webp" alt="A figure stands on a cliff inside a glowing gold cloud, looking at an infinity sign over the sea" width="850" height="453"></div>`;
    case "personas": return `<div class="persona-stage">${[1, 2, 3, 4, 5, 6].map(i => `<img src="/assets/img/persona-${i}.png" alt="" loading="lazy">`).join("")}</div>`;
    default: return sphere();
  }
}
