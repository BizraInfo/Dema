# NODE0-ROLE-MODEL-BINDING-REGISTRY-1A

Truth label: `NODE0_ROLE_MODEL_BINDING_REGISTRY_MEASURED_REPO`

## Purpose

SHADOW-only fail-closed role-model binding registry: roles bind to models only through evidence-bearing capability records that satisfy an independently versioned role-and-lane acceptance policy (metric, direction, threshold, evaluation identity); stale, contradicted, superseded, over-budget, under-threshold, or independence-violating bindings are rejected or abstained; missing/inapplicable policy and design-family contradictions surface as REQUIRES_HUMAN.

## Input Contract

```js
runNode0RoleModelBindingRegistry({ consent, input })
```

Exact consent:

```text
GO: node0 role model binding registry preview
```

## Output Contract

```text
schema
truth_label
ok
content_hash
boundary.execution_allowed (false)
blocked_by[]
```

## Verification

```js
verifyNode0RoleModelBindingRegistry(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/node0-role-model-binding-registry.js
tests/node0-role-model-binding-registry.test.js
scripts/review/node0-role-model-binding-registry-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_ROLE_MODEL_BINDING_REGISTRY_1A.md
docs/02-architecture/NODE0_ROLE_MODEL_BINDING_REGISTRY_v0_1.md
```

## Commands

```bash
node --test tests/node0-role-model-binding-registry.test.js
node scripts/review/node0-role-model-binding-registry-check.mjs --json
npm test
npm run check
```

## Decision vocabulary (v0.1)

- Modes: `SHADOW` · `CANDIDATE` — anything else is rejected (activation fails closed).
- Statuses: `BOUND_SHADOW` · `BOUND_CANDIDATE` · `REJECTED` · `ABSTAIN` · `REQUIRES_HUMAN`.
- Lanes: the eight Node0 workload lanes; a capability measured in one lane never
  generalizes to another. SAT binds only `short_sat_judgment`; PAT never binds it.
- `REQUIRES_HUMAN` + `spec_reopen_required` is the honest representation of the
  measured-family-vs-designed-family fork (e.g. gemma vs deepseek for SAT judge);
  the operator resolves it, code never does.
- Two eligible records are `ambiguous_multiple_eligible_records` — ranking policy
  is a later, measured slice.
- Adequacy invariant: no route binds unless an independently versioned
  role-and-lane acceptance policy (`bizra.node0.role_lane_acceptance_policy.v0.1`)
  is supplied and the evidence satisfies its metric, direction, threshold, and
  evaluation identity. Missing/inapplicable policy → `REQUIRES_HUMAN`
  (`acceptance_policy_missing` / `acceptance_policy_not_applicable`);
  under-threshold evidence → `capability_threshold_not_met`. No
  operator-ratified policy exists yet, so the canonical gate decision is
  honestly `REQUIRES_HUMAN`.
- Evidence `sha256` is format-checked only — syntactic validity of a SHA-256
  field does not verify source-evidence authenticity.

Design record: `docs/06-adr/ADR-045-role-model-binding-registry-1a.md`.

## Non-generalization warning

The only measured lane today is `short_sat_judgment` (74-item held-out, grammar-
constrained). Every other lane has no measured capability record; the registry
therefore refuses to bind them — that refusal is the honest current state, not a
defect.
