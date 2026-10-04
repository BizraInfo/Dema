# DEMA-MISSION-WORKER-HANDOFF-0A

Truth label: `DEMA_MISSION_WORKER_HANDOFF_PREVIEW`

## Purpose

Prove the minimum model-substitution case: one declared mission changes workers
without changing its mission contract, acceptance criteria, consent scope,
source checkpoint, or authority.

The handoff is not a new orchestration subsystem. It compiles into the existing
`NODE0-REALM-STATE-KERNEL-1A` event log as one hash-chained
`MISSION_CHECKPOINT` whose payload has `checkpoint_type: WORKER_HANDOFF`.

## Input

The caller injects:

- an already replayable Node0 realm event history containing the declared mission;
- `from_worker` and `to_worker` capability references;
- before/after hashes for mission contract, acceptance criteria, consent scope,
  and source checkpoint;
- an external consent-receipt hash;
- evidence references and prohibited effects;
- `authority_delta: 0`;
- the exact phrase `GO: dema mission worker handoff preview`.

## Fail-closed invariants

The plan is blocked when:

- consent is not an exact byte match;
- prior realm replay fails or the mission was not declared;
- the replacement names the same worker;
- any before/after invariant hash differs;
- the consent-receipt hash is malformed;
- evidence/prohibited-effect sets are empty, duplicated, accessor-backed, or
  otherwise malformed;
- `authority_delta` is not zero;
- an unknown top-level field is present;
- the proposed event cannot be canonicalized.

The verifier replays the complete returned history and rejects:

- forged or broken hash chains;
- extra fields on the envelope, handoff event, or handoff payload;
- a false continuity proof;
- non-normalized evidence/prohibited-effect ordering;
- nonzero authority;
- any non-canonical all-false boundary shape.

## Output

A replayable preview envelope containing:

- the complete event history with one appended `MISSION_CHECKPOINT`;
- the canonical `handoff_event_id` produced by the existing realm event hasher;
- `continuity_status: MISSION_CONTINUES`;
- replay summary and exact all-false boundary;
- `authority_delta: 0`.

## Boundary

No file write, model invocation, network use, live execution, mission-contract
mutation, consent-scope mutation, acceptance-criteria mutation, source-checkpoint
mutation, or authority increase occurs.

## Known limits

- No durable event-log persistence is added.
- No worker is selected or invoked.
- No external signature or independent anchor is created. A forger controlling
  both equal before/after hashes and recomputing the event ID still requires an
  external signed checkpoint to detect.
- The existing realm reducer records the checkpoint sequence but does not yet
  project `current_worker` into derived realm state.
- This is a minimum continuity proof, not production failover.

## Evidence

- `packages/core/src/dema-mission-worker-handoff.js`
- `tests/dema-mission-worker-handoff.test.js`
- `scripts/review/dema-mission-worker-handoff-check.mjs`
- `docs/receipts/DEMA_MISSION_WORKER_HANDOFF_0A.md`

The test file is automatically included by the repository's existing
`node --test` stage in `npm run check`; it also executes the dedicated review
harness.
