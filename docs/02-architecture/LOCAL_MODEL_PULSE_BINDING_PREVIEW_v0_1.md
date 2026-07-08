# LOCAL-MODEL-PULSE-BINDING-PREVIEW-1A

Truth label: `LOCAL_MODEL_PULSE_BINDING_PREVIEW_MEASURED_REPO`

## Purpose

Bind an already-produced local-model invocation result (`bizra.dema.llm_invocation_result.v0.1`) into
the Materialization Pulse evidence lane as **suggestion-only** evidence — so the Pulse can carry "the
mind spoke" without granting any action authority.

```text
local model invocation result (from the existing adapter)
  → suggestion-only binding gate
  → Materialization Pulse evidence lane
```

This kernel **does not invoke a model.** It reuses the existing local-model adapter's output; the
adapter is what talks to Ollama (localhost). Per ADR-015 (LLM is suggestion, verifier is authority),
model output may enter the system only as bounded evidence, never as execution permission.

## Operating law

```text
The local model may suggest.
The verifier remains authority.
A model output may enter the Pulse as evidence, never as action permission.
```

## Input

```text
mission_id            (string)
pulse_receipt_ref     (sha256:… | null)
invocation_result     (bizra.dema.llm_invocation_result.v0.1 envelope)
```

## Output (suggestion-only, all-false boundary)

```text
schema · truth_label · mode:preview_only · mission_id · pulse_receipt_ref
source_invocation_ref · source_schema · source_truth_label · invocation_status · model_invoked
verdict_role:suggestion · suggestion_admissible · failure_recordable
public_claim_safe:false · action_allowed:false · authority_delta:0 · grants_action:false
mint_allowed:false · wallet_used:false · federation_live:false
prompt_safety_verdict · response_safety_verdict · response_preview_ref · response_text_preview
evaluation_blocked_by[] · boundary(all-false) · content_hash
```

## Acceptance rules

```text
completed + PUBLIC_SAFE prompt + PUBLIC_SAFE response + suggestion role → admissible suggestion
blocked invocation                                                     → recordable failure evidence only
failed invocation                                                      → recordable failure evidence only
unsafe prompt or response                                              → rejected
non-suggestion verdict role                                            → rejected
runtime strict-false boundary violation                                → rejected
public-claim / action / mint / wallet / federation flags               → rejected
recomputed-hash authority laundering                                   → rejected
```

## Boundary

Preview-only. It does not invoke a model, verify semantic truth, authorize an action, publish a claim,
write receipts, mint, use a wallet, federate, or prove live URP. `authority_delta` 0.

## Notes

The example `llm_invocation_result` fixtures live in `scripts/review/local-model-pulse-binding-fixtures.mjs`
(NOT in the kernel) because a real completed invocation legitimately carries input boundary flags like
`network_used:true` — that is input data describing what the adapter did, not the binding kernel
claiming authority. Keeping them out of `*-preview.js` keeps the static boundary-invariant check clean.

## Commands

```bash
node --test tests/local-model-pulse-binding-preview.test.js
node scripts/review/local-model-pulse-binding-preview-check.mjs --json
npm test
npm run check
npm run coverage
```
