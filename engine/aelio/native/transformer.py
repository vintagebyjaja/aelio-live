"""AELIO Native decoder-only transformer, implemented directly in NumPy.

* Weights are always independently initialised from a seeded random normal
  distribution. There is no code path that loads third-party weights.
* Forward and backward passes are written by hand (verified by a numerical
  gradient check in tests/test_native.py).
* The configuration (layers, width, heads, context) scales without changing
  the platform; the planned PyTorch/GPU backend must reproduce this exact
  architecture and checkpoint format (see docs/ARCHITECTURE.md).
"""
from __future__ import annotations

import hashlib
import io
import json
import math
from dataclasses import asdict, dataclass

import numpy as np

ARCH_NAME = "aelio-native-decoder-v1"


@dataclass
class Config:
    vocab_size: int = 512
    n_layer: int = 2
    n_head: int = 4
    n_embd: int = 96
    block_size: int = 64
    seed: int = 1337

    def n_params(self) -> int:
        C, V, T, L = self.n_embd, self.vocab_size, self.block_size, self.n_layer
        per = 2 * C + C * 3 * C + 3 * C + C * C + C + 2 * C + C * 4 * C + 4 * C + 4 * C * C + C
        return V * C + T * C + L * per + 2 * C + C * V


def init_params(cfg: Config) -> dict[str, np.ndarray]:
    rng = np.random.default_rng(cfg.seed)
    C, std = cfg.n_embd, 0.02
    proj_std = std / math.sqrt(2 * cfg.n_layer)
    f = np.float32
    p = {"wte": rng.normal(0, std, (cfg.vocab_size, C)).astype(f),
         "wpe": rng.normal(0, std, (cfg.block_size, C)).astype(f)}
    for l in range(cfg.n_layer):
        p[f"h{l}.ln1_g"] = np.ones(C, f); p[f"h{l}.ln1_b"] = np.zeros(C, f)
        p[f"h{l}.w_qkv"] = rng.normal(0, std, (C, 3 * C)).astype(f); p[f"h{l}.b_qkv"] = np.zeros(3 * C, f)
        p[f"h{l}.w_o"] = rng.normal(0, proj_std, (C, C)).astype(f); p[f"h{l}.b_o"] = np.zeros(C, f)
        p[f"h{l}.ln2_g"] = np.ones(C, f); p[f"h{l}.ln2_b"] = np.zeros(C, f)
        p[f"h{l}.w_fc"] = rng.normal(0, std, (C, 4 * C)).astype(f); p[f"h{l}.b_fc"] = np.zeros(4 * C, f)
        p[f"h{l}.w_pr"] = rng.normal(0, proj_std, (4 * C, C)).astype(f); p[f"h{l}.b_pr"] = np.zeros(C, f)
    p["lnf_g"] = np.ones(C, f); p["lnf_b"] = np.zeros(C, f)
    p["w_head"] = rng.normal(0, std, (C, cfg.vocab_size)).astype(f)
    return p


# ---------------- layer primitives ----------------
EPS = 1e-5
_A = math.sqrt(2 / math.pi)


def ln_fwd(x, g, b):
    mu = x.mean(-1, keepdims=True)
    var = x.var(-1, keepdims=True)
    rstd = 1.0 / np.sqrt(var + EPS)
    xh = (x - mu) * rstd
    return xh * g + b, (xh, rstd, g)


def ln_bwd(dy, cache):
    xh, rstd, g = cache
    dg = (dy * xh).reshape(-1, xh.shape[-1]).sum(0)
    db = dy.reshape(-1, xh.shape[-1]).sum(0)
    dxh = dy * g
    N = xh.shape[-1]
    dx = rstd / N * (N * dxh - dxh.sum(-1, keepdims=True) - xh * (dxh * xh).sum(-1, keepdims=True))
    return dx, dg, db


def gelu_fwd(x):
    t = np.tanh(_A * (x + 0.044715 * x ** 3))
    return 0.5 * x * (1 + t), (x, t)


def gelu_bwd(dy, cache):
    x, t = cache
    return dy * (0.5 * (1 + t) + 0.5 * x * (1 - t * t) * _A * (1 + 3 * 0.044715 * x * x))


class Model:
    def __init__(self, cfg: Config, params: dict[str, np.ndarray] | None = None):
        self.cfg = cfg
        self.p = params if params is not None else init_params(cfg)
        T = cfg.block_size
        self._mask = np.triu(np.ones((T, T), dtype=bool), 1)

    # ---- forward (optionally keeping caches for backward) ----
    def forward(self, idx: np.ndarray, targets: np.ndarray | None = None, train: bool = False):
        cfg, p = self.cfg, self.p
        B, T = idx.shape
        C, H = cfg.n_embd, cfg.n_head
        D = C // H
        caches = []
        x = p["wte"][idx] + p["wpe"][:T]
        mask = self._mask[:T, :T]
        for l in range(cfg.n_layer):
            pre = f"h{l}."
            a, c_ln1 = ln_fwd(x, p[pre + "ln1_g"], p[pre + "ln1_b"])
            qkv = a @ p[pre + "w_qkv"] + p[pre + "b_qkv"]
            q, k, v = np.split(qkv, 3, axis=-1)
            q = q.reshape(B, T, H, D).transpose(0, 2, 1, 3)
            k = k.reshape(B, T, H, D).transpose(0, 2, 1, 3)
            v = v.reshape(B, T, H, D).transpose(0, 2, 1, 3)
            s = (q @ k.transpose(0, 1, 3, 2)) * (1.0 / math.sqrt(D))
            s = np.where(mask, -1e9, s)
            s = s - s.max(-1, keepdims=True)
            P = np.exp(s)
            P /= P.sum(-1, keepdims=True)
            y = (P @ v).transpose(0, 2, 1, 3).reshape(B, T, C)
            att = y @ p[pre + "w_o"] + p[pre + "b_o"]
            x1 = x + att
            m, c_ln2 = ln_fwd(x1, p[pre + "ln2_g"], p[pre + "ln2_b"])
            hpre = m @ p[pre + "w_fc"] + p[pre + "b_fc"]
            h, c_gelu = gelu_fwd(hpre)
            mlp = h @ p[pre + "w_pr"] + p[pre + "b_pr"]
            x2 = x1 + mlp
            if train:
                caches.append((x, a, c_ln1, q, k, v, P, y, x1, m, c_ln2, c_gelu, h))
            x = x2
        xf, c_lnf = ln_fwd(x, p["lnf_g"], p["lnf_b"])
        logits = xf @ p["w_head"]
        if targets is None:
            return logits, None
        z = logits - logits.max(-1, keepdims=True)
        lse = np.log(np.exp(z).sum(-1, keepdims=True))
        logp = z - lse
        loss = -np.take_along_axis(logp, targets[..., None], -1).mean()
        if train:
            self._cache = (idx, targets, caches, xf, c_lnf, logp)
        return logits, float(loss)

    def backward(self) -> dict[str, np.ndarray]:
        cfg, p = self.cfg, self.p
        idx, targets, caches, xf, c_lnf, logp = self._cache
        B, T = idx.shape
        C, H = cfg.n_embd, cfg.n_head
        D = C // H
        g = {k: np.zeros_like(v) for k, v in p.items()}
        dlogits = np.exp(logp)
        np.put_along_axis(dlogits, targets[..., None], np.take_along_axis(dlogits, targets[..., None], -1) - 1, -1)
        dlogits /= B * T
        g["w_head"] = xf.reshape(-1, C).T @ dlogits.reshape(-1, cfg.vocab_size)
        dxf = dlogits @ p["w_head"].T
        dx, g["lnf_g"], g["lnf_b"] = ln_bwd(dxf, c_lnf)
        for l in reversed(range(cfg.n_layer)):
            pre = f"h{l}."
            x, a, c_ln1, q, k, v, P, y, x1, m, c_ln2, c_gelu, h = caches[l]
            # MLP branch
            dmlp = dx
            g[pre + "w_pr"] = h.reshape(-1, 4 * C).T @ dmlp.reshape(-1, C)
            g[pre + "b_pr"] = dmlp.reshape(-1, C).sum(0)
            dh = dmlp @ p[pre + "w_pr"].T
            dhpre = gelu_bwd(dh, c_gelu)
            g[pre + "w_fc"] = m.reshape(-1, C).T @ dhpre.reshape(-1, 4 * C)
            g[pre + "b_fc"] = dhpre.reshape(-1, 4 * C).sum(0)
            dm = dhpre @ p[pre + "w_fc"].T
            dx1_ln, g[pre + "ln2_g"], g[pre + "ln2_b"] = ln_bwd(dm, c_ln2)
            dx1 = dx + dx1_ln
            # attention branch
            datt = dx1
            g[pre + "w_o"] = y.reshape(-1, C).T @ datt.reshape(-1, C)
            g[pre + "b_o"] = datt.reshape(-1, C).sum(0)
            dy = (datt @ p[pre + "w_o"].T).reshape(B, T, H, D).transpose(0, 2, 1, 3)
            dP = dy @ v.transpose(0, 1, 3, 2)
            dv = P.transpose(0, 1, 3, 2) @ dy
            ds = P * (dP - (dP * P).sum(-1, keepdims=True)) * (1.0 / math.sqrt(D))
            dq = ds @ k
            dk = ds.transpose(0, 1, 3, 2) @ q
            dqkv = np.concatenate([t.transpose(0, 2, 1, 3).reshape(B, T, C) for t in (dq, dk, dv)], -1)
            g[pre + "w_qkv"] = a.reshape(-1, C).T @ dqkv.reshape(-1, 3 * C)
            g[pre + "b_qkv"] = dqkv.reshape(-1, 3 * C).sum(0)
            da = dqkv @ p[pre + "w_qkv"].T
            dx0, g[pre + "ln1_g"], g[pre + "ln1_b"] = ln_bwd(da, c_ln1)
            dx = dx1 + dx0
        np.add.at(g["wte"], idx, dx)
        g["wpe"][:T] = dx.sum(0)
        self._cache = None
        return g

    # ---- inference ----
    def generate(self, prompt_ids: list[int], max_new: int = 64, temperature: float = 0.8, top_k: int = 40,
                 seed: int = 0, stop_id: int | None = None) -> list[int]:
        rng = np.random.default_rng(seed)
        ids = list(prompt_ids)
        for _ in range(max_new):
            ctx = np.array([ids[-self.cfg.block_size:]], dtype=np.int64)
            logits, _ = self.forward(ctx)
            lg = logits[0, -1].astype(np.float64) / max(temperature, 1e-4)
            if top_k and top_k < lg.size:
                kth = np.partition(lg, -top_k)[-top_k]
                lg = np.where(lg < kth, -np.inf, lg)
            pr = np.exp(lg - lg.max())
            pr /= pr.sum()
            nxt = int(rng.choice(lg.size, p=pr))
            if stop_id is not None and nxt == stop_id:
                break
            ids.append(nxt)
        return ids[len(prompt_ids):]

    # ---- persistence ----
    def save(self, path: str, extra: dict | None = None) -> str:
        meta = {"arch": ARCH_NAME, "config": asdict(self.cfg), "init": "random-normal(seed)",
                "external_weights": False, **(extra or {})}
        buf = io.BytesIO()
        np.savez(buf, __meta__=np.frombuffer(json.dumps(meta).encode(), dtype=np.uint8), **self.p)
        data = buf.getvalue()
        with open(path, "wb") as fh:
            fh.write(data)
        return hashlib.sha256(data).hexdigest()

    @classmethod
    def load(cls, path: str) -> tuple["Model", dict]:
        z = np.load(path, allow_pickle=False)
        meta = json.loads(bytes(z["__meta__"]).decode())
        if meta.get("arch") != ARCH_NAME or meta.get("external_weights"):
            raise ValueError("not an AELIO Native checkpoint")
        params = {k: z[k] for k in z.files if k != "__meta__"}
        return cls(Config(**meta["config"]), params), meta


class AdamW:
    def __init__(self, params: dict[str, np.ndarray], lr=3e-3, betas=(0.9, 0.95), wd=0.01, eps=1e-8):
        self.lr, self.b1, self.b2, self.wd, self.eps = lr, betas[0], betas[1], wd, eps
        self.m = {k: np.zeros_like(v) for k, v in params.items()}
        self.v = {k: np.zeros_like(v) for k, v in params.items()}
        self.t = 0

    def step(self, params, grads, lr=None, clip=1.0) -> float:
        lr = self.lr if lr is None else lr
        norm = math.sqrt(sum(float((g * g).sum()) for g in grads.values()))
        scale = min(1.0, clip / (norm + 1e-6))
        self.t += 1
        for k, w in params.items():
            gk = grads[k] * scale
            self.m[k] = self.b1 * self.m[k] + (1 - self.b1) * gk
            self.v[k] = self.b2 * self.v[k] + (1 - self.b2) * gk * gk
            mh = self.m[k] / (1 - self.b1 ** self.t)
            vh = self.v[k] / (1 - self.b2 ** self.t)
            if w.ndim >= 2:
                w -= lr * self.wd * w
            w -= (lr * mh / (np.sqrt(vh) + self.eps)).astype(w.dtype)
        return norm
