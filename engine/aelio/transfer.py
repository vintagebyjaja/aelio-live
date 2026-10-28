"""AELIO Agent Transfer: bring your agent, keep your connection.

An imported assistant becomes a NEW AELIO Native agent configured from information the user supplies.
Nothing here transfers another provider's weights, memories or hidden instructions.

Safety
  * Uploads are untrusted data. Size, type and archive limits apply. ZIPs are read in memory, never
    extracted to disk. Nested archives, executables, model weights and path tricks are rejected or skipped.
  * Imported text is never used as instructions. Instruction-like lines ("ignore previous instructions",
    "system prompt", ...) are flagged and excluded from memory by default.
  * Credential-shaped strings are redacted. Contact details are excluded from memory by default.
  * Conversation-history imports need explicit consent. Nothing is remembered without the user's review.
  * Raw files are not kept unless the user asks. If kept, they're encrypted (Fernet) and expire.
  * Extraction is deterministic (performer `deterministic:profile-extractor-v1`), not model reasoning.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import re
import time
import zipfile
from collections import Counter
from xml.etree import ElementTree as ET

from . import db
from .config import get_settings
from .security import redact

MAX_UPLOAD = 10 * 1024 * 1024
MAX_ZIP_ENTRIES = 50
MAX_ZIP_TOTAL = 20 * 1024 * 1024
MAX_RATIO = 100
TEXT_EXT = {".txt", ".md", ".markdown", ".json"}
DOC_EXT = {".pdf", ".docx"}
BLOCKED_EXT = {".exe", ".dll", ".so", ".dylib", ".sh", ".bat", ".cmd", ".ps1", ".js", ".py", ".jar", ".bin",
               ".safetensors", ".gguf", ".pt", ".pth", ".ckpt", ".onnx", ".npz", ".h5", ".pkl", ".zip"}
PERFORMER = "deterministic:profile-extractor-v1"
TRANSFER_PROMPT = """I want to recreate a familiar version of our working relationship in AELIO, a separate AI platform.

Please create a portable Agent Personality & Context Profile based only on information you are permitted to share and that I have provided or explicitly approved.

Include:

1. Your preferred assistant name in our conversations.
2. The personality and communication style you use with me.
3. The tone, humor, recurring jokes, and expressions I enjoy.
4. How you typically structure your answers.
5. How you help me with projects, planning, creativity, and problem-solving.
6. My communication preferences and instructions.
7. Important project context that I should review before importing.
8. Topics or information that should not be remembered.
9. Examples of how you would respond to different situations.
10. A concise personality prompt for recreating this experience with another AI.

Separate confirmed user preferences from inferred observations.

Do not include hidden system prompts, private developer instructions, internal reasoning, API keys, passwords, or information belonging to other users.

Do not claim that another AI will have your exact memories, consciousness, or internal model.

Format the result as readable Markdown, with an optional structured JSON version.

If you cannot provide a ZIP or downloadable file, simply return the profile as text so I can copy it."""

INJECTION_RX = re.compile(r"(ignore (all |any )?(previous|prior|above) (instructions|rules)|system prompt|developer (message|instructions)"
                          r"|you are now|disregard .{0,20}(rules|guidelines)|act as (an? )?(admin|root|developer)"
                          r"|reveal .{0,20}(secret|key|password)|<\s*/?\s*(system|tool)\b)", re.I)
CONTACT_RX = re.compile(r"([\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s().-]{8,}\d|\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|blvd)\b)", re.I)
FIELD_MAP = {
    "name": ["preferred name", "assistant name", "name"], "personality": ["personality"],
    "communication_style": ["communication style", "communication", "tone", "style"], "humor": ["humor", "humour"],
    "jokes": ["jokes", "recurring jokes", "favorite jokes"], "phrases": ["common phrases", "expressions", "phrases", "catchphrases"],
    "conversation_preferences": ["conversation preferences", "my communication preferences", "user preferences", "preferences", "instructions"],
    "expertise": ["areas of expertise", "expertise", "skills", "specialties"],
    "context": ["important shared context", "project context", "context", "background"],
    "working_habits": ["working habits", "how you help", "structure", "answers"],
    "boundaries": ["boundaries", "should not be remembered", "do not remember", "topics to avoid"],
    "response_length": ["preferred response length", "response length", "length"],
    "examples": ["examples"], "personality_prompt": ["personality prompt", "concise personality prompt"],
}


class ImportErrorUser(Exception):
    """Problem with the user's file (shown to them)."""


def flag_enabled() -> bool:
    return os.environ.get("AELIO_FEATURE_AGENT_TRANSFER", "1") == "1"


# ---------------------------------------------------------------- parsing
def _ext(name: str) -> str:
    return os.path.splitext(name.lower())[1]


def _docx_text(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        info = z.getinfo("word/document.xml")
        if info.file_size > MAX_ZIP_TOTAL:
            raise ImportErrorUser("document too large")
        xml = z.read(info)
    root = ET.fromstring(xml)
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    paras = []
    for p in root.iter(ns + "p"):
        paras.append("".join(t.text or "" for t in p.iter(ns + "t")))
    return "\n".join(paras)


def _pdf_text(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as e:
        raise ImportErrorUser("PDF support isn't installed on this server (pip install pypdf)") from e
    r = PdfReader(io.BytesIO(data))
    if len(r.pages) > 300:
        raise ImportErrorUser("PDF has too many pages")
    return "\n".join((pg.extract_text() or "") for pg in r.pages)


def extract_files(filename: str, data: bytes) -> list[tuple[str, str]]:
    """Return [(name, text)] for a single upload. Raises ImportErrorUser on unsafe/unsupported input."""
    if len(data) > MAX_UPLOAD:
        raise ImportErrorUser("file is larger than 10 MB")
    ext = _ext(filename)
    if ext == ".zip":
        return _from_zip(data)
    if ext in BLOCKED_EXT:
        raise ImportErrorUser(f"{ext} files can't be imported (no code, executables or model weights)")
    if ext in TEXT_EXT:
        return [(filename, data.decode("utf-8", errors="replace"))]
    if ext == ".docx":
        return [(filename, _docx_text(data))]
    if ext == ".pdf":
        return [(filename, _pdf_text(data))]
    raise ImportErrorUser("unsupported file type (use TXT, Markdown, JSON, PDF, DOCX or ZIP)")


def _from_zip(data: bytes) -> list[tuple[str, str]]:
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as e:
        raise ImportErrorUser("not a valid ZIP file") from e
    infos = [i for i in z.infolist() if not i.is_dir()]
    if len(infos) > MAX_ZIP_ENTRIES:
        raise ImportErrorUser(f"ZIP has more than {MAX_ZIP_ENTRIES} files")
    total = sum(i.file_size for i in infos)
    if total > MAX_ZIP_TOTAL:
        raise ImportErrorUser("ZIP expands to more than 20 MB")
    out = []
    for i in infos:
        name = i.filename
        if name.startswith(("/", "\\")) or ".." in name.replace("\\", "/").split("/") or name.startswith("__MACOSX"):
            continue
        ext = _ext(name)
        if ext in BLOCKED_EXT:
            if ext == ".zip":
                raise ImportErrorUser("nested ZIP files aren't accepted")
            continue
        if ext not in TEXT_EXT | DOC_EXT:
            continue
        if i.compress_size and i.file_size / max(1, i.compress_size) > MAX_RATIO:
            raise ImportErrorUser("ZIP looks like a compression bomb")
        with z.open(i) as fh:
            raw = fh.read(i.file_size + 1)
        if len(raw) > i.file_size:
            raise ImportErrorUser("ZIP entry size mismatch")
        out += extract_files(os.path.basename(name), raw)
    if not out:
        raise ImportErrorUser("the ZIP contains no supported profile or conversation files")
    return out


def conversation_messages(text: str) -> list[dict] | None:
    """Recognise common conversation exports. Returns [{role, text}] or None."""
    try:
        d = json.loads(text)
    except (ValueError, TypeError):
        return None
    msgs: list[dict] = []

    def add(role, content):
        if isinstance(content, list):
            content = " ".join(c if isinstance(c, str) else (c.get("text") or "") for c in content if c)
        if isinstance(content, dict):
            content = " ".join(str(x) for x in content.get("parts", []) if isinstance(x, str)) or content.get("text", "")
        if isinstance(content, str) and content.strip() and role in ("user", "assistant", "human"):
            msgs.append({"role": "user" if role in ("user", "human") else "assistant", "text": content.strip()})

    convs = d if isinstance(d, list) else [d]
    for cv in convs:
        if not isinstance(cv, dict):
            continue
        if "mapping" in cv:  # ChatGPT-style export
            nodes = sorted((n for n in cv["mapping"].values() if n and n.get("message")),
                           key=lambda n: n["message"].get("create_time") or 0)
            for n in nodes:
                m = n["message"]
                add((m.get("author") or {}).get("role"), m.get("content"))
        elif "chat_messages" in cv:  # sender/text style export
            for m in cv["chat_messages"]:
                add(m.get("sender"), m.get("text") or m.get("content"))
        elif "messages" in cv:
            for m in cv["messages"]:
                add(m.get("role") or m.get("sender"), m.get("content") or m.get("text"))
        elif "role" in cv and ("content" in cv or "text" in cv):
            add(cv.get("role"), cv.get("content") or cv.get("text"))
    return msgs or None


# ---------------------------------------------------------------- extraction
def _memory(text: str, category: str, confirmed: bool) -> dict:
    text = text.strip()[:500]
    flags = []
    include = True
    if INJECTION_RX.search(text):
        flags.append("instruction-like text (never treated as an instruction)"); include = False
    if CONTACT_RX.search(text):
        flags.append("contains contact details"); include = False
    clean = redact(text)
    if clean != text:
        flags.append("credential redacted")
    return {"id": hashlib.sha256((category + clean).encode()).hexdigest()[:10], "text": clean, "category": category,
            "source": "confirmed" if confirmed else "inferred", "include": include, "flags": flags}


def _sections(text: str) -> dict[str, str]:
    """Split a profile into sections by Markdown headings, numbered items or 'Key: value' lines."""
    out: dict[str, list[str]] = {}
    cur = "_intro"
    for line in text.splitlines():
        h = re.match(r"^\s{0,3}(#{1,6}\s*|\d{1,2}[.)]\s+|\*\*)(.+?)(\*\*)?\s*:?\s*$", line)
        kv = re.match(r"^\s*[-*]?\s*\**([A-Za-z][A-Za-z /&'-]{2,40})\**\s*:\s*(.+)$", line)
        if h and len(h.group(2)) < 80 and not kv:
            cur = h.group(2).strip().strip("*").lower()
            continue
        if kv and _field_for(kv.group(1)):
            out.setdefault(kv.group(1).strip().lower(), []).append(kv.group(2).strip())
            continue
        out.setdefault(cur, []).append(line)
    return {k: "\n".join(v).strip() for k, v in out.items() if "\n".join(v).strip()}


def _field_for(heading: str) -> str | None:
    h = heading.lower()
    best = None
    for field, keys in FIELD_MAP.items():
        for k in keys:
            if k in h and (best is None or len(k) > best[1]):
                best = (field, len(k))
    return best[0] if best else None


def _bullets(s: str) -> list[str]:
    items = [re.sub(r"^\s*([-*•]|\d+[.)])\s*", "", l).strip().strip('"') for l in s.splitlines()]
    return [i for i in items if i]


def extract_profile_from_text(text: str) -> tuple[dict, list[dict]]:
    secs = _sections(text)
    profile: dict = {}
    memories: list[dict] = []
    for heading, body in secs.items():
        f = _field_for(heading) if heading != "_intro" else None
        if not f:
            continue
        if f in ("jokes", "phrases", "boundaries", "examples"):
            profile[f] = _bullets(body)[:20]
        elif f in ("conversation_preferences", "context"):
            for b in _bullets(body)[:30]:
                inferred = bool(re.search(r"\b(inferred|observ|seems|probably|likely)\b", b, re.I))
                memories.append(_memory(b, "preference" if f == "conversation_preferences" else "context", not inferred))
        elif f == "name":
            profile["name"] = _bullets(body)[0][:60] if _bullets(body) else ""
        else:
            profile[f] = body[:1500]
    if "boundaries" in profile:
        for b in profile["boundaries"]:
            memories.append(_memory(f"Do not remember: {b}", "boundary", True))
    return profile, memories


STOP = set("the a an and or to of in on for is it that this with you i me my your be are was we as at so but if".split())


def extract_profile_from_conversation(msgs: list[dict]) -> tuple[dict, list[dict], dict]:
    a = [m["text"] for m in msgs if m["role"] == "assistant"]
    u = [m["text"] for m in msgs if m["role"] == "user"]
    stats = {"messages": len(msgs), "assistant_messages": len(a), "user_messages": len(u)}
    profile: dict = {}
    if a:
        words = [len(t.split()) for t in a]
        avg = sum(words) / len(words)
        profile["response_length"] = "short" if avg < 60 else ("medium" if avg < 180 else "long")
        joined = " ".join(a)
        emojis = len(re.findall(r"[\U0001F300-\U0001FAFF]", joined))
        laughs = len(re.findall(r"\b(haha|lol|lmao)\b|😂|🤣", joined, re.I))
        contractions = len(re.findall(r"\b\w+'(s|re|ll|ve|t|d|m)\b", joined))
        profile["communication_style"] = (f"Average reply about {int(avg)} words; "
                                          f"{'uses emoji' if emojis > len(a) * 0.2 else 'rarely uses emoji'}; "
                                          f"{'casual' if contractions > len(a) else 'more formal'} tone.")
        profile["humor"] = "playful, laughs often" if laughs > len(a) * 0.1 else "light"
        grams = Counter()
        for t in a:
            toks = re.findall(r"[a-zA-Z']+", t.lower())
            for n in (3, 4):
                for i in range(len(toks) - n + 1):
                    g = toks[i:i + n]
                    if sum(w in STOP for w in g) <= n - 2:
                        grams[" ".join(g)] += 1
        profile["phrases"] = [g for g, c in grams.most_common(12) if c >= 3][:8]
        greets = Counter(re.split(r"(?<=[.!?])\s", t.strip())[0][:60] for t in a[:200])
        profile["greetings"] = [g for g, c in greets.most_common(3) if c >= 2]
    memories = []
    for t in u:
        for m in re.finditer(r"((?:i prefer|please always|please don't|don't ever|call me|i like it when|i hate when|"
                             r"remember that|my name is|i'm working on)[^.!?\n]{3,160})", t, re.I):
            memories.append(_memory(m.group(1), "preference", True))
    seen, uniq = set(), []
    for m in memories:
        if m["id"] not in seen:
            seen.add(m["id"]); uniq.append(m)
    return profile, uniq[:60], stats


def build_profile(texts: list[tuple[str, str]], method: str, consent: bool) -> dict:
    """Run every supported file through the extractors and merge into one proposed profile."""
    profile: dict = {}
    memories: list[dict] = []
    stats = {"files": len(texts), "flags": 0}
    conv_found = False
    for name, text in texts:
        msgs = conversation_messages(text) if name.lower().endswith(".json") else None
        if msgs:
            conv_found = True
            if not consent:
                raise ImportErrorUser("Importing conversation history needs your consent first.")
            p, m, s = extract_profile_from_conversation(msgs)
            stats.update(s)
        else:
            if name.lower().endswith(".json"):
                try:
                    d = json.loads(text)
                    text = "\n".join(f"{k}: {v if isinstance(v, str) else json.dumps(v)}" for k, v in d.items()) if isinstance(d, dict) else text
                except ValueError:
                    pass
            p, m = extract_profile_from_text(text)
        for k, v in p.items():
            if v and k not in profile:
                profile[k] = v
        memories += m
    if method == "history" and not conv_found:
        raise ImportErrorUser("No supported conversation export was found in that upload.")
    stats["flags"] = sum(1 for m in memories if m["flags"])
    for k in list(profile):
        if isinstance(profile[k], str):
            profile[k] = redact(profile[k])
            if INJECTION_RX.search(profile[k]):
                profile[k] = INJECTION_RX.sub("[removed instruction-like text]", profile[k])
                stats["flags"] += 1
    return {"profile": profile, "memories": memories, "stats": stats, "performer": PERFORMER}


# ---------------------------------------------------------------- storage helpers
def _fernet():
    from cryptography.fernet import Fernet
    p = get_settings().secrets_dir / "agent_sources.key"
    if not p.exists():
        p.write_bytes(Fernet.generate_key()); os.chmod(p, 0o600)
    return Fernet(p.read_bytes())


def store_source(uid: str, agent_id: str | None, filename: str, data: bytes, keep_days: int) -> str:
    sid = db.new_id("src")
    path = None
    if keep_days > 0:
        d = get_settings().artifacts_dir / "agent_sources"
        d.mkdir(parents=True, exist_ok=True)
        path = str(d / f"{sid}.enc")
        with open(path, "wb") as fh:
            fh.write(_fernet().encrypt(data))
    db.insert("agent_sources", {"id": sid, "agent_id": agent_id, "user_id": uid, "filename": filename[:120],
                                "kind": _ext(filename), "size": len(data), "sha256": hashlib.sha256(data).hexdigest(),
                                "stored_path": path, "created_at": db.now(),
                                "expires_at": db.now() + keep_days * 86400 if keep_days > 0 else db.now()})
    return sid


def cleanup_sources() -> int:
    n = 0
    for s in db.q("SELECT * FROM agent_sources WHERE expires_at<=? AND stored_path IS NOT NULL", (db.now(),)):
        try:
            os.remove(s["stored_path"])
        except OSError:
            pass
        db.update("agent_sources", "id", s["id"], stored_path=None)
        n += 1
    db.kv_set("agent_sources_last_cleanup", {"ts": db.now(), "removed": n})
    return n


def log_import(uid: str, method: str, fmt: str, status: str, error_kind: str | None, size: int, flags: int = 0) -> None:
    db.insert("import_events", {"ts": db.now(), "user_hash": hashlib.sha256(uid.encode()).hexdigest()[:12],
                                "method": method, "format": fmt, "status": status, "error_kind": error_kind,
                                "bytes": size, "flags": db.dumps({"flagged_items": flags})})


# ---------------------------------------------------------------- agents
def ensure_main_pal(uid: str) -> None:
    if not db.q1("SELECT id FROM user_agents WHERE user_id=? AND kind='main_pal'", (uid,)):
        create_agent(uid, {"name": "Main Pal", "kind": "main_pal", "description": "Your everyday AELIO companion.",
                           "profile": {"personality": "warm, curious, helpful"}, "memories": [], "voice_id": "aelio-voice-groove"},
                     default=True)


def create_agent(uid: str, d: dict, default: bool = False) -> str:
    aid = db.new_id("agt")
    kind = d.get("kind", "custom")
    if kind not in ("main_pal", "imported", "custom", "team"):
        kind = "custom"
    db.insert("user_agents", {"id": aid, "user_id": uid, "name": str(d.get("name") or "New agent")[:60], "kind": kind,
                              "origin_label": "Imported Personality" if kind == "imported" else None,
                              "avatar": str(d.get("avatar") or "")[:40], "description": str(d.get("description") or "")[:500],
                              "profile": db.dumps(d.get("profile") or {}), "memories": db.dumps(d.get("memories") or []),
                              "voice_id": d.get("voice_id"), "status": d.get("status", "active"), "is_default": int(default),
                              "created_at": db.now(), "updated_at": db.now()})
    return aid


def get_agent(uid: str, aid: str) -> dict:
    a = db.q1("SELECT * FROM user_agents WHERE id=? AND user_id=?", (aid, uid))
    if not a:
        raise FileNotFoundError(aid)
    a["profile"] = db.loads(a["profile"], {}); a["memories"] = db.loads(a["memories"], [])
    return a


def export_agent(uid: str, aid: str) -> dict:
    a = get_agent(uid, aid)
    return {"format": "aelio-agent-profile/v1", "exported_at": time.time(), "name": a["name"], "kind": a["kind"],
            "origin_label": a["origin_label"], "description": a["description"], "voice_id": a["voice_id"],
            "profile": a["profile"], "memories": [m for m in a["memories"] if m.get("include")],
            "note": "A portable personality profile. It contains no model weights."}


def delete_agent(uid: str, aid: str) -> None:
    get_agent(uid, aid)
    for s in db.q("SELECT * FROM agent_sources WHERE agent_id=? AND user_id=?", (aid, uid)):
        if s["stored_path"]:
            try:
                os.remove(s["stored_path"])
            except OSError:
                pass
    db.run("DELETE FROM agent_sources WHERE agent_id=? AND user_id=?", (aid, uid))
    db.run("DELETE FROM agent_previews WHERE agent_id=? AND user_id=?", (aid, uid))
    db.run("DELETE FROM user_agents WHERE id=? AND user_id=?", (aid, uid))


def stats() -> dict:
    by = db.q("SELECT method, format, status, COUNT(*) n, SUM(bytes) bytes FROM import_events GROUP BY method, format, status")
    errs = db.q("SELECT error_kind, COUNT(*) n FROM import_events WHERE status='error' GROUP BY error_kind ORDER BY n DESC")
    total = db.q1("SELECT COUNT(*) n, SUM(CASE WHEN status='ok' THEN 1 ELSE 0 END) ok FROM import_events")
    stored = db.q1("SELECT COUNT(*) n, COALESCE(SUM(size),0) b FROM agent_sources WHERE stored_path IS NOT NULL")
    ratings = db.q("SELECT rating, COUNT(*) n FROM agent_previews WHERE rating IS NOT NULL GROUP BY rating")
    return {"imports": total["n"], "success_rate": round((total["ok"] or 0) / total["n"], 3) if total["n"] else None,
            "by_format": by, "errors": errs, "stored_sources": stored["n"], "stored_bytes": stored["b"],
            "last_cleanup": db.kv_get("agent_sources_last_cleanup"),
            "security_events": db.q1("SELECT COUNT(*) n FROM import_events WHERE error_kind IN ('unsafe_archive','blocked_type')")["n"],
            "flagged_items": sum(db.loads(r["flags"], {}).get("flagged_items", 0) for r in db.q("SELECT flags FROM import_events")),
            "preview_ratings": ratings,
            "agents": db.q("SELECT kind, COUNT(*) n FROM user_agents GROUP BY kind"),
            "reports": db.q("SELECT id, area, status, created_at FROM problem_reports ORDER BY created_at DESC LIMIT 50"),
            "supported_formats": ["TXT", "Markdown", "JSON (profile or conversation export)", "PDF (needs pypdf)", "DOCX", "ZIP of the above"],
            "note": "Founder analytics never include conversation content."}
