"""Deterministic project self-diagnosis.

Every finding here comes from static analysis, compilers or repository
metadata. It is labelled `deterministic:diagnose-v1` and is never
presented as model reasoning.
"""
from __future__ import annotations

import ast
import json
import re
import shutil
from pathlib import Path

from . import sandbox
from .projects import tree

PERFORMER = "deterministic:diagnose-v1"
SECRET_RX = re.compile(r"(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}"
                       r"|-----BEGIN (RSA |EC )?PRIVATE KEY-----)")
JS_IMPORT_RX = re.compile(r"""(?:import\s[^'"]*?from\s*|import\s*\(\s*|require\s*\(\s*)['"](\.{1,2}/[^'"]+)['"]""")

CHECKS_PERFORMED = ["framework detection", "missing dependencies", "syntax errors (JS via node --check, Python via ast)",
                    "broken relative imports (JS)", "missing tests", "accessibility (HTML lang, img alt, unlabeled buttons)",
                    "security (committed credentials, eval, unescaped innerHTML)", "deployment configuration"]
CHECKS_NOT_YET = ["type errors (tsc needs project dependencies installed in sandbox)", "incomplete routes",
                  "unsupported API calls", "model-driven diagnosis (no capable native model yet)"]


def _f(check, severity, msg, file=None, line=None):
    return {"check": check, "severity": severity, "message": msg, "file": file, "line": line, "performer": PERFORMER}


def diagnose(repo: Path) -> dict:
    files = [f["path"] for f in tree(repo)]
    findings: list[dict] = []
    frameworks = []
    pkg = repo / "package.json"
    if pkg.exists():
        try:
            pj = json.loads(pkg.read_text())
            deps = {**pj.get("dependencies", {}), **pj.get("devDependencies", {})}
            for name, fw in (("react", "React"), ("next", "Next.js"), ("vite", "Vite"), ("vue", "Vue"),
                             ("svelte", "Svelte"), ("firebase", "Firebase"), ("wrangler", "Cloudflare Wrangler")):
                if name in deps:
                    frameworks.append(fw)
            if deps and not (repo / "node_modules").exists():
                findings.append(_f("missing dependencies", "warning",
                                   f"{len(deps)} npm dependencies declared but node_modules is not installed", "package.json"))
            if deps and not any((repo / l).exists() for l in ("package-lock.json", "pnpm-lock.yaml", "yarn.lock")):
                findings.append(_f("missing configuration", "info", "no lockfile; builds are not reproducible", "package.json"))
            if "test" not in pj.get("scripts", {}):
                findings.append(_f("missing tests", "info", "package.json has no test script", "package.json"))
        except ValueError as e:
            findings.append(_f("syntax errors", "error", f"package.json is invalid JSON: {e}", "package.json"))
    if any(f.endswith(".py") for f in files):
        frameworks.append("Python")
    if "index.html" in files and not pkg.exists():
        frameworks.append("Static HTML")
    if any(f in files for f in ("wrangler.toml", "wrangler.json", "_headers", "_redirects")):
        frameworks.append("Cloudflare Pages/Workers config")

    js = [f for f in files if f.endswith((".js", ".mjs", ".cjs"))]
    if js and shutil.which("node"):
        for f in js[:200]:
            r = sandbox.run(["node", "--check", f], repo, timeout=15, cpu_s=15)
            if r.get("refused"):
                findings.append(_f("syntax errors", "warning", "sandbox unavailable; JS syntax not checked"))
                break
            if r["returncode"] != 0:
                msg = (r["stderr"].strip().splitlines() or ["syntax error"])
                findings.append(_f("syntax errors", "error", " | ".join(msg[:4])[:400], f))
    for f in js:
        try:
            src = (repo / f).read_text(errors="ignore")
        except OSError:
            continue
        for m in JS_IMPORT_RX.finditer(src):
            target = (repo / f).parent / m.group(1)
            if not any(Path(str(target) + ext).exists() for ext in ("", ".js", ".mjs", "/index.js")):
                line = src[: m.start()].count("\n") + 1
                findings.append(_f("broken imports", "error", f"cannot resolve {m.group(1)}", f, line))
        if re.search(r"\beval\s*\(", src):
            findings.append(_f("security", "warning", "use of eval()", f))
        if re.search(r"innerHTML\s*=\s*[^'\"`]", src):
            findings.append(_f("security", "info", "innerHTML assigned from an expression; check escaping", f))
    for f in [f for f in files if f.endswith(".py")][:500]:
        try:
            ast.parse((repo / f).read_text(errors="ignore"), filename=f)
        except SyntaxError as e:
            findings.append(_f("syntax errors", "error", f"{e.msg}", f, e.lineno))
    for f in [f for f in files if f.endswith((".html", ".htm"))][:50]:
        html = (repo / f).read_text(errors="ignore")
        if "<html" in html and not re.search(r"<html[^>]*\slang=", html):
            findings.append(_f("accessibility", "warning", "<html> has no lang attribute", f))
        n = len([m for m in re.finditer(r"<img\b[^>]*>", html) if not re.search(r"\balt=", m.group(0))])
        if n:
            findings.append(_f("accessibility", "warning", f"{n} <img> element(s) without alt text", f))
        n = len(re.findall(r"<button\b[^>]*>\s*</button>", html))
        if n:
            findings.append(_f("accessibility", "warning", f"{n} empty <button>(s) without accessible label", f))
    for f in files:
        if Path(f).suffix in {".png", ".jpg", ".webp", ".gif", ".zip", ".npz", ".ico"}:
            continue
        try:
            txt = (repo / f).read_text(errors="ignore")
        except OSError:
            continue
        if SECRET_RX.search(txt):
            findings.append(_f("security", "critical", "credential-like string committed to the repository", f))
        if f.endswith(".env") or Path(f).name == ".env":
            findings.append(_f("security", "critical", ".env file committed", f))
    tests = [f for f in files if re.search(r"(^|/)(tests?/|.*\.(test|spec)\.[jt]sx?$|test_.*\.py$)", f)]
    if not tests:
        findings.append(_f("missing tests", "warning", "no test files found"))
    if "Static HTML" in frameworks and "_headers" not in files:
        findings.append(_f("deployment configuration", "info",
                           "no _headers file: Cloudflare Pages will serve without custom security headers"))
    sev_rank = {"critical": 0, "error": 1, "warning": 2, "info": 3}
    findings.sort(key=lambda x: sev_rank[x["severity"]])
    return {"performer": PERFORMER, "frameworks": frameworks or ["unknown"], "files": len(files),
            "findings": findings, "checks_performed": CHECKS_PERFORMED, "checks_not_yet_implemented": CHECKS_NOT_YET,
            "counts": {s: sum(1 for x in findings if x["severity"] == s) for s in sev_rank}}
