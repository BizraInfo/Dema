# Proof-of-Truth Claim Scope Contract v0.1

Truth label: `POT_CLAIM_SCOPE_MEASURED_REPO`

## Purpose

`POT-CLAIM-SCOPE-0A` is a pure structural evaluator. It prevents a supplied
claim descriptor from promoting evidence beyond the scope it declares. It does
not obtain, authenticate, or independently observe evidence.

The only primary claim scopes are:

```text
COMPONENT
ROUTE
MISSION
RESPONSIBILITY
```

`NODE0_CLOSURE` is deliberately not a fifth scope. It is a later derived
operational promotion that must be earned from a converged responsibility plus
separate Node0 continuity and recovery evidence.

## Evidence laws

```text
UNKNOWN        != PASS
NOT_APPLICABLE != UNKNOWN
COMPONENT      != ROUTE != MISSION != RESPONSIBILITY
```

The evaluator fixes the requirements for its four scopes. A claim cannot
weaken those requirements by supplying `required_rails`, a desired status, or
model-produced text.

Every required rail uses the same caller-supplied
`identity.causal_binding_digest`. A mismatch is `FAIL`; a missing or stale
required observation is `HOLD`. The digest is a structural binding check only:
this slice does not prove that any supplied digest names authentic bytes or a
real-world event.

## Rails and required outcomes

```text
F = formal_contract
K = integrity_binding
E = empirical_observation
$ = economic_value
```

| Scope | Required rails | Extra requirement | Successful status |
| --- | --- | --- | --- |
| `COMPONENT` | F, K, E | `economic_value` may be `NOT_APPLICABLE` | `COMPONENT_VERIFIED` |
| `ROUTE` | F, K, E | bounded timeout/retry, declared duplicate handling, disabled or explicit fallback | `ROUTE_VERIFIED` |
| `MISSION` | F, K, E | an economic measurement plan; `$` is `MEASUREMENT_PENDING` or structurally bound `PASS` | `MISSION_VERIFIED` |
| `RESPONSIBILITY` | F, K, E, $ | fresh recovery `PASS`, at least two completed runs, and positive supplied `burden_removed` for `VRO_CONVERGED` | `VRO_CANDIDATE` or `VRO_CONVERGED` |

For every scope, an explicit contradiction, invalid required identity, required
`NOT_APPLICABLE`, causal-binding mismatch, or scope escalation is `FAIL`.
Missing, `UNKNOWN`, `HOLD`, or stale required evidence is `HOLD`.

## Identity and freshness

The fixed required identity fields are scope-specific:

```text
COMPONENT      component/version/source/evaluation/environment
ROUTE          release/MR/route/provider/model/adapter/authority
MISSION        mission contract/release/MR/authority/input/run/worker/verifier/receipt
RESPONSIBILITY responsibility/template/release/MR/authority/verifier/receipt
```

Fresh rails require caller-supplied `evaluation.evaluation_at`,
`observed_at`, and `max_age_ms`. The evaluator does not read a clock or probe a
runtime. `observed_at` later than the supplied evaluation time, or older than
the supplied maximum age, is `HOLD`.

## API

```js
evaluatePotClaimScope({ claim, evaluation })
```

returns a deterministic `PASS`, `FAIL`, or `HOLD` decision with reasons,
resulting status, an all-false boundary, and `authority_delta: 0`.

```js
runPotClaimScope({ consent, input })
```

is a static review wrapper. It requires the exact phrase:

```text
GO: pot claim scope preview
```

The phrase gates the wrapper only. It is not consumed consent and grants no
execution, provider, model, mission, receipt, or Node0 authority.

## Boundaries

This slice performs no provider invocation, model invocation, runtime start,
estate observation, receipt minting, filesystem mutation, network use, daemon
start, token/wallet action, fallback activation, or authority change.

Its content hash detects alteration of a payload after construction and its
decision is re-derived from the embedded input. It is not a signature, remote
attestation, runtime observation, or independent anchor: a wholly replaced and
rehashed self-consistent payload is not thereby proven true.

## Commands

```bash
node --test tests/pot-claim-scope.test.js
node scripts/review/pot-claim-scope-check.mjs --json
npm test
npm run check
npm run llm:guidance
git diff --check
```
