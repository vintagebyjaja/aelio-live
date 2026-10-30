/* Applies the founder's published Web Designer settings to this public page.
 * Reads /api/public/site-design (same origin). If the engine isn't reachable, the built-in design simply stays.
 * Only structured values arrive (hex colours, bounded numbers, image ids), and they're applied as CSS variables
 * and image URLs on this origin, never as HTML. Preview: ?designPreview=<token> from Studio Brain shows the draft. */
(() => {
  const html = document.documentElement, body = document.body;
  let preview = new URLSearchParams(location.search).get("designPreview");
  try { if (preview) sessionStorage.setItem("aelio-design-preview", preview); else preview = sessionStorage.getItem("aelio-design-preview"); } catch (e) { /* ignore */ }
  const HEX = /^#[0-9a-f]{6}$/i;

  function apply(d) {
    const t = d.theme || {};
    const vars = { "--gold": t.gold, "--copper": t.copper, "--bg": t.bg, "--text": t.text };
    for (const [k, v] of Object.entries(vars)) if (HEX.test(v || "")) {html.style.setProperty(k, v);body.style.setProperty(k,v);}
    if (typeof t.radius === "number") html.style.setProperty("--r", Math.max(0, Math.min(32, t.radius)) + "px");
    if (typeof t.heading_scale === "number") html.style.setProperty("--hscale", String(Math.max(.7, Math.min(1.3, t.heading_scale))));
    html.classList.remove("btn-pill", "btn-square"); if (t.button === "pill" || t.button === "square") html.classList.add("btn-" + t.button);
    if (d.intro && d.intro.enabled === false) {
      try { localStorage.setItem("aelio-intro-off", "1"); } catch (e) { /* ignore */ }
      if (window.__aelioIntroEnd) window.__aelioIntroEnd("design");
    } else { try { localStorage.removeItem("aelio-intro-off"); } catch (e) { /* ignore */ } }

    const sec = body.dataset.section, h = d.heroes && d.heroes[sec];
    const env = document.querySelector(".hero .env");
    if (!env || !h || !h.image || !/^img_[0-9a-f]{16}$/.test(h.image)) return;
    if (body.dataset.overview !== "1" && sec !== "home" && !h.subpages) return;
    const plate = document.createElement("div");
    plate.className = "plate-custom" + (h.motion ? " moving" : "");
    const img = new Image(); img.alt = ""; img.decoding = "async";
    img.style.objectPosition = `${+h.focus_x || 50}% ${+h.focus_y || 50}%`;
    img.onload = () => env.classList.add("has-custom");      // swap only once the image is really there
    img.src = "/api/public/site-assets/" + h.image;
    plate.appendChild(img);
    const shade = document.createElement("div");
    const a = Math.max(0, Math.min(95, +h.shade || 0)) / 100;
    shade.className = "custom-shade";
    shade.style.background = `linear-gradient(90deg,rgba(4,5,9,${a}) 0%,rgba(4,5,9,${a * .75}) 35%,rgba(4,5,9,${a * .15}) 70%,transparent),linear-gradient(0deg,rgba(5,7,11,.9),transparent 25%)`;
    env.appendChild(plate); env.appendChild(shade);
  }

  const url = "/api/public/site-design" + (preview ? "?preview=" + encodeURIComponent(preview) : "");
  fetch(url, { credentials: "same-origin" }).then(r => r.ok ? r.json() : null).then(d => {
    if (!d || !d.design) return;
    apply(d.design);
    if (d.preview) { const b = document.createElement("div"); b.className = "design-preview-bar"; b.textContent = "Draft preview: only you can see this";
      const x = document.createElement("button"); x.textContent = "Exit preview"; x.onclick = () => { try { sessionStorage.removeItem("aelio-design-preview"); } catch (e) { /* ignore */ } location.href = location.pathname; };
      b.appendChild(x); body.appendChild(b); }
  }).catch(() => { /* engine not connected: built-in design stays */ });
})();
