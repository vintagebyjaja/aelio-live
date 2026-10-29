/* AELIO public site: living environments (stars, water, light motes) and gentle parallax.
 * Small canvases only; pauses off-screen and in background tabs; draws one still frame when reduced motion is on. */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const rng = (seed) => { let a = (seed | 0) || 1; return () => { a = (a * 1664525 + 1013904223) | 0; return ((a >>> 0) % 100000) / 100000; }; };
  const COLORS = { gold: [255, 196, 120], green: [190, 235, 205], warm: [255, 214, 150] };
  const items = [];

  function fit(c) {
    const r = c.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * DPR)), h = Math.max(1, Math.round(r.height * DPR));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; return true; }
    return false;
  }

  function stars(c) {
    const r = rng(+c.dataset.seed || 1), n = +c.dataset.stars || 160, ctx = c.getContext("2d");
    const pts = Array.from({ length: n }, () => ({ x: r(), y: Math.pow(r(), 1.6) * .66, s: .4 + r() * 1.3, p: r() * 6.28, v: .4 + r() * 1.4 }));
    return (t) => {
      fit(c); const W = c.width, H = c.height; ctx.clearRect(0, 0, W, H);
      for (const s of pts) {
        const a = .35 + .65 * (reduce ? .7 : (.5 + .5 * Math.sin(s.p + t * .001 * s.v)));
        ctx.fillStyle = `rgba(255,244,222,${(a * (1 - s.y)).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.s * DPR, 0, 6.283); ctx.fill();
      }
    };
  }

  function water(c) {
    const ctx = c.getContext("2d"), col = COLORS[c.dataset.water] || COLORS.gold, r = rng(+c.dataset.seed || 3);
    const lines = Array.from({ length: 70 }, () => ({ y: Math.pow(r(), 1.35), x: r(), w: .03 + r() * .16, p: r() * 6.28, sp: .3 + r() }));
    return (t) => {
      fit(c); const W = c.width, H = c.height; ctx.clearRect(0, 0, W, H);
      const cx = (+getComputedStyle(c.parentNode).getPropertyValue("--glint-x") || .62) * W;
      for (const l of lines) {
        const y = l.y * H, k = 1 - l.y * .6;
        const drift = reduce ? 0 : Math.sin(t * .0006 * l.sp + l.p) * 18 * DPR;
        const near = Math.exp(-Math.pow((l.x * W - cx) / (W * .18), 2));         // brighter in the light column
        const a = (.05 + .45 * near) * k * (reduce ? .8 : (.6 + .4 * Math.sin(t * .0015 * l.sp + l.p)));
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`;
        ctx.lineWidth = (1 + l.y * 2.2) * DPR;
        const x = l.x * W + drift, w = l.w * W * (1 + l.y);
        ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.stroke();
      }
    };
  }

  function motes(c) {
    const ctx = c.getContext("2d"), col = COLORS[c.dataset.motes] || COLORS.gold, r = rng(+c.dataset.seed || 5);
    const ps = Array.from({ length: 46 }, () => ({ x: .35 + r() * .65, y: r(), s: .6 + r() * 1.8, v: .15 + r() * .5, p: r() * 6.28 }));
    return (t) => {
      fit(c); const W = c.width, H = c.height; ctx.clearRect(0, 0, W, H);
      for (const m of ps) {
        const y = reduce ? m.y : ((m.y - t * .00002 * m.v) % 1 + 1) % 1;
        const x = m.x + (reduce ? 0 : Math.sin(t * .0005 + m.p) * .01);
        const a = .5 * Math.sin(Math.PI * y);
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x * W, y * H, m.s * DPR, 0, 6.283); ctx.fill();
      }
    };
  }

  document.querySelectorAll("canvas.env-canvas").forEach(c => {
    const draw = c.dataset.stars ? stars(c) : c.dataset.water ? water(c) : c.dataset.motes ? motes(c) : null;
    if (draw) items.push({ c, draw, visible: true });
  });
  if (!items.length) return;

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { const it = items.find(i => i.c === e.target); if (it) it.visible = e.isIntersecting; }));
    items.forEach(i => io.observe(i.c));
  }
  let last = 0;
  function frame(t) {
    if (!document.hidden && t - last > 33) { last = t; items.forEach(i => { if (i.visible) i.draw(t); }); }
    requestAnimationFrame(frame);
  }
  if (reduce) { const once = () => items.forEach(i => i.draw(0)); once(); addEventListener("resize", once); }
  else requestAnimationFrame(frame);

  // Gentle parallax: layers move a few pixels with the pointer and scroll. Never on touch-only devices or reduced motion.
  if (reduce) return;
  const hero = document.querySelector(".hero");
  const DEPTH = [[".env-svg", .5], [".plate", .35], [".emblem-float", 1], [".globe", 1.1], [".lens", -.4]];
  const layers = []; if (hero) DEPTH.forEach(([sel, d]) => hero.querySelectorAll(sel).forEach(el => { el.dataset.depth = d; layers.push(el); }));
  if (!layers.length) return;
  let px = 0, py = 0, sy = 0, queued = false;
  const apply = () => { queued = false; layers.forEach(l => { const d = +l.dataset.depth; l.style.transform = `translate3d(${(px * d).toFixed(1)}px,${(py * d + sy * d * .6).toFixed(1)}px,0)`; }); };
  const q = () => { if (!queued) { queued = true; requestAnimationFrame(apply); } };
  if (matchMedia("(hover: hover)").matches) hero.addEventListener("pointermove", e => { const r = hero.getBoundingClientRect(); px = ((e.clientX - r.left) / r.width - .5) * -14; py = ((e.clientY - r.top) / r.height - .5) * -8; q(); });
  addEventListener("scroll", () => { sy = Math.min(scrollY, 900) * .08; q(); }, { passive: true });
})();
