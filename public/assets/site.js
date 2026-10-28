/* AELIO public site: mega menus, mobile menu, search, modals, small interactions. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------- mega menus: hover + keyboard focus + click; Esc closes ----------
  const items = $$(".nav-item");
  let closeT;
  const close = (except) => items.forEach(i => { if (i !== except) { i.classList.remove("open"); i.querySelector(".nav-top").setAttribute("aria-expanded", "false"); } });
  const open = (i) => { clearTimeout(closeT); close(i); i.classList.add("open"); i.querySelector(".nav-top").setAttribute("aria-expanded", "true"); };
  items.forEach(i => {
    const top = i.querySelector(".nav-top");
    i.addEventListener("mouseenter", () => open(i));
    i.addEventListener("mouseleave", () => { closeT = setTimeout(() => close(), 160); });
    i.addEventListener("focusin", () => open(i));
    top.addEventListener("click", (e) => { if (matchMedia("(hover: none)").matches && !i.classList.contains("open")) { e.preventDefault(); open(i); } });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const o = items.find(i => i.classList.contains("open"));
      close(); if (o) o.querySelector(".nav-top").focus();
      $$(".modal,.search").forEach(m => m.hidden = true);
    }
    if ((e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".nav-item")) close(); });

  // ---------- mobile menu ----------
  const mb = $("#menuBtn"), mp = $("#mPanel");
  if (mb) mb.addEventListener("click", () => { const on = mp.hidden; mp.hidden = !on; mb.setAttribute("aria-expanded", String(on)); document.body.style.overflow = on ? "hidden" : ""; });

  // ---------- early access modal (honest preview) ----------
  const modal = $("#earlyModal");
  $$("[data-early]").forEach(b => b.addEventListener("click", (e) => { e.preventDefault(); modal.hidden = false; modal.querySelector(".modal-x").focus(); }));
  $$(".modal,[data-close]").forEach(el => el.addEventListener("click", (e) => { if (e.target === el) el.closest(".modal").hidden = true; }));

  // ---------- search ----------
  const sw = $("#search"), si = $("#searchIn"), so = $("#searchOut");
  let index = null, sel = 0;
  async function openSearch() {
    sw.hidden = false; si.value = ""; so.innerHTML = ""; si.focus();
    if (!index) { try { index = await (await fetch("/assets/search-index.json")).json(); } catch { index = []; } }
  }
  const sb = $("#searchBtn"); if (sb) sb.addEventListener("click", openSearch);
  sw.addEventListener("click", (e) => { if (e.target === sw) sw.hidden = true; });
  si.addEventListener("input", () => {
    const q = si.value.trim().toLowerCase(); sel = 0;
    const hits = !q ? [] : (index || []).map(p => { const t = (p.title + " " + p.section + " " + p.text).toLowerCase(); const s = q.split(/\s+/).every(w => t.includes(w)) ? (p.title.toLowerCase().includes(q) ? 2 : 1) : 0; return [s, p]; })
      .filter(x => x[0]).sort((a, b) => b[0] - a[0]).slice(0, 8).map(x => x[1]);
    so.innerHTML = hits.map((p, i) => `<a href="${p.url}" class="${i ? "" : "sel"}"><b>${p.title}</b><small>${p.section} · ${p.text.slice(0, 90)}</small></a>`).join("") || (q ? '<p class="dim small" style="padding:10px">No matches.</p>' : "");
  });
  si.addEventListener("keydown", (e) => {
    const links = $$("a", so); if (!links.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); links[sel].classList.remove("sel"); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length; links[sel].classList.add("sel"); }
    if (e.key === "Enter") { e.preventDefault(); location.href = links[sel].getAttribute("href"); }
  });

  // ---------- copy buttons ----------
  $$("[data-copy]").forEach(b => b.addEventListener("click", async () => {
    const t = $(b.dataset.copy).textContent;
    try { await navigator.clipboard.writeText(t); b.textContent = "Copied ✓"; } catch { b.textContent = "Select and copy"; }
    setTimeout(() => b.textContent = "Copy", 2200);
  }));

  // ---------- personalities preview ----------
  const pp = $("[data-personas]");
  if (pp) { const lines = JSON.parse(pp.dataset.personas); $$(".persona", pp).forEach((b, i) => b.addEventListener("click", () => {
    $$(".persona", pp).forEach(x => x.setAttribute("aria-pressed", "false")); b.setAttribute("aria-pressed", "true");
    $(".persona-line").textContent = "“" + lines[i] + "”"; })); }

  // ---------- pointer-responsive visuals ----------
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) $$("[data-tilt]").forEach(el => {
    el.addEventListener("pointermove", (e) => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.transform = `perspective(1200px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`; });
    el.addEventListener("pointerleave", () => el.style.transform = "");
  });

  // ---------- reveal on scroll ----------
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    $$(".band .wrap").forEach(w => { w.classList.add("reveal"); io.observe(w); });
  }

  // ---------- published models (from the AELIO engine; founder-published only) ----------
  const pub = $("[data-engine-list]");
  if (pub) {
    const engine = (window.AELIO_CONFIG && window.AELIO_CONFIG.engine) || "";
    fetch(engine + "/api/public/models").then(r => r.json()).then(d => {
      pub.innerHTML = d.models.length ? d.models.map(m => `<div class="card"><b>${m.name}</b><p>${m.engine}</p><p class="dim small">${Object.entries(m.metrics || {}).filter(([k, v]) => typeof v === "number" && /accuracy|val_loss|pass_at/.test(k)).map(([k, v]) => k + " " + v).join(" · ")}</p></div>`).join("")
        : '<p class="dim">No models have been published yet. When the founder publishes one from the Studio Brain, it appears here automatically.</p>';
    }).catch(() => { pub.innerHTML = '<p class="dim">The AELIO engine isn\'t reachable right now, so no published models can be shown.</p>'; });
  }
})();
