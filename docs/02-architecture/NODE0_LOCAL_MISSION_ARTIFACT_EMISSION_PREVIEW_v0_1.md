# NODE0-LOCAL-MISSION-ARTIFACT-EMISSION-PREVIEW-1A

Truth label: `NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_MEASURED_REPO`

## Purpose

A pure emitter/serializer. Given an already-produced, already-verified
`NODE0-LOCAL-MISSION-HARNESS-PREVIEW` result, it re-verifies that result
(transitively re-verifying pulse → composition → signature-backed genesis
anchor) and serializes it into THREE separate content-addressed preview
artifacts: a receipt, a not-applied world-state delta preview, and a DEMA
report. It composes the shipped harness kernel and re-implements nothing.

## Composition

```text
harness result (payload)                     ← input, already verified
  └─ verifyNode0LocalMissionHarnessPreview    ← independent anchor re-check
        └─ pulse verdict → composition ref → genesis signature anchor
emit:
  receipt                    ← harness receipt_artifact_preview + pulse hash
  world_state_delta_preview  ← DECLARED append; applied:false, committed_live:false
  dema_report                ← status + next_safe_action
```

## Input Contract

```js
runNode0LocalMissionArtifactEmissionPreview({ consent, input })
// input = { harness_result, authority_delta?, request_live_commit?, mint_allowed?, declared_flags?, now_iso? }
```

Exact consent:

```text
GO: node0 local mission artifact emission preview
```

`harness_result` is the output of `buildNode0LocalMissionHarnessPreviewPayload`.

## Output Contract

```text
schema
truth_label
ok / status
run_id                         (first 16 hex of the input content hash)
artifacts { receipt, world_state_delta_preview, dema_report }
artifact_paths[]               artifacts/proofs/node0-local-mission/<run_id>/<name>.json
content_hash
boundary.*                     (all false)
mint_allowed (false) · authority_delta (0)
blocked_by[]
```

Each artifact carries `schema`, `content_hash` (`sha256:…`), `committed_live:false`,
`boundary` (all-false), `what_this_proves`, `what_this_does_not_prove`.

## Verification

```js
verifyNode0LocalMissionArtifactEmissionPreview(payload)
```

Body-bound re-derivation of the emission hash AND each artifact hash. Fail-closed
rejects: `content_hash_mismatch`, `artifact_content_hash_mismatch:<name>`,
`artifact_committed_live:<name>`, `authority_delta_nonzero`, `mint_allowed_true`,
`committed_live_true`, `boundary_not_all_false`, `declared_<flag>` (laundering),
`raw_content_leaked:<name>:<key>`, and `harness_anchor_invalid` (the embedded
harness result no longer verifies — catches forge-and-recompute up the chain).

## Boundaries

- Pure kernel; the only injected input is `now_iso` (default null) — no clock call.
- No fs / network / process / random. Any file write lives in the CLI/adapter, consent-gated, under `DEMA_HOME`.
- No world-state applied, nothing recorded live, no model / daemon / wallet / token / federation.
- All-false boundary invariant — serialization authority ≠ execution authority.

## Files

```text
packages/core/src/node0-local-mission-artifact-emission-preview.js
tests/node0-local-mission-artifact-emission-preview.test.js
scripts/review/node0-local-mission-artifact-emission-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_1A.md
docs/02-architecture/NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_v0_1.md
```

## Smoke commands

```bash
node --test tests/node0-local-mission-artifact-emission-preview.test.js
node scripts/review/node0-local-mission-artifact-emission-preview-check.mjs --json
node scripts/review/kernel-purity-check.mjs
npm test
npm run check
```
