# Receipt: DEMA-CAPABILITY-TRUTH-REGISTRY-1A

Truth label: `DEMA_CAPABILITY_TRUTH_REGISTRY_MEASURED_REPO_ONLY`

## Slice

This slice adds a deterministic capability truth registry for the first six Dema proof-control surfaces:

```text
COVERAGE_TRUTH_GATE_1A
DEMA_NODE_SPACE_FILE_STEWARD_1A
NODE0_MULTI_DEVICE_URP_MANIFEST_1A
AASR_NODE0_STATE_ROUTER_PREVIEW_1A
APR_NODE0_ROUTE_REFINERY_PREVIEW_1A
NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_1A
```

The registry binds each `MEASURED_REPO` row to source, test, review gate, and receipt/documentation evidence.

Each row also exposes the operator-facing truth fields:

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
```

## Files

```text
packages/core/src/dema-capability-truth-registry.js
tests/dema-capability-truth-registry.test.js
scripts/review/dema-capability-truth-registry-check.mjs
scripts/check.mjs
docs/02-architecture/DEMA_CAPABILITY_TRUTH_REGISTRY_v0_1.md
docs/receipts/DEMA_CAPABILITY_TRUTH_REGISTRY_1A.md
docs/TESTING.md
docs/CURRENT_LIMITS.md
```

## Proof Contract

The default gate must pass only while:

- all six required capability rows are present,
- each `MEASURED_REPO` row has existing source, test, review gate, and receipt/documentation evidence,
- #301 remains `MEASURED_REPO` after merged source/test/gate/docs are detected on `main`,
- #301 encodes `PREVIEW_ONLY -> ACTION_ELIGIBLE_PREVIEW` with exact GO phrase, reversible plan, backup manifest, undo manifest, receipt preview, and no boundary violation as required inputs,
- preview-only rows do not imply execution,
- no row assigns `ACTION_CAPABLE` or `eligible_for_execution: true` by prose,
- token, wallet, live URP federation, live RSI, and live PoI remain `DESIGNED_NOT_LIVE`,
- the registry hash recomputes exactly.

## Commands

```bash
node --test tests/dema-capability-truth-registry.test.js
node scripts/review/dema-capability-truth-registry-check.mjs --json
npm test
npm run check
npm run llm:guidance
git diff --check
```

## Boundaries

- No daemon
- No network
- No token mint
- No wallet
- No live execution
- No file mutation
- No URP federation
- No PoI runtime
- No RSI runtime
- No model invocation

## Replay Meaning

A passing replay means Dema can render a deterministic truth map for the current pre-action spine and fail closed when measured capabilities lose evidence or try to promote to unsupported live claims.

It does not prove live action execution, production readiness, federation, wallet behavior, token economics, live RSI, live PoI, or a dashboard.
