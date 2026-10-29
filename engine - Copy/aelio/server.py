"""AELIO Studio HTTP server (private back office + internal API gateway).

Route families and who can reach them:
  /api/auth/*     sign-in (Firebase or local), MFA
  /api/*          founder session with MFA completed; CSRF header on writes
  /v1/*           registered Grooveville applications (Bearer app key + scope)
  /public/v1/*    read-only list of founder-published models (for aelio.live)
  /               studio web app (static; holds no data until signed in)
"""
from __future__ import annotations

import hmac
import os
import time
from pathlib import Path

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse, Response
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from . import db, deploy, firebase_auth, gateway, guardians, jobs, orchestrator, usage, voice
from .codestudio import diagnose, projects, sandbox
from .config import WEB_DIST, get_settings
from .native import datasets, registry
from .quality import suites
from .security import (RateLimiter, create_session, end_session, get_session, hash_password, login_blocked,
                       mfa_fresh, new_totp_secret, put_secret, record_login, totp_uri, touch_mfa, verify_password,
                       verify_totp, list_secret_names)

# import job handlers so they register
from .native import train as _train  # noqa: F401
from .quality import runner as _runner  # noqa: F401

COOKIE = "aelio_session"
api_limiter = RateLimiter(600)
gw_limiter = RateLimiter(300)


class HTTPError(Exception):
    def __init__(self, status: int, msg: str):
        self.status, self.msg = status, msg


def ip_of(req: Request) -> str:
    """Client IP. Behind the aelio.live proxy, trust only the IP the proxy vouches for."""
    if req.scope.get("aelio_proxied") and req.headers.get("x-aelio-client-ip"):
        return req.headers["x-aelio-client-ip"]
    return req.headers.get("cf-connecting-ip") or (req.client.host if req.client else "?")


def auth_mode() -> str:
    return os.environ.get("AELIO_AUTH", "firebase" if firebase_auth.project_id() else "local")


async def body(req: Request) -> dict:
    try:
        d = await req.json()
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def _bearer(req: Request) -> str | None:
    h = req.headers.get("authorization", "")
    return h[7:].strip() if h.lower().startswith("bearer ") else None


def ensure_user(ident: dict) -> dict:
    """Create or refresh the local record for a verified Firebase account (allow-lists are authoritative)."""
    uid = "fb_" + ident["uid"]
    u = db.q1("SELECT * FROM users WHERE id=?", (uid,))
    if not u:
        email = ident["email"] or uid
        if db.q1("SELECT id FROM users WHERE email=?", (email,)):
            email = f"{email}#{ident['uid'][:8]}"
        db.insert("users", {"id": uid, "email": email, "pw_hash": "firebase", "totp_secret": new_totp_secret(),
                            "mfa_enabled": 0, "role": ident["role"], "created_at": db.now(),
                            "firebase_uid": ident["uid"], "unlimited": int(ident["unlimited"])})
        db.audit("system", uid, "user.created", uid, {"role": ident["role"]})
    else:
        db.update("users", "id", uid, role=ident["role"], unlimited=int(ident["unlimited"]), last_seen=db.now())
    return db.q1("SELECT * FROM users WHERE id=?", (uid,))


def principal(req: Request) -> dict | None:
    """Who is calling: Firebase ID token (aelio.live), session token, or session cookie."""
    tok = _bearer(req)
    if tok and tok.count(".") == 2:
        try:
            claims = firebase_auth.verify_token(tok)
        except firebase_auth.AuthError as e:
            raise HTTPError(401, str(e))
        ident = firebase_auth.identity(claims)
        if ident["role"] == "visitor":
            return {"user_id": None, "email": ident["email"], "role": "visitor", "unlimited": False,
                    "mfa_at": None, "csrf": None, "via": "firebase", "plan": None, "status": "active"}
        u = ensure_user(ident)
        return {"user_id": u["id"], "email": ident["email"], "role": ident["role"],
                "unlimited": ident["unlimited"], "mfa_at": u["mfa_at"], "csrf": None, "via": "firebase",
                "plan": u["plan"], "status": u["status"], "mfa_enabled": u["mfa_enabled"]}
    sess = get_session(tok) if tok else get_session(req.cookies.get(COOKIE))
    if not sess:
        return None
    u = db.q1("SELECT * FROM users WHERE id=?", (sess["user_id"],)) or {}
    return {**sess, "via": "session-bearer" if tok else "cookie", "unlimited": sess["role"] == "founder" or bool(u.get("unlimited")),
            "plan": u.get("plan", "free"), "status": u.get("status", "active"), "mfa_enabled": u.get("mfa_enabled", 1),
            "token": tok or req.cookies.get(COOKIE)}


def _mfa_ok(p: dict) -> bool:
    if not p.get("mfa_at"):
        return False
    if p["via"] == "firebase":
        return time.time() - p["mfa_at"] < get_settings().session_hours * 3600
    return True


def founder(req: Request, *, write: bool = False, allow_pending_mfa: bool = False) -> dict:
    p = principal(req)
    if not p or p["role"] != "founder":
        raise HTTPError(401 if not p else 403, "authentication required" if not p else "Studio Brain is founder-only")
    if not allow_pending_mfa and not _mfa_ok(p):
        raise HTTPError(401, "MFA required")
    if write and p["via"] == "cookie" and req.headers.get("x-csrf-token") != p["csrf"]:
        raise HTTPError(403, "missing or invalid CSRF token")
    return p


def member(req: Request, *, write: bool = False) -> dict:
    """My AELIO access: founder or member accounts."""
    p = principal(req)
    if not p:
        raise HTTPError(401, "authentication required")
    if p["role"] not in ("founder", "member"):
        raise HTTPError(403, "AELIO accounts are not open yet")
    if write and p["via"] == "cookie" and req.headers.get("x-csrf-token") != p["csrf"]:
        raise HTTPError(403, "missing or invalid CSRF token")
    return p


def mark_mfa(req: Request, p: dict) -> None:
    if p["via"] == "firebase":
        db.update("users", "id", p["user_id"], mfa_at=time.time())
    else:
        touch_mfa(p["token"])


def J(data, status: int = 200) -> JSONResponse:
    return JSONResponse(data, status_code=status)


def route(path: str, methods=("GET",)):
    def deco(fn):
        async def endpoint(req: Request):
            try:
                if not api_limiter.allow(ip_of(req)):
                    return J({"error": "rate limited"}, 429)
                return await fn(req)
            except HTTPError as e:
                return J({"error": e.msg}, e.status)
            except usage.UsageError as e:
                return J({"error": str(e), "code": e.code, **{k: v for k, v in e.info.items()}}, e.status)
            except (projects.PolicyError, deploy.ApprovalError, suites.SuiteTampered) as e:
                return J({"error": str(e)}, 403)
            except FileNotFoundError as e:
                return J({"error": f"not found: {e}"}, 404)
            except (ValueError, KeyError) as e:
                return J({"error": str(e)}, 400)
        ROUTES.append(Route(path, endpoint, methods=list(methods)))
        return fn
    return deco


ROUTES: list = []

# ------------------------------------------------------------------ auth


@route("/api/auth/config")
async def auth_config(req):
    return J({"mode": auth_mode(), "firebase": firebase_auth.web_config()})


def _cookie(resp: Response, token: str) -> None:
    resp.set_cookie(COOKIE, token, httponly=True, secure=get_settings().secure_cookies, samesite="strict",
                    max_age=get_settings().session_hours * 3600, path="/")


@route("/api/auth/firebase", ("POST",))
async def auth_firebase(req):
    if auth_mode() != "firebase":
        raise HTTPError(400, "Firebase sign-in is not enabled")
    ip = ip_of(req)
    if login_blocked(ip):
        raise HTTPError(429, "too many failed attempts; try again later")
    d = await body(req)
    try:
        claims = firebase_auth.verify_id_token(str(d.get("idToken", "")))
    except firebase_auth.AuthError as e:
        record_login(ip, False)
        db.audit("anonymous", None, "auth.firebase_denied", None, {"reason": str(e)}, ip)
        raise HTTPError(403, str(e))
    record_login(ip, True)
    email = (claims.get("email") or claims["sub"]).lower()
    u = db.q1("SELECT * FROM users WHERE email=?", (email,))
    if not u:
        uid = "fb_" + claims["sub"]
        db.insert("users", {"id": uid, "email": email, "pw_hash": "firebase", "totp_secret": new_totp_secret(),
                            "mfa_enabled": 0, "role": "founder", "created_at": db.now()})
        u = db.q1("SELECT * FROM users WHERE id=?", (uid,))
    token, csrf = create_session(u["id"], ip, req.headers.get("user-agent", ""), mfa_verified=False)
    db.audit("founder", u["id"], "auth.firebase_ok", None, {"email": email}, ip)
    out = {"ok": True, "csrf": csrf, "mfa": "enroll" if not u["mfa_enabled"] else "verify"}
    if not u["mfa_enabled"]:
        out.update(totp_secret=u["totp_secret"], totp_uri=totp_uri(u["totp_secret"], email))
    resp = J(out)
    _cookie(resp, token)
    return resp


@route("/api/auth/login", ("POST",))
async def auth_local(req):
    if auth_mode() != "local":
        raise HTTPError(400, "local password sign-in is disabled; use Firebase")
    ip = ip_of(req)
    if login_blocked(ip):
        raise HTTPError(429, "too many failed attempts; try again later")
    d = await body(req)
    u = db.q1("SELECT * FROM users WHERE email=?", (str(d.get("email", "")).lower(),))
    ok = bool(u) and verify_password(str(d.get("password", "")), u["pw_hash"]) and \
        verify_totp(u["totp_secret"], str(d.get("code", "")))
    record_login(ip, ok)
    if not ok:
        db.audit("anonymous", None, "auth.local_denied", None, {"email": d.get("email")}, ip)
        raise HTTPError(401, "invalid credentials or code")
    token, csrf = create_session(u["id"], ip, req.headers.get("user-agent", ""), mfa_verified=True)
    db.audit("founder", u["id"], "auth.local_ok", None, {}, ip)
    resp = J({"ok": True, "csrf": csrf, "mfa": "ok", "token": token, "role": u["role"]})
    _cookie(resp, token)
    return resp


@route("/api/auth/mfa", ("POST",))
async def auth_mfa(req):
    p = principal(req)
    if not p or p["role"] not in ("founder", "member"):
        raise HTTPError(401, "authentication required")
    if p["via"] == "cookie" and req.headers.get("x-csrf-token") != p["csrf"]:
        raise HTTPError(403, "missing or invalid CSRF token")
    d = await body(req)
    u = db.q1("SELECT * FROM users WHERE id=?", (p["user_id"],))
    if login_blocked(ip_of(req)):
        raise HTTPError(429, "too many failed attempts; try again later")
    if not verify_totp(u["totp_secret"], str(d.get("code", ""))):
        record_login(ip_of(req), False)
        raise HTTPError(401, "invalid code")
    if not u["mfa_enabled"]:
        db.update("users", "id", u["id"], mfa_enabled=1)
    mark_mfa(req, p)
    db.audit(p["role"], u["id"], "auth.mfa_ok", None, {}, ip_of(req))
    return J({"ok": True})


@route("/api/me")
async def api_me(req):
    """Where the Brain button should take this account."""
    p = principal(req)
    if not p:
        return J({"authenticated": False, "destination": "game"})
    out = {"authenticated": True, "email": p["email"], "role": p["role"], "unlimited": p["unlimited"],
           "destination": {"founder": "studiobrain", "member": "my"}.get(p["role"], "game")}
    if p["role"] == "founder":
        u = db.q1("SELECT * FROM users WHERE id=?", (p["user_id"],))
        out["mfa"] = "ok" if _mfa_ok(p) else ("verify" if u["mfa_enabled"] else "enroll")
        out["mfa_fresh"] = mfa_fresh(p) if p.get("mfa_at") else False
        if not u["mfa_enabled"]:
            out.update(totp_secret=u["totp_secret"], totp_uri=totp_uri(u["totp_secret"], p["email"]))
    return J(out)


@route("/api/auth/me")
async def me(req):
    sess = get_session(req.cookies.get(COOKIE))
    if not sess:
        return J({"authenticated": False, "mode": auth_mode()})
    return J({"authenticated": True, "email": sess["email"], "role": sess["role"], "csrf": sess["csrf"],
              "mfa_complete": bool(sess["mfa_at"]), "mfa_fresh": mfa_fresh(sess), "mode": auth_mode()})


@route("/api/auth/logout", ("POST",))
async def logout(req):
    tok = req.cookies.get(COOKIE)
    if tok:
        end_session(tok)
    resp = J({"ok": True})
    resp.delete_cookie(COOKIE, path="/")
    return resp

# ------------------------------------------------------------------ overview


def engine_readiness() -> list[dict]:
    out = []
    for fam, label in registry.MODEL_FAMILIES.items():
        ck = db.q1("""SELECT c.*, m.name FROM checkpoints c JOIN models m ON m.id=c.model_id WHERE m.family=?
                      ORDER BY c.created_at DESC LIMIT 1""", (fam,))
        if fam == "memory":
            out.append({"family": fam, "engine": label, "state": "deterministic",
                        "detail": "Retrieval, history and tool permissions are deterministic software; no learned model.",
                        "checkpoint": None})
            continue
        if not ck:
            out.append({"family": fam, "engine": label, "state": "untrained",
                        "detail": "No native checkpoint yet.", "checkpoint": None})
            continue
        m = db.loads(ck["metrics"], {})
        out.append({"family": fam, "engine": label, "state": f"prototype ({ck['status']})", "checkpoint": ck["id"],
                    "model": ck["name"], "metrics": m,
                    "detail": "Small model trained from random initialisation. Not production-capable."})
    return out


@route("/api/overview")
async def overview(req):
    founder(req)
    jobs_by = {r["status"]: r["n"] for r in db.q("SELECT status, COUNT(*) n FROM jobs GROUP BY status")}
    return J({
        "engines": engine_readiness(),
        "jobs": jobs_by,
        "running": db.q("SELECT id,kind,status,started_at FROM jobs WHERE status IN ('running','queued') ORDER BY created_at DESC LIMIT 10"),
        "recent_tests": db.q("SELECT id,suite,status,passed,failed,total,created_at,task_id FROM test_runs ORDER BY created_at DESC LIMIT 8"),
        "alerts": db.q("SELECT id,agent,severity,message,simulated,ts FROM guardian_events WHERE severity IN ('warning','critical') AND action_status='recommended' ORDER BY ts DESC LIMIT 8"),
        "pending_approvals": {
            "deployments": db.q("SELECT id,target,status,created_at FROM deployments WHERE status='awaiting_founder_review'"),
            "guardian_actions": db.q1("SELECT COUNT(*) n FROM guardian_events WHERE action_status='recommended' AND risk!='low'")["n"],
            "checkpoints": db.q("SELECT id,model_id,status FROM checkpoints WHERE status='evaluated' ORDER BY created_at DESC LIMIT 5"),
        },
        "experiments": db.q("SELECT id,kind,status,created_at,finished_at FROM jobs WHERE kind LIKE 'native.%' ORDER BY created_at DESC LIMIT 8"),
        "sandbox": db.kv_get("sandbox_selftest"),
        "first_run": db.kv_get("first_run_report"),
    })

# ------------------------------------------------------------------ native lab


@route("/api/models")
async def models(req):
    founder(req)
    evals = db.q("SELECT * FROM evaluations ORDER BY created_at DESC LIMIT 100")
    for e in evals:
        e["metrics"] = db.loads(e["metrics"], {}); e["details"] = db.loads(e["details"], {})
    return J({"models": registry.list_models(), "evaluations": evals})


@route("/api/datasets")
async def list_datasets(req):
    founder(req)
    rows = db.q("SELECT * FROM datasets ORDER BY created_at DESC")
    for r in rows:
        r["provenance"] = db.loads(r["provenance"], {}); r["validation"] = db.loads(r["validation"], {})
    return J({"datasets": rows, "license_allowlist": sorted(datasets.LICENSE_ALLOWLIST)})


@route("/api/datasets/builtin", ("POST",))
async def build_dataset(req):
    s = founder(req, write=True)
    name = (await body(req)).get("name")
    fn = {"psf-stdlib-docstrings": datasets.build_stdlib_docstrings, "psf-stdlib-code": datasets.build_stdlib_code,
          "uci-optdigits-8x8": datasets.register_digits}.get(name)
    if not fn:
        raise HTTPError(400, "unknown builtin dataset")
    row = fn()
    db.audit("founder", s["user_id"], "dataset.built", row["id"])
    return J({"dataset": {k: row[k] for k in ("id", "name", "version", "status", "training_eligible")}})


@route("/api/datasets/upload", ("POST",))
async def upload_dataset(req):
    s = founder(req, write=True)
    d = await body(req)
    text = str(d.get("text", ""))
    if len(text) > 20_000_000:
        raise HTTPError(413, "too large for inline upload")
    row = datasets.ingest_text(str(d["name"]), str(d.get("modality", "text")), str(d["license"]), str(d["source"]),
                               text, str(d.get("origin", "licensed-corpus")), s["email"])
    return J({"dataset": {k: row[k] for k in ("id", "name", "version", "status", "training_eligible")}})


@route("/api/train", ("POST",))
async def train(req):
    s = founder(req, write=True)
    d = await body(req)
    kind = d.get("kind", "text")
    if kind == "vision":
        jid = jobs.enqueue("native.train_vision", {"dataset_id": d["dataset_id"], "epochs": int(d.get("epochs", 40))},
                           priority=4, timeout_s=1800, created_by=s["user_id"])
        return J({"job_id": jid})
    steps = max(10, min(int(d.get("steps", 600)), 20000))
    cfg = {k: int(d[k]) for k in ("n_layer", "n_head", "n_embd", "block_size", "vocab_size") if k in d}
    jid = jobs.enqueue("native.train_lm", {
        "dataset_id": d["dataset_id"], "steps": steps, "config": cfg, "lr": float(d.get("lr", 3e-3)),
        "family": "code" if kind == "code" else "reasoning", "model_id": d.get("model_id"),
        "name": "aelio-native-code" if kind == "code" else "aelio-native-text",
        "sample_prompt": "def " if kind == "code" else "Return the"},
        priority=4, timeout_s=int(d.get("timeout_s", 7200)), created_by=s["user_id"],
        limits={"threads": 2})
    return J({"job_id": jid})


@route("/api/infer", ("POST",))
async def infer(req):
    founder(req, write=True)
    d = await body(req)
    from .native.train import infer as _infer
    return J(_infer(d["checkpoint_id"], str(d.get("prompt", ""))[:2000], int(d.get("max_new", 60)),
                    float(d.get("temperature", 0.8))))


@route("/api/checkpoints/{cid}/eval_code", ("POST",))
async def eval_code(req):
    s = founder(req, write=True)
    jid = jobs.enqueue("native.eval_code", {"checkpoint_id": req.path_params["cid"], "samples": 3}, priority=4,
                       timeout_s=1800, created_by=s["user_id"])
    return J({"job_id": jid})


@route("/api/checkpoints/{cid}/status", ("POST",))
async def ck_status(req):
    s = founder(req, write=True)
    st = (await body(req)).get("status")
    if st in ("approved", "production", "published") and not mfa_fresh(s):
        raise HTTPError(403, "re-enter your authenticator code to promote or publish a model")
    registry.set_checkpoint_status(req.path_params["cid"], st, s["user_id"])
    return J({"ok": True})


@route("/api/checkpoints/compare")
async def ck_compare(req):
    founder(req)
    return J(registry.compare(req.query_params["a"], req.query_params["b"]))

# ------------------------------------------------------------------ jobs


@route("/api/jobs")
async def list_jobs(req):
    founder(req)
    return J({"jobs": db.q("SELECT id,kind,status,priority,attempts,max_attempts,created_at,started_at,finished_at,error,critical,postponed_until FROM jobs ORDER BY created_at DESC LIMIT 200")})


@route("/api/jobs/{jid}")
async def get_job(req):
    founder(req)
    j = jobs.get(req.path_params["jid"])
    if not j:
        raise FileNotFoundError(req.path_params["jid"])
    return J(j)


@route("/api/jobs/{jid}/cancel", ("POST",))
async def cancel_job(req):
    s = founder(req, write=True)
    jobs.cancel(req.path_params["jid"])
    db.audit("founder", s["user_id"], "job.cancel", req.path_params["jid"])
    return J({"ok": True})

# ------------------------------------------------------------------ code studio


@route("/api/projects", ("GET", "POST"))
async def projects_route(req):
    if req.method == "GET":
        founder(req)
        return J({"projects": db.q("SELECT * FROM projects ORDER BY created_at DESC")})
    founder(req, write=True)
    d = await body(req)
    if d.get("remote_url"):
        return J({"project": projects.connect_git(d["remote_url"], d.get("name") or d["remote_url"].rsplit("/", 1)[-1],
                                                  bool(d.get("production", True)))})
    return J({"project": projects.create_from_sample(d.get("sample", "dashboard-benchmark"), d.get("name"))})


def _repo(req) -> Path:
    return Path(projects.get(req.path_params["pid"])["path"])


@route("/api/projects/{pid}/tree")
async def p_tree(req):
    founder(req)
    r = _repo(req)
    return J({"files": projects.tree(r), "branches": projects.branches(r),
              "head": projects.git(r, "rev-parse", "--abbrev-ref", "HEAD").strip()})


@route("/api/projects/{pid}/file", ("GET", "PUT"))
async def p_file(req):
    r = _repo(req)
    if req.method == "GET":
        founder(req)
        return J({"path": req.query_params["path"], "content": projects.read_file(r, req.query_params["path"])})
    s = founder(req, write=True)
    d = await body(req)
    head = projects.git(r, "rev-parse", "--abbrev-ref", "HEAD").strip()
    if projects.get(req.path_params["pid"])["is_production"] and not head.startswith("aelio/"):
        raise projects.PolicyError("switch to an aelio/* branch before editing a production project")
    projects.write_file(r, d["path"], str(d["content"]))
    db.audit("founder", s["user_id"], "file.edited", f"{req.path_params['pid']}:{d['path']}")
    return J({"ok": True, "changed": projects.changed_files(r)})


@route("/api/projects/{pid}/commit", ("POST",))
async def p_commit(req):
    s = founder(req, write=True)
    r = _repo(req)
    head = projects.git(r, "rev-parse", "--abbrev-ref", "HEAD").strip()
    if not head.startswith("aelio/"):
        raise projects.PolicyError("commits from the studio go to aelio/* branches only")
    sha = projects.commit_all(r, str((await body(req)).get("message", "Founder edit"))[:200], f"founder:{s['email']}")
    return J({"sha": sha})


@route("/api/projects/{pid}/search")
async def p_search(req):
    founder(req)
    return J({"hits": projects.search(_repo(req), req.query_params.get("q", ""))})


@route("/api/projects/{pid}/log")
async def p_log(req):
    founder(req)
    return J({"commits": projects.log(_repo(req))})


@route("/api/projects/{pid}/branch", ("POST",))
async def p_branch(req):
    founder(req, write=True)
    d = await body(req)
    r = _repo(req)
    if d.get("checkout") and d["checkout"] in projects.branches(r):
        projects.checkout(r, d["checkout"])
        return J({"head": d["checkout"]})
    return J({"head": projects.create_branch(r, d["name"])})


@route("/api/projects/{pid}/diff")
async def p_diff(req):
    founder(req)
    r = _repo(req)
    return J({"diff": projects.diff(r, req.query_params.get("base", "main"), req.query_params.get("head", "HEAD"))})


@route("/api/projects/{pid}/ai/propose", ("POST",))
async def p_ai_propose(req):
    """Ask the AI (through the Intelligence Gateway) for a change. Nothing is written until it's applied."""
    from .codestudio import assist
    from .intelligence.gateway import GatewayRefused
    s = founder(req, write=True)
    d = await body(req)
    try:
        return J(assist.propose(req.path_params["pid"], s, str(d.get("instruction", "")), list(d.get("paths") or [])))
    except GatewayRefused as e:
        return J({"error": e.message, "code": e.code}, e.status)
    except assist.AssistError as e:
        return J({"error": str(e)}, 422)


@route("/api/projects/{pid}/ai/proposals")
async def p_ai_list(req):
    founder(req)
    return J({"proposals": db.q("SELECT id,instruction,summary,status,created_at,decided_at FROM code_proposals WHERE project_id=? ORDER BY created_at DESC LIMIT 50",
                                (req.path_params["pid"],))})


@route("/api/projects/{pid}/ai/proposals/{prop}/{action}", ("POST",))
async def p_ai_decide(req):
    from .codestudio import assist
    s = founder(req, write=True)
    pid, prop, action = req.path_params["pid"], req.path_params["prop"], req.path_params["action"]
    try:
        if action == "apply":
            return J(assist.apply(pid, prop, s["user_id"]))
        if action == "reject":
            assist.reject(pid, prop, s["user_id"])
            return J({"ok": True})
    except assist.AssistError as e:
        return J({"error": str(e)}, 409)
    raise HTTPError(400, "action must be apply or reject")


@route("/api/projects/{pid}/diagnose")
async def p_diag(req):
    founder(req)
    return J(diagnose.diagnose(_repo(req)))


@route("/api/tasks", ("GET", "POST"))
async def tasks_route(req):
    if req.method == "GET":
        founder(req)
        rows = db.q("SELECT id,project_id,title,status,stage,mode,retry_count,branch,created_at,updated_at,result FROM tasks ORDER BY created_at DESC LIMIT 100")
        for r in rows:
            r["result"] = db.loads(r["result"])
        return J({"tasks": rows})
    s = founder(req, write=True)
    d = await body(req)
    c = orchestrator.TaskContract(instruction=d["instruction"], project_id=d["project_id"],
                                  mode=d.get("mode", "native"), max_retries=int(d.get("max_retries", 2)),
                                  acceptance_suite=d.get("acceptance_suite", "dashboard_benchmark_v1"))
    tid = orchestrator.create_task(d.get("title") or d["instruction"][:80], c)
    jid = jobs.enqueue("orchestrator.run_task", {"task_id": tid}, priority=3, timeout_s=1800, created_by=s["user_id"])
    return J({"task_id": tid, "job_id": jid})


@route("/api/tasks/{tid}")
async def task_get(req):
    founder(req)
    return J(orchestrator.task_detail(req.path_params["tid"]))

# ------------------------------------------------------------------ quality lab


@route("/api/quality/suites")
async def q_suites(req):
    founder(req)
    return J({"suites": suites.list_suites()})


@route("/api/quality/run", ("POST",))
async def q_run(req):
    s = founder(req, write=True)
    d = await body(req)
    p = projects.get(d["project_id"])
    jid = jobs.enqueue("quality.run_suite", {"suite": d["suite"], "workspace": p["path"], "project_id": p["id"]},
                       priority=3, timeout_s=600, created_by=s["user_id"])
    return J({"job_id": jid})


@route("/api/quality/runs")
async def q_runs(req):
    founder(req)
    return J({"runs": db.q("SELECT id,task_id,suite,project_id,status,passed,failed,total,duration_s,created_at,suite_sha256 FROM test_runs ORDER BY created_at DESC LIMIT 200")})


@route("/api/quality/runs/{rid}")
async def q_run_get(req):
    founder(req)
    r = db.q1("SELECT * FROM test_runs WHERE id=?", (req.path_params["rid"],))
    if not r:
        raise FileNotFoundError(req.path_params["rid"])
    r["results"] = db.loads(r["results"], []); r["sandbox"] = db.loads(r["sandbox"], {})
    return J(r)

# ------------------------------------------------------------------ voice lab


@route("/api/voices")
async def voices_list(req):
    founder(req)
    return J({"voices": voice.list_voices(),
              "synth": db.q("SELECT * FROM voice_synth ORDER BY created_at DESC LIMIT 50"),
              "speech_datasets": db.q("SELECT id,name,version,license,status,training_eligible FROM datasets WHERE modality='speech'")})


@route("/api/voices/{vid}", ("PUT",))
async def voice_update(req):
    s = founder(req, write=True)
    d = await body(req)
    return J(voice.update_profile(req.path_params["vid"], d.get("description"), d.get("params"), s["user_id"]))


@route("/api/voices/{vid}/synthesize", ("POST",))
async def voice_synth(req):
    s = founder(req, write=True)
    return J(voice.submit_synthesis(req.path_params["vid"], str((await body(req)).get("text", ""))[:2000], s["user_id"]))


@route("/api/voices/{vid}/approve", ("POST",))
async def voice_approve(req):
    s = founder(req, write=True)
    if not mfa_fresh(s):
        raise HTTPError(403, "re-enter your authenticator code to approve a voice")
    return J(voice.approve(req.path_params["vid"], s["user_id"]))

# ------------------------------------------------------------------ operations / guardians


@route("/api/guardians")
async def g_list(req):
    founder(req)
    ev = db.q("SELECT * FROM guardian_events ORDER BY ts DESC LIMIT 100")
    for e in ev:
        for k in ("recommendation", "conditions", "result"):
            e[k] = db.loads(e[k])
    hist = db.q("SELECT ts,metric,value,simulated FROM telemetry WHERE ts>? AND metric IN ('cpu_temp_c','cpu_util_pct','mem_used_pct','gpu0_temp_c','gpu0_power_w') ORDER BY ts",
                (time.time() - 86400,))
    return J({"agents": [dict(a, capabilities=db.loads(a["capabilities"]), tools=db.loads(a["tools"]),
                              permissions=db.loads(a["permissions"]))
                         for a in db.q("SELECT * FROM agents WHERE division='Green Guardians'")],
              "events": ev, "history": hist, "mode": "recommendation-only", "thresholds": guardians.THRESH})


@route("/api/guardians/cycle", ("POST",))
async def g_cycle(req):
    founder(req, write=True)
    return J(guardians.run_cycle())


@route("/api/guardians/simulate", ("POST",))
async def g_sim(req):
    founder(req, write=True)
    return J(guardians.synthetic_thermal_scenario())


@route("/api/guardians/events/{eid}/decide", ("POST",))
async def g_decide(req):
    s = founder(req, write=True)
    return J(guardians.decide(req.path_params["eid"], bool((await body(req)).get("approve")), s["user_id"]))


@route("/api/operations")
async def operations(req):
    founder(req)
    import psutil
    import shutil as _sh
    latest = {r["metric"]: r for r in db.q("""SELECT t.* FROM telemetry t JOIN (SELECT metric, MAX(ts) m FROM telemetry
                                                WHERE simulated=0 GROUP BY metric) x ON x.metric=t.metric AND x.m=t.ts""")}
    du = _sh.disk_usage(str(get_settings().data_dir))
    api = db.q("""SELECT route, COUNT(*) n, AVG(latency_ms) avg_ms, SUM(CASE WHEN status>=400 THEN 1 ELSE 0 END) errors
                  FROM api_usage WHERE ts>? GROUP BY route ORDER BY n DESC""", (time.time() - 86400,))
    train = db.q("""SELECT id,kind,status,started_at,finished_at,error FROM jobs WHERE kind LIKE 'native.%'
                    ORDER BY created_at DESC LIMIT 20""")
    return J({
        "infrastructure": {"host": os.uname().nodename, "cpus": psutil.cpu_count(), "mem_gb": round(psutil.virtual_memory().total / 1e9, 1),
                           "disk_free_gb": round(du.free / 1e9, 1), "sandbox_backend": sandbox.backend(),
                           "gpus": [] if not _sh.which("nvidia-smi") else "see GPU telemetry",
                           "telemetry": latest},
        "gpu": {"available": bool(_sh.which("nvidia-smi")),
                "note": None if _sh.which("nvidia-smi") else "No GPU on this host. Native training runs on CPU (NumPy backend)."},
        "training": train,
        "api": api,
        "deployments": db.q("SELECT id,target,status,created_at,approved_at FROM deployments ORDER BY created_at DESC LIMIT 20"),
        "finance": {"infrastructure_cost": None, "api_cost": None,
                    "note": "Data unavailable: no billing integration is connected. External AI usage is not billed through AELIO.",
                    "storage_bytes": sum(f.stat().st_size for f in get_settings().artifacts_dir.rglob("*") if f.is_file())},
    })

# ------------------------------------------------------------------ deployments


@route("/api/deployments", ("GET", "POST"))
async def deployments(req):
    if req.method == "GET":
        founder(req)
        return J({"deployments": [deploy.get(d["id"]) for d in db.q("SELECT id FROM deployments ORDER BY created_at DESC LIMIT 50")]})
    s = founder(req, write=True)
    d = await body(req)
    return J({"deployment_id": deploy.request(d.get("project_id"), d.get("task_id"), d.get("target", "preview"), "founder")})


@route("/api/deployments/{did}/approve", ("POST",))
async def dep_approve(req):
    s = founder(req, write=True)
    d = await body(req)
    u = db.q1("SELECT * FROM users WHERE id=?", (s["user_id"],))
    fresh = mfa_fresh(s)
    if d.get("code") and verify_totp(u["totp_secret"], str(d["code"])):
        mark_mfa(req, s); fresh = True
    return J(deploy.approve_production(req.path_params["did"], s["user_id"], fresh, "founder"))


@route("/api/deployments/{did}/reject", ("POST",))
async def dep_reject(req):
    s = founder(req, write=True)
    return J(deploy.reject(req.path_params["did"], s["user_id"]))

# ------------------------------------------------------------------ agents / settings


@route("/api/agents")
async def agents(req):
    founder(req)
    rows = db.q("SELECT * FROM agents ORDER BY division, name")
    for r in rows:
        for k in ("capabilities", "tools", "permissions"):
            r[k] = db.loads(r[k])
    return J({"agents": rows})


@route("/api/apps", ("GET", "POST"))
async def apps(req):
    if req.method == "GET":
        founder(req)
        return J({"apps": gateway.list_apps(), "ecosystem": gateway.ECOSYSTEM, "scopes": sorted(gateway.SCOPES)})
    s = founder(req, write=True)
    d = await body(req)
    row, raw = gateway.register_app(d["name"], d["slug"], d.get("scopes", ["status:read"]), int(d.get("quota_per_day", 1000)))
    return J({"app": {k: row[k] for k in ("id", "name", "slug", "key_prefix")}, "api_key_shown_once": raw})


@route("/api/settings")
async def settings_route(req):
    s = founder(req)
    return J({"auth": {"mode": auth_mode(), "founder": s["email"], "mfa_fresh_minutes": get_settings().mfa_fresh_minutes,
                       "session_hours": get_settings().session_hours,
                       "founder_allowlist_configured": bool(firebase_auth.allowlist()[0] or firebase_auth.allowlist()[1])},
              "secrets": list_secret_names(),
              "policies": {"production_deploy": "founder + fresh MFA", "agent_self_permissions": "impossible (no route)",
                           "protected_suites": "hash-locked; relock only via server CLI",
                           "sandbox": sandbox.backend(), "guardians": "recommendation-only",
                           "external_ai": "none connected; external reference artifacts are labelled and excluded from training"},
              "integrations": {"firebase": bool(firebase_auth.project_id()), "github_token": "GITHUB_TOKEN" in list_secret_names()}})


@route("/api/secrets", ("POST",))
async def secrets_route(req):
    s = founder(req, write=True)
    if not mfa_fresh(s):
        raise HTTPError(403, "re-enter your authenticator code to change secrets")
    d = await body(req)
    if d["name"] in list_secret_names() and not d.get("overwrite"):
        raise HTTPError(409, "secret exists; pass overwrite=true to replace it")
    put_secret(d["name"], str(d["value"]))
    db.audit("founder", s["user_id"], "secret.set", d["name"])
    return J({"ok": True, "secrets": list_secret_names()})


@route("/api/audit")
async def audit_route(req):
    founder(req)
    return J({"entries": db.q("SELECT * FROM audit_log ORDER BY id DESC LIMIT 300")})


@route("/api/security/selftest", ("POST",))
async def selftest(req):
    founder(req, write=True)
    r = sandbox.self_test()
    db.kv_set("sandbox_selftest", {**r, "ts": db.now()})
    return J(r)

# ------------------------------------------------------------------ gateway (/v1) for Grooveville apps


def gw(path: str, scope: str, methods=("GET",)):
    def deco(fn):
        async def endpoint(req: Request):
            t0 = time.time()
            auth = req.headers.get("authorization", "")
            app = gateway.authenticate(auth[7:] if auth.lower().startswith("bearer ") else None)
            status = 200
            try:
                if not app:
                    status = 401; return J({"error": "invalid or missing application key"}, 401)
                if scope not in app["scopes"]:
                    status = 403; return J({"error": f"missing scope {scope}"}, 403)
                if not gateway.within_quota(app) or not gw_limiter.allow(app["id"]):
                    status = 429; return J({"error": "quota exceeded"}, 429)
                resp = await fn(req, app)
                status = resp.status_code
                return resp
            except FileNotFoundError:
                status = 404; return J({"error": "not found"}, 404)
            finally:
                gateway.record(app["id"] if app else None, path, status, (time.time() - t0) * 1000)
        ROUTES.append(Route(path, endpoint, methods=list(methods)))
        return fn
    return deco


@gw("/v1/status", "status:read")
async def v1_status(req, app):
    return J({"service": "aelio-native-gateway", "app": app["slug"], "engines": engine_readiness()})


@gw("/v1/voices", "voices:read")
async def v1_voices(req, app):
    return J({"voices": [{k: v[k] for k in ("voice_id", "name", "description", "use_cases", "status", "can_synthesize")}
                         for v in voice.list_voices()]})


@gw("/v1/voices/{vid}/synthesize", "voices:synthesize", ("POST",))
async def v1_synth(req, app):
    v = db.q1("SELECT * FROM voices WHERE voice_id=?", (req.path_params["vid"],))
    if not v:
        raise FileNotFoundError
    if v["status"] != "approved":
        return J({"voice_id": v["voice_id"], "status": "awaiting_training", "audio": None,
                  "message": "This AELIO voice has no approved native speech model yet."}, 409)
    return J(voice.submit_synthesis(v["voice_id"], str((await body(req)).get("text", "")), f"app:{app['slug']}"), 202)


def _published() -> list[dict]:
    return db.q("""SELECT c.id checkpoint_id, m.name, m.family, m.engine, c.metrics, c.approved_at published_at
                   FROM checkpoints c JOIN models m ON m.id=c.model_id WHERE c.status='published'
                   ORDER BY c.approved_at DESC""")


@gw("/v1/models", "models:read")
async def v1_models(req, app):
    return J({"models": [dict(r, metrics=db.loads(r["metrics"], {})) for r in _published()]})


@gw("/v1/models/{cid}/infer", "models:infer", ("POST",))
async def v1_infer(req, app):
    c = db.q1("SELECT * FROM checkpoints WHERE id=? AND status='published'", (req.path_params["cid"],))
    if not c:
        raise FileNotFoundError
    from .native.train import infer as _infer
    d = await body(req)
    return J(_infer(c["id"], str(d.get("prompt", ""))[:1000], min(int(d.get("max_new", 60)), 128)))

# ------------------------------------------------------------------ public read-only (for aelio.live)


async def public_models(req):
    resp = J({"models": [dict(r, metrics=db.loads(r["metrics"], {})) for r in _published()],
              "note": "Models listed here were published by the founder. All are AELIO Native, trained from random initialisation."})
    origin = req.headers.get("origin", "")
    if origin in ("https://aelio.live", "https://www.aelio.live"):
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Vary"] = "Origin"
    return resp

ROUTES.append(Route("/public/v1/models", public_models, methods=["GET"]))
ROUTES.append(Route("/api/public/models", public_models, methods=["GET"]))   # same-origin path used by aelio.live

# ------------------------------------------------------------------ static web app


async def spa(req):
    idx = WEB_DIST / "index.html"
    if not idx.exists():
        return Response("Studio web app not built. Run: node web/build.mjs", 503)
    return FileResponse(idx)


async def api_404(req):
    return J({"error": "not found"}, 404)


CSP = ("default-src 'self'; script-src 'self' https://www.gstatic.com https://apis.google.com; "
       "connect-src 'self' https://*.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com; "
       "frame-src https://*.firebaseapp.com https://accounts.google.com; img-src 'self' data:; "
       "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; "
       "frame-ancestors 'none'; base-uri 'none'; form-action 'self'")


def cors_origins() -> set[str]:
    return {o.strip().rstrip("/") for o in os.environ.get(
        "AELIO_CORS_ORIGINS", "https://aelio.live,https://www.aelio.live").split(",") if o.strip()}


class CORS:
    """Lets pages on aelio.live call the engine. Auth uses Bearer tokens, never cookies, cross-site."""

    PATHS = ("/api/", "/v1/", "/public/")

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope.get("path", "").startswith(self.PATHS):
            return await self.app(scope, receive, send)
        origin = dict(scope.get("headers") or []).get(b"origin", b"").decode()
        allowed = origin.rstrip("/") in cors_origins()
        extra = [(b"access-control-allow-origin", origin.encode()), (b"vary", b"Origin"),
                 (b"access-control-allow-headers", b"authorization, content-type, x-csrf-token"),
                 (b"access-control-allow-methods", b"GET, POST, PUT, DELETE, OPTIONS"),
                 (b"access-control-max-age", b"600")] if allowed else []
        if scope["method"] == "OPTIONS":
            await send({"type": "http.response.start", "status": 204 if allowed else 403, "headers": extra})
            return await send({"type": "http.response.body", "body": b""})

        async def send_wrapper(message):
            if message["type"] == "http.response.start" and allowed:
                h = [(k, v) for k, v in message.get("headers", []) if not k.lower().startswith(b"access-control-")
                     and k.lower() != b"vary"]
                message = {**message, "headers": h + extra}
            await send(message)
        await self.app(scope, receive, send_wrapper)


class ProxyGuard:
    """When AELIO_PROXY_SECRET is set, API requests must come through aelio.live's same-origin proxy.

    The proxy (Cloudflare Pages Function, `functions/api/`) adds `x-aelio-proxy-secret`.
    Anything else reaching the engine directly is refused, so the engine has no public entry of its own.
    """
    PATHS = ("/api/", "/v1/", "/public/", "/webhooks/")

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        secret = os.environ.get("AELIO_PROXY_SECRET", "")
        if scope["type"] == "http" and secret and scope.get("path", "").startswith(self.PATHS):
            got = dict(scope.get("headers") or []).get(b"x-aelio-proxy-secret", b"").decode()
            if not hmac.compare_digest(got, secret):
                body = b'{"error":"not found"}'
                await send({"type": "http.response.start", "status": 404,
                            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
                return await send({"type": "http.response.body", "body": body})
            scope["aelio_proxied"] = True
        return await self.app(scope, receive, send)


class SecurityHeaders:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope.get("path", "")

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                h = [(k, v) for k, v in message.get("headers", []) if k.lower() not in {
                    b"x-frame-options", b"x-content-type-options", b"referrer-policy",
                    b"strict-transport-security", b"permissions-policy", b"content-security-policy"}]
                h += [(b"content-security-policy", CSP.encode()), (b"x-frame-options", b"DENY"),
                      (b"x-content-type-options", b"nosniff"), (b"referrer-policy", b"no-referrer"),
                      (b"strict-transport-security", b"max-age=31536000; includeSubDomains"),
                      (b"permissions-policy", b"camera=(self), microphone=(self), display-capture=(self)")]
                if path.startswith(("/api", "/v1")):
                    h.append((b"cache-control", b"no-store"))
                message = {**message, "headers": h}
            await send(message)
        await self.app(scope, receive, send_wrapper)


from . import routes_brain as _routes_brain  # noqa: E402,F401  (registers My AELIO + economy routes)
from .intelligence import routes as _routes_ai  # noqa: E402,F401  (registers AI chat + Intelligence dashboard routes)
from . import routes_engine as _routes_engine  # noqa: E402,F401  (health + founder engine overview)


def create_app(start_worker: bool | None = None) -> Starlette:
    import contextlib
    s = get_settings()
    voice.seed(); guardians.seed_agents(); usage.seed()
    from .intelligence import settings as _ai_settings
    _ai_settings.seed_models()
    routes = list(ROUTES) + [Route("/api/{rest:path}", api_404), Route("/v1/{rest:path}", api_404)]
    if (WEB_DIST / "assets").exists():
        routes.append(Mount("/assets", StaticFiles(directory=WEB_DIST / "assets")))
    routes += [Route("/", spa), Route("/{rest:path}", spa)]
    run_workers = s.start_worker if start_worker is None else start_worker

    @contextlib.asynccontextmanager
    async def lifespan(app):
        workers = [jobs.Worker() for _ in range(max(1, s.worker_threads))] if run_workers else []
        for w in workers:
            w.start()
        yield
        for w in workers:
            w.stop.set()

    return Starlette(routes=routes, lifespan=lifespan,
                     middleware=[Middleware(ProxyGuard), Middleware(TrustedHostMiddleware, allowed_hosts=s.allowed_hosts),
                                 Middleware(SecurityHeaders), Middleware(CORS)])
