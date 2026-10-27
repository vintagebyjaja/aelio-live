"""Protected browser test — dashboard_benchmark_v1.

Serves src/ through Playwright request routing (no network needed) and checks
responsive layout at phone and desktop widths. Prints one JSON object per check.
"""
import json
import mimetypes
from pathlib import Path

from playwright.sync_api import sync_playwright

SRC = Path("src").resolve()


def report(name, passed, detail=""):
    print(json.dumps({"name": name, "passed": bool(passed), "detail": str(detail)[:300]}), flush=True)


def serve(route):
    rel = route.request.url.split("http://bench.local/", 1)[1].split("?")[0] or "index.html"
    f = (SRC / rel).resolve()
    if SRC not in f.parents and f != SRC or not f.exists():
        return route.fulfill(status=404, body="not found")
    route.fulfill(status=200, body=f.read_bytes(),
                  headers={"content-type": mimetypes.guess_type(str(f))[0] or "text/plain"})


with sync_playwright() as p:
    browser = p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
    for width in (375, 1280):
        page = browser.new_page(viewport={"width": width, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.route("http://bench.local/**", serve)
        try:
            page.goto("http://bench.local/index.html", wait_until="load", timeout=15000)
            page.wait_for_timeout(300)
        except Exception as e:  # noqa: BLE001
            report(f"{width}px: page loads", False, e)
            continue
        report(f"{width}px: no script errors", not errors, "; ".join(errors))
        overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        boxes = page.evaluate("""[...document.querySelectorAll('[data-metric]')].map(e => {
            const r = e.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; })""")
        visible = [b for b in boxes if b["w"] > 0 and b["h"] > 0]
        # An empty page trivially has no overflow, so this only counts once the dashboard rendered.
        report(f"{width}px: no horizontal overflow", overflow <= 0 and len(visible) > 0,
               f"overflow={overflow}px" + ("" if visible else "; nothing rendered"))
        report(f"{width}px: three metric cards visible", len(visible) == 3, f"visible={len(visible)}")
        if len(visible) == 3:
            ys = sorted(round(b["y"]) for b in visible)
            if width == 1280:
                report("1280px: metrics in one row", ys[-1] - ys[0] < 5, f"ys={ys}")
            else:
                report("375px: metrics stacked", ys[1] > ys[0] + 5 and ys[2] > ys[1] + 5, f"ys={ys}")
        heading = page.evaluate("document.querySelectorAll('h1,h2,h3').length")
        report(f"{width}px: has headings for structure", heading >= 1, f"headings={heading}")
        page.close()
    browser.close()
