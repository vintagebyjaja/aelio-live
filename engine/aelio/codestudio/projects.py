"""Code Studio projects: isolated git workspaces, file access, search, history, branches.

Policy:
  * Every project is a git repository inside the studio's workspaces directory.
  * Agents work only on `aelio/*` branches. Pushing to the default branch or to
    a production remote is not implemented in v1, by design.
  * File writes are confined to the workspace and refuse `.git` and protected
    test locations (`.aelio_protected`).
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path

from .. import db
from ..config import SAMPLES_DIR, get_settings
from ..security import get_secret, redact

GIT_ENV = {"GIT_AUTHOR_NAME": "AELIO Studio", "GIT_AUTHOR_EMAIL": "studio@aelio.live",
           "GIT_COMMITTER_NAME": "AELIO Studio", "GIT_COMMITTER_EMAIL": "studio@aelio.live",
           "GIT_TERMINAL_PROMPT": "0"}
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".aelio_protected", "dist", ".venv", "venv"}


class PolicyError(Exception):
    pass


def git(repo: Path, *args: str, env: dict | None = None, check: bool = True) -> str:
    e = {**os.environ, **GIT_ENV, **(env or {})}
    r = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, env=e, timeout=120)
    if check and r.returncode != 0:
        raise RuntimeError(redact(r.stderr.strip() or r.stdout.strip()))
    return r.stdout


def _new(name: str, kind: str, remote: str | None = None, production: bool = False) -> tuple[str, Path]:
    pid = db.new_id("prj")
    path = get_settings().workspaces_dir / pid / "repo"
    path.parent.mkdir(parents=True, exist_ok=True)
    return pid, path


def create_from_sample(sample: str = "dashboard-benchmark", name: str | None = None) -> dict:
    src = SAMPLES_DIR / sample
    if not src.is_dir():
        raise FileNotFoundError(sample)
    pid, path = _new(name or sample, "sample")
    shutil.copytree(src, path)
    git(path, "init", "-q", "-b", "main")
    git(path, "add", "-A")
    git(path, "commit", "-qm", f"Import sample project {sample}")
    row = {"id": pid, "name": name or sample, "path": str(path), "kind": "sample", "remote_url": None,
           "default_branch": "main", "is_production": 0, "created_at": db.now()}
    db.insert("projects", row)
    db.audit("founder", None, "project.created", pid, {"sample": sample})
    return row


def connect_git(remote_url: str, name: str, production: bool, token_secret: str | None = "GITHUB_TOKEN") -> dict:
    """Clone an authorised repository (read access) into an isolated workspace.

    The token is read from the server-side secret store and never written to the
    repository config or logs.
    """
    if not re.fullmatch(r"https://github\.com/[\w.-]+/[\w.-]+(\.git)?", remote_url):
        raise PolicyError("Only https://github.com/<owner>/<repo> URLs are accepted.")
    pid, path = _new(name, "git")
    env = {}
    tok = get_secret(token_secret) if token_secret else None
    if tok:
        helper = path.parent / "askpass.sh"
        helper.write_text("#!/bin/sh\necho \"$AELIO_GIT_TOKEN\"\n")
        helper.chmod(0o700)
        env = {"GIT_ASKPASS": str(helper), "AELIO_GIT_TOKEN": tok}
    url = remote_url.replace("https://", "https://x-access-token@") if tok else remote_url
    e = {**os.environ, **GIT_ENV, **env}
    r = subprocess.run(["git", "clone", "-q", url, str(path)], capture_output=True, text=True, env=e, timeout=300)
    if tok:
        (path.parent / "askpass.sh").unlink(missing_ok=True)
    if r.returncode != 0:
        shutil.rmtree(path.parent, ignore_errors=True)
        raise RuntimeError(redact(r.stderr))
    git(path, "remote", "set-url", "origin", remote_url)
    branch = git(path, "rev-parse", "--abbrev-ref", "HEAD").strip()
    row = {"id": pid, "name": name, "path": str(path), "kind": "git", "remote_url": remote_url,
           "default_branch": branch, "is_production": int(production), "created_at": db.now()}
    db.insert("projects", row)
    db.audit("founder", None, "project.connected", pid, {"remote": remote_url, "production": production})
    return row


def get(pid: str) -> dict:
    p = db.q1("SELECT * FROM projects WHERE id=?", (pid,))
    if not p:
        raise FileNotFoundError(pid)
    return p


def safe_path(repo: Path, rel: str) -> Path:
    rel = rel.lstrip("/")
    full = (repo / rel).resolve()
    if full != repo.resolve() and repo.resolve() not in full.parents:
        raise PolicyError("path escapes the workspace")
    parts = Path(rel).parts
    if parts and parts[0] in {".git", ".aelio_protected"}:
        raise PolicyError("protected location")
    return full


def tree(repo: Path, limit: int = 2000) -> list[dict]:
    out = []
    for root, dirs, files in os.walk(repo):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for f in sorted(files):
            p = Path(root) / f
            out.append({"path": str(p.relative_to(repo)), "size": p.stat().st_size})
            if len(out) >= limit:
                return out
    return out


def read_file(repo: Path, rel: str, max_bytes: int = 400_000) -> str:
    p = safe_path(repo, rel)
    data = p.read_bytes()[:max_bytes]
    return data.decode("utf-8", errors="replace")


def write_file(repo: Path, rel: str, content: str, allowed: list[str] | None = None) -> None:
    if allowed is not None and rel not in allowed:
        raise PolicyError(f"{rel} is outside this task's allowed files {allowed}")
    p = safe_path(repo, rel)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


def search(repo: Path, pattern: str, limit: int = 200) -> list[dict]:
    rx = re.compile(re.escape(pattern), re.I)
    hits = []
    for f in tree(repo):
        if f["size"] > 1_000_000:
            continue
        try:
            for i, line in enumerate((repo / f["path"]).read_text(errors="ignore").splitlines(), 1):
                if rx.search(line):
                    hits.append({"path": f["path"], "line": i, "text": line.strip()[:240]})
                    if len(hits) >= limit:
                        return hits
        except OSError:
            continue
    return hits


def log(repo: Path, n: int = 30) -> list[dict]:
    raw = git(repo, "log", f"-n{n}", "--all", "--pretty=format:%H\x1f%an\x1f%ad\x1f%s\x1f%D", "--date=iso")
    out = []
    for line in raw.splitlines():
        h, a, d, s, refs = (line.split("\x1f") + [""] * 5)[:5]
        out.append({"sha": h, "author": a, "date": d, "subject": s, "refs": refs})
    return out


def branches(repo: Path) -> list[str]:
    return [b.strip().lstrip("* ") for b in git(repo, "branch").splitlines()]


def create_branch(repo: Path, name: str, base: str | None = None) -> str:
    if not re.fullmatch(r"aelio/[\w.-]+", name):
        raise PolicyError("agent branches must be named aelio/<name>")
    git(repo, "checkout", "-q", "-B", name, *( [base] if base else []))
    return name


def checkout(repo: Path, ref: str) -> None:
    git(repo, "checkout", "-q", ref)


def changed_files(repo: Path) -> list[str]:
    out = git(repo, "status", "--porcelain", "--untracked-files=all")
    return [l[3:].strip() for l in out.splitlines() if l.strip()]


def commit_all(repo: Path, msg: str, performer: str) -> str:
    git(repo, "add", "-A", "--", ".", ":(exclude).aelio_protected")
    git(repo, "commit", "-q", "--allow-empty", "-m", f"{msg}\n\nPerformer: {performer}")
    return git(repo, "rev-parse", "HEAD").strip()


def diff(repo: Path, base: str, head: str = "HEAD") -> str:
    return git(repo, "diff", f"{base}..{head}")


def reset_hard(repo: Path) -> None:
    git(repo, "reset", "-q", "--hard")
    git(repo, "clean", "-qfd", "-e", ".aelio_protected")
