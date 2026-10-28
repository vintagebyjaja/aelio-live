#!/usr/bin/env python3
"""AELIO Native budget model. Every assumption is a named constant below.

Separates: theoretical compute (100% of peak, a floor that is never reached),
realistic training (measured-style utilization ranges for a new engine, times
the number of full-run equivalents including failed runs and ablations),
GPU kernel development, dataset preparation, evaluation, inference, and
engineering labor (hours; cost depends on the rate you pay).

    python3 native/tools/budget.py            # markdown tables
    python3 native/tools/budget.py --json

Prices are quotes to re-confirm before renting; nothing here buys anything.
"""
import json
import math
import sys

# --- FLOPs per training token, from aelio-model (6 x matmul params + 6 x L x ctx x d) ---
def ffn_hidden(d):
    return math.ceil(math.ceil(8 * d / 3) / 64) * 64

def flops_per_token(L, d, H, KV, V, ctx):
    hd = d // H
    attn = 2 * d * d + 2 * d * KV * hd
    return 6 * (L * (attn + 3 * d * ffn_hidden(d)) + V * d) + 6 * L * ctx * d

MODELS = [
    # name, (L, d, H, KV, V, ctx), training tokens, GPU, n_gpus, MFU range, full-run equivalents range
    ("0.1 (10.6M)", (8, 256, 4, 4, 16384, 512), 2e9, "RTX 4090", 1, (0.05, 0.15), (10, 20)),
    ("0.2 (110M)", (12, 768, 12, 12, 32768, 1024), 10e9, "H100", 1, (0.10, 0.30), (3, 6)),
    ("0.3 (506M)", (27, 1280, 20, 4, 32768, 2048), 30e9, "H100", 8, (0.15, 0.35), (2, 3)),
    ("1.0 (1.02B)", (20, 2048, 16, 4, 65536, 4096), 60e9, "H100", 8, (0.20, 0.40), (2, 3)),
    ("2.0 (3.02B)", (28, 3072, 24, 8, 65536, 4096), 150e9, "H100", 8, (0.20, 0.40), (2, 3)),
]

# Dense bf16 peak (no sparsity), FLOP/s per GPU
PEAK = {"H100": 989e12, "RTX 4090": 165e12}
# $/GPU-hour, gpuperhour.com observed 2026-10-28: H100 SXM 30-day avg $2.19, cheapest secure
# on-demand now $2.90-$3.13; RTX 4090 30-day avg $0.33, cheapest secure now $0.82. Confirm before renting.
PRICE = {"H100": (2.20, 3.30), "RTX 4090": (0.33, 0.85)}
EVAL_OVERHEAD = (0.10, 0.20)      # extra GPU time for evaluation runs
RESTART_OVERHEAD = (0.05, 0.15)   # lost work from crashes/pre-emption between checkpoints

# --- Phase 0-1 non-training items (ranges) ---
LABOR_HOURS = {
    "Phase 0: publishing boundary, workspace, CI, data/benchmark audit": (40, 70),
    "Phase 1: tensor + autograd (CPU), gradient checks": (120, 200),
    "Phase 1: transformer (RoPE, RMSNorm, SwiGLU, attention), AdamW, schedule": (80, 140),
    "Phase 1: BPE tokenizer (train, encode, decode, versioning)": (40, 70),
    "Phase 1: checkpoints, determinism, resume, profiling hooks": (40, 70),
    "Phase 1: reference comparisons, CI, docs, reviews": (40, 80),
}
LABOR_RATE_EXAMPLE = 100  # $/h, illustrative only; replace with what you actually pay

def run(lo_hi_mfu, flops, gpu, n):
    """Wall hours and GPU-hours at a given MFU."""
    gpu_hours = flops / (PEAK[gpu] * lo_hi_mfu) / 3600
    return gpu_hours / n, gpu_hours

def main():
    rows = []
    for name, shape, tokens, gpu, n, (mfu_lo, mfu_hi), (runs_lo, runs_hi) in MODELS:
        fpt = flops_per_token(*shape)
        flops = fpt * tokens
        theo_gpu_h = flops / PEAK[gpu] / 3600
        wall_fast, gh_fast = run(mfu_hi, flops, gpu, n)
        wall_slow, gh_slow = run(mfu_lo, flops, gpu, n)
        p_lo, p_hi = PRICE[gpu]
        run_cost = (gh_fast * p_lo, gh_slow * p_hi)
        tot_lo = gh_fast * runs_lo * (1 + EVAL_OVERHEAD[0]) * (1 + RESTART_OVERHEAD[0]) * p_lo
        tot_hi = gh_slow * runs_hi * (1 + EVAL_OVERHEAD[1]) * (1 + RESTART_OVERHEAD[1]) * p_hi
        rows.append(dict(model=name, tokens=tokens, flops_per_token=fpt, flops=flops, gpu=f"{n}x {gpu}",
                         theoretical_gpu_hours=theo_gpu_h, theoretical_cost=theo_gpu_h * p_lo,
                         mfu=(mfu_lo, mfu_hi), wall_hours=(wall_fast, wall_slow),
                         gpu_hours_per_run=(gh_fast, gh_slow), cost_per_run=run_cost,
                         full_run_equivalents=(runs_lo, runs_hi), training_total=(tot_lo, tot_hi)))
    labor = {k: v for k, v in LABOR_HOURS.items()}
    lab_lo = sum(v[0] for v in labor.values())
    lab_hi = sum(v[1] for v in labor.values())
    if "--json" in sys.argv:
        print(json.dumps(dict(training=rows, labor_hours=labor, labor_total=(lab_lo, lab_hi)), indent=1))
        return
    print("| Model | Tokens | FLOPs | Theoretical (100% peak) | Realistic utilization | Wall time per run | Cost per run | All runs incl. failures + eval |")
    print("|---|---|---|---|---|---|---|---|")
    for r in rows:
        print(f"| {r['model']} | {r['tokens']/1e9:.0f}B | {r['flops']:.2e} | {r['theoretical_gpu_hours']:.2f} GPU-h (${r['theoretical_cost']:,.2f}) "
              f"| {r['mfu'][0]:.0%}-{r['mfu'][1]:.0%} on {r['gpu']} | {r['wall_hours'][0]:.1f}-{r['wall_hours'][1]:.1f} h "
              f"| ${r['cost_per_run'][0]:,.0f}-${r['cost_per_run'][1]:,.0f} | {r['full_run_equivalents'][0]}-{r['full_run_equivalents'][1]} runs: "
              f"${r['training_total'][0]:,.0f}-${r['training_total'][1]:,.0f} |")
    print()
    print("| Labor item | Hours |")
    print("|---|---|")
    for k, (a, b) in labor.items():
        print(f"| {k} | {a}-{b} |")
    print(f"| Total Phase 0-1 | {lab_lo}-{lab_hi} (at an illustrative ${LABOR_RATE_EXAMPLE}/h: ${lab_lo*LABOR_RATE_EXAMPLE:,}-${lab_hi*LABOR_RATE_EXAMPLE:,}) |")

if __name__ == "__main__":
    main()
