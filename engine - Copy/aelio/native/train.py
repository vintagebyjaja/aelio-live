"""Native training, evaluation and inference jobs.

Every job is isolated (own checkpoint directory), reproducible (seeded,
config + dataset hash recorded) and measured (wall time and process CPU time).
"""
from __future__ import annotations

import json
import math
import time
from pathlib import Path

import numpy as np
import psutil

from .. import db
from ..config import PROTECTED_SUITES_DIR, get_settings
from ..jobs import JobContext, handler
from . import datasets, registry
from .tokenizer import BPETokenizer
from .transformer import AdamW, Config, Model


def _ckpt_dir(name: str) -> Path:
    d = get_settings().artifacts_dir / "checkpoints" / name
    d.mkdir(parents=True, exist_ok=True)
    return d


def _eval_loss(model: Model, ids: np.ndarray, batches: int = 24, batch: int = 16) -> float:
    T = model.cfg.block_size
    n = len(ids) - T - 1
    if n <= 0:
        return float("nan")
    starts = np.linspace(0, n, batches * batch, dtype=np.int64)
    losses = []
    for i in range(batches):
        s = starts[i * batch:(i + 1) * batch]
        x = np.stack([ids[j:j + T] for j in s]); y = np.stack([ids[j + 1:j + T + 1] for j in s])
        losses.append(model.forward(x, y)[1])
    return float(np.mean(losses))


@handler("native.train_lm")
def train_lm(ctx: JobContext) -> dict:
    p = ctx.payload
    ds = datasets.get(p["dataset_id"])
    if not ds or not ds["training_eligible"]:
        raise ValueError("dataset missing or not training-eligible (license/validation/origin)")
    cfg = Config(**{k: v for k, v in p.get("config", {}).items() if k in Config.__dataclass_fields__})
    steps, bs, lr = int(p.get("steps", 600)), int(p.get("batch", 16)), float(p.get("lr", 3e-3))
    proc = psutil.Process()
    cpu0, t0 = sum(proc.cpu_times()[:2]), time.time()

    train_txt, val_txt = datasets.read_split(ds, "train"), datasets.read_split(ds, "val")
    ctx.log(f"dataset {ds['name']} v{ds['version']} sha256={ds['sha256'][:12]} train={len(train_txt)}B val={len(val_txt)}B")
    tok = BPETokenizer.train(train_txt[: int(p.get("tokenizer_chars", 400_000))], cfg.vocab_size - 1 + 1)
    cfg.vocab_size = tok.vocab_size
    ctx.log(f"tokenizer trained from scratch: vocab={tok.vocab_size} merges={len(tok.merges)}")
    ctx.check()
    tr = np.array(tok.encode(train_txt), dtype=np.int64)
    va = np.array(tok.encode(val_txt), dtype=np.int64)
    ctx.log(f"encoded: train_tokens={len(tr)} val_tokens={len(va)} params={cfg.n_params():,}")

    model = Model(cfg)  # random initialisation, seeded
    opt = AdamW(model.p, lr=lr)
    rng = np.random.default_rng(cfg.seed + 1)
    T = cfg.block_size
    init_val = _eval_loss(model, va, batches=8)
    curve = [{"step": 0, "train_loss": None, "val_loss": round(init_val, 4)}]
    ctx.log(f"step 0 val_loss={init_val:.4f} (random init; uniform would be {math.log(cfg.vocab_size):.4f})")
    warm = max(1, steps // 20)
    ema = None
    for step in range(1, steps + 1):
        s = rng.integers(0, len(tr) - T - 1, bs)
        x = np.stack([tr[j:j + T] for j in s]); y = np.stack([tr[j + 1:j + T + 1] for j in s])
        _, loss = model.forward(x, y, train=True)
        g = model.backward()
        cur_lr = lr * min(1.0, step / warm) * (0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * step / steps)))
        opt.step(model.p, g, lr=cur_lr)
        ema = loss if ema is None else 0.95 * ema + 0.05 * loss
        if step % max(1, steps // 10) == 0 or step == steps:
            ctx.check()
            vl = _eval_loss(model, va, batches=8)
            curve.append({"step": step, "train_loss": round(ema, 4), "val_loss": round(vl, 4)})
            ctx.log(f"step {step}/{steps} train_loss~{ema:.4f} val_loss={vl:.4f} lr={cur_lr:.2e}")

    val_loss = _eval_loss(model, va)
    counts = np.bincount(tr, minlength=cfg.vocab_size).astype(np.float64) + 1
    unigram = float(-np.mean(np.log(counts[va] / counts.sum())))
    bpb = val_loss * len(va) / max(1, len(val_txt.encode())) / math.log(2)
    prompt = p.get("sample_prompt", "Return the")
    sample = tok.decode(model.generate(tok.encode(prompt), max_new=60, seed=7))
    elapsed, cpu = time.time() - t0, sum(proc.cpu_times()[:2]) - cpu0

    name = p.get("name", "aelio-native-lm")
    d = _ckpt_dir(f"{name}-{ctx.id}")
    (d / "tokenizer.json").write_text(tok.to_json())
    metrics = {"val_loss": round(val_loss, 4), "val_ppl": round(math.exp(val_loss), 2),
               "bits_per_byte": round(bpb, 4), "baseline_uniform_loss": round(math.log(cfg.vocab_size), 4),
               "baseline_unigram_loss": round(unigram, 4), "beats_unigram_baseline": val_loss < unigram,
               "init_val_loss": round(init_val, 4), "train_seconds": round(elapsed, 1),
               "cpu_seconds": round(cpu, 1), "params": cfg.n_params(), "steps": steps,
               "train_tokens": int(len(tr)), "energy_kwh": None, "energy_note": "Data unavailable (no power meter)"}
    sha = model.save(str(d / "model.npz"), {"dataset_id": ds["id"], "dataset_sha256": ds["sha256"],
                                           "tokenizer": "tokenizer.json", "job_id": ctx.id})
    model_id = p.get("model_id") or registry.register_model(name, p.get("family", "reasoning"),
                                                            {"arch": "aelio-native-decoder-v1", **cfg.__dict__})
    db.update("models", "id", model_id, architecture=db.dumps({"arch": "aelio-native-decoder-v1", **cfg.__dict__}))
    cid = registry.add_checkpoint(model_id, str(d / "model.npz"), sha, steps, metrics, ctx.id, ds["id"])
    db.insert("evaluations", {"id": db.new_id("eval"), "checkpoint_id": cid, "suite": f"heldout:{ds['name']}",
                              "metrics": db.dumps(metrics), "passed": int(metrics["beats_unigram_baseline"]),
                              "created_at": db.now(), "job_id": ctx.id,
                              "details": db.dumps({"curve": curve, "sample_prompt": prompt, "sample": sample})})
    db.update("checkpoints", "id", cid, status="evaluated")
    ctx.log(f"saved checkpoint {cid} sha256={sha[:12]}; sample: {sample[:120]!r}")
    return {"model_id": model_id, "checkpoint_id": cid, "metrics": metrics, "curve": curve, "sample": sample}


def load_lm(checkpoint_id: str) -> tuple[Model, BPETokenizer, dict]:
    c = db.q1("SELECT * FROM checkpoints WHERE id=?", (checkpoint_id,))
    if not c:
        raise ValueError("checkpoint not found")
    path = Path(c["path"])
    model, meta = Model.load(str(path))
    tok = BPETokenizer.from_json((path.parent / meta["tokenizer"]).read_text())
    return model, tok, c


def infer(checkpoint_id: str, prompt: str, max_new: int = 60, temperature: float = 0.8, seed: int = 0) -> dict:
    t0 = time.time()
    model, tok, c = load_lm(checkpoint_id)
    out = tok.decode(model.generate(tok.encode(prompt), max_new=max(1, min(max_new, 256)),
                                    temperature=temperature, seed=seed))
    return {"checkpoint_id": checkpoint_id, "performer": f"native:{c['model_id']}/{checkpoint_id}",
            "prompt": prompt, "completion": out, "latency_ms": round((time.time() - t0) * 1000, 1)}


# ---------- Milestone B: protected code tasks ----------
def _code_tasks() -> list[dict]:
    return json.loads((PROTECTED_SUITES_DIR / "code_tasks_v1" / "tasks.json").read_text())["tasks"]


def complete_function(model: Model, tok: BPETokenizer, prompt: str, seed: int) -> str:
    raw = tok.decode(model.generate(tok.encode(prompt), max_new=80, temperature=0.6, seed=seed))
    lines = []
    for ln in raw.split("\n"):
        if lines and ln and not ln.startswith((" ", "\t")):
            break  # dedent ends the function body
        lines.append(ln)
    return prompt + "\n".join(lines).rstrip() + "\n"


@handler("native.eval_code")
def eval_code(ctx: JobContext) -> dict:
    from ..codestudio import sandbox
    from ..quality import suites
    suites.verify_suite("code_tasks_v1")  # refuse to run against a tampered suite
    model, tok, c = load_lm(ctx.payload["checkpoint_id"])
    k = int(ctx.payload.get("samples", 3))
    results = []
    import tempfile
    for t in _code_tasks():
        ctx.check()
        ok_any = False
        attempts = []
        for s in range(k):
            src = complete_function(model, tok, t["prompt"], seed=s)
            with tempfile.TemporaryDirectory() as ws:
                Path(ws, "cand.py").write_text(src + "\n\n" + t["tests"] + "\nprint('ALL_PASS')\n")
                r = sandbox.run(["python3", "cand.py"], Path(ws), timeout=10, cpu_s=10)
            ok = r["returncode"] == 0 and "ALL_PASS" in r["stdout"]
            ok_any |= ok
            attempts.append({"seed": s, "passed": ok, "code": src[:600], "error": r["stderr"][-300:]})
        results.append({"task": t["id"], "passed": ok_any, "attempts": attempts})
        ctx.log(f"{t['id']}: {'PASS' if ok_any else 'FAIL'}")
    passed = sum(r["passed"] for r in results)
    metrics = {f"pass_at_{k}": round(passed / len(results), 4), "tasks": len(results), "tasks_passed": passed}
    db.insert("evaluations", {"id": db.new_id("eval"), "checkpoint_id": c["id"], "suite": "protected:code_tasks_v1",
                              "metrics": db.dumps(metrics), "passed": int(passed == len(results)),
                              "created_at": db.now(), "job_id": ctx.id, "details": db.dumps(results)})
    return {"metrics": metrics, "results": results}


# ---------- Milestone D: vision prototype ----------
@handler("native.train_vision")
def train_vision(ctx: JobContext) -> dict:
    ds = datasets.get(ctx.payload["dataset_id"])
    if not ds or not ds["training_eligible"]:
        raise ValueError("dataset not eligible")
    z = np.load(ds["path"])
    X = z["images"].astype(np.float32) / 16.0
    Y = z["labels"].astype(np.int64)
    rng = np.random.default_rng(int(ctx.payload.get("seed", 42)))
    perm = rng.permutation(len(X))
    n_te = len(X) // 5
    te, tr = perm[:n_te], perm[n_te:]
    H = int(ctx.payload.get("hidden", 64))
    W1 = rng.normal(0, math.sqrt(2 / 64), (64, H)).astype(np.float32); b1 = np.zeros(H, np.float32)
    W2 = rng.normal(0, math.sqrt(2 / H), (H, 10)).astype(np.float32); b2 = np.zeros(10, np.float32)
    params = {"W1": W1, "b1": b1, "W2": W2, "b2": b2}
    opt = AdamW(params, lr=float(ctx.payload.get("lr", 3e-3)), wd=1e-4)
    t0 = time.time()

    def fwd(x):
        h = np.maximum(0, x @ params["W1"] + params["b1"])
        return h, h @ params["W2"] + params["b2"]

    epochs = int(ctx.payload.get("epochs", 40))
    for ep in range(epochs):
        ctx.check()
        rng.shuffle(tr)
        for i in range(0, len(tr), 64):
            b = tr[i:i + 64]
            x, y = X[b], Y[b]
            h, lg = fwd(x)
            pr = np.exp(lg - lg.max(1, keepdims=True)); pr /= pr.sum(1, keepdims=True)
            d = pr; d[np.arange(len(b)), y] -= 1; d /= len(b)
            g = {"W2": h.T @ d, "b2": d.sum(0)}
            dh = (d @ params["W2"].T) * (h > 0)
            g.update({"W1": x.T @ dh, "b1": dh.sum(0)})
            opt.step(params, g)
        if (ep + 1) % 10 == 0:
            acc = float((fwd(X[te])[1].argmax(1) == Y[te]).mean())
            ctx.log(f"epoch {ep + 1}/{epochs} held-out accuracy={acc:.4f}")
    pred = fwd(X[te])[1].argmax(1)
    acc = float((pred == Y[te]).mean())
    conf = np.zeros((10, 10), int)
    for a, b in zip(Y[te], pred):
        conf[a, b] += 1
    t_inf = time.time(); fwd(X[te]); lat = (time.time() - t_inf) * 1000 / len(te)
    d = _ckpt_dir(f"vision-digits-{ctx.id}")
    np.savez(d / "model.npz", **params)
    import hashlib
    sha = hashlib.sha256((d / "model.npz").read_bytes()).hexdigest()
    metrics = {"accuracy": round(acc, 4), "test_images": int(len(te)), "chance_accuracy": 0.1,
               "train_seconds": round(time.time() - t0, 2), "latency_ms": round(lat, 4),
               "params": int(sum(v.size for v in params.values()))}
    mid = ctx.payload.get("model_id") or registry.register_model(
        "aelio-native-vision-digits", "vision", {"arch": "mlp-64-%d-10" % H, "input": "8x8 grey"},
        "Milestone D narrow classification prototype")
    cid = registry.add_checkpoint(mid, str(d / "model.npz"), sha, epochs, metrics, ctx.id, ds["id"])
    db.insert("evaluations", {"id": db.new_id("eval"), "checkpoint_id": cid, "suite": "heldout:uci-optdigits-20pct",
                              "metrics": db.dumps(metrics), "passed": int(acc > 0.9), "created_at": db.now(),
                              "job_id": ctx.id, "details": db.dumps({"confusion": conf.tolist()})})
    db.update("checkpoints", "id", cid, status="evaluated")
    return {"model_id": mid, "checkpoint_id": cid, "metrics": metrics, "confusion": conf.tolist()}
