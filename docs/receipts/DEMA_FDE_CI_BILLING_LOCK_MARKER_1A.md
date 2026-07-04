# Receipt: DEMA-FDE-CI-BILLING-LOCK-MARKER-1A

Truth label: `DEMA_FDE_DUAL_DIAGNOSTIC_PREVIEW_ONLY`

## Slice

Local-only FDE hardening: classify GitHub Actions startup failures caused by
account billing lock so operators do not patch application code for CI bootstrap
failures.

## Markers

```text
account is locked
billing issue
job was not started
runner_id=0 / runner_assigned: false
steps=[] / log not found
```

## Classification

```text
failure_class: github_actions_billing_lock
code_implicated: false
operator_action_required: billing_unlock
```

## Proof

```bash
node --test tests/dema-fde-dual-diagnostic.test.js
npm test
npm run check
```

## Boundaries

Local branch only. Not trunk truth until billing unlock and PR merge.
