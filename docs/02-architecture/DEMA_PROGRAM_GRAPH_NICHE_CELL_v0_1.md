# Dema Program Graph + Niche Mission Cell v0.1 (DEMA-PROGRAM-GRAPH-NICHE-CELL-0A)

Truth label: `PREVIEW_ONLY` · representation only · `authority_delta: 0`

## Purpose

Give a future Niche Mission Foundry a safe, deterministic place to submit a
candidate mission: an immutable **ProgramDefinition** (task topology + one
Niche Mission Cell) compiled into a content-addressed envelope with a **pure
derived ProgramProjection**. Nothing lifecycle-shaped is ever caller input;
nothing here persists, consents, executes, or judges evidence.

```text
Niche Foundry (future)   proposes a ProgramDefinition
Program Graph (this)     validates topology, derives readiness,
                         judges structural transition admissibility
Mission Corridor         persists the authorized mission + journal
FATE                     decides whether authority exists
Workers / Verifiers      execute / judge evidence
Human                    accepts value, promotes capability
```

## Kernel

`packages/mission/src/dema-program-graph.js` — pure (no fs, network, process,
clock, randomness). API:

- `validateProgramDefinition(input)` → `{ ok, blocked_by[] }` (collect-all,
  named codes, fail-closed)
- `compileProgramDefinition(input)` → frozen
  `{ canonicalization, body, body_hash, projection }`
- `deriveProgramProjection(normalizedDefinition)` → frozen projection
- `verifyCompiledProgram(compiled)` → semantic re-derivation
- `evaluateProgramTransitionCandidate({...})` → structural candidate only
- `buildFounderRecoveryProgramDefinition()` / `runProgramGraphFixture()`

## Schema (`bizra.dema.program-definition.v0.1`)

Top-level closed keys: `schema_version, program_id, program_version, title,
purpose, truth_label, source_bindings, niche_cell, task_definitions,
authority_ceiling, boundary`. Derived/lifecycle fields (`program_state`,
`content_hash`, `projection`, `body_hash`, task `state`/`blocked_by`, …) are
rejected by name (`derived_field_supplied:*`) — they are compiler output,
never input.

The **hash envelope** never hashes an object containing its own hash: the
subject is `body` (the normalized definition) under `bizra.canonical-json.v1`
(second registered consumer of `packages/canon` under the M5.1B allowlist —
no new canonicalization algorithm). Semantic normalization: set-like arrays
(sources, dependencies, actions, evidence, constraints, proves/does-not-prove)
are deduplicated and sorted; `task_definitions` order by `task_id`; an
equivalent definition in any input order yields the same `body_hash`.

The Niche Mission Cell carries `human` (`private_data_scope:
BOUNDED_REFERENCE_ONLY` — references only, never content), `situation`,
`problem`, `desired_outcome`, `constraints`, `execution_preview` (all refs
nullable in 0A), `proof_contract`. Niche-specific rules live in a **profile**
(`bizra.dema.niche-profile.founder-recovery.v0.1`: ≥3 distinct
`source_observation_refs`), not in generic lifecycle law.

## State machine

Closed table; an unlisted transition fails closed:

```text
PROPOSED → READY → ACTIVE → VERIFYING → HUMAN_DECISION_REQUIRED → ACCEPTED → SUPERSEDED
PROPOSED/READY/ACTIVE/VERIFYING → BLOCKED
VERIFYING → REJECTED · HUMAN_DECISION_REQUIRED → REJECTED
BLOCKED, REJECTED, SUPERSEDED: no exits in 0A
```

Unblocking a task is journal law (Mission Corridor), not graph law. The
initial projection is fully derived: no dependencies → `PROPOSED`; any
dependency (necessarily unaccepted at compile time) → `BLOCKED` with
`dependency_not_accepted:<id>`.

`evaluateProgramTransitionCandidate` gates `READY` on all dependencies
`ACCEPTED`, and `ACCEPTED` on required-evidence presence, a human decision ref
when `human_gate: REQUIRED`, and a verifier ref distinct from the worker ref
when independence is `REQUIRED`. The result is **structural only**:

```json
{ "structurally_admissible": true,
  "authority_granted": false,
  "transition_applied": false,
  "does_not_prove": ["evidence authenticity", "human consent authenticity",
    "verifier identity or organizational independence", "mission value"] }
```

## Authority separation

The program's `authority_ceiling` is a closed all-false 8-key object
(`execution/network/model_invocation/private_content_read/repository_write/
external_effect/economic_action/promotion _allowed`); missing, extra,
non-boolean, or `true` values fail closed. The slice's own conduct is the
canonical all-false preview boundary (deep-equal key set from
`boundary-schema.js`). Failure paths can only ADD blocked codes — no code
path flips any authority flag to true.

## Threat model & failure behavior

Verification semantically re-derives: schema/topology/profile revalidation,
normalization idempotence, hash recomputation, projection recomputation.
Defended (all fail closed): forged projection state; stale hash after body
edit; **forge-and-rehash** (recomputed hash over an invariant-violating,
reordered, or schema-relabeled body); derived-field injection; authority
flips; niche source-ref thinning; human-gate removal. NOT defended (out of
scope, journal/consent law): transition-history forgery (no journal here),
evidence authenticity, consent authenticity, real verifier independence.

## Relationships

- **Mission Corridor** (`mission-corridor.js`): owns the persistent contract +
  hash-chained journal; a future slice derives *current* (non-initial) task
  states from Definition + journal — this kernel deliberately cannot.
- **FATE**: sole authority decision point; this kernel never grants.
- **Mission-harness return-review preview**: donor for future worker-output
  review inside `VERIFYING`.
- **Niche Mission Foundry** (future, DESIGNED_NOT_LIVE): will compile cells
  from bounded observations and submit ProgramDefinitions here.

## Measured vs designed

Measured (41 tests + gate in `npm run check`): everything above under
"Defended", determinism, order-invariant hashing, fixture representability
(DEMA-CONTINUUM-FOUNDER-RECOVERY-001, 8 tasks, nothing ACCEPTED).
Designed-not-live: Foundry, opportunity detection, journal-bound current
state, worker/model execution, evidence truth, capability promotion.

## What this does not prove

Persistent lifecycle execution · authentic consent · evidence truth · real
human acceptance · model or worker execution · archive recovery · task
completion · human value · skill promotion.
