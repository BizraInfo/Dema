# Receipt: DEMA-TRACE-DIAGNOSTIC-CONTRACT-1A

Truth label: `DEMA_TRACE_DIAGNOSTIC_CONTRACT_PREVIEW_ONLY`

## Slice

Moat gate: every important system contract observable, testable, diagnosable. Each trace is admissible ONLY with explicit scope, completeness, and correlation limits. Promotion to insight requires the complete four-rail contract: **provenance · consistency · disambiguation · corroboration** — composition is the moat.

## Proof Contract

- **Provenance**: each trace carries scope (explicit, never UNKNOWN/*), completeness ∈ {COMPLETE, PARTIAL, SCOPED}, correlation_limit, source_ref, source_sha256 (64-hex), observed_at; duplicate trace_id blocked.
- **Consistency**: hypothesis_graph referential integrity — every explains_traces ref must exist; duplicate hypothesis_id blocked.
- **Disambiguation**: ≥2 hypotheses required (graph-of-thoughts); single hypothesis is REMAIN_TRACE, not insight — prevents premature closure.
- **Corroboration**: independent replay_performed + independent=true + 64-hex independent_replay_hash required.
- **Promotion**: provenance failure => BLOCKED (inadmissible); any other rail failure => REMAIN_TRACE; ALL FOUR true => INSIGHT_AUTHORIZED.
- **Semantic rederivation**: verify recomputes from carried inputs and rejects tampered promotion_status/rails even with recomputed diagnostic_hash; hash mismatch and rails_mismatch both blocked.
- **Boundary**: all-false preview boundary (17 keys), deep-frozen, deterministic content-addressed diagnostic_hash (`sha256:` canonical JSON v1).
- **Event-driven spine**: traces → hypotheses (this gate) → bounded proposals → verified reversible transitions remains separated; gate classifies, never executes.

## What this does NOT prove

No claim that a promoted insight is true, that production traces were measured, that a system change is authorized, that a daemon/federation/mint/wallet/network ran, or that any autopoietic loop closed. Classification is preview-only; authority remains gated behind separate exact-consent and reversible-transition verifiers.

## Proof ran

Focused 14/14 · gate PASS (INSIGHT_AUTHORIZED with 4/4 rails, single-hypothesis probe blocked, tamper probe caught via semantic rederivation) · registry row DEMA_TRACE_DIAGNOSTIC_CONTRACT_1A (#90) · capability registry PASS (90/90 MEASURED_REPO, hash sha256:fff735387f0eaa6da811131850624ba33e1bad53a338a5646bfbf2da964cf52d) · npm test 9736/9740 pass (4 skipped, G8 0 unclassified) · npm run check PASS · kernel-purity PASS (513 scanned, 101 allowlisted) · actuator PASS · integration PASS · git diff --check clean.

## Moat statement

Prevention at cause: this composition binds every system contract to an observable, hash-anchored, scope-declared trace before reasoning amplifies. Teams diffuse a finding across modules through the four rails — a missing scope is provenance BLOCKED, not a silent peer; a single-hypothesis narrative is disambiguation REMAIN, not insight. The diagnostic contract is the moat that turns drift into a classified, reversible, operator-visible refusal before it becomes a consequence.
