#!/usr/bin/env python3
"""Independent check of AELIO Native parameter counts.

Shares no code with the Rust crate: it computes each preset in closed form,
then (if cargo is available) runs `param-report --json` and compares every
field. Exit code 0 = all match.

    python3 native/tools/param_count_check.py
"""
import json
import math
import pathlib
import shutil
import subprocess
import sys

PRESETS = {
    # name: (layers, d_model, heads, kv_heads, vocab, context)
    "aelio-native-0.1": (8, 256, 4, 4, 16384, 512),
    "aelio-native-0.2": (12, 768, 12, 12, 32768, 1024),
    "aelio-native-0.3": (27, 1280, 20, 4, 32768, 2048),
    "aelio-native-1.0": (20, 2048, 16, 4, 65536, 4096),
    "aelio-native-2.0": (28, 3072, 24, 8, 65536, 4096),
}


def ffn_hidden(d, multiple=64):
    return math.ceil(math.ceil(8 * d / 3) / multiple) * multiple


def closed_form(L, d, H, KV, V, ctx):
    hd = d // H
    attn = d * d + 2 * d * (KV * hd) + d * d          # wq, wk, wv, wo
    ffn = 3 * d * ffn_hidden(d)                         # gate, up, down
    norms = 2 * d                                       # two RMSNorm weights
    emb = V * d                                         # tied with output head
    total = L * (attn + ffn + norms) + emb + d          # + final norm
    flops = 6 * (L * (attn + ffn) + V * d) + 6 * L * ctx * d
    return {
        "ffn_hidden": ffn_hidden(d), "embedding": emb, "attention": L * attn, "ffn": L * ffn,
        "norms": L * norms + d, "per_layer": attn + ffn + norms, "non_embedding": total - emb,
        "total": total, "train_flops_per_token": flops, "train_state_bytes": 18 * total,
    }


def main():
    expected = {n: closed_form(*p) for n, p in PRESETS.items()}
    for n, e in expected.items():
        print(f"{n}: total {e['total']:,}  embedding {e['embedding']:,} "
              f"({100 * e['embedding'] / e['total']:.1f}%)  per layer {e['per_layer']:,}")
    cargo = shutil.which("cargo")
    if not cargo:
        print("cargo not found: closed-form values printed, Rust comparison skipped")
        return 0
    root = pathlib.Path(__file__).resolve().parents[1]
    out = subprocess.run([cargo, "run", "-q", "-p", "aelio-model", "--bin", "param-report", "--", "--json"],
                         cwd=root, check=True, capture_output=True, text=True).stdout
    rust = {r["name"]: r for r in json.loads(out)}
    bad = 0
    for n, e in expected.items():
        for k, v in e.items():
            if rust[n][k] != v:
                print(f"MISMATCH {n}.{k}: rust {rust[n][k]} vs closed form {v}")
                bad += 1
    print("Rust and closed form agree on every field" if not bad else f"{bad} mismatches")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
