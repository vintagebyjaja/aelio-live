"""Native model registry: models, checkpoints, comparisons and promotion."""
from __future__ import annotations

from .. import db

MODEL_FAMILIES = {
    "reasoning": "Reasoning Core", "code": "Code Engine", "vision": "Vision Engine",
    "voice": "Voice Engine", "live": "Video + Live Engine", "memory": "Memory + Tools Engine",
}


def register_model(name: str, family: str, architecture: dict, notes: str = "") -> str:
    if family not in MODEL_FAMILIES:
        raise ValueError("unknown family")
    mid = db.new_id("mdl")
    db.insert("models", {"id": mid, "name": name, "family": family, "engine": MODEL_FAMILIES[family],
                         "architecture": db.dumps(architecture), "status": "registered",
                         "origin": "aelio-native:random-init", "created_at": db.now(), "notes": notes})
    db.audit("system", "model-registry", "model.registered", mid, {"name": name, "family": family})
    return mid


def add_checkpoint(model_id: str, path: str, sha256: str, step: int, metrics: dict, job_id: str | None,
                   dataset_id: str | None) -> str:
    cid = db.new_id("ckpt")
    db.insert("checkpoints", {"id": cid, "model_id": model_id, "path": path, "sha256": sha256, "step": step,
                              "created_at": db.now(), "metrics": db.dumps(metrics), "status": "candidate",
                              "job_id": job_id, "dataset_id": dataset_id})
    db.update("models", "id", model_id, status="trained")
    return cid


def list_models() -> list[dict]:
    rows = db.q("SELECT * FROM models ORDER BY created_at DESC")
    for r in rows:
        r["architecture"] = db.loads(r["architecture"], {})
        r["checkpoints"] = [dict(c, metrics=db.loads(c["metrics"], {})) for c in
                            db.q("SELECT * FROM checkpoints WHERE model_id=? ORDER BY created_at DESC", (r["id"],))]
    return rows


def compare(a_id: str, b_id: str) -> dict:
    """Compare checkpoint b (new) against a (baseline) on shared metrics."""
    a = db.q1("SELECT * FROM checkpoints WHERE id=?", (a_id,))
    b = db.q1("SELECT * FROM checkpoints WHERE id=?", (b_id,))
    if not a or not b:
        raise ValueError("checkpoint not found")
    ma, mb = db.loads(a["metrics"], {}), db.loads(b["metrics"], {})
    lower_better = {"val_loss", "val_ppl", "bits_per_byte", "train_seconds", "cpu_seconds", "latency_ms"}
    rows, verdicts = [], set()
    for k in sorted(set(ma) & set(mb)):
        if not isinstance(ma[k], (int, float)) or not isinstance(mb[k], (int, float)):
            continue
        delta = mb[k] - ma[k]
        better = (delta < 0) if k in lower_better else (delta > 0)
        rows.append({"metric": k, "baseline": ma[k], "candidate": mb[k], "delta": delta,
                     "improved": better if delta != 0 else None})
        if k in {"val_loss", "accuracy", "pass_at_1"} and delta != 0:
            verdicts.add("more accurate" if better else "regressing")
        if k in {"train_seconds", "latency_ms"} and delta != 0:
            verdicts.add("faster" if better else "slower")
    if not verdicts:
        verdicts.add("no comparable metrics")
    return {"baseline": a_id, "candidate": b_id, "rows": rows, "verdicts": sorted(verdicts),
            "ready_for_additional_testing": "regressing" not in verdicts}


def set_checkpoint_status(cid: str, status: str, actor: str) -> None:
    allowed = {"candidate", "evaluated", "rejected", "approved", "production", "published"}
    if status not in allowed:
        raise ValueError("bad status")
    fields = {"status": status}
    if status in ("approved", "production", "published"):
        fields.update(approved_by=actor, approved_at=db.now())
    db.update("checkpoints", "id", cid, **fields)
    db.audit("founder", actor, f"checkpoint.{status}", cid)
