# Receipt: DEMA-MISSION-WORKER-HANDOFF-0A

Truth label: `DEMA_MISSION_WORKER_HANDOFF_PREVIEW`

## Claim

A declared mission can record a worker replacement as one deterministic,
hash-chained `MISSION_CHECKPOINT` while preserving four mission invariants and
zero authority.

## Measured local proof

Focused isolated harness:

```text
28 tests
28 pass
0 fail
```

Review harness result:

```json
{
  "ok": true,
  "schema": "bizra.dema.mission_worker_handoff.v0.1",
  "truth_label": "DEMA_MISSION_WORKER_HANDOFF_PREVIEW",
  "continuity_status": "MISSION_CONTINUES",
  "handoff_event_id": "sha256:7af1167c5eee29abde3045f91866cb557c6a87ff73efe463c486f4b6d5a62f09",
  "authority_delta": 0,
  "blocked_by": []
}
```

## Adversarial cases covered

- exact consent mismatch;
- smuggled envelope, event, and payload authority fields;
- nonzero authority delta;
- drift in mission contract, acceptance criteria, consent scope, or source checkpoint;
- same-worker handoff;
- duplicate evidence references;
- absent mission and corrupt prior realm chain;
- lone-surrogate and accessor-backed input rejection;
- forged-and-rehashed authority increase;
- forged-and-rehashed false continuity claim;
- non-normalized evidence order;
- missing boundary key;
- accidental freezing of caller-owned history.

## What this proves

- Model substitution can be represented without a second state machine.
- Mission continuity is bound to the existing realm event chain.
- Worker identity changes while mission, consent, acceptance, source checkpoint,
  and authority remain invariant.
- Failure does not increase authority.

## What this does not prove

- Full repository CI has not yet run on this slice.
- Durable restart recovery, automatic failover, worker routing, model invocation,
  external signatures, and production operation are not implemented.
- Internal replay integrity is not independent authenticity.

## Authority

```text
file_write_performed: false
network_used: false
model_invocation_performed: false
live_execution_performed: false
mission_contract_mutated: false
consent_scope_mutated: false
acceptance_criteria_mutated: false
source_checkpoint_mutated: false
authority_increased: false
authority_delta: 0
```
