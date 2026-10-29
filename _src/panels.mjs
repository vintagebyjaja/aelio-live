// Small code-drawn scenes for feature panels (Create disciplines, Our Values commitments).
// Each is its own picture so panels never look like identical cards.
const S = (inner, bg) => `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${bg || ""}${inner}</svg>`;
const r1 = (seed) => { let a = seed; return () => (a = (a * 9301 + 49297) % 233280) / 233280; };
const f = (n) => Math.round(n * 10) / 10;

export const DISC = {
  design: () => S(`<rect x="40" y="40" width="200" height="140" rx="12" fill="#0d141d" stroke="#5ad1e6" stroke-opacity=".4"/>
    <path d="M70 150 C110 60, 170 200, 220 80" fill="none" stroke="#ffb83e" stroke-width="3"/><circle cx="70" cy="150" r="6" fill="#ffb83e"/><circle cx="220" cy="80" r="6" fill="#ffb83e"/>
    <line x1="70" y1="150" x2="110" y2="60" stroke="#ffcf86" stroke-opacity=".5"/><line x1="220" y1="80" x2="170" y2="200" stroke="#ffcf86" stroke-opacity=".5"/>
    ${["#ffb83e", "#c9742c", "#f4d9a4", "#5ad1e6", "#7be0a4"].map((c, i) => `<circle cx="${290 + (i % 2) * 44}" cy="${70 + Math.floor(i / 2) * 44}" r="16" fill="${c}" class="float1" style="animation-delay:${i * .4}s"/>`).join("")}`, `<rect width="400" height="300" fill="#08101a"/>`),
  architecture: () => { let g = ""; for (let i = 0; i < 6; i++) g += `<path d="M${120 + i * 4} ${220 - i * 22} L200 ${180 - i * 22} L${280 - i * 4} ${220 - i * 22} L200 ${260 - i * 22} Z" fill="none" stroke="#ffcf86" stroke-opacity="${.25 + i * .12}"/>`;
    return S(`${g}<path d="M200 128 V260 M120 220 V100 M280 220 V100" stroke="#5ad1e6" stroke-opacity=".5"/>${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 36}" y1="300" x2="200" y2="200" stroke="#5ad1e6" stroke-opacity=".08"/>`).join("")}`, `<rect width="400" height="300" fill="#060b12"/>`); },
  animation: () => S(`<path d="M30 220 C110 220, 120 70, 200 70 S 300 220, 370 160" fill="none" stroke="#ffb83e" stroke-width="3"/>
    ${[0, 1, 2, 3, 4].map(i => `<circle cx="${60 + i * 70}" cy="${f(150 - Math.sin(i * .9) * 60)}" r="${18 - i}" fill="none" stroke="#f4d9a4" stroke-opacity="${.2 + i * .18}"/>`).join("")}
    ${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="${40 + i * 48}" y="255" width="8" height="8" transform="rotate(45 ${44 + i * 48} 259)" fill="#5ad1e6" opacity=".8"/>`).join("")}<line x1="30" y1="259" x2="370" y2="259" stroke="#5ad1e6" stroke-opacity=".3"/>`, `<rect width="400" height="300" fill="#0b0a12"/>`),
  games: () => { let s = ""; for (let j = 0; j < 9; j++) { let d = ""; for (let i = 0; i <= 14; i++) { const x = i * 28 + j * 6, y = 120 + j * 18 - Math.sin(i * .55 + j * .7) * 16 - Math.cos(i * .25) * 12; d += (i ? " L" : "M") + f(x) + " " + f(y); } s += `<path d="${d}" fill="none" stroke="#7be0a4" stroke-opacity="${f(.18 + j * .08)}"/>`; }
    return S(`${s}<g class="float1"><path d="M290 70 l14 24 h-28z" fill="#ffb83e"/><circle cx="110" cy="80" r="9" fill="#5ad1e6"/></g>`, `<rect width="400" height="300" fill="#06100b"/>`); },
  worlds: () => { const r = r1(4); let c = ""; for (let i = 0; i < 26; i++) { const w = 8 + r() * 18, h = 30 + r() * 120, x = i * 16; c += `<rect x="${f(x)}" y="${f(210 - h)}" width="${f(w)}" height="${f(h)}" fill="#151019"/>`; }
    return S(`<circle cx="290" cy="190" r="70" fill="#ffb35a" opacity=".55"/>${c}<rect y="210" width="400" height="90" fill="#0b0810"/>${[0, 1, 2, 3, 4, 5].map(i => `<line x1="${200 + i * 14}" y1="${220 + i * 12}" x2="${300 + i * 6}" y2="${220 + i * 12}" stroke="#ffcf86" stroke-opacity="${.5 - i * .07}" stroke-width="2"/>`).join("")}`, `<rect width="400" height="210" fill="#3a1f26"/>`); },
  projects: () => S(`${[0, 1, 2].map(c => `<rect x="${30 + c * 120}" y="40" width="104" height="220" rx="12" fill="#0d121b" stroke="#ffb83e" stroke-opacity=".25"/><rect x="${44 + c * 120}" y="56" width="50" height="8" rx="4" fill="#f4d9a4" opacity=".7"/>
    ${[0, 1, 2].slice(0, 3 - c).map(k => `<rect x="${42 + c * 120}" y="${80 + k * 54}" width="80" height="42" rx="8" fill="${["#1a2230", "#2a2216", "#13261b"][c]}" stroke="${["#5ad1e6", "#ffb83e", "#7be0a4"][c]}" stroke-opacity=".5"/>`).join("")}`).join("")}`, `<rect width="400" height="300" fill="#07090e"/>`),
};

export const VAL = {
  green: () => { const r = r1(9); let t = ""; for (let i = 0; i < 9; i++) { const x = r() * 400, y = 190 + r() * 50, s = .6 + r() * .8; t += `<g class="sway" style="animation-delay:${f(r() * 3)}s"><line x1="${f(x)}" y1="${f(y)}" x2="${f(x)}" y2="${f(y - 26 * s)}" stroke="#1b140e" stroke-width="3"/><ellipse cx="${f(x)}" cy="${f(y - 38 * s)}" rx="${f(16 * s)}" ry="${f(22 * s)}" fill="#2e6e48"/></g>`; }
    return S(`<circle cx="300" cy="120" r="60" fill="#fff0c4" opacity=".3"/><path d="M0 200 Q100 150 200 190 T400 170 V300 H0Z" fill="#1f4632"/><path d="M0 240 Q120 200 240 235 T400 225 V300 H0Z" fill="#143423"/>${t}`, `<rect width="400" height="300" fill="#16352a"/>`); },
  privacy: () => S(`<g transform="translate(200 140)"><rect x="-80" y="-100" width="160" height="200" rx="14" fill="#5ad1e6" fill-opacity=".06" stroke="#8fe3f2" stroke-opacity=".6"/>
    <path d="M0 -50 L42 -34 V4 C42 34 22 52 0 62 C-22 52 -42 34 -42 4 V-34 Z" fill="none" stroke="#9feaf7" stroke-width="3" class="v-pulse"/><path d="M-16 6 L-4 18 L20 -8" fill="none" stroke="#ffcf86" stroke-width="3"/></g>
    ${[0, 1, 2, 3, 4, 5].map(i => `<line x1="${i * 80}" y1="300" x2="200" y2="210" stroke="#5ad1e6" stroke-opacity=".12"/>`).join("")}`, `<rect width="400" height="300" fill="#0a1420"/><rect y="0" width="400" height="160" fill="#2a1a22" opacity=".6"/>`),
  vision: () => { const r = r1(2); let c = ""; for (let i = 0; i < 30; i++) { const w = 8 + r() * 14, h = 20 + r() * 110, x = i * 14; c += `<rect x="${f(x)}" y="${f(200 - h)}" width="${f(w)}" height="${f(h)}" fill="#120e14"/>`; }
    return S(`<circle cx="200" cy="200" r="90" fill="#ffb35a" opacity=".55"/>${c}${[0, 1, 2, 3, 4].map(i => `<circle cx="${60 + i * 70}" cy="${250 + (i % 2) * 6}" r="11" fill="#0a0709"/><rect x="${51 + i * 70}" y="${258 + (i % 2) * 6}" width="18" height="40" rx="8" fill="#0a0709"/>`).join("")}`, `<rect width="400" height="300" fill="#4a2420"/><rect y="200" width="400" height="100" fill="#120a0c"/>`); },
  community: () => S(`<rect x="0" y="0" width="400" height="300" fill="#120d0a"/><rect x="30" y="30" width="340" height="150" rx="10" fill="#1d1510" stroke="#ffb83e" stroke-opacity=".2"/>
    ${[0, 1, 2, 3, 4, 5].map(i => `<g transform="translate(${70 + i * 52} ${200 + (i % 2) * 10})"><circle r="13" fill="#2a1d14"/><rect x="-14" y="14" width="28" height="44" rx="12" fill="#2a1d14"/></g>`).join("")}
    ${[0, 1, 2, 3].map(i => `<circle cx="${90 + i * 75}" cy="70" r="4" fill="#ffcf86" class="v-blink" style="animation-delay:${i * .5}s"/>`).join("")}<ellipse cx="200" cy="270" rx="150" ry="16" fill="#ffb83e" opacity=".14"/>`),
};
