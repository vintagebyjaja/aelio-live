# Infrastructure requirements and estimated costs

Prices are on-demand list prices from public comparisons in September 2026. They change often, so check them with the provider before you buy. Nothing has been provisioned.

## Needed now (v1 as delivered)
| Service | Purpose | Estimate |
|---|---|---|
| Linux server, 2–4 vCPU / 4–8 GB / 40 GB | Studio server, job queue, CPU training of small prototypes, sandbox | ~$10–40/month VPS, or $0 on your own machine |
| Cloudflare Tunnel (+ optional Zero Trust Access, free tier ≤50 users) | `studio.aelio.live` without open ports | $0 |
| Firebase Authentication | Founder sign-in | $0 at this scale (Spark/Blaze free allowance) |
| Backups | Copy `var/` (DB, checkpoints, datasets) nightly to Cloudflare R2 | well under $5/month at current size (< 1 GB) |

## Needed for the next milestones
| Milestone | Compute | Rough cost |
|---|---|---|
| PyTorch backend + larger text/code models (10–100M params) | 1× NVIDIA L4 (24 GB) or A100 80GB, on demand | L4 ≈ $0.71/h (GCP); A100 80GB ≈ $1.39–2.79/h (RunPod / Lambda). A 24 h run ≈ $17–67. |
| Native speech prototype (Milestone C), per voice | 1× A100/H100, tens of GPU-hours, plus recording sessions with consented voice performers | GPU $50–300 per experiment; voice talent contracts are a separate budget |
| Sustained model R&D | Reserved GPU or a dedicated GPU box | H100 ≈ $2.89–3.29/h (RunPod, Lambda) → ~$2,100–2,400/month if run 24/7 |
| Object storage for datasets/checkpoints | Cloudflare R2 | ~$0.015/GB-month, no egress fees |

**Don't run training on Cloudflare Workers or Pages.** They have no GPUs and strict CPU limits. Run GPU jobs on dedicated machines that report back to the studio's job queue.

## Green Guardians telemetry
This build host exposes only CPU utilisation, memory and load. A real server should expose `/sys/class/thermal`, fan sensors, RAPL energy counters and `nvidia-smi`. Guardians use whatever exists and show "Data unavailable" for the rest. Water use needs a facility or provider data feed, which isn't available from typical cloud GPU providers.
