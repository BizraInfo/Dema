# Receipt: NODE0-GOVERNED-REVERSIBLE-ACTION-PREVIEW-1A

Truth label: `NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_ONLY`

## Slice

This slice adds a preview-only action-eligibility envelope over APR route refinements. It prepares one low-risk action candidate:

```text
rename_preview_to_governed_action_candidate
```

The slice does not rename files, move files, merge files, delete files, read file content, invoke OCR or embeddings, use the network, write URP state, mint tokens, access wallets, start daemons, or perform autonomous action.

## Files

```text
packages/core/src/node0-governed-reversible-action-preview.js
tests/node0-governed-reversible-action-preview.test.js
scripts/review/node0-governed-reversible-action-preview-check.mjs
scripts/check.mjs
docs/02-architecture/NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_v0_1.md
docs/receipts/NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_1A.md
docs/TESTING.md
docs/CURRENT_LIMITS.md
```

## Proof Contract

The kernel emits:

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

The default gate must pass only while:

- the input is APR-refined,
- the action type is `rename_preview_to_governed_action_candidate`,
- exact preview consent is present,
- backup and undo previews are present,
- execution remains false,
- every boundary key remains false,
- the action block hash recomputes exactly.

## Consent Boundary

The exact phrase is:

```text
GO: preview governed reversible action only
```

This phrase authorizes preview construction only. It does not authorize a rename or any other local mutation.

## Action Block Hash Input

`chained_action_block_preview.block_preview_hash` is a `sha256:` digest of the stable-stringified block payload:

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

The verifier recomputes this hash and rejects stale or tampered action blocks.

## Acceptance Proof

Focused test surface:

```bash
node --test tests/node0-governed-reversible-action-preview.test.js
```

Review gate:

```bash
node scripts/review/node0-governed-reversible-action-preview-check.mjs --json
```

Full local proof ladder:

```bash
npm test
npm run check
npm run llm:guidance
git diff --check
```

## Non-Claims

This slice does not make Dema a live runtime, autonomous actor, production system, economic system, token issuer, wallet user, federation node, or large-corpus performance-proven file agent. It is a preview-only control-plane organ between APR route refinement and a future governed runtime handoff.
