# BIZRA Legend Paper — Implementation Evidence Map v0.1

Truth label: `PAPER_EVIDENCE_META_DOCS_ONLY`. Maps the paper's implementation claims (paper
sha256 `2d0953d0…469b01`, §8) to actual evidence status.

## Critical distinction (read first)

The paper reports "**approximately 4,200 lines of Python**" (§8) for a single-node Node0 runtime:
Python runtime, Ed25519 receipt chain, FATE gate, local URP seed with SQLite, PoI ledger, bubblewrap
Outside-In Sandbox. **This repository (`Dema`) is NOT that Python runtime.** Dema is the JavaScript,
zero-dependency **proof-discipline layer** (registry 40, preview kernels). The Python Node0 runtime is
a **separate codebase** (not in this repo). Therefore:

- Paper implementation claims must **not** be mapped to Dema repo paths as if Dema *is* the runtime.
- Where Dema carries a **preview kernel** of a paper concept, that is noted as `DEMA_PREVIEW` — a
  disciplined preview of the idea, not the live Python runtime the paper measured.

`status`: `PAPER_PYTHON_RUNTIME` (external Python codebase, not this repo) · `DEMA_PREVIEW` (a
preview kernel exists in this repo) · `DESIGN_ONLY` · `DIRECTION_ONLY`.

| paper claim (§8 / architecture) | status | Dema repo path (if any) | note |
|---|---|---|---|
| Python runtime hosting PAT/SAT agents (~4,200 LOC) | PAPER_PYTHON_RUNTIME | — | separate codebase; not in Dema |
| Ed25519-based receipt chain with SHA-256 hashing | PAPER_PYTHON_RUNTIME + DEMA_PREVIEW | `packages/core/src/preview-receipt-signing.js`, `node0-receipt-signing-ed25519.js` | Dema has **preview** signing surfaces; live signed anchor is future (`DEMA-RECEIPT-SIGNATURE-ANCHOR-1A`) |
| FATE gate as a strict pre-execution predicate | PAPER_PYTHON_RUNTIME + DEMA_PREVIEW | `packages/fate/src/fate.js` (exact-string consent), boundary schema | Dema exact-consent gate exists; the paper's Ring-0 FATE is the Python runtime; non-bypassability unproven (Thm 6.3 conditional) |
| Local URP seed with embedded SQLite | PAPER_PYTHON_RUNTIME | — | not in Dema; URP is `DESIGNED_NOT_LIVE` here |
| PoI ledger with configurable decay | PAPER_PYTHON_RUNTIME + DEMA_PREVIEW | `packages/core/src/poi-receipt-*.js`, `reward-eligibility-contract-preview.js`, `urp-supply-side-resource-reward-contract-preview.js` | Dema has **preview** reward/eligibility contracts (`mint_allowed:false`); no live ledger |
| bubblewrap-based Outside-In Sandbox for SAT | PAPER_PYTHON_RUNTIME | — | not in Dema (Dema runs no sandbox); process isolation lives in the Python runtime |
| Asymmetric Authority Gradient (`A(E,a) ≤ A_prev`) | DEMA_PREVIEW (strong) | every preview kernel: `authority_delta:0`, `grants_action:false` (FDE-dual-diagnostic, socratic-critic, zero-overclaim, supply-reward) | **Dema operationalizes this invariant repeatedly** — the strongest cross-artifact evidence |
| Table 3 measurements (FATE 0.42 ms, TFP 3.7%, sandbox 8.3 ms) | PAPER_PYTHON_RUNTIME (EMPIRICAL) | — | measured on the Python runtime on Apple M2 Pro; **not reproducible from Dema**; needs the published harness |
| FDE inward/outward diagnostic doctrine | DEMA_PREVIEW | `packages/core/src/dema-fde-dual-diagnostic.js` (+ forwarder) | shipped preview; hardening is future (`DEMA-FDE-DUAL-DIAGNOSTIC-HARDENING-1A`) |
| Socratic critic before verification | DEMA_PREVIEW | `packages/core/src/dema-socratic-critic-process-supervision-preview.js` | shipped this session (#337) — a Dema extension, not in the paper |
| Zero-overclaim speech gate | DEMA_PREVIEW | `packages/core/src/dema-zero-overclaim-response-policy.js` | shipped this session (#338) — Dema extension |
| First Light front door (human interface) | DEMA_PREVIEW | `apps/front-door/index.html` + kernel | shipped this session (#336) — the DEMA companion, not in the paper's scope |
| TEE-backed isolation (SGX/SEV-SNP/CCA) | DIRECTION_ONLY | — | paper §5.4 explicitly "not yet implemented … keystone of the critical path" |
| Multi-node federation | DIRECTION_ONLY | — | paper §11 Stage 3/4 "Direction Only" |
| Static analysis proving FATE wiring | not implemented | — | paper §11.1 step 2; future `DEMA-FATE-WIRING-STATIC-ANALYSIS-PREVIEW-1A` |
| Coq/Lean formalization of Matn/PAT invariant | not implemented | — | paper §11.1 step 3; future `DEMA-MATN-PAT-INVARIANT-PREVIEW-1A` |

## Downgrades required before public claim

1. Any measurement (Table 3) must be attributed to the **external Python runtime**, not to Dema.
2. FATE non-bypassability (Thm 6.3) must stay **conditional** until static analysis exists.
3. Prompt-injection immunity (Thm 6.5) must stay **conditional** on sandbox + Matn/PAT isolation.
4. Ring-0/kernel-space enforcement must be described as **process-level isolation modeled on Ring-0**,
   not literal kernel-space, until TEE is deployed.

## What is genuinely strong (Dema-side)

The **Asymmetric Authority Gradient** (CL-05) is not just paper text — this repo enforces it in every
preview kernel (`authority_delta:0`, `grants_action:false`, `mint_allowed:false`). That is the
paper's strongest claim with independent, reproducible repo evidence.
