# NODE0-CLOSURE-INVARIANTS-1A — receipt

**Status:** `IMPLEMENTED_LOCAL` · **Schema:** `bizra.dema.node0_closure_invariants.v0.3`

## What this surface is

The ten booleans that decide whether Node0 is genetically complete, evaluated
from supplied, sourced, scope-declared observations. A pure evaluator plus a
verifier. It executes nothing, activates nothing, and closes nothing.

| # | Invariant | Required | Observation scope that can settle it |
| --- | --- | --- | --- |
| 1 | `mission_is_primary_state` | `true` | `node0_runtime_state_ownership` |
| 2 | `worker_is_replaceable` | `true` | `node0_runtime_worker_handoff` |
| 3 | `contract_is_immutable` | `true` | `node0_contract_artifact_immutability` |
| 4 | `acceptance_is_model_blind` | `true` | `node0_acceptance_function_model_blindness` |
| 5 | `verification_is_external` | `true` | `node0_verifier_independence` |
| 6 | `authority_delta` | `0` | `node0_cycle_authority_delta` |
| 7 | `recovery_after_worker_exit` | `true` | `node0_runtime_kill_resume` |
| 8 | `receipt_per_transition` | `true` | `node0_transition_receipt_chain` |
| 9 | `full_history_replayable` | `true` | `node0_history_replay` |
| 10 | `remote_write` | `false` | `node0_deployment_remote_write` |

## Measured state

The review gate (`scripts/review/node0-closure-invariants-check.mjs`) publishes
the ledger on every `npm run check`:

```
adapters registered: 1 of 10
ledger: OPEN - 1 satisfied, 0 violated, 9 unknown of 10
  + SATISFIED acceptance_is_model_blind <- NODE0-MODEL-SWAP-INVARIANCE-1A verdict_reproduced sha256:...
```

**One evidence adapter exists.** `ACCEPTANCE-MODEL-BLIND-ADAPTER-1A` settles
`acceptance_is_model_blind` from a model-swap attestation whose verifier
independently re-derived every verdict and diagnosis from the carried contract
and carried outputs. A weaker tier returns `null`: evidence omitted is evidence
absent, and no builder may reach a satisfied invariant by carrying less.

That observation exercises the **shipped** acceptance function on a **declared
probe task** (`review-gate-acceptance-model-blindness-probe`, covered by the
attestation content hash). It is not a measurement of production traffic, and
the receipt says so rather than letting the ledger imply otherwise.

Eight invariants have never had an instrument. The tenth, `remote_write`, has
one — `NODE0-SOURCE-LISTENER-SCAN-1A` — whose scope review (TASK-060) demoted it
to returning `null`, because a source scan cannot settle a deployment question.

## What the gate asserts, and what it deliberately does not

PASS means the ledger is **sound and honest**, never that Node0 is closed. A
gate that failed while closure was OPEN would be a gate demanding a lie, so the
pass condition is the truth surface: the ten are the ten in order, every
invariant declares a scope, the verdict re-derives from the rows (positive
control), and a forged CLOSED verdict is refused (negative control — without it
the positive control would pass against a verifier that only ever says ok).

## Honest limits

- **Not closure.** `OPEN` is the correct and expected published state.
- **Not endurance.** Seventy-two hours of uptime is later evidence, not the
  definition of closure.
- **Not instrument truth.** The kernel checks the ledger of answers, not the
  instruments that produced them. A scope is a caller-supplied declaration
  matched exactly; it stops a narrow instrument being routed to a broad
  question, it does not prove the declaration true.
- **Six of the ten cannot be settled from this repository at all.**
  `mission_is_primary_state`, `worker_is_replaceable`,
  `recovery_after_worker_exit`, `receipt_per_transition`,
  `full_history_replayable` and `authority_delta` describe a *running loop*
  observed across a worker exit. No static analysis of source can produce them.

## Evidence

- Kernel: `packages/core/src/node0-closure-invariants.js`
- Tests: `tests/node0-closure-invariants.test.js`
- Review gate: `scripts/review/node0-closure-invariants-check.mjs`
- Honesty map row: `docs/CURRENT_LIMITS.md`
- Test-suite map row: `docs/TESTING.md`

## Boundary

No socket, no child process, no model invocation, no network, no file mutation,
no daemon, no mint, no wallet. Reads nothing from disk.
