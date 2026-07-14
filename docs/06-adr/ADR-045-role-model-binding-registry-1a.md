# ADR-045 — Role↔Model Binding Registry (NODE0-ROLE-MODEL-BINDING-REGISTRY-1A)

- **Status:** ACCEPTED as SHADOW-only slice (mission NODE0-HCF-A-PLUS-MISSION-CORRIDOR-1A). Not runtime canon. Fleet architecture itself remains **undecided** — this ADR selects an implementation spearpoint, not a fleet.
- **Truth labels:** design here is `DESIGN_ONLY` until the paired kernel + tests land in the same slice; measured inputs cited below carry their own labels.
- **Evidence base:** `artifacts/mission-corridor/NODE0-HCF-A-PLUS-1A/evidence-manifest.json` (sha256-bound artifacts; sandboxed collection).

## Context

1. The merged C0 fleet kernel (`agent-role-contract.js`, `node0-agent-fleet-roles.js`, PR #392) **hard-codes** model families into role contracts: PAT=`gemma`, SAT=`deepseek`, all roles `size_class 3-4B`.
2. The C0 judge baseline (74 held-out, grammar-constrained, lane 1 only) **measured**: gemma4:26b 90.54% · gemma4:e4b 79.73% · whiterabbitneo 72.97% · qwen3:4b 58.11% · **deepseek-r1:7b 29.73%** — the design's SAT family is the worst measured judge, and the best family (gemma) is design-forbidden for SAT while PAT holds it (`base_family_shared_across_teams`).
3. Today the codebase cannot *represent* "binding contradicted by evidence; operator decision pending." The C1 campaign is halted on exactly this (base-model fork in `JUDGE-C1-TRAINING-CAMPAIGN-CONTRACT-DRAFT.json`).
4. Residency measurements (`fleet-residency-report.json`): three 3–4B bases co-reside in 16 GB (9.8 GB, 100% GPU); warm eval 11–36 ms; cold reload 919–1,287 ms. Measured for small bases; **not** a system-wide law.

## Candidate fleet architectures — kept open

| Lane | A: 12 dedicated small checkpoints | B: shared bases + role adapters | C: hybrid heterogeneous fabric |
|---|---|---|---|
| 1 short SAT judgment | over-provisioned; weak 2–4B judges measured | viable if SAT base family is independent AND measured (today's best eligible: 58–63%) | viable; burst 26B-via-RAM-offload measured strongest (90.54%) |
| 2 PAT collaborative reasoning | 7 checkpoints to train/maintain, unmeasured | adapter multiplexing on 1 base, unmeasured | same + deterministic tools, unmeasured |
| 3 Foundry long-context ingestion | small ctx models unfit (U) | KV/offload pressure unmeasured | offload/burst lane designed for this (U) |
| 4 code & reproduction | unmeasured | unmeasured | deterministic tools preferred; model optional (U) |
| 5 external research | unmeasured | unmeasured | network-gated; mostly harness not model (D) |
| 6 deep synthesis | 2–4B below reasoning floor (per spec §2 note, D) | base size cap binds | burst expert path (U) |
| 7 burst expert mission | N/A (all small) | N/A (bases resident) | measured: 26B via 105 GB RAM offload works; 51B failed load |
| 8 background bounded batch | idle-friendly (D) | idle-friendly (D) | idle-friendly + checkpointing (D) |

**No architecture can be closed on current evidence** — only lane 1 and fragments of lane 7 are measured. Twelve lenses summary (functionality→cost): all three candidates fail "verifier independence" *as currently coded* because independence is asserted by hard-coded family, not by evidence; all three need the same missing primitive.

## Decision — the spearpoint

Implement a **pure, SHADOW-only, fail-closed role↔model binding registry kernel**: `packages/core/src/node0-role-model-binding-registry-preview.js`.

- Logical role contracts (existing `validateAgentRoleContract`) stay decoupled from model families; a binding exists **only** through an evidence-bearing **capability record** `{role, lane, model, backend, family, evidence{sha256, measured_at_iso, metric, value}, limitations, resource_envelope, privacy_class, consent_ref, verification_state, superseded_by, contradicted_by}`.
- `resolveRoleModelBinding` decides `BOUND_SHADOW | BOUND_CANDIDATE | REJECTED | ABSTAIN | REQUIRES_HUMAN`, deterministically, with reasons, and a content-addressed decision receipt (reuses `sha256`/`stableStringify`; boundary via `buildPreviewBoundary` — all-false).
- Fail-closed rules: unknown mode/lane/shape → reject; missing/stale/non-hex evidence → reject; superseded/contradicted → reject; budget exceeded → reject; missing privacy class or consent ref → reject; PAT binding to the SAT-judgment lane (SAT authority) → reject; SAT binding to any mission-operating lane → reject; SAT family shared with PAT families → reject; independence unverifiable → **ABSTAIN**; record family contradicting the C0 design family → **REQUIRES_HUMAN** (`spec_reopen_required`) — the measured gemma/deepseek contradiction becomes representable instead of silent.
- Multiple eligible records → reject `ambiguous_multiple_eligible_records` (ranking is a later measured slice).
- The kernel cannot activate roles, invoke models, write files, mint, or widen authority; modes other than SHADOW/CANDIDATE are rejected (activation attempt fails closed).

## Rejected alternatives (this mission)

- **3-base co-resident router demo** — highest operator interest, but requires live ollama; the sandbox netns blocks `127.0.0.1:11434` (OUT-2). Not executable under containment; unchanged as a future slice.
- **Live extension of the judge baseline to a second lane** — same OUT-2 blocker; only deterministic fixtures land now.
- **Typed Thought-Exchange packet schema slice** — no measured contradiction forcing it yet; the registry embeds the verdict/abstain vocabulary it would need first.
- **Editing C0 contracts to swap families now** — forbidden: that decision is the operator's (spec-reopen); code must represent the pending state, not resolve it.

## SNR receipt

`registry = evidence(measured contradiction on disk) + actionability(pure kernel, no blocked lane) + leverage(unblocks C1 base pick; represents A/B/C uniformly) + risk_reduction(fail-closed everywhere) + BIZRA_alignment(consent/independence/abstain) − speculation(none beyond v0.1 vocab) − ambiguity(single-eligible rule) − drag(≤3 files)`. Every rejected alternative loses on actionability (OUT-2) or evidence.

## Rollback / supersession

Rollback = revert the slice commits (pure kernel + tests + docs; no state, no migration). Superseded when a measured ranking policy or the operator's spec-reopen decision lands; this ADR then gains a `Superseded-by` header line. Historical C0 contracts are **not** rewritten by this slice.

## What this does not decide

Fleet architecture A/B/C; any model family assignment; adapter training; serving topology; Thought Exchange transport; URP placement policy. All remain candidates pending lane measurements and operator decisions.
