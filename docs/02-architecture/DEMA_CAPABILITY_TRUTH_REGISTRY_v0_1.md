# DEMA-CAPABILITY-TRUTH-REGISTRY-1A

## Purpose

`DEMA-CAPABILITY-TRUTH-REGISTRY-1A` is a deterministic registry for the first eight shipped Dema proof-control surfaces:

```text
COVERAGE_TRUTH_GATE_1A
DEMA_NODE_SPACE_FILE_STEWARD_1A
NODE0_MULTI_DEVICE_URP_MANIFEST_1A
AASR_NODE0_STATE_ROUTER_PREVIEW_1A
APR_NODE0_ROUTE_REFINERY_PREVIEW_1A
NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_1A
DEMA_FDE_DUAL_DIAGNOSTIC_1A
NODE0_REVERSIBLE_EXECUTE_GATE_1A
```

It prevents capability drift by binding each row to source, test, review-gate, and receipt/documentation evidence. The registry is a truth map, not an execution router.

## Output Contract

The kernel emits:

```text
schema
truth_label
stage
supported_statuses
required_capability_ids
capabilities
blocked_surfaces
boundaries
previous_state_hash
capability_count
measured_repo_count
registry_hash
what_this_proves
what_this_does_not_prove
```

Each capability row records:

```text
capability_id
status
source_files
test_files
review_gate
receipt_doc
boundary
what_this_proves
what_this_does_not_prove
promotion_rule
blocked_by
runtime_status
truth_label
summary
evidence.source_paths
evidence.test_paths
evidence.review_gate_paths
evidence.receipt_paths
evidence.documentation_paths
execution_allowed
eligible_for_execution
action_capable
claims_live_execution
claims_token_or_wallet
blocked_promotion_rule
forbidden_claims
```

## Status Rules

Supported statuses are:

```text
MEASURED_REPO
IMPLEMENTED_LOCAL
PREVIEW_ONLY
DESIGNED_NOT_LIVE
PLANNED
UNKNOWN
```

`MEASURED_REPO` requires:

```text
source path exists
test path exists
review gate path exists
receipt or documentation path exists
```

`PREVIEW_ONLY` cannot imply execution. The verifier rejects preview rows that set `execution_allowed`, claim live execution, or claim token/wallet behavior.

No row can assign `ACTION_CAPABLE` by prose. The verifier rejects `status: "ACTION_CAPABLE"`, `action_capable: true`, or any `eligible_for_execution` value other than `false`.

## Promotion Dependency

The #301 row encodes the only current pre-action promotion dependency:

```text
PREVIEW_ONLY -> ACTION_ELIGIBLE_PREVIEW
requires:
  exact_go_phrase
  reversible_plan
  backup_manifest
  undo_manifest
  receipt_preview
  no_boundary_violation
eligible_for_execution: false
```

This is still not execution consent. It only records the evidence required before a future, separate exact-GO execution slice could be designed.

## Blocked Live Surfaces

The registry explicitly keeps these surfaces `DESIGNED_NOT_LIVE`:

```text
TOKEN_ECONOMY
WALLET_ACTIONS
LIVE_URP_FEDERATION
LIVE_RSI
LIVE_POI
```

## Hash Contract

`registry_hash` is a SHA-256 digest over the stable-stringified registry payload:

```text
schema
truth_label
stage
supported_statuses
required_capability_ids
capabilities
blocked_surfaces
boundaries
previous_state_hash
```

The hash is deterministic and changes when any registry evidence, status, boundary, or blocked live surface changes.

## Boundaries

The registry does not:

- execute any capability,
- start a daemon,
- use the network,
- mint tokens,
- access wallets,
- federate URP,
- start PoI,
- start RSI,
- invoke a model,
- mutate files.

## Replay Meaning

A passing replay means the repository currently contains the six required capability rows and each `MEASURED_REPO` row has the evidence categories required by this slice.

It does not prove live execution, production readiness, token economics, federation, wallet behavior, live RSI, or live PoI.
