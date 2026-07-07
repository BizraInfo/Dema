# DEMA-SOCRATIC-CRITIC-PROCESS-SUPERVISION-PREVIEW-1A

Truth label: `DEMA_SOCRATIC_CRITIC_PREVIEW_MEASURED_REPO`.

## Purpose

The reasoning spine's missing middle layer. Outcome-only success is not enough; a plausible answer with
an unproven causal path is not sovereign intelligence. The Socratic critic interrogates a hypothesis's
**process** before SAT verifies its **outcome**.

```text
PAT proposes  →  Socratic Critic interrogates  →  SAT verifies  →  Receipt records
```

Each layer has a distinct boundary: the critic does not execute, the verifier does not invent, the
receipt writer does not upgrade authority.

## Input contract

A hypothesis packet:

```js
{
  claim,           // the proposed claim (must be non-vacuous)
  causal_path: [], // intermediate cause→effect steps
  constraints: [{ id, satisfied }], // declared system laws / consent / repo facts / policy
  evidence_refs: [],
  certainty,       // asserted certainty level
  falsifier,       // what observation would make the claim false
}
```

## Output contract

```text
gates{ clarification_question · constraint_check · causal_path_probe · counterexample_generation
       · falsification_condition · uncertainty_label · verified_vs_inferred_split }
status  ∈ { ready_for_sat, needs_revision, blocked_by_missing_evidence, rejected_overclaim }
blocked_by[]
grants_action: false · claims_truth: false · authority_delta: 0 · boundary: all-false
content_hash
```

## Invariants (the critic's discipline)

- **It never grants authority** (`grants_action: false`).
- **It never claims truth** (`claims_truth: false`; status is never `verified`).
- **It never executes** (`authority_delta: 0`, boundary all-false).
- It only improves the **question pressure** before SAT — a failure classification can only reduce
  authority, request revision, or block; never increase it.

## Boundaries

- Pure kernel; no fs/network/clock/random. No model invocation. No agent runtime.
- No autonomous science runtime, no external APIs, no URP, no mint, no federation.

## Files

```text
packages/core/src/dema-socratic-critic-process-supervision-preview.js
tests/dema-socratic-critic-process-supervision-preview.test.js
scripts/review/dema-socratic-critic-process-supervision-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_SOCRATIC_CRITIC_PROCESS_SUPERVISION_PREVIEW_1A.md
docs/02-architecture/DEMA_SOCRATIC_CRITIC_PROCESS_SUPERVISION_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/dema-socratic-critic-process-supervision-preview.test.js
node scripts/review/dema-socratic-critic-process-supervision-preview-check.mjs --json
npm test
npm run check
```
