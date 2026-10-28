"""Sandboxed execution of generated or untrusted code.

Backends (in order of preference for `auto`):
  docker     - container with --network none, memory/CPU/pid limits, read-write
               mount of only the task workspace. Recommended for production.
  namespace  - Linux user+mount+net+pid namespaces via `unshare`: no network
               interfaces, the studio data directory (database, secrets,
               checkpoints) and home directories hidden behind empty tmpfs mounts,
               plus rlimits for CPU time, file size and process count.
There is deliberately no unsandboxed fallback: if neither backend is available,
execution is refused and the reason is reported.
"""
from __future__ import annotations

import os
import resource
import shlex
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

from ..config import get_settings
from ..security import redact

SAFE_ENV_KEYS = {"PATH", "LANG", "LC_ALL", "PLAYWRIGHT_BROWSERS_PATH", "NODE_PATH", "TZ"}


def _docker_ok() -> bool:
    if not shutil.which("docker"):
        return False
    try:
        return subprocess.run(["docker", "info"], capture_output=True, timeout=5).returncode == 0
    except Exception:
        return False


def _ns_ok() -> bool:
    if not shutil.which("unshare"):
        return False
    try:
        r = subprocess.run(["unshare", "--user", "--map-root-user", "--net", "--mount", "--pid", "--fork",
                            "true"], capture_output=True, timeout=5)
        return r.returncode == 0
    except Exception:
        return False


_backend_cache: str | None = None


def backend() -> str:
    global _backend_cache
    want = get_settings().sandbox_backend
    if want in ("docker", "namespace"):
        return want
    if _backend_cache is None:
        _backend_cache = "docker" if _docker_ok() else ("namespace" if _ns_ok() else "unavailable")
    return _backend_cache


def _limits(cpu_s: int, fsize_mb: int, nproc: int):
    def apply() -> None:
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_s, cpu_s + 5))
        resource.setrlimit(resource.RLIMIT_FSIZE, (fsize_mb * 1024 * 1024,) * 2)
        try:
            resource.setrlimit(resource.RLIMIT_NPROC, (nproc, nproc))
        except (ValueError, OSError):
            pass
        os.setsid()
    return apply


def run(cmd: list[str], workspace: Path, *, timeout: int = 60, cpu_s: int = 60, mem_mb: int = 1024,
        fsize_mb: int = 64, nproc: int = 256, extra_env: dict | None = None) -> dict:
    be = backend()
    workspace = Path(workspace).resolve()
    env = {k: v for k, v in os.environ.items() if k in SAFE_ENV_KEYS}
    env.update({"HOME": "/tmp", "AELIO_SANDBOX": "1", **(extra_env or {})})
    isolation = {"backend": be, "network": "none", "timeout_s": timeout, "cpu_s": cpu_s,
                 "mem_mb": mem_mb, "secrets_visible": False, "workspace": str(workspace)}
    if be == "unavailable":
        return {"returncode": None, "stdout": "", "stderr": "No sandbox backend available (need Docker or "
                "Linux user namespaces). Execution refused.", "duration_s": 0, "timed_out": False,
                "isolation": isolation, "refused": True}
    if be == "docker":
        image = os.environ.get("AELIO_SANDBOX_IMAGE", "aelio-sandbox:latest")
        full = ["docker", "run", "--rm", "--network", "none", f"--memory={mem_mb}m", "--cpus=1",
                "--pids-limit", str(nproc), "--read-only", "--tmpfs", "/tmp:size=256m",
                "-v", f"{workspace}:/work:rw", "-w", "/work", "--user", "65534:65534"]
        for k, v in env.items():
            full += ["-e", f"{k}={v}"]
        full += [image] + cmd
        preexec = None
    else:
        s = get_settings()
        hide = [str(s.data_dir)] + [p for p in ("/root", "/home") if os.path.isdir(p)]
        mnt = tempfile.mkdtemp(prefix="aelio-sbx-")
        script = [f"mount --bind {shlex.quote(str(workspace))} {shlex.quote(mnt)}"]
        for h in hide:
            # Don't hide a parent of the sandbox mount point itself.
            script.append(f"mount -t tmpfs -o size=1m,mode=755 tmpfs {shlex.quote(h)}")
        script.append("mount -t proc proc /proc 2>/dev/null || true")
        script.append(f"cd {shlex.quote(mnt)} && exec " + " ".join(shlex.quote(c) for c in cmd))
        full = ["unshare", "--user", "--map-root-user", "--net", "--mount", "--pid", "--fork",
                "bash", "-c", " && ".join(script[:-1]) + " ; " + script[-1]]
        preexec = _limits(cpu_s, fsize_mb, nproc)
        isolation["hidden_paths"] = hide
        isolation["mounted_at"] = mnt
    t0 = time.time()
    timed_out = False
    try:
        p = subprocess.Popen(full, cwd=str(workspace), env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             preexec_fn=preexec, text=True)
        try:
            out, err = p.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            try:
                os.killpg(p.pid, 9)
            except Exception:
                p.kill()
            out, err = p.communicate()
        rc = p.returncode
    finally:
        if be == "namespace":
            try:
                os.rmdir(isolation["mounted_at"])
            except OSError:
                pass
    return {"returncode": rc, "stdout": redact(out[-200_000:]), "stderr": redact(err[-200_000:]),
            "duration_s": round(time.time() - t0, 3), "timed_out": timed_out, "isolation": isolation,
            "refused": False}


def self_test() -> dict:
    """Prove isolation properties instead of assuming them."""
    s = get_settings()
    marker = s.secrets_dir / ".sandbox_probe"
    marker.write_text("probe")
    with tempfile.TemporaryDirectory() as ws:
        code = (
            "import socket,os,sys\n"
            "r={}\n"
            "try:\n s=socket.create_connection(('1.1.1.1',53),timeout=2); r['network']='reachable'\n"
            "except Exception as e: r['network']='blocked'\n"
            f"r['secrets_visible']=os.path.exists({str(marker)!r})\n"
            f"r['db_visible']=os.path.exists({str(s.db_path)!r})\n"
            "r['env_has_secrets']=any(k for k in os.environ if 'TOKEN' in k or 'SECRET' in k or 'KEY' in k)\n"
            "print(r)\n")
        Path(ws, "probe.py").write_text(code)
        res = run(["python3", "probe.py"], Path(ws), timeout=20)
    marker.unlink(missing_ok=True)
    try:
        import ast as _ast
        report = _ast.literal_eval(res["stdout"].strip().splitlines()[-1])
    except Exception:
        report = {"error": res["stderr"][-500:] or "no output"}
    report["backend"] = res["isolation"]["backend"]
    report["passed"] = (report.get("network") == "blocked" and report.get("secrets_visible") is False
                        and report.get("db_visible") is False and report.get("env_has_secrets") is False)
    return report
