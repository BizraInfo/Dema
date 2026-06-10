# ADR-035: Node0 Closed-Loop Runtime Dry-Run Boundary

**Status:** Proposed / Boundary Spec / No Implementation

**Date:** 2026-06-09

**Decision Makers:** Mumu (via GO consent), Codex (implementation + verification)

[CITED]
**Supersedes:** None. Builds on ADR-032 Node0 Closed-Loop Digest, ADR-033 Layer Closure Contract LCC-6, and ADR-034 G-Ladder Layer Index. Local Section 1 proof-layer rollup is committed at `a88c455` with `pre-push:seal` `PUSH_READY` and `delivery:check` `OVERALL A+: PASS`.

[CITED]
**Related:** ADR-001 (Dema is one face), ADR-002 (no shadow state), ADR-004 (local-first memory), ADR-005 (explicit consent), ADR-006 (continuous assurance and no-mint verification), ADR-007 (multi-session chain policy), ADR-008 (runtime activation boundary), ADR-014 (three-runtime architecture), ADR-015 (verifier authority), ADR-028 (Atomic Impact Receipt Lifecycle), ADR-029 (Mission-Centric State Ecosystem), ADR-030 (Dema/Data-Lake alignment), ADR-031 (Hybrid Mission Knowledge Graph + BoK), ADR-032 (Node0 Closed-Loop Digest), ADR-033 (LCC-6), ADR-034 (G-Ladder Layer Index), Delivery Spine, Claims Ledger, `docs/LLM_SYSTEM_FLOW.md`, and the BIZRA Node0 / Dema Closed-Loop Production Checklist Section 2.

[DECLARED]
**Implements:** G61_NODE0_CLOSED_LOOP_RUNTIME_DRY_RUN_BOUNDARY_LOCAL_GREEN (this boundary spec + test scaffold only; no runtime implementation).

## 1. Title

ADR-035: Node0 Closed-Loop Runtime Dry-Run Boundary

## 2. Status

Proposed / Boundary Spec / No Implementation

## 3. Context

The production checklist now requires runtime readiness after proof-layer closure. The first Section 2 item is to define the first real closed-loop runtime boundary. This must not be interpreted as permission to start a live daemon, command runner, hidden loop, Data Lake bridge, public network path, Node1 sync, URP bridge, economic action, token action, contract action, marketplace action, or Shariah-compliance claim.

Dema remains the face and local proof/control surface. The governed runtime remains outside this ADR until future proof gates authorize it. This ADR defines a dry-run only boundary for a future Node0 closed-loop runtime envelope so the loop can be reasoned about, tested, reviewed, and indexed before any live execution exists.

## 4. Purpose

Define the first real closed-loop runtime boundary as a local, dry-run only, replay-safe, consent-gated envelope.

It exists to make runtime readiness auditable without implementing live runtime execution.

## 5. Definition

The Node0 Closed-Loop Runtime Dry-Run Boundary is a future local-only envelope that may simulate a closed-loop runtime state transition for proof and review.

It may describe:

input -> validation -> planning -> execution -> reflection -> receipt -> digest -> index

The word `execution` in this ADR means dry-run execution planning and effect classification only. It does not mean command execution, process spawning, file writing, network access, Data Lake mutation, Node1 activation, URP publication, token minting, reward authorization, contract calls, marketplace signaling, or public publishing.

No live runtime execution is introduced here.

## 6. Core Principle

Runtime readiness means deterministic dry-run proof before runtime authority.

## 7. Runtime Loop States

The boundary defines these future state names:

1. `input`
2. `validation`
3. `planning`
4. `execution`
5. `reflection`
6. `receipt`
7. `digest`
8. `index`

Each state is a dry-run state label only until a future mock and delivery-check gate prove the shape. No state may perform side effects in this boundary.

## 8. Dry-Run Only Rule

The boundary is dry-run only.

Allowed dry-run behavior:

- classify a proposed runtime step
- validate that a proposed step remains local-only
- calculate a future trace envelope shape
- carry proof gaps
- carry still-blocked invariants
- require operator approval gates before any future write-capable step

Forbidden behavior:

- live runtime execution
- daemon start
- command execution
- process spawning
- network calls
- file writes
- cross-repo writes
- Data Lake mutation
- public publication
- Node1 activation
- URP bridge activation
- reward logic
- token logic
- contracts
- marketplace behavior
- Shariah-compliance claims

## 9. Failure-Safe Abort Behavior

Every future dry-run transition must define failure-safe abort behavior:

- invalid input aborts before planning
- forbidden input aborts before planning
- missing consent aborts before any write-capable future path
- unknown state aborts closed
- blocked invariant conflict aborts closed
- replay mismatch aborts closed

Abort is a valid safety outcome. Abort must not be converted into success by retries, summarization, or operator-facing language.

## 10. Retry Policy

The retry policy boundary is conservative:

- retry count must be finite
- retries must be deterministic for identical input
- retries must not bypass validation
- retries must not bypass consent
- retries must not downgrade blocked invariants
- repeated identical aborts must remain aborts

No retry engine is implemented here.

## 11. Timeout Policy

The timeout policy boundary is conservative:

- every future dry-run transition must have an explicit maximum duration
- timeout yields `ABORTED_TIMEOUT`
- timeout must not write receipts
- timeout must not advance digest or index state
- timeout must preserve trace IDs and proof gaps

No timer engine is implemented here.

## 12. Idempotency Policy

The idempotency policy boundary requires:

- deterministic state IDs from semantic input
- replay-safe execution receipts
- no duplicate advancement for identical trace IDs
- no hidden mutable state
- no automatic reconciliation with external systems

No idempotency store is implemented here.

## 13. Local-Only Execution Locks

The local-only execution locks boundary requires future write-capable paths to prove a local lock policy before any write is introduced.

The boundary allows only lock policy description. It does not acquire locks, write lockfiles, spawn lock managers, or coordinate across repositories.

## 14. Operator Approval Gates

Every future transition that could become write-capable must require exact operator approval gates.

This boundary does not collect consent, persist consent, infer consent, or broaden ADR-005. Consent remains exact-string only.

## 15. Runtime Trace IDs

Every future dry-run transition must carry runtime trace IDs.

Trace IDs must be:

- deterministic for replay-safe dry-run envelopes where possible
- local-only
- non-secret
- non-public
- bound to the dry-run input
- carried into future receipt, digest, and index references

No trace writer is implemented here.

## 16. Replay-Safe Execution Receipts

Replay-safe execution receipts are allowed as a future boundary concept only.

This ADR does not mint receipts, write receipts, publish receipts, or authorize execution. It only requires that any future dry-run runtime mock define a receipt expectation that can be replayed, checked, and rejected on mismatch.

## 17. Still-Blocked Invariant Rule

The future dry-run runtime never bypasses still-blocked invariants.

The dry-run boundary must carry:

- NO_PRODUCTION_SCORING
- NO_ECONOMIC_SCORING
- NO_REWARD_ELIGIBILITY_IMPLEMENTATION
- NO_REWARD_LOGIC
- NO_RECEIPT_MINTING
- NO_PUBLIC_RECEIPT_WRITING
- NO_PUBLISHING
- NO_BRIDGING
- NO_CONTRACTS
- NO_TOKEN_LOGIC
- NO_MARKETPLACE
- NO_PUBLIC_ECONOMIC_COPY
- NO_NODE1
- NO_PUBLIC_URP_BRIDGE
- NO_SHARIAH_COMPLIANCE_CLAIM

## 18. Allowed Inputs

- runtime_scope
- dry_run_intent
- input_ref
- validation_ref
- planning_ref
- execution_plan_ref
- reflection_ref
- receipt_expectation_ref
- digest_expectation_ref
- index_expectation_ref
- retry_policy_ref
- timeout_policy_ref
- idempotency_policy_ref
- lock_policy_ref
- operator_approval_status
- runtime_trace_id
- proof_gaps
- still_blocked_invariants
- consent_status
- review_status
- prototype_posture

## 19. Forbidden Inputs

- live_runtime_request
- daemon_start_request
- command_execution_request
- process_spawn_request
- filesystem_write_request
- network_call_request
- cross_repo_write_request
- datalake_mutation_request
- bridge_activation_request
- node1_target
- urp_publication
- token_amount
- reward_amount
- payout
- public_url
- contract_address
- marketplace_listing
- Shariah-compliant assertion
- APY/APR/yield/investment language

## 20. Allowed Outputs

- schema
- runtime_dry_run_boundary_id
- runtime_scope
- state_sequence_expectation
- abort_policy_expectation
- retry_policy_expectation
- timeout_policy_expectation
- idempotency_policy_expectation
- lock_policy_expectation
- operator_approval_expectation
- runtime_trace_expectation
- receipt_replay_expectation
- digest_index_expectation
- proof_gaps
- still_blocked_snapshot
- created_at
- prototype_posture

## 21. Forbidden Outputs

- live_runtime_started
- daemon_started
- command_executed
- process_spawned
- filesystem_write_performed
- network_call_performed
- cross_repo_write_performed
- datalake_mutated
- runtime_bridge_active
- node1_sync
- urp_publication
- receipt_minted
- receipt_written
- digest_written
- index_written
- token_minted
- reward_authorized
- contract_call
- marketplace_signal
- public_receipt_url
- Shariah-compliant label

## 22. Non-Claims

[PROTOTYPE]
[DESIGNED_NOT_LIVE]
LOCAL_ONLY
GENESIS_MODE

No live runtime execution.
No hidden daemon.
No command execution.
No process spawning.
No network calls.
No filesystem writes.
No cross-repo writes.
No Data Lake mutation.
No public publication.
No Node1 activation.
No URP bridge.
No reward logic.
No token logic.
No contracts.
No marketplace.
No Shariah-compliant claim.

## 23. MBOK / DevOps / CI-CD / A+ QA Mapping

G60R/G61 boundary progression -> ADR-035 -> runtime dry-run scaffold -> future runtime dry-run mock -> future delivery-check marker -> future four-rail proof.

| Area                             | Status / Action                                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integration Management           | Defines the first runtime-readiness boundary without live runtime authority.                                                                               |
| Scope Management                 | Limits the slice to dry-run state names, policies, consent gates, trace expectations, replay-safe receipt expectations, and still-blocked invariants.      |
| Quality Management               | Requires failure-safe abort, retry, timeout, idempotency, trace, and replay-safe receipt boundaries before any implementation.                             |
| Risk Management                  | Explicitly forbids runtime, daemon, process, network, filesystem, cross-repo, Data Lake, public, token, contract, marketplace, and Shariah-claim surfaces. |
| Stakeholder Management           | Preserves Dema as face and operator approval as exact-string future gate.                                                                                  |
| DevOps                           | Local-only, [PROTOTYPE][DESIGNED_NOT_LIVE], proof-gated. No pipeline automation or runtime polling added here.                                             |
| CI/CD                            | Closure requires scaffold, mock, delivery-check integration, clean pre-push seal, and exact-head four-rail remote proof.                                   |
| A+ Performance-Quality Assurance | No throughput, autonomy, production, public, economic, or compliance claims until production DoD passes.                                                   |

## 24. Next Micro

GO: NODE0 CLOSED-LOOP RUNTIME DRY-RUN TEST SCAFFOLD

Only after ADR-035 local proof + commit + push + four-rail remote proof.
