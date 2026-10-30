# Phase 07 — DeepSeek-V4.1-Flash tech report (MAP ONLY)

**Status:** MAP_BEFORE_MERGE · not ingested as doctrine · not a model install  
**Source PDF:** `/home/bizra-operating-system/Downloads/DeepSeek_V41_Tech_Report.pdf`  
**sha256:** `ba68e2e40408125ae6d2f63a9a241b61c73910691c74ec1a2a7023c851eac08d`  
**Extract:** `/data/bizra/logs/sparc-spec-pseudocode/pdf-extract/DeepSeek_V41_Tech_Report.txt`  
**mtime (PDF):** 2026-10-30 · **Evidence class:** DECLARED external paper (claims inside PDF are *their* measurements, not ours)

---

## 1. What it is (measured on disk)

Open tech report for **DeepSeek-V4.1-Flash**: multimodal MoE, long-horizon / agentic workloads, focus = **KV cache compression** + deployment. HF path named in abstract: `deepseek-ai/DeepSeek-V4.1-Flash` (NOT fetched this turn).

## 2. Peak numbers (from extract — their claims)

| Claim | Value | Our label |
| --- | --- | --- |
| Backbone params | 552B MoE | DECLARED |
| Context | up to 1M tokens | DECLARED |
| Active params prefill / decode | 8B / 16B (CED) | DECLARED |
| Global KV (HBM) | **890 bytes/token** (~1/4 of V4-Flash) | DECLARED |
| Persistent KV (SSD/host) | ~1/8 of V4-Flash via SWA Bounded Replay | DECLARED |
| Pretrain corpus | 45T multimodal tokens | DECLARED |
| vs V1 global KV | ~437× smaller (their fig) | DECLARED |

## 3. Architectural linchpins (SNR for BIZRA/Dema)

1. **Input-heavy agents are a storage/bandwidth problem**, not only a FLOPs problem — KV HBM + persistent SSD + interconnect dominate cost.  
2. **CED (Causal Encoder-Decoder):** cheaper prefill (8B) vs decode (16B) — matches agent loops that re-read long traces.  
3. **CSA2:** cross-layer KV + indexer reuse (Generate / Reindex / Reuse modes) + hierarchical sparse indexer.  
4. **FP4 main KV** in training with “marginal” degradation (their words).  
5. **SWA Bounded Replay:** don’t persist every layer’s sliding-window KV; reconstruct with bounded recomputation — trade SSD for a little prefill.  
6. **Engram / DSpark / Single-Pass mHC:** memory/traffic + speculative decode extensions (secondary to CSA2/CED for our season).  
7. **Post-train agents:** task = `(problem, environment, verification)`; quality axes difficulty + correctness; lifecycle re-audit from RL trajectories; mocked tools from real interfaces; **DSec** = massive agent runtime (named, not reimplemented here).

## 4. Lost-in-noise / red-team (their own limitations)

- CSA2 **selection errors** and SWA **approximate reconstruction** may fail at untested boundaries.  
- Benchmark saturation ≠ frontier parity on hardest tasks (they explicitly warn).  
- Scores approaching closed models ≠ matching edge-case reasoning.

## 5. BIZRA season mapping (do / don’t)

| Do absorb (wisdom) | Don’t absorb (effect) |
| --- | --- |
| Separate **global** vs **local/SWA** state; bound what must stay hot | Download/run DeepSeek weights without GO |
| Prefer **replay/recompute** over unbounded persistent caches | Claim Node0 hosts 1M-ctx MoE |
| Agent fuel = verified tasks with **verification system** | Treat paper benches as our receipts |
| Controllable reasoning effort as a first-class RL knob | Equate DSec with Dema runtime |

**Analogy (PREVIEW only):** TMPK Truth Spine ≈ append-only global KV of *governance*; SWA ≈ short local working set; Bounded Replay ≈ re-derive local state from sealed chain instead of inventing ambient memory. Autopoietic gate’s linkage corroboration ≈ refuse to promote uncached/uncorroborated “insight.”

## 6. Forbidden promotions

- Not `RSI_LIVE` / `SINGULARITY_LIVE` / `NODE0_CLOSED`  
- Not “we integrated DeepSeek-V4.1”  
- Not economic mint from paper numbers  

## 7. Admit decision (human GO 2026-10-30)

**Verdict:** `ADMITTED_MAP_CANDIDATE` only.  
**Code:** `packages/core/src/deepseek-v41-flash-admit-preview.js` + tests.  
**Includes:** PDF sha256 bind + KV-estate vocabulary (global/SWA/persistent/replay).  
**Still GO-gated separately:** weight download / GPU alloc / model invoke — exact phrase in module `WEIGHTS_FETCH_REQUIRES`.

---

## What this map does NOT prove

We did not run the model, verify 890 B/token, reproduce benches, or load HF weights. Extract + sha256 prove **file presence and text extraction**, not model capability. Admit preview proves **constitutional registration of the map**, not runtime readiness.
