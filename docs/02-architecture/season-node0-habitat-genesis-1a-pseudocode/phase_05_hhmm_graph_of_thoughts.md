# Phase 05 · HHMM + Hash Table + Diffusion (PREVIEW)

**Existing code:** `packages/core/src/framework-constellation-preview.js`  
**Status:** PREVIEW_ONLY · do not claim live hierarchical reasoning

## Contract

| Layer | Role | Live? |
| --- | --- | --- |
| HHMM | Macro→meso→micro state transitions for quest ticks | PREVIEW |
| Hash table | Content-addressed evidence / ISNAD binding | PREVIEW schema |
| Diffusion amplifier | Parallel candidate generation ranked by SNR | DESIGN |
| Graph of thoughts | Provenance edges subject–predicate–object | DESIGN (JSONL shape from Cartographer) |

## Pseudocode

```
compose_tick(evidence_bundle):
  macro ← hhmm_select_regime(bundle)
  meso  ← hhmm_select_stage(macro, quest)
  micro ← fog_slice(quest.target)
  candidates ← diffusion_expand(micro, k=small)
  ranked ← snr_rank(candidates)   # Formal∩Crypto∩Empirical∩Economic
  best ← ranked[0]
  IF best.needs_model AND NOT consent_exact_string → BLOCK
  IF best.needs_infra AND infra_unavailable → OUTWARD_DIAGNOSE
  ELSE RETURN {action:best, receipt_stub:true, live:false}
```

## Acceptance

- Constellation preview tests remain green
- No claim of continuous verification (level 5) until independent repro exists
