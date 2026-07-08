# BIZRA Legend Paper — Tier-1 Rewrite Plan v0.1

Truth label: `PAPER_EVIDENCE_META_DOCS_ONLY`. Rewrite frame for the paper (sha256 `2d0953d0…469b01`)
toward an A/A* standard. **This doc adds only what the existing meta-docs lack; it does not restate them.**

## Defers to (canonical — do not duplicate)
- **Claim ledger:** `BIZRA_LEGEND_CLAIM_LEDGER_v0_1.md` (CL-01…CL-21, per-claim proof class + overclaim risk).
- **Evidence map:** `BIZRA_LEGEND_IMPLEMENTATION_EVIDENCE_MAP_v0_1.md` (Python-runtime vs Dema-JS split; Table 3 belongs to the external Python codebase).
- **Wording patches:** `BIZRA_LEGEND_FORBIDDEN_WORDING_PATCH_LIST_v0_1.md` (residual: "first architecture", literal "kernel-space").
- **References:** `BIZRA_LEGEND_REFERENCE_AUDIT_v0_1.md` (corrected 2026-07-09 — refs are real, byline placeholder only).

## 0 · Headline assessment
The paper is already top-decile on overclaim discipline. Its Tier-1 blockers are: (a) placeholder bylines
[fixed in the reference audit], (b) an evaluation not replayable by the reader, (c) five co-equal contributions
diluting the one idea, (d) a sharper prior-art delta. None is prose-overclaim.

## 1 · Contribution hierarchy (elect ONE idea)
Restructure §1.1 from five co-equal contributions to one headline + corollaries.

**PRIMARY (the repeatable sentence):** *Don't make the model more honest — make honesty not the model's job.*
Verification Independence (VIA): put the prover causally outside the proposer, and hallucination / reward-hacking
/ prompt-injection / catastrophic-forgetting collapse into violations of **one** explicit, testable architectural
invariant (ties to CL-01/02/03/21).

**SECONDARY (corollaries):** PAT/SAT airgap (CL-04) · Isnād/Matn `μ∉C_t` (CL-07) · receipts-as-evaluation-objects
(CL-08/09) · PoI (CL-11/13/14).
**TERTIARY (evidence):** the unconditional tamper-evidence theorem (CL-08) + the replayable proof-object lifecycle (below).

Product spine to integrate as the *instantiation* of the one idea (verify each disk referent, else label DESIGN):
Dema = membrane/face · cockpit = visible truth surface · receipts = evaluation objects · FDE = failure-laundering
guard (`dema-fde-dual-diagnostic`) · SDK/ADK = proof-object verify / proof-bound agent build (**confirm disk referent or label DESIGNED**).

## 2 · Figure 1 — the replayable proof object (NEW; not in the meta-set)
Make Figure 1 the spine and the most-screenshotted asset. Depicts the run captured in the evidence pack
(`/data/bizra/legend-paper-audit/BIZRA_LEGEND_PAPER_FIGURE1_EVIDENCE_PACK_v0_1.md`), pinned to a Dema commit:

```
untrusted input → sanitize (μ∉C_t) → plan → FATE (consent∧proof) → pulse
      → emit  [receipt · world_state_delta(applied:false) · dema_report · emission.json]  ← content-addressed
      → dema mission cockpit <run-id>   re-verifies the WHOLE chain + renders gates ✓×8, writes nothing
```
Caption: **"every arrow is a hash; reproduce this figure in two commands."** This is the Dema-JS evaluation lead
(operator decision) — NOT the Python Table 3 (which stays attributed to the external runtime per the evidence map).

## 3 · Evaluation plan (receipts-as-evidence)
Reframe §8 from latency micro-benchmarks to **self-verifying evaluation**:
1. Centerpiece: the `emit→cockpit` proof object; ship the fixture + one-command replay; every MEASURED claim links to a replayable receipt.
2. Show the negative control: a tampered artifact → cockpit refuses (`artifact_hash_mismatch`). Prover-catches-forgery is the paper's "matched control."
3. Keep the Python latency table, bound to a released harness + commit, labeled as the external systems-runtime.
4. State the non-claim: this demonstrates *reproducibility of proof objects*, not task-success superiority (no AdvBench number — say so).

## 4 · Limitations — model on Anthropic's J-space paper (transformer-circuits.pub/2026/workspace)
That paper is the best in-genre exemplar of hard-result-plus-surgical-bound. Graft five moves:
1. **Every headline claim gets a matched control** (their 59%-vs-5% swap; ours = tamper→refuse).
2. **Quantify the surprise** (their "6–7% of variance carries the power"; ours = boundary all-false, sub-ms gate, `authority_delta:0`).
3. **Self-author limitations harder than a reviewer would** (their 7-item J-lens method-limits list; ours = Python-vs-JS, sanitizer-is-filter-not-sandbox, ephemeral-not-persisted signature).
4. **Split functional from phenomenal** — steal the sentence shape: *"a rendered cockpit means the artifacts are consistent and the anchor verifies — NOT that the mission's claims are true."*
5. **Cite the alignment-auditing convergence** — their J-space flags eval-awareness / prompt-injection / hidden objectives; cite as independent top-lab convergence on "adversarial intent is detectable at the architecture/representation level" (supports CL-07/CL-10).

## 5 · Reviewer-risk table
| Objection | Sev | Needed |
|---|---|---|
| Placeholder bylines | 🔴 | fixed in reference audit — apply to the PDF |
| "Capability-security / IFC / seccomp / gVisor / TEE rebranded?" | 🔴 | sharp per-prior-art delta in §2 (VIA's addition over each) |
| "VIA is a tautology / unfalsifiable" | 🟠 | front-load the reduces-to-invariant falsifiability (CL-21), don't bury in §10.2 |
| "Table 3 not replayable / where's the code?" | 🔴 | lead with the Dema-JS proof object; bind the Python harness + commit |
| "Single-node; theorems conditional — what's proven?" | 🟠 | lead security with the unconditional theorem (CL-08) |
| "Islamic-finance framing off-venue" | 🟠 | modularize; systems contribution stands alone; pick venue |
| "No task-success benchmark" | 🟢 | reframe as self-verifying evaluation |

## 6 · Recommended outline (v0.2)
1. Intro: Causal Entanglement → VIA (one-sentence contribution).
2. VIA formalized + falsifiability front-loaded.
3. ★ The proof-object lifecycle — Figure 1, runnable [elevated].
4. Architecture as corollaries (PAT/SAT, Isnād/Matn, FATE — condensed).
5. Security theorems — lead with the unconditional CL-08; CL-06/10/11 clearly conditional.
6. Evaluation — self-verifying proof objects + bound latency table.
7. Limitations — J-space-style bounding.
8. Related work — sharp per-prior-art delta.
9. Conclusion.
Move to bounded sections (off the spine): Islamic-finance alignment, federation roadmap, PoI economics.

## 7 · Rewrite order (bounded, gated)
1. Apply the reference-audit corrections to the PDF (bylines + [6] ID, [4] venue, [8]/[16]/[17] orphans). [BLOCKER]
2. Elevate ONE contribution (§1.1); subordinate the mechanisms.
3. Add Figure 1 + the reproducible evaluation lead; ship the fixture in the repo.
4. Apply the two wording patches ("first", "kernel-space") per the patch list.
5. Sharpen §2 prior-art delta; front-load falsifiability.
6. Upgrade limitations with the J-space bounding moves.
7. Venue decision → tune the Islamic-finance framing.

## Verification tasks still open (disk-wins)
- [ ] Confirm SDK/ADK product-spine terms have disk referents, else label DESIGNED (FDE ✓ = `dema-fde-dual-diagnostic`).
- [ ] Bundle `figure1-input.txt` + the two-command replay into the paper's artifact repo under a pinned commit.
- [ ] Human skim of refs [2] (solo preprint) and [6] (ID collision) PDFs before finalizing.
