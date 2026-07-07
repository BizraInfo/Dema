# Receipt: NODE0-FIRST-REAL-LOCAL-MISSION-PULSE-PREVIEW-1A

Truth label: `NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_MEASURED_REPO`

## Slice

Pure preview-only Node0 mission pulse: connects one caller-supplied mission packet through consent, resource-composition reference, action preview, verification, receipt preview, world-state delta preview, and a DEMA truth report — all boundary-false, activates nothing.

```text
plan → build → verify → tamper-reject
```

## The eight-stage pulse

```text
PERCEIVE   → mission packet present + well-shaped
CONSENT    → operator sole authority, live mutation refused
RESOURCE_SELECT → composition_ref re-verifies + composition_ready
ACTION_PREVIEW  → caller-supplied candidate {claim,task,boundary} shape valid, no overclaim
VERIFY     → all prior stages passed, nothing blocked
RECEIPT    → receipt preview (committed_live false)
WORLD_STATE_UPDATE_PREVIEW → proposed delta (committed_live false)
DEMA_REPORT → truth / boundary / next-action / proof-gap summary
```

## Proof Contract

The gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the mission has consent (sole authority, no live mutation) and a content-addressed input packet,
- the `composition_ref` re-verifies via `verifyNode0UrpGenesisRootCompositionGatePreview` and is `composition_ready`,
- the caller candidate has non-empty claim/task/boundary and no overclaim wording in its affirmative fields,
- no declared live/mint/network/model/file-mutation flag, `authority_delta` 0, no live-commit request,
- RECEIPT and WORLD_STATE deltas stay `committed_live: false`,
- the verdict is content-addressed AND a forge-and-recompute that tampers the embedded composition/genesis chain is still rejected (the genesis anchor is signature-backed),
- the boundary stays all-false (no execution authority).

This kernel runs NO resource kernel loop, reads NO file, invokes NO model. The ACTION_PREVIEW
validates a caller-supplied candidate's SHAPE — it performs no semantic extraction. RECEIPT and
WORLD_STATE are previews; nothing is committed to a live world-state.

## Boundary

`verified_preview_pulse` verdict only. No live URP, no mint, no wallet, no settlement, no federation,
no daemon, no model invocation, no network, no remote execution, no file mutation. `boundary`
all-false · `authority_delta` 0 · `grants_action` false · `mint_allowed` false.

`npm run check` runs `node0-first-real-local-mission-pulse-preview-check.mjs` and keeps `NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-first-real-local-mission-pulse-preview.test.js
node scripts/review/node0-first-real-local-mission-pulse-preview-check.mjs --json
npm run check
```
