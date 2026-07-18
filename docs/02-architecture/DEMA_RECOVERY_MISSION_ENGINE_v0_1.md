# DEMA-RECOVERY-MISSION-ENGINE-1A

Truth label: `DEMA_RECOVERY_MISSION_ENGINE_MEASURED_REPO`

## Purpose

Deterministic human-gated Recovery Mission state machine: declare -> reconstruct -> candidates -> human revival -> use -> verify -> seal; every transition guarded, no auto-selection, worker output is evidence not authority. Events are an **injected** event history — durable storage is NOT implemented; the derived mission state exists only for the duration of a call.

## State Machine

States: `DECLARED`, `RECONSTRUCTING` (named by the spec, unreached by the v0.1 transition table), `CANDIDATES_READY`, `AWAITING_HUMAN`, `IN_USE_MISSION`, `VERIFYING`, `SEALED`, `STOPPED`.

```text
MISSION_DECLARED  ->                       DECLARED
RECONSTRUCTED     : DECLARED             -> CANDIDATES_READY   (requires consent_id, <=7 candidates, no orphan lineage)
AWAIT_HUMAN       : CANDIDATES_READY     -> AWAITING_HUMAN
HUMAN_REVIVAL     : AWAITING_HUMAN       -> IN_USE_MISSION      (chosen_asset_id must be a surfaced candidate — no auto-selection)
WORKER_RESULT     : IN_USE_MISSION       -> VERIFYING           (evidence only — cannot reach SEALED by itself)
VERIFIER_VERDICT  : VERIFYING            -> SEALED              (PASS + independent verifier + used_asset_id == chosen asset)
VERIFIER_VERDICT  : VERIFYING            -> STOPPED             (FAIL, cause verify_failed)
STOP              : any non-terminal     -> STOPPED             (narrated cause)
```

`SEALED` and `STOPPED` are terminal — any further event is rejected `mission_already_terminal`.

## Reconstruction Helper

`reconstructRecoveryCandidates({ evidence, source_boundary })` is the pure derivation the `RECONSTRUCTED` event payload is built from: it never emits an item whose root falls outside `source_boundary` (excluded items are named in `not_accessed_report`, never silently dropped), buckets unknown-time evidence under the literal `"UNKNOWN"` sentinel (never interpolated), carries declared conflicts through verbatim into `contradiction_map`, and ranks candidates by declared relevance as a labeled integer `rank` (never a decimal score), capped at 7.

## Input Contract

```js
runDemaRecoveryMissionEngine({ consent, input })
```

Exact consent:

```text
GO: dema recovery mission engine preview
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
verifyDemaRecoveryMissionEngine(payload)
```

Body-bound re-derivation plus semantic invariants with stable block codes: schema, truth label, canonicalization algorithm, hash algorithm, text encoding, boundary shape, and `replay.ok`/`mission_state` consistency (both directions, plus the `current_state`/`chronology`/`seal_receipt` projections) are each rejected even when the forger recomputes the hash.

Limits (declared, tested): independent authenticity is NOT proved — an attacker controlling every semantically permitted field and recomputing the hash still requires an external signature or anchor to detect (later slice). Durable storage is not implemented; events are injected arrays. Restart recovery is not proved by this slice.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/dema-recovery-mission-engine.js
tests/dema-recovery-mission-engine.test.js
scripts/review/dema-recovery-mission-engine-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_RECOVERY_MISSION_ENGINE_1A.md
docs/02-architecture/DEMA_RECOVERY_MISSION_ENGINE_v0_1.md
```

## Commands

```bash
node --test tests/dema-recovery-mission-engine.test.js
node scripts/review/dema-recovery-mission-engine-check.mjs --json
npm test
npm run check
```
