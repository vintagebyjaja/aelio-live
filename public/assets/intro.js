/* AELIO entrance: silent, 4 seconds, once per browsing session. Loaded from <head> (external file, CSP-safe).
 *
 * Three independent ways out, so nobody can ever be stuck on the intro:
 *   1. Skip button / Escape key (immediate)
 *   2. This script fades it out from 3.6 s; it is gone at 4.0 s
 *   3. CSS alone hides it at 4.0 s (animation in cine.css), even if the rest of this script never runs
 * If this file fails to load, the intro never shows at all: the overlay is display:none unless html.intro-on is set.
 * Nothing here waits for images, fonts or the network.
 */
(function () {
  var KEY = "aelio-intro-seen-v6", DURATION = 3600,   /* fade starts at 3.6 s, gone at 4.0 s */ html = document.documentElement;
  var seen = false;
  try { seen = sessionStorage.getItem(KEY) === "1"; } catch (e) { /* storage blocked: still safe, intro just may replay */ }
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var forced = /[?&]intro=1\b/.test(location.search);           // QA: ?intro=1 replays it
  var off = false;                                                 // founder turned it off in Web Designer
  try { off = localStorage.getItem("aelio-intro-off") === "1"; } catch (e) { /* ignore */ }
  if ((seen || reduce || off) && !forced) return;
  try { sessionStorage.setItem(KEY, "1"); } catch (e) { /* ignore */ }
  html.classList.add("intro-on");

  var done = false;
  function end(how) {
    if (done) return;
    done = true;
    html.classList.add("intro-out");
    html.setAttribute("data-intro-end", how);
    setTimeout(function () {
      html.classList.remove("intro-on", "intro-out");
      var el = document.getElementById("intro");
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 420);
  }
  window.__aelioIntroEnd = end;
  setTimeout(function () { end("timer"); }, DURATION);
  setTimeout(function () { end("fallback"); }, DURATION + 1200);  // independent of everything above

  function wire() {
    var b = document.getElementById("introSkip");
    if (b) b.addEventListener("click", function () { end("skip"); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") end("escape"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
})();
