# NODE0-MISSION-PILOT-COCKPIT-PREVIEW-1A

Truth label: `NODE0_MISSION_PILOT_COCKPIT_PREVIEW_MEASURED_REPO`

## Purpose

Read-only truth cockpit: verifies the three emitted mission artifacts (receipt, world-state delta, DEMA report) by content hash and renders one operator view — mission status, accepted/rejected gates, delta preview, DEMA report, and next safe action; refuses tampered artifacts.

## Input Contract

```js
runNode0MissionPilotCockpitPreview({ consent, input: { emission } })
```

`emission` is ONE already-produced `NODE0-LOCAL-MISSION-ARTIFACT-EMISSION-PREVIEW-1A`
payload — the three content-addressed artifacts (`receipt`,
`world_state_delta_preview`, `dema_report`) with its embedded `harness_result`. The
kernel reads no file; the CLI/adapter loads the three JSON artifacts and injects the
emission. Exact consent:

```text
GO: node0 mission pilot cockpit preview
```

## Output Contract

```text
schema
truth_label
ok
status                 (verified_preview_cockpit | blocked_preview_cockpit | blocked_pending_consent)
run_id
content_hash
cockpit_view {
  schema
  mission_status
  run_id
  receipt_hash
  gates { ladder[], accepted[], rejected[], reached_station, blocked_by[] }
  world_state_delta_preview { operation, target, applied:false, committed_live:false, would_append_receipt, receipt_content_hash }
  dema_report { status, next_safe_action }
  what_happened
  what_did_not_happen
  next_safe_action
  content_hash
}
boundary.execution_allowed (false)
mint_allowed (false)
authority_delta (0)
blocked_by[]
```

The `cockpit_view` is content-addressed and DERIVED from the verified emission —
every field is passed through from the artifacts (gates come from the pulse ladder
embedded in the emission). No new intelligence.

## Verification

```js
verifyNode0MissionPilotCockpitPreview(payload)
```

Body-bound re-derivation: recomputes the cockpit `content_hash` and the `cockpit_view`
hash, independently re-derives EACH artifact hash (refusing tampered artifacts),
binds the rendered view to the current source (`cockpit_view_source_mismatch`), and
re-runs the emission verify on the embedded source (independent anchor -> genesis
signature). Tampering any field — including a recomputed-hash forgery of the upstream
chain — breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/node0-mission-pilot-cockpit-preview.js
tests/node0-mission-pilot-cockpit-preview.test.js
scripts/review/node0-mission-pilot-cockpit-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_MISSION_PILOT_COCKPIT_PREVIEW_1A.md
docs/02-architecture/NODE0_MISSION_PILOT_COCKPIT_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/node0-mission-pilot-cockpit-preview.test.js
node scripts/review/node0-mission-pilot-cockpit-preview-check.mjs --json
npm test
npm run check
```
