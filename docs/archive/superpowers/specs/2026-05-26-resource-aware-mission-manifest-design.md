# Resource-Aware Mission Manifest v0.1

**Date:** 2026-05-26
**Status:** Approved (with corrections)
**Sparse point:** After Probe Verdict Hardening (commit 9191fc5)

## Purpose

Pre-execution declaration of what a mission will consume and touch
before it runs. Completes the proof loop from "declare → consent →
execute → receipt → verify → probe." Currently the "declare" step
is missing.

The manifest separates two temporal boundaries:

1. **What the manifest command itself does** (read-only, no side effects)
2. **What the mission will do when executed** (writes receipt, collects
   consent)

## Architecture

```
packages/mission/src/mission-manifest.js   ← core: build + render
apps/cli/src/index.js                      ← dispatch: dema mission manifest
                                             + draft integration
tests/mission-manifest.test.js             ← unit tests
```

## CLI surface

```
dema mission manifest [health_snapshot] [--json] [--no-color]
```

- No args or `health_snapshot` → manifest for health-snapshot mission
- Unknown type → error message, exit 1
- `--json` → JSON envelope (`bizra.dema.mission_manifest.v0.1`)
- Internal error → exit 2

### Draft integration

`dema mission draft "<intent>" [--json]` now includes a
`pre_execution_manifest` field in its output, built by calling
`buildMissionManifest("health_snapshot", { now })`.

## Function signatures

```javascript
export function buildMissionManifest(missionType, { now = new Date() } = {})
export function formatMissionManifest(manifest)
```

`now` is injectable for deterministic tests.

## JSON envelope

```json
{
  "schema": "bizra.dema.mission_manifest.v0.1",
  "generated_at": "2026-05-26T...",
  "mission_type": "health_snapshot",
  "mode": "PRE_EXECUTION_DECLARATION",
  "manifest_generation_boundary": {
    "truth_label": "LOCAL_STATIC_DECLARATION",
    "filesystem_write_performed": false,
    "network_used": false,
    "model_invocation_performed": false,
    "receipt_mint_performed": false
  },
  "consent_boundary": {
    "truth_label": "LOCAL_STATIC_DECLARATION",
    "required_phrase": "RUN NODE0 HEALTH SNAPSHOT",
    "required_phrase_hash": "<sha256 of phrase>",
    "exact_string_only": true,
    "consent_required": true,
    "expected_consent_collected_at_execution": true
  },
  "expected_mission_boundary": {
    "truth_label": "LOCAL_STATIC_DECLARATION",
    "filesystem_write_performed": true,
    "network_used": false,
    "runtime_execution_performed": false,
    "model_loaded": false,
    "model_invocation_performed": false,
    "prompt_executed": false,
    "external_call_performed": false,
    "raw_corpus_scan_performed": false,
    "raw_data_included": false,
    "tool_executed": false,
    "chain_advance_performed": false,
    "receipt_mint_performed": false,
    "federation_invoked": false,
    "node_connection_performed": false,
    "public_network_used": false,
    "consent_required": true,
    "expected_consent_collected_at_execution": true
  },
  "proof_boundary": {
    "truth_label": "LOCAL_STATIC_DECLARATION",
    "receipt_schema": "bizra.dema.mission_receipt.health_snapshot.v0.1",
    "content_hash_algorithm": "sha256",
    "content_hash_input": "stableStringify(attests)",
    "tamper_detectable": true,
    "verifier_available": true,
    "behavioral_probe_available": true
  },
  "resource_boundary": {
    "truth_label": "LOCAL_STATIC_DECLARATION",
    "resource_truth_label": "LOCAL_STATIC_ESTIMATE",
    "estimated_wall_time_class": "low",
    "static_wall_time_budget_ms": 5000,
    "expected_filesystem_read_classes": [
      "setup_state",
      "harness_state",
      "doctor_predicates",
      "witness_state",
      "memory_summary"
    ],
    "expected_filesystem_write_classes": ["mission_receipt"],
    "network_endpoints": [],
    "model_invocations": [],
    "memory_estimate_class": "trivial"
  },
  "manifest_hash": "<sha256 of stableStringify(payload_without_manifest_hash)>"
}
```

## Plain text output

```
Resource-Aware Mission Manifest v0.1
==========================================
  Mission Type:     health_snapshot
  Mode:             PRE_EXECUTION_DECLARATION

  Manifest Generation:
    This command: read-only, no network, no model, no write

  Consent:
    Required phrase: RUN NODE0 HEALTH SNAPSHOT
    Exact string only: yes
    Consent required: yes (collected at execution time)

  Expected Mission Boundary (16 keys):
    Will do:         filesystem_write, consent_collected
    Will NOT:        network, model, federation, runtime, ...

  Proof:
    Receipt schema:  bizra.dema.mission_receipt.health_snapshot.v0.1
    Hash:            sha256(stableStringify(attests))
    Verifier:        available
    Probe:           available

  Resources (estimated):
    Wall time:       low (budget: 5000ms)
    Reads:           setup, harness, doctor, witness, memory
    Writes:          mission_receipt
    Network:         none
    Models:          none

  Manifest Hash:     sha256:...
==========================================
```

## Hash computation

```javascript
const payload = { ...manifest };
delete payload.manifest_hash;
manifest.manifest_hash = sha256(stableStringify(payload));
```

The hash covers the entire manifest except `manifest_hash` itself.
Uses the same `sha256` + `stableStringify` from
`packages/consent/src/consent-common.js`.

## Error cases

| Condition            | Behavior                                                                    |
| -------------------- | --------------------------------------------------------------------------- |
| Unknown mission type | Error: "Unknown mission type: '{type}'. Supported: health_snapshot." Exit 1 |
| Internal error       | Error envelope, exit 2                                                      |

## Testing

- Schema assertion (`bizra.dema.mission_manifest.v0.1`)
- Frozen output (deep-equal on known input with fixed `now`)
- Hash determinism (2 calls with same `now` → same `manifest_hash`)
- Consent phrase hash matches `sha256(HEALTH_MISSION_CONSENT_PHRASE)`
- JSON output via CLI
- Plain text output via CLI
- Unknown type → error + exit 1
- Draft integration: `buildMissionDraftPreview` output includes
  `pre_execution_manifest` field
- Manifest generation boundary is read-only (all false)
- No files persisted to disk

## Boundaries

- No files written to disk
- No network access
- No model invocation
- No receipt minting
- No modification to run/closeout/probe modules
- Only imports from consent-common.js (sha256, stableStringify)
  and health-snapshot.js (HEALTH_MISSION_CONSENT_PHRASE)

## What this is NOT

- Not a runtime resource profiler
- Not a receipt or evidence chain entry
- Not a replacement for the consent gate
- `expected_mission_boundary` declares future intent, not current state
