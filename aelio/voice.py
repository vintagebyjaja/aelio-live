"""AELIO Voice: one shared service with six AELIO-owned voice identities.

Status honesty: a voice can synthesise speech only once an approved AELIO
Native speech checkpoint is attached to it. Until then, synthesis jobs complete
with status `awaiting_training` and no audio. No third-party speech provider is
connected in v1.
"""
from __future__ import annotations

import time

from . import db
from .jobs import JobContext, enqueue, handler

VOICES = [
    ("aelio-voice-groove", "GROOVE", "Warm, smooth and relaxed, masculine. A natural American voice with a rich mid-to-low register.",
     ["warm", "smooth", "relaxed", "masculine", "american", "mid-low register"], "Navigation, casual conversation"),
    ("aelio-voice-nova", "NOVA", "Elegant, clear and sophisticated, feminine. Precise pronunciation with polished, natural delivery.",
     ["elegant", "clear", "sophisticated", "feminine", "precise"], "Professional assistance, navigation"),
    ("aelio-voice-sol", "SOL", "Bright, upbeat, energetic.", ["bright", "upbeat", "energetic"],
     "Lifestyle, entertainment, food discovery"),
    ("aelio-voice-sage", "SAGE", "Calm, thoughtful, reassuring.", ["calm", "thoughtful", "reassuring"],
     "Education, architecture, learning"),
    ("aelio-voice-echo", "ECHO", "Deep, cinematic, commanding.", ["deep", "cinematic", "commanding"],
     "Storytelling, entertainment"),
    ("aelio-voice-aura", "AURA", "Soft, expressive, personable.", ["soft", "expressive", "personable"],
     "Coaching, careers, personal assistance"),
]
DEFAULT_PARAMS = {"rate": 1.0, "pitch_semitones": 0.0, "energy": 1.0, "sample_rate_hz": 24000}


def seed() -> int:
    n = 0
    for vid, name, desc, traits, uses in VOICES:
        if not db.q1("SELECT voice_id FROM voices WHERE voice_id=?", (vid,)):
            db.insert("voices", {"voice_id": vid, "name": name, "description": desc, "traits": db.dumps(traits),
                                 "use_cases": uses, "status": "awaiting_training", "native_checkpoint_id": None,
                                 "params": db.dumps(DEFAULT_PARAMS), "updated_at": db.now()})
            n += 1
    return n


def list_voices() -> list[dict]:
    rows = db.q("SELECT * FROM voices ORDER BY rowid")
    for r in rows:
        r["traits"] = db.loads(r["traits"], []); r["params"] = db.loads(r["params"], {})
        r["can_synthesize"] = bool(r["native_checkpoint_id"]) and r["status"] == "approved"
    return rows


def update_profile(voice_id: str, description: str | None, params: dict | None, actor: str) -> dict:
    v = db.q1("SELECT * FROM voices WHERE voice_id=?", (voice_id,))
    if not v:
        raise FileNotFoundError(voice_id)
    fields = {"updated_at": db.now()}
    if description:
        fields["description"] = description[:1000]
    if params:
        merged = {**db.loads(v["params"], {}), **{k: float(params[k]) for k in params if k in DEFAULT_PARAMS}}
        fields["params"] = db.dumps(merged)
    db.update("voices", "voice_id", voice_id, **fields)
    db.audit("founder", actor, "voice.profile_updated", voice_id, fields)
    return next(x for x in list_voices() if x["voice_id"] == voice_id)


def approve(voice_id: str, actor: str) -> dict:
    v = db.q1("SELECT * FROM voices WHERE voice_id=?", (voice_id,))
    if not v or not v["native_checkpoint_id"]:
        raise ValueError("cannot approve a voice without a trained native speech checkpoint")
    db.update("voices", "voice_id", voice_id, status="approved", approved_by=actor, approved_at=db.now())
    db.audit("founder", actor, "voice.approved", voice_id)
    return next(x for x in list_voices() if x["voice_id"] == voice_id)


def submit_synthesis(voice_id: str, text: str, requested_by: str) -> dict:
    if not db.q1("SELECT voice_id FROM voices WHERE voice_id=?", (voice_id,)):
        raise FileNotFoundError(voice_id)
    sid = db.new_id("syn")
    db.insert("voice_synth", {"id": sid, "voice_id": voice_id, "text": text[:2000], "status": "queued",
                              "created_at": db.now()})
    jid = enqueue("voice.synthesize", {"synth_id": sid}, priority=3, timeout_s=120, created_by=requested_by)
    db.update("voice_synth", "id", sid, job_id=jid)
    return {"synth_id": sid, "job_id": jid}


@handler("voice.synthesize")
def synthesize(ctx: JobContext) -> dict:
    t0 = time.time()
    s = db.q1("SELECT * FROM voice_synth WHERE id=?", (ctx.payload["synth_id"],))
    v = db.q1("SELECT * FROM voices WHERE voice_id=?", (s["voice_id"],))
    if not v["native_checkpoint_id"] or v["status"] != "approved":
        msg = (f"{v['name']} has no approved AELIO Native speech checkpoint. No audio was generated. "
               "Next step: register a licensed, consented speech dataset for this voice and run speech training "
               "(Milestone C).")
        db.update("voice_synth", "id", s["id"], status="awaiting_training", performer="none",
                  latency_ms=round((time.time() - t0) * 1000, 2), message=msg)
        ctx.log(msg)
        return {"status": "awaiting_training", "audio": None, "message": msg}
    raise NotImplementedError("native speech inference backend not yet implemented")
