# Receipt: DEMA-TRACE-DIAGNOSTIC-CONTRACT-1A

Truth label: `DEMA_TRACE_DIAGNOSTIC_CONTRACT_PREVIEW_ONLY`

## Slice

Moat gate: every important system contract observable, testable, diagnosable. Each trace is admissible ONLY with explicit scope, completeness, and correlation limits. Promotion to insight requires the complete four-rail contract: **provenance · consistency · disambiguation · corroboration** — composition is the moat.

## Proof Contract

### v0.1 (historical — preserved for backward compatibility)

- **Provenance**: each trace carries scope (explicit, never UNKNOWN/*), completeness ∈ {COMPLETE, PARTIAL, SCOPED}, correlation_limit, source_ref, source_sha256 (64-hex), observed_at; duplicate trace_id blocked.
- **Consistency**: hypothesis_graph referential integrity — every explains_traces ref must exist; duplicate hypothesis_id blocked.
- **Disambiguation**: ≥2 hypotheses required (graph-of-thoughts); single hypothesis is REMAIN_TRACE, not insight — prevents premature closure.
- **Corroboration**: independent replay_performed + independent=true + 64-hex independent_replay_hash required.
- **Promotion**: provenance failure => BLOCKED (inadmissible); any other rail failure => REMAIN_TRACE; ALL FOUR true => INSIGHT_AUTHORIZED.
- **Semantic rederivation**: verify recomputes from carried inputs and rejects tampered promotion_status/rails even with recomputed diagnostic_hash; hash mismatch and rails_mismatch both blocked.
- **Boundary**: all-false preview boundary (17 keys), deep-frozen, deterministic content-addressed diagnostic_hash (`sha256:` canonical JSON v1).
- **Event-driven spine**: traces → hypotheses (this gate) → bounded proposals → verified reversible transitions remains separated; gate classifies, never executes.

### v0.2 (subject binding — used for new promotions)

v0.2 inherits all v0.1 rails and adds:

- **Insight integrity**: insight_candidate must have non-empty `claim` and non-empty `evidence_refs` (prevents empty/promotional insights from authorizing).
- **Evidence-ref resolution**: every `evidence_ref` must resolve to an existing `trace_id` in the trace_set (prevents citing non-existent evidence).
- **Evidence coverage**: every `evidence_ref` must be covered by at least one hypothesis `explains_traces` edge (prevents orphan evidence from authorizing insight).
- **PARTIAL-completeness restriction**: if any cited trace has `completeness: PARTIAL`, promotion remains REMAIN_TRACE regardless of other rails (partial evidence cannot authorize insight).
- **Subject binding**: `replay_subject_hash` = SHA-256 stable-stringified(trace_set + hypothesis_graph + insight_candidate); must match for corroboration to pass. This binds the verification to the exact inputs — a subject binding, NOT proof that the verifier is truly independent.
- **Adversarial probe**: review gate tests evidence-laundering attack (evict hypothesis coverage after build → orphan ref → refused).

v0.2 does NOT prove: that a promoted insight is true, that production traces were measured, that the verifier is truly independent (replay_subject_hash is a binding, not an independence proof), or that any system change is authorized.

## What this does NOT prove

No claim that a promoted insight is true, that production traces were measured, that a system change is authorized, that a daemon/federation/mint/wallet/network ran, or that any autopoietic loop closed, or that the verifier is truly independent (subject hash is a binding, not an independence proof). v0.1 preserved for historical reports; v0.2 used for new promotions. Classification is preview-only; authority remains gated behind separate exact-consent and reversible-transition verifiers.

## Proof ran

Focused 26/26 (14 v0.1 + 12 v0.2) · gate PASS (INSIGHT_AUTHORIZED with 4/4 rails, single-hypothesis probe blocked, tamper probe caught via semantic rederivation, v0.2 subject binding verified, v0.2 evidence-laundering attack detected) · review gate PASS (happy path + single-hypothesis refusal + tamper probe + v0.2 evidence-laundering probe) · npm test 9763/9767 pass (4 skipped, G8 0 unclassified) · git diff --check clean · authority_delta 0.

## Moat statement

Prevention at cause: this composition binds every system contract to an observable, hash-anchored, scope-declared trace before reasoning amplifies. Teams diffuse a finding across modules through the four rails — a missing scope is provenance BLOCKED, not a silent peer; a single-hypothesis narrative is disambiguation REMAIN, not insight. The diagnostic contract is the moat that turns drift into a classified, reversible, operator-visible refusal before it becomes a consequence.
