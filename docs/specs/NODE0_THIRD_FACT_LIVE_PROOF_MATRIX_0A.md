# NODE0-THIRD-FACT-LIVE-PROOF-MATRIX-0A

**Truth label:** `DESIGN_ONLY_LIVE_PROOF_MATRIX_0A`
**Status:** design/scoping — no implementation; the master checklist that turns Third Fact claims into measurable live-code proof points.
**Date:** 2026-07-09

> This document does not prove anything. It states, per claim, what is **already proven**, what is **candidate**, and what is **designed but not live** — and the exact metric/test that would promote each. Its only job is to stop a claim being called "proven" before it is.

---

## 1. Evidence boundary (verified on disk)

| Exists | Does NOT exist |
|---|---|
| Root founder receipt (`~/.dema/founder-impact/15054ede…`, VERIFIED, tamper→FAILED) | Live PoI |
| Local asset inventory (`inventory-v0.1.json`, **1,314** records, `LOCAL_METADATA_MEASURED`) | Token mint |
| FDE dual-diagnostic (tested, registered) | Federation / URP web connection |
| `#366` design PR + `#367` impl PR (CI green, **unmerged**) | Autonomous PAT/SAT runtime |
| Shipped rails: sanitizer, claim-gate, boundary-vocab, receipts, no-overclaim gate, operator-lexicon guard (`#364` merged) | Measured performance evals (reconstruction, replay, block-rate) |
| 9 `dema mission …` commands (pulse/review/shelf/compact) | Verified impact of any kind |

---

## 2. Third Fact claim matrix

Status legend: **PROVEN** (shipped + verified) · **CANDIDATE** (mechanism exists, not yet measured/verified) · **DESIGNED_NOT_LIVE** (specified, not built) · **BLOCKED** (gated until a prior proof).

| # | Claim | Root anchor | Pain solved | Current evidence (real) | Missing live-code proof | Metric | Test method | Receipt | FDE class on failure | **Status** |
|--|--|--|--|--|--|--|--|--|--|--|
| 1 | Human/mission is the center, not the LLM | Third Fact | LLM-centric fragility | 9 `dema mission` cmds; receipts persist outside chat | Session-reload eval: kill chat, rebuild mission from receipts, continue | `mission_reconstruction_accuracy ≥ 0.95`; `critical_state_loss = 0` | replay harness (unbuilt) | mission-state receipt | inward (state) | **DESIGNED_NOT_LIVE** |
| 2 | Human is the node; machine is substrate | Third Fact | cloud dependency | local inventory + local receipts + local dema state (1 device) | 2-device Node0 space; cross-device state | device-parity checks | multi-device harness (unbuilt) | node-space receipt | outward (env) | **CANDIDATE** (1-device); 2-device DESIGNED_NOT_LIVE |
| 3 | Every verified contribution → light | Third Fact | unrecognized labor | asset→consent→receipt proven (founder receipt) | classification + **verification** (SAT) steps | `public_candidate_count`, `top_3_next_receipt_candidates` | `dema assets shareability` (next slice) + SAT (later) | impact-candidate receipt | economy | **CANDIDATE** (path partial; verification not live) |
| 4 | Don't believe words; inspect receipts | Third Fact | hallucinated progress | founder loop + FDE emit receipts; refusal-receipt schema exists | universal "every action → receipt/refusal" | `receipt_coverage = 100%` | coverage audit (unbuilt) | per-action receipt | inward (proof) | **CANDIDATE** |
| 5 | Context must not vanish | Third Fact | context-window limits | receipts + typed memory on disk | replay reconstructs mission > 1 context window | `retrieval_precision@10`, `mission_continuity_score`, `compression_loss_rate` | context-bypass harness (unbuilt) | replay receipt | inward (state) | **DESIGNED_NOT_LIVE** |
| 6 | Humanity is not fuel | Third Fact | data extraction | **founder receipt binds hashes, not bytes** (`raw_data_included:false`, verified); inventory is local-metadata-only; no upload | (universal enforcement audit) | `raw_data_leakage_count = 0` | grep + boundary assert (**passed today** on founder receipt) | hash-bound receipt | boundary (consent) | **PROVEN** (0A scope) |
| 7 | If it fails, correct; if it harms, stop | FDE doctrine | false repair / fake progress | FDE dual-diagnostic shipped + tested; authority-monotonic (`authority_delta:0` observed) | live auto-repair loop bound to real failures | classification accuracy on injected failures | FDE inject-suite (partial) | diagnostic receipt | (self) | **PROVEN** (classifier) · repair-loop DESIGNED_NOT_LIVE |
| 8 | Proof before reward | Third Fact | simulated value → token | `mint_allowed:false` enforced everywhere (founder receipt, registry) | verified-impact → mint path (needs SAT) | `mint_before_verify = 0` (invariant) | invariant test (partial) | — | economy | **PROVEN** (the refusal) · mint-path BLOCKED |
| 9 | Seed before forest | Third Fact | premature scale | one-node local loop demonstrated (founder receipt) | complete one-node lifecycle **measured** alone | `one_node_lifecycle_pass` | lifecycle harness (unbuilt) | lifecycle receipt | outward (env) | **CANDIDATE** · federation BLOCKED |

---

## 3. Required claim categories (coverage checklist)

`human-mission-centric` · `context-window-bypass` · `persistent-memory` · `hallucination-resistance` · `consent-and-sovereignty` · `local-asset-inventory` · `asset-shareability-value-map` · `receipt-chain-and-tamper-evidence` · `fde-failure-classification` · `pat-sat-boundary` · `proof-of-impact-candidate-path` · `performance-quality-gates` · `node0-one-human-full-lifecycle`

---

## 4. Performance / quality metrics (targets, unmeasured until harnessed)

`mission_reconstruction_accuracy` · `retrieval_precision@10` / `recall@20` · `hallucination/unsupported_claim_block_rate ≥ 0.98` · `false_positive_block_rate ≤ 0.05` · `receipt_coverage = 100%` · `asset_classification_coverage` · `receipt_verify_latency < 1s` · `replay_latency` · `context_reconstruction_latency` · `raw_data_leakage_count = 0` · `CPU/RAM/disk footprint` · `failure_recovery_time`.

Initial quality gate: no network, no model, no raw-corpus exposure, metadata classification within a bounded local budget.

---

## 5. Explicit non-claims

This matrix does **not** claim: verified impact · live PoI · token reward · federation · public network · autonomous SAT minting · that any metric above has been *measured* yet. Every measured cell is a **target**, not a result.

---

## 6. The category being staked

Node0 must not prove "AI is smarter." It must prove **"the mission survives the model"** — measurable as: can BIZRA preserve a human mission across memory, assets, consent, proof, receipts, and time better than an LLM chat window? Category: **mission-centric intelligence infrastructure**.

---

## 7. Next executable slice

`DEMA-ASSET-SHAREABILITY-0A` — run the shipped `dema assets shareability` over the existing 1,314-record inventory (metadata-only), producing the value/eligibility map (rows 3 + 5 above). No mint, no upload, no content sweep.
