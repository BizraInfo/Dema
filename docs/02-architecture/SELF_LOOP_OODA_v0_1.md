# Self-Loop OODA Kernel v0.1

- **Schema:** `bizra.dema.self_loop_ooda.v0.1`
- **Live source of truth:** `packages/core/src/self-loop-ooda.js`
- **Status:** live bounded review-cycle kernel; not a daemon or autonomous runtime.

## What it is

`SELF-LOOP-OODA-KERNEL-1A` is a deterministic, evidence-bound kernel for representing a single supplied OODA-style review cycle:

```text
observe -> orient -> decide -> act -> review
```

It turns caller-supplied phase claims and evidence anchors into a frozen, content-addressed review cycle. It can recommend `PROPOSE_NEXT_BOUNDED_CYCLE` only when all five phases are present and evidence-bound.

## What it is not

This kernel is **not** an autonomous loop. It does not schedule itself, run in the background, execute actions, mutate the repository, invoke a model, call a network, sign, mint, reward, activate PoI, or federate.

The `act` phase records only a proposed action. `action_executed_by_kernel` is always `false`, and verification fails closed if a step or boundary claims execution.

## Public API

```js
buildSelfLoopOodaCycle({ steps, cycle_id, previous_cycle_hash })
normalizeSelfLoopStep(step)
verifySelfLoopOodaCycle(cycle)
SELF_LOOP_PHASES
SELF_LOOP_OODA_SCHEMA
```

## Phase contract

Each phase requires:

```text
phase: observe | orient | decide | act | review
claim: non-empty string
evidence: one or more caller-supplied anchors
```

The `act` phase may include `proposed_action`, but `executed` must remain false.

## Fail-closed posture

The kernel rejects malformed or overclaiming inputs with explicit reason codes, including:

```text
steps_must_be_array
step_malformed
phase_unknown
claim_required
evidence_required
duplicate_phase
act_phase_must_not_execute
self_loop_overclaim
cycle_malformed
schema_mismatch
truth_label_mismatch
mode_mismatch
boundary_not_false
autonomous_loop_started
action_execution_overclaim
step_hash_mismatch
missing_phases_mismatch
phase_coverage_mismatch
steps_by_phase_mismatch
cycle_hash_mismatch
```

## Load-bearing verification

Verification does not trust stored derived fields. It re-derives:

- phase coverage and shown formula
- missing phases
- `steps_by_phase`
- per-step hashes
- cycle hash
- boundary all-false posture

This keeps the self-loop honest: the kernel can structure review and recommend a next bounded cycle, but it cannot silently become a runtime loop.

## Relationship to previous live framework kernels

- HHMM models lifecycle state transitions.
- Hash-table index organizes evidence/claims/risks/decisions.
- Self-awareness report surfaces evidenced capability vs blind spots.
- Self-loop OODA structures the next bounded review cycle without executing it.

Together these are still framework kernels, not a complete autonomous operating system.
