# Node0 Reference Hardware Profile · MSI Titan HX 18 (Linux)

**Status:** MEASURED on operator machine · PREVIEW policies (not enforced)  
**Scope:** Architecture refactor for a single-node Node0 workstation — how Dema layers compute, GPU, RAM, and storage on this class of machine.  
**Truth label:** `NODE0_HARDWARE_PROFILE_LOCAL_ONLY` via `dema hardware profile`

## Measured substrate (2026-06-24)

| Plane | Observed | Class |
| ----- | -------- | ----- |
| CPU | Intel Core i9-14900 · 32 logical threads | `ultra` |
| RAM | ~125 GiB total · ~87 GiB available | `ultra` |
| GPU | NVIDIA RTX 4090 Laptop · 16 GiB VRAM | `laptop_16gb` |
| Storage | NVMe · ~937 GiB root · ~481 GiB free | `large` |
| OS | Linux 6.17 (native, not WSL) | `linux` |

Hostname on disk: `Bizra-Node0` (per prior spearpoint audit).

This is **not** a datacenter. It is an elite **personal** Node0: one human, one machine, one consent boundary.

## Architectural refactor (four planes)

The old mental model treated “local LLM” as one blob. On this hardware the correct model is **four planes** with different bottlenecks:

```text
┌─────────────────────────────────────────────────────────────────┐
│  OPERATOR (Dema face)                                            │
│  consent · observe · benchmark · route preview · talk             │
└────────────────────────────┬────────────────────────────────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ COMPUTE     │    │ GPU (16 GiB)    │    │ RAM (128 GiB)    │
│ 32 threads  │    │ ONE loaded      │    │ CPU offload ·    │
│ parallel    │    │ model at a time │    │ corpus headroom  │
│ eval/observe│    │ LM Studio ·     │    │ (does not remove │
│ gatherers   │    │ Ollama · llama  │    │  GPU exclusivity)│
└─────────────┘    └─────────────────┘    └──────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ STORAGE (4 TB)  │
                    │ models · logs · │
                    │ ~/.dema · corpus│
                    └─────────────────┘
```

### 1. Compute plane (CPU)

**Role:** Parallel **read-only** gatherers and preview workers.

- `dema eval baseline` — interleaved provider probes (warm-up, max-models cap)
- `dema node0 activation observe` — localhost GET-only
- `dema hardware profile` — os + optional `nvidia-smi`

**Not for:** Hidden daemons, live PAT/SAT swarm, or “use all 32 threads for one chat.”

### 2. GPU plane (the real bottleneck)

**Role:** Single primary inference device.

**Policy (preview only):** `max_simultaneous_loaded_models = 1` on 16 GiB laptop GPUs.

Measured failure mode: `llama serve` (~5 GiB) + `llama cli` (~6.5 GiB) + desktop compositor left **~1.4 GiB free** → LM Studio `cudaMalloc failed: out of memory` → UI shows generic “Failed to load model.”

**Provider stack (priority):**

| Priority | Provider | Port | Role |
| -------- | -------- | ---- | ---- |
| 1 | LM Studio | 1234 | Primary chat UI |
| 2 | Ollama | 11434 | CLI / Modelfile lab |
| 3 | llama.cpp serve | 8080 | Optional single-model serve |

**Rule:** Pick **one** loaded model stack per session. Unload or stop competitors before switching.

**Known model caveat:** HauhauCS Gemma4 vision weights may fail in LM Studio with `unknown projector type: gemma4uv` — backend too old for that mmproj. Use text-only GGUF or Ollama for those weights.

### 3. RAM plane

**Role:** Headroom for CPU offload, large contexts, and local corpus — **not** a license to load multiple GPU models.

128 GiB enables:

- Ollama `num_gpu` partial offload when Modelfiles are tuned
- Large eval receipt JSON and parallel test runs
- Future local corpus indexes under `/data/bizra`

It does **not** remove the 16 GiB VRAM cap for simultaneous GPU residents.

### 4. Storage plane

**Suggested layout:**

```text
~/.dema/              operator state · receipts · keys (consent-gated)
~/.lmstudio/models/   LM Studio weights
~/.ollama/models/     Ollama blobs
/data/bizra/logs/     eval baselines · routing previews · harness output
```

## Dema command wiring

| Step | Command | Proves |
| ---- | ------- | ------ |
| Profile machine | `dema hardware profile [--json]` | Capacity bands + reference match |
| Discover models | `dema models discover --json` | Local catalog only |
| Benchmark | `dema eval baseline --suite bizra-local-small --max-models 6` | Measured scores |
| Route preview | `dema eval route --baseline <path>.json` | Role→model preview (not live) |
| Observe runtime | `dema node0 activation observe` | Sovereign + provider reachability |

Activation ladder (unchanged): **observe → verify → benchmark → route → dry-run → activate**. This hardware profile informs **observe** and **benchmark**; it does not skip to activate.

## What this refactor does not claim

- Not live MoE, KV-cache sync, or PAT/SAT council
- Not federation, token, PoI, or URP submission
- Policies are **preview-only** until a future enforced slice with consent
- Reference profile match is descriptive (`msi_hx18_titan_linux`), not a SKU warranty

## Proof command

```bash
node bin/dema hardware profile
node bin/dema hardware profile --json | jq '.reference_profile,.capacity_classes'
npm test -- tests/node0-hardware-profile.test.js tests/node0-hardware-profile-cli.test.js
```

## Related

- `packages/core/src/node0-hardware-profile.js` — pure kernel
- `apps/cli/src/commands/hardware-profile-gatherer.js` — read-only gatherer
- `packages/core/src/node-resource-passport-preview.js` — URP passport now includes `memory` + `gpu` capacity bands
- `docs/archive/06-adr/audits/2026-05-27-spearpoint-v1-status.md` — D1 hardware verification
