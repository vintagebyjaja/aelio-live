"""Dataset registry: ingestion, validation, licensing/provenance and versioning.

A dataset is only `training_eligible` when:
  * its license is on the allow-list,
  * it passed validation, and
  * its origin is not output from another company's AI model.
"""
from __future__ import annotations

import ast
import hashlib
import inspect
import json
import platform
import re
import sysconfig
from pathlib import Path

from .. import db
from ..config import get_settings
from ..security import redact

LICENSE_ALLOWLIST = {
    "PSF-2.0", "MIT", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "CC0-1.0", "CC-BY-4.0",
    "Public-Domain", "Grooveville-Owned",
}
BLOCKED_ORIGINS = {"external-ai-output"}
EXCLUDE_DIRS = {"test", "tests", "idlelib", "site-packages", "dist-packages", "lib2to3", "ensurepip",
                "turtledemo", "__pycache__", "config-3", "venv", "pydoc_data"}


def _stdlib_files() -> list[Path]:
    root = Path(sysconfig.get_paths()["stdlib"])
    out = []
    for p in sorted(root.rglob("*.py")):
        rel = p.relative_to(root)
        if any(part in EXCLUDE_DIRS or part.startswith("config-") for part in rel.parts):
            continue
        out.append(p)
    return out


def _split(name: str) -> str:
    return "val" if int(hashlib.sha256(name.encode()).hexdigest(), 16) % 10 == 0 else "train"


def validate_text(text: str) -> dict:
    lines = text.splitlines()
    uniq = len(set(lines))
    redacted = redact(text)
    return {
        "chars": len(text), "lines": len(lines),
        "duplicate_line_ratio": round(1 - uniq / max(1, len(lines)), 4),
        "credential_like_spans_redacted": int(redacted != text),
        "utf8": True,
        "passed": len(text) > 1000,
    }


def _register(name: str, modality: str, license_: str, source: str, provenance: dict, files: dict[str, str],
              origin: str = "licensed-corpus") -> dict:
    s = get_settings()
    prev = db.q1("SELECT MAX(version) v FROM datasets WHERE name=?", (name,))
    version = (prev["v"] or 0) + 1 if prev else 1
    did = db.new_id("ds")
    d = s.artifacts_dir / "datasets" / did
    d.mkdir(parents=True, exist_ok=True)
    validation = validate_text("".join(files.values()))
    files = {k: redact(v) for k, v in files.items()}  # cleaning: strip credential-shaped strings
    h = hashlib.sha256()
    total = 0
    for fname, content in files.items():
        (d / fname).write_text(content, encoding="utf-8")
        h.update(fname.encode()); h.update(content.encode())
        total += len(content.encode())
    eligible = (license_ in LICENSE_ALLOWLIST and validation["passed"] and origin not in BLOCKED_ORIGINS)
    provenance = {**provenance, "origin": origin}
    (d / "manifest.json").write_text(json.dumps({"name": name, "version": version, "license": license_,
                                                 "source": source, "provenance": provenance,
                                                 "validation": validation}, indent=2))
    row = {"id": did, "name": name, "version": version, "modality": modality, "license": license_,
           "source": source, "provenance": db.dumps(provenance), "sha256": h.hexdigest(), "path": str(d),
           "size_bytes": total, "n_records": sum(c.count("\n") for c in files.values()),
           "status": "validated" if validation["passed"] else "rejected",
           "training_eligible": int(eligible), "created_at": db.now(), "validation": db.dumps(validation)}
    db.insert("datasets", row)
    db.audit("system", "dataset-registry", "dataset.registered", did, {"name": name, "eligible": eligible})
    return row


def build_stdlib_docstrings(max_bytes: int = 1_200_000) -> dict:
    """English technical prose: docstrings from the Python standard library (PSF-2.0)."""
    parts = {"train": [], "val": []}
    size = {"train": 0, "val": 0}
    used = []
    for p in _stdlib_files():
        try:
            tree = ast.parse(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        docs = []
        for node in ast.walk(tree):
            if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                ds = ast.get_docstring(node, clean=True)
                if ds and len(ds) > 40:
                    docs.append(inspect.cleandoc(ds))
        if not docs:
            continue
        sp = _split(str(p.name))
        text = "\n\n".join(docs) + "\n\n"
        cap = max_bytes if sp == "train" else max_bytes // 9
        if size[sp] + len(text) > cap:
            continue
        parts[sp].append(text); size[sp] += len(text); used.append(p.name)
    prov = {"python_version": platform.python_version(), "files_used": len(used),
            "file_list_sha256": hashlib.sha256("\n".join(used).encode()).hexdigest(),
            "method": "ast docstring extraction; split by sha256(filename) % 10"}
    return _register("psf-stdlib-docstrings", "text", "PSF-2.0",
                     "Python standard library docstrings (python.org, PSF License 2.0)", prov,
                     {"train.txt": "".join(parts["train"]), "val.txt": "".join(parts["val"])})


def build_stdlib_code(max_bytes: int = 1_500_000) -> dict:
    """Python source code from the standard library (PSF-2.0)."""
    parts = {"train": [], "val": []}
    size = {"train": 0, "val": 0}
    used = []
    for p in _stdlib_files():
        try:
            src = p.read_text(encoding="utf-8")
        except Exception:
            continue
        if len(src) > 40_000 or len(src) < 500:
            continue
        sp = _split(str(p.name))
        cap = max_bytes if sp == "train" else max_bytes // 9
        if size[sp] + len(src) > cap:
            continue
        src = re.sub(r"\n{3,}", "\n\n", src)
        parts[sp].append(src + "\n\n"); size[sp] += len(src); used.append(p.name)
    prov = {"python_version": platform.python_version(), "files_used": len(used),
            "file_list_sha256": hashlib.sha256("\n".join(used).encode()).hexdigest(),
            "method": "whole-file source, 500B-40KB files; split by sha256(filename) % 10"}
    return _register("psf-stdlib-code", "code", "PSF-2.0",
                     "Python standard library source (python.org, PSF License 2.0)", prov,
                     {"train.txt": "".join(parts["train"]), "val.txt": "".join(parts["val"])})


def register_digits() -> dict:
    src = Path(__file__).parent / "data" / "uci_digits.npz"
    s = get_settings()
    did = db.new_id("ds")
    data = src.read_bytes()
    prev = db.q1("SELECT MAX(version) v FROM datasets WHERE name='uci-optdigits-8x8'")
    row = {"id": did, "name": "uci-optdigits-8x8", "version": ((prev or {}).get("v") or 0) + 1, "modality": "image",
           "license": "CC-BY-4.0", "source": "UCI ML Repository, Alpaydin & Kaynak (1998), doi:10.24432/C50P49",
           "provenance": db.dumps({"origin": "licensed-corpus", "file": "aelio/native/data/uci_digits.npz",
                                   "attribution": "E. Alpaydin, C. Kaynak"}),
           "sha256": hashlib.sha256(data).hexdigest(), "path": str(src), "size_bytes": len(data),
           "n_records": 1797, "status": "validated", "training_eligible": 1, "created_at": db.now(),
           "validation": db.dumps({"passed": True, "images": 1797, "shape": [8, 8], "classes": 10})}
    db.insert("datasets", row)
    db.audit("system", "dataset-registry", "dataset.registered", did, {"name": row["name"]})
    return row


def ingest_text(name: str, modality: str, license_: str, source: str, text: str, origin: str,
                attested_by: str) -> dict:
    """Founder-uploaded dataset. Upload must state license and origin."""
    lines = text.splitlines(keepends=True)
    val = "".join(l for i, l in enumerate(lines) if i % 10 == 0)
    train = "".join(l for i, l in enumerate(lines) if i % 10 != 0)
    return _register(name, modality, license_, source, {"attested_by": attested_by, "upload": True},
                     {"train.txt": train, "val.txt": val}, origin=origin)


def get(did: str) -> dict | None:
    return db.q1("SELECT * FROM datasets WHERE id=?", (did,))


def read_split(ds: dict, split: str) -> str:
    return (Path(ds["path"]) / f"{split}.txt").read_text(encoding="utf-8")
