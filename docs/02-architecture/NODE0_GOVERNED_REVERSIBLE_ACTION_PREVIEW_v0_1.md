# Node0 Governed Reversible Action Preview v0.1

Truth label: `NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_ONLY`

## Purpose

`NODE0-GOVERNED-REVERSIBLE-ACTION-PREVIEW-1A` is the first preview-only bridge from an APR-refined route to a governed local action candidate. It does not execute the action. It checks whether one low-risk rename candidate has the proof, exact preview consent, backup preview, undo preview, risk review, and receipt requirements needed for human review.

The 1A supported action type is:

```text
rename_preview_to_governed_action_candidate
```

This is not an actual rename. It is an eligibility envelope for a possible future governed runtime handoff.

## Input Contract

```js
buildNode0GovernedReversibleActionPreview({
  refined_route_preview,
  proposed_action,
  consent_proof,
  backup_policy,
  undo_policy,
  execution_policy,
  backup_manifest_preview,
  undo_manifest_preview,
  previous_state_hash,
  boundary,
})
```

`refined_route_preview` must be an APR route refinery preview. Raw AASR route previews are blocked with `apr_refinement_required`.

`consent_proof` must use exact preview consent:

```text
GO: preview governed reversible action only
```

The phrase authorizes preview construction only. It does not authorize runtime execution.

## Output Contract

The envelope emits:

```text
schema
truth_label
action_stage
input_refined_route_id
route_refinement_evidence
proposed_action
action_type
action_eligibility
consent_state
backup_manifest_preview
undo_manifest_preview
risk_review
pre_execution_receipt_preview
post_execution_receipt_requirements
human_go_phrase_required
blocked_by
chained_action_block_preview
boundaries
what_this_proves
what_this_does_not_prove
```

`action_eligibility.eligible_for_human_go_review` may be true only when all preview proofs are present and all boundaries are false. `action_eligibility.eligible_for_execution` is always false in this repo.

## Boundary

The boundary composes the canonical preview boundary with action-specific false keys:

```text
scan_executed
action_execution_performed
file_mutation_performed
actual_rename_performed
move_performed
merge_performed
delete_performed
file_content_read
ocr_performed
embedding_generated
network_used
urp_write_performed
token_minted
wallet_accessed
transfer_performed
daemon_started
model_invocation_performed
autonomous_action_performed
```

Every key must be false. An empty boundary object is invalid.

## Blocked Surfaces

The risk review blocks delete, move, merge, content-read, network, token, wallet, daemon, execution, and autonomous-action claims. These are blocked even if they appear as claim fragments inside a proposed rename candidate.

## Hash Contract

`chained_action_block_preview.block_preview_hash` is computed from the action block payload:

```text
previous_state_hash
input_refined_route_id
route_refinement_evidence
proposed_action
action_eligibility
consent_state
backup_manifest_preview
undo_manifest_preview
risk_review
pre_execution_receipt_preview
post_execution_receipt_requirements
human_go_phrase_required
boundaries
```

The payload is serialized with stable key ordering and emitted as a `sha256:` hash. The verifier recomputes the expected hash and fails closed on mismatch.

## What This Proves

- Node0 can preview whether an APR-refined route has enough evidence to become a governed reversible action candidate.
- The preview can require exact consent, backup, undo, and post-execution receipt requirements before any future action handoff.
- The action candidate can be content-addressed without writing state or mutating files.

## What This Does Not Prove

- No rename, move, merge, delete, content read, OCR, embedding, network call, URP write, token mint, wallet access, daemon, runtime, or autonomous action occurred.
- This does not prove live governed runtime execution, backup restoration, post-action verification, federation, token economics, or production readiness.
