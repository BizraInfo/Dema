# Node0 Agent-Fleet Model Architecture — Design v0.1

- **Truth label:** `PLANNED / DESIGNED_NOT_LIVE` — this spec authorizes nothing and promotes nothing. Every training run, adapter load, and serving change behind it requires its own exact operator GO. No capability named here is live until an eval measures it and `docs/CURRENT_LIMITS.md` is updated in the same slice.
- **Bind:** 2026-07-13 session. Hardware and fleet rows below are `MEASURED_LOCAL` (operator machine); everything else is design.
- **Boundaries (constitutional):** zero corpus egress · no autonomous training runs (GPU-hours = halt gate) · no mint, no tokens, no reward wiring · failure never widens authority · SAT judges never share PAT's base weights.
- **Vocabulary honesty:** this is a **multi-agent fleet with per-role adapters**, *not* MoE (one jointly-trained routed network — referenced in BIZRA docs only as a boundary disclaimer), *not* agent RL, *not* verified reward, *not* a live autopoietic loop.

## 1. Decisions locked (operator, 2026-07-13)

1. **Adapters, not new models:** fine-tune per-role LoRA adapters on shared local bases (no pretraining; 12 separate 2B checkpoints rejected as cost without benefit).
2. **Local-only distillation:** all training data is built on Node0 from the operator's own artifacts with local teacher models. The corpus never leaves the machine.
3. **First-light agent: SAT boundary-judge** — the minimum provable special case; everything else scales only after its eval passes.

## 2. Fleet architecture (target, all co-resident on the RTX 4090 16 GiB)

| Brain | Class | Quantized VRAM (est.) | Serves |
|---|---|---|---|
| **Dema alpha** | 7–8B (today: whiterabbitneo-v3:7b, `MEASURED_LOCAL` best 6/6; swappable) | ~4.5 GB | routing, mission command, operator dialogue |
| **PAT base** | 3–4B (gemma-class) | ~2.7 GB | all 7 PAT roles via 7 LoRA adapters |
| **SAT base** | 3–4B, **different model family** (llama/phi/qwen-class) | ~2.3 GB | all 5 SAT roles via 5 LoRA adapters |

≈9.5 GB weights + ~4 GB KV headroom → twelve agents genuinely co-resident; "parallel thinking" = batched concurrent inference on the two bases, not twelve GPUs. Adapters are 30–80 MB files, hot-swappable, content-hashed in an **adapter registry** (name → sha256 → training-receipt pointer). Estimates carry ±20%; the serving slice must measure before claiming fit.

**Why not 12×2B:** twelve datasets and runs for independence that only matters across the PAT/SAT boundary — bought cheaper and stronger by giving SAT a different base family (classifier-independence doctrine). 2B is below the honest reasoning floor for judge/planner roles; 3–4B with harness structure is the floor.

## 3. Dynamic subagent trees (7×7 PAT, 5×5 SAT)

A spawned subagent is an **orchestration object, never new weights**: `{parent_agent, role_contract, context_packet, adapter_ref, budget, stop_conditions}`. PAT leads may spawn up to 7 subagents; SAT judges up to 5 — each spawn is a journal event in the mission corridor, so the "agent tree" IS the hash-chained journal DAG (the hypergraph/blocktree the operator names). Spawn depth 1 for v0 (leads spawn workers; workers do not spawn). Subagent authority ⊆ parent authority minus explicit subtractions; a spawn can never widen authority.

- **PAT (7 + subagents):** serve the operator only; run locally; lanes per existing PAT lane definitions (`DESIGNED_NOT_LIVE` today).
- **SAT (5 + subagents):** serve the system; bind to URP — **URP-Local** governor on Node0 now; remote URP residency stays `DESIGNED_NOT_LIVE` until federation gates exist.
- **Dema alpha:** the only agent that speaks to the operator by default; presents PAT results and SAT verdicts without merging them.

## 4. Communication substrate ("thinking together")

Thought-exchange is **structured artifacts on a shared blackboard**, never weight-level fusion:

- **Blackboard = corridor journal + receipts** (exists, `VERIFIED_REPO`): append-only, hash-chained, replayable.
- **Message schema:** `{from_agent, to (agent|room), claim, evidence_refs[], confidence_label (V/D/A/U), request}` — canonical-json-v1 serialized.
- **Two rooms:** PAT room (mission deliberation, operator-visible) and SAT room (judgment deliberation). SAT reads PAT's room; PAT never writes SAT's room. Verdicts flow one way: SAT → Dema → operator.
- **Deliberation pattern:** propose → challenge → converge, bounded rounds (default 3), disagreement surfaces to Dema as a fork report, never silently averaged.

## 5. Training pipeline (local-only distillation)

- **Data sources (all on-disk, all operator-owned):** review-gate outputs (labeled pass/block + reasons — produced daily by 131 gates), receipts and mission journals, corpus metadata from GENESIS-INVENTORY-0A (`MEASURED_LOCAL`), session transcripts under DEMA_HOME.
- **Teacher bench (local only):** qwen3-coder-next (51 GB, CPU/offload — strongest local teacher, slow is acceptable for data generation), whiterabbitneo-v3:7b, deepseek-r1:7b. No cloud teachers; no corpus upload.
- **Method:** QLoRA fine-tune of the role base on the 4090 (feasible envelope for 3–8B students). Each run is a **consented campaign**: contract (dataset hash, base hash, hyperparams, GPU-hour ceiling, output adapter path) → corridor start → run → receipt → corridor stop. A training run without a corridor contract is forbidden.
- **Registry:** every adapter lands as `{role, adapter_sha256, base_sha256, dataset_sha256, training_receipt, eval_report}` — no unhashed adapter is ever loaded.

## 6. Eval-first law (benchmark before believe)

Per role, in this order: (1) build the role eval suite; (2) measure the **un-tuned base + role contract** (phase C baseline); (3) train adapter; (4) adapter must beat baseline on the suite AND not regress a shared safety set. Promotion of any role from `DESIGNED_NOT_LIVE` requires: eval report + `CURRENT_LIMITS.md` row + receipt, same slice. `dema eval baseline/compare` is the harness spine (exists, `VERIFIED_REPO`).

## 7. First-light slice: SAT boundary-judge (the only implementation this spec points at)

- **Job:** given a receipt, boundary block, or PR-diff excerpt, classify {boundary_violation | overclaim | consent_gap | clean} with reasons.
- **Dataset:** labeled examples distilled from existing gate outputs + seeded adversarial violations (mutated boundary keys, forged all-false blocks, overclaim phrasings from the no-overclaim lexicon). Target ≥2,000 examples, held-out split ≥20%.
- **Eval (acceptance):** ≥95% agreement with deterministic gates on held-out real examples; ≥90% catch-rate on seeded adversarial set; zero regression on a 200-item clean set vs baseline. Judge output is **advisory forever** — deterministic gates remain authoritative; the judge adds coverage where no deterministic gate exists (fail-closed stays with the gates).
- **Phases:** C0 = judge-as-contract on un-tuned SAT base (baseline, no training) → C1 = QLoRA adapter run under corridor consent → compare → promote or reject honestly.
- **What C1 success does NOT prove:** nothing about the other 11 roles, nothing about deliberation quality, no live SAT autonomy, no URP residency.

## 8. Rollback & recovery posture

Adapters are files: rollback = don't load (registry pin flips back). Bases are immutable published GGUFs (re-pull by hash). Datasets and receipts are content-addressed on disk. Every phase is reversible by construction; nothing in this design mutates existing runtime, canon, or corpus.

## 9. Phase ladder (each phase = its own slice + its own GO)

C0 twelve role-contracts on existing fleet (no training) → C1 SAT boundary-judge adapter → C2 PAT corpus-librarian adapter → C3 serving slice (three bases co-resident, measured VRAM) → C4 deliberation rooms v0 (bounded rounds) → C5+ remaining roles, eval-gated, one at a time. No phase begins before the previous phase's eval report exists.
