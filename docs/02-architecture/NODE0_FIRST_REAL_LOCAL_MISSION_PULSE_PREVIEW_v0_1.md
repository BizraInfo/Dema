# NODE0-FIRST-REAL-LOCAL-MISSION-PULSE-PREVIEW-1A

Truth label: `NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_MEASURED_REPO`

## Purpose

The first control-plane bridge from **composed architecture** (the merged genesis-root + composition
gate) toward a **living loop**. It proves ONE caller-supplied mission packet can be connected,
deterministically and boundary-false, through the eight-stage pulse — without live autonomy, model
invocation, filesystem access, or a daemon.

It sits ABOVE `NODE0-URP-GENESIS-ROOT-COMPOSITION-GATE-PREVIEW-1A` (#343): the mission's
`composition_ref` is a composition verdict, re-verified here, which transitively re-verifies the
genesis signature anchor.

## The eight pulse stages

```text
PERCEIVE   → mission present + well-shaped (mission_id, sovereign_intent)
CONSENT    → operator_is_sole_authority true, allows_live_mutation false
RESOURCE_SELECT → composition_ref re-verifies + composition_ready true
ACTION_PREVIEW  → caller candidate {claim,task,boundary} shape valid; affirmative fields no-overclaim
VERIFY     → every prior stage passed, nothing blocked
RECEIPT    → receipt_preview (committed_live false)
WORLD_STATE_UPDATE_PREVIEW → world_state_delta_preview (committed_live false)
DEMA_REPORT → status / what_happened / what_this_proves / what_this_does_not_prove / next_safe_action
```

## Input Contract

```js
runNode0FirstRealLocalMissionPulsePreview({ consent, input })
// input = {
//   mission: { mission_id, sovereign_intent, mission_type },
//   consent: { operator_is_sole_authority, scope, allows_live_mutation:false },
//   input_packet: { source_label, content_hash: "sha256:…", sensitivity, raw_content_leaves_node0:false },
//   composition_ref: <NODE0-URP-GENESIS-ROOT-COMPOSITION-GATE verdict payload>,
//   candidate_extraction: { claim, task, boundary },   // caller-supplied ACTION_PREVIEW
//   authority_delta: 0, request_live_commit: false, declared_flags: { …all false }
// }
```

Exact consent:

```text
GO: node0 first real local mission pulse preview
```

## Output Contract

```text
schema · truth_label · ok · status (verified_preview_pulse | blocked_preview_pulse)
content_hash · pulse_ready · stage_count(8)
boundary (all-false) · mint_allowed:false · authority_delta:0 · grants_action:false
receipt_preview · world_state_delta_preview (committed_live:false) · dema_report
what_this_proves · what_this_does_not_prove · blocked_by[]
```

## Verification

```js
verifyNode0FirstRealLocalMissionPulsePreview(payload)
```

Body-bound re-derivation over the whole verdict, PLUS re-verification of the embedded
`composition_ref` — whose embedded genesis descriptor carries a signature-backed anchor. So a
forge-and-recompute of the pulse body that tampers the composition/genesis chain is still rejected
(re-signing needs a private key the forger lacks). Receipt/world-state previews must stay
`committed_live: false`.

## What this does NOT prove

No live runtime, no model intelligence, no real founder-data ingestion, no mint, no federation, no
daemon, no network, no public readiness. The ACTION_PREVIEW is a caller-supplied candidate whose
shape is validated — this kernel performs no semantic extraction and reads no file.

## Next rung

`NODE0-LOCAL-MISSION-HARNESS-PREVIEW-1A` — the first I/O harness (read one local file → hash → mission
packet → run this pure kernel → write receipt artifact → DEMA report). Kernel first (this slice),
harness second.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/node0-first-real-local-mission-pulse-preview.js
tests/node0-first-real-local-mission-pulse-preview.test.js
scripts/review/node0-first-real-local-mission-pulse-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_1A.md
docs/02-architecture/NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/node0-first-real-local-mission-pulse-preview.test.js
node scripts/review/node0-first-real-local-mission-pulse-preview-check.mjs --json
npm test
npm run check
```
