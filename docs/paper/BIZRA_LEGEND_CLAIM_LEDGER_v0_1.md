# BIZRA Legend Paper — Claim Ledger v0.1

Truth label: `PAPER_EVIDENCE_META_DOCS_ONLY`. This is a **meta-analysis** of an external paper, not a
capability. Registry unchanged.

## Subject (hash-pinned external artifact — not imported)

- Title: *Architectural Decoupling of Agency and Verification: A Formal Protocol for Epistemologically
  Bounded Autonomous Systems*
- Path: `/home/bizra-operating-system/Downloads/BIZRA_Legend_Paper_v0_1.pdf` (12 pp, external)
- **SHA256: `2d0953d0d3cdc597f0b0576b3420074ff0d8f0d89059c8623be5f10112469b01`**
- Every claim below was extracted from the **real PDF**, not the audit paraphrase.

## Proof classes

`FORMAL` (axiom/theorem/definition) · `CRYPTOGRAPHIC` (proven under crypto assumptions) ·
`EMPIRICAL` (measured) · `ECONOMIC` (contract/incentive design) · `DESIGN_ONLY` (specified, not
proven/deployed) · `DIRECTION_ONLY` (aspirational roadmap).

## The sentence to preserve (paper's central falsifiable thesis)

> "BIZRA reduces agent failure modes to violations of explicit, testable architectural invariants" —
> **not** "eliminates." (Abstract; §1.1 Thesis; Remark 6.6.)

## Ledger

| id | claim (from paper) | proof_class | current_evidence | missing_evidence | overclaim_risk | next_proof_step |
|---|---|---|---|---|---|---|
| CL-01 | Causal Entanglement: P_gen and P_ver share weights/context/history → `I(H_gen;H_ver) > 0` | FORMAL | Def 3.2; §1, §3.2 | none (definitional) | low | — |
| CL-02 | Verification Independence Axiom: any signal updating state/weights/authority must originate from a causally-disjoint process | FORMAL (normative) | Axiom 3.1 | it is a normative, not empirical, claim (paper §10.2 construct validity) | low (paper flags it) | formalize invariant checker |
| CL-03 | Hallucination, reward-hacking, prompt-injection, context-exhaustion are VIA violations, not capability gaps | FORMAL / argumentative | §1, §3.2 (four stress-tests) | empirical failure-mode benchmark | medium | AdvBench + adversarial sim |
| CL-04 | PAT/SAT airgap: Ring-3 proposer, Ring-0 verifier | DESIGN_ONLY | Def 4.1 (paper calls it "a design invariant, not a theorem", Remark 4.2) | static analysis; formal proof | medium | FATE-wiring static analysis (§11.1) |
| CL-05 | Asymmetric Authority Gradient `A(E,a) ≤ A_previous` — a failure classification cannot increase authority | DESIGN_ONLY → **operationalized in Dema** | paper Def 4.1; **Dema: every preview kernel carries `authority_delta:0`, `grants_action:false` (FDE-dual-diagnostic, socratic-critic, zero-overclaim, supply-reward)** | formal proof of the gradient | low | — (strong repo evidence) |
| CL-06 | FATE non-bypassability (Thm 6.3) | FORMAL (conditional) | Thm 6.3 proof, **conditional on the runtime construction invariant — "not yet discharged via static analysis; high-priority future work"** | static analysis proving all action paths route through FATE | high if stated unconditionally | `DEMA-FATE-WIRING-STATIC-ANALYSIS-PREVIEW-1A` |
| CL-07 | Isnād/Matn Isolation: `μ ∉ C_t` — untrusted payload never enters proposer context | DESIGN_ONLY (conditional) | Def 5.1; Outside-In Sandbox §5.2 | sandbox implementation evidence + benchmark | medium | Matn/PAT invariant in Coq/Lean (§11.1) |
| CL-08 | Tamper-evidence of the receipt chain (Thm 6.1) | CRYPTOGRAPHIC | **UNCONDITIONAL under collision-resistant H + EUF-CMA Σ**; proof §6.3 | none beyond stated crypto assumptions | low (strongest proven claim) | — |
| CL-09 | Non-repudiation (Thm 6.2) | CRYPTOGRAPHIC | under EUF-CMA-secure Σ; proof §6.3 | none beyond assumptions | low | — |
| CL-10 | Indirect prompt injection reduced to invariant violation (Thm 6.5) | FORMAL (conditional) | conditional on `μ∉C_t` + Outside-In Sandbox; Remark 6.6 explicitly refuses "eliminates/immune" | AdvBench/Agent-Security-Bench validation | **high if worded as "immune"** — paper already forbids this | prompt-injection benchmark (§11.1) |
| CL-11 | PoI soundness vs Sybil/collusion (Thm 6.7) | FORMAL (conditional) | under honest-majority `|N_A| < k`, `k≥2` | multi-node federation execution | medium | Stage-3 federation |
| CL-12 | Non-Parametric Distillation / Skill Files: entropy-preserving, structural counter to catastrophic forgetting | DESIGN_ONLY | §7.2, Remark 7.5; paper does **not** claim it "solves" forgetting | continual-learning benchmark (Permuted MNIST) | medium | continual-learning benchmark (§11.1) |
| CL-13 | No passive rent (Prop 7.3): `lim decay = 0` — no ongoing reward from past contributions | ECONOMIC (formal) → **operationalized in Dema** | Prop 7.3; **Dema #339 supply-reward: availability/service rewarded, not ownership; `mint_allowed:false`** | live settlement (DESIGNED_NOT_LIVE) | low | — |
| CL-14 | No speculation (Prop 7.4): PoI non-transferable, no secondary market | ECONOMIC (design) | Prop 7.4 | live ledger | low | — |
| CL-15 | Islamic financial principles (no riba/gharar/fake value) operationalized architecturally | ECONOMIC / DESIGN | §7.3; **Dema: reward-eligibility (#328) + supply-reward (#339), `mint_allowed:false`, founder no-mint oath** | live economy (not built) | low | — |
| CL-16 | Preliminary single-node measurements: FATE eval 0.42±0.08 ms, TFP overhead 3.7%, sandbox spawn 8.3±1.1 ms | EMPIRICAL | Table 3 (§8.2) | **measured on the external Python runtime, NOT this repo**; multi-node + adversary unmeasured (§8.4) | medium (do not attribute to Dema) | reproduce with published harness |
| CL-17 | Protocol complexity `O(log n)`, amortized verification `O(1)` (Thm 4.7) | FORMAL | Thm 4.7 proof | — | medium — Remark 4.8 warns: never say "O(1) verification cost" without the amortization qualifier | keep qualifier |
| CL-18 | "the first agent architecture that enforces VIA structurally" | DIRECTION_ONLY / priority claim | abstract, §1.1 | a priority/novelty claim is not verifiable from within | **high** — "first" is unbounded | soften to "to our knowledge" or drop |
| CL-19 | Ring-0 / kernel-space enforcement of SAT + FATE | DESIGN_ONLY | Table 1, §4.2; implementation is **bubblewrap process isolation**, not literal kernel code; TEE is §5.4 **Direction only** | TEE deployment (SGX/SEV-SNP/CCA) | **high** if read as literal kernel-space | deploy TEE (§11.1 step 1) |
| CL-20 | Federation: Tree/Forest stages, universal URP | DIRECTION_ONLY | §11 explicitly "Direction Only"; "no stage is claimed until the prior is proven" | Stage-3 execution | low (paper is explicit) | — |
| CL-21 | **Central thesis:** reduces failure modes to testable invariant violations (not "eliminates") | FORMAL (falsifiable) | Abstract, §1.1, Remark 6.6 | — | low | **preserve verbatim** |

## Summary

- **Proven now (cryptographic):** CL-08, CL-09 (tamper-evidence, non-repudiation) — unconditional under stated crypto assumptions.
- **Conditional formal:** CL-06, CL-10, CL-11, CL-17 — theorems with explicit conditions the paper names.
- **Design-only:** CL-04, CL-05, CL-07, CL-12, CL-14, CL-15, CL-19.
- **Direction-only:** CL-18 (priority), CL-20 (federation).
- **Highest overclaim risk:** CL-06 (if stated unconditionally), CL-10 (if "immune"), CL-18 ("first"), CL-19 ("kernel-space" literal). See the forbidden-wording patch list.
