# Behavioral Mission Probe v0.1

**Date:** 2026-05-26
**Status:** Approved
**Sparse point:** After Mission Closeout Evidence Report shipped (commit 64b3086)

## Purpose

Truthfulness verifier for mission execution. Runs a health-snapshot
mission in an isolated DEMA_HOME, observes side effects, and compares
observed behavior to declared boundary claims. Catches lies — where a
mission receipt claims `network_used: false` but evidence suggests
otherwise, or `filesystem_write_performed: true` but no files were
created.

Upgrades Dema from "receipt verifies structurally" to "mission behavior
was observed and compared against declared boundaries."

## Architecture

```
packages/mission/src/mission-probe.js      ← core: run probes, collect evidence
apps/cli/src/index.js                      ← dispatch: dema mission probe
tests/mission-probe.test.js                ← unit tests
```

## CLI surface

```
dema mission probe [--json] [--no-color]
```

v0.1 probes the health-snapshot mission only (the only executable
mission type). Future versions can probe other mission types.

## Evidence levels

Each of the 16 canonical boundary keys receives one of three evidence
levels:

| Level                          | Meaning                                                                                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OBSERVED`                     | Directly verified via filesystem diff, file count, or consent flow observation                                                                                                    |
| `STATIC_CHECKED`               | Verified via static import/call-surface analysis of the mission's code path. Not a runtime proof — means no forbidden import or call surface was detected by v0.1 static analysis |
| `DECLARED_NOT_OBSERVABLE_V0_1` | Cannot be verified in v0.1. Would require runtime interception or instrumentation not yet built                                                                                   |

### Forbidden surfaces for STATIC_CHECKED

The following Node.js built-in modules and globals constitute the
forbidden network/runtime surface. If any appear in the health-snapshot
call chain's imports, the corresponding boundary key fails STATIC_CHECKED:

```
http, https, http2, net, tls, dgram, dns,
child_process, worker_threads, cluster,
fetch (global), WebSocket
```

### Boundary key → evidence level mapping

| Boundary key                  | Evidence level               | How verified                                       |
| ----------------------------- | ---------------------------- | -------------------------------------------------- |
| `filesystem_write_performed`  | OBSERVED                     | Before/after file count diff in DEMA_HOME          |
| `consent_collected`           | OBSERVED                     | Consent gate probe confirms write requires consent |
| `network_used`                | STATIC_CHECKED               | No forbidden network imports in call chain         |
| `runtime_execution_performed` | STATIC_CHECKED               | No child_process/worker_threads imports            |
| `model_loaded`                | STATIC_CHECKED               | No model loading imports                           |
| `model_invocation_performed`  | STATIC_CHECKED               | No inference call surface                          |
| `prompt_executed`             | STATIC_CHECKED               | No prompt execution surface                        |
| `external_call_performed`     | STATIC_CHECKED               | No http/fetch/WebSocket surface                    |
| `raw_corpus_scan_performed`   | DECLARED_NOT_OBSERVABLE_V0_1 | —                                                  |
| `raw_data_included`           | DECLARED_NOT_OBSERVABLE_V0_1 | —                                                  |
| `tool_executed`               | DECLARED_NOT_OBSERVABLE_V0_1 | —                                                  |
| `chain_advance_performed`     | DECLARED_NOT_OBSERVABLE_V0_1 | —                                                  |
| `receipt_mint_performed`      | DECLARED_NOT_OBSERVABLE_V0_1 | —                                                  |
| `federation_invoked`          | DECLARED_NOT_OBSERVABLE_V0_1 | —                                                  |
| `node_connection_performed`   | DECLARED_NOT_OBSERVABLE_V0_1 | —                                                  |
| `public_network_used`         | STATIC_CHECKED               | No forbidden network imports                       |

## The 5 probes

### 1. `boundary_observed_v0_1`

Run health-snapshot mission with consent in isolated DEMA_HOME.
Before: snapshot file listing. After: snapshot file listing. Diff.

- `filesystem_write_performed`: compare new file count to declaration
- `consent_collected`: verified by probe 3 (consent_gate)
- Network/runtime keys: static import analysis of health-snapshot.js
  call chain against the forbidden surface list
- Remaining keys: tagged `DECLARED_NOT_OBSERVABLE_V0_1`

### 2. `determinism`

Run `buildHealthSnapshot({ now: fixedDate })` twice against the same
DEMA_HOME state. Both must produce identical `content_hash`. Proves
the snapshot is a pure function of state, not of timing or randomness.

### 3. `consent_gate`

- Run `saveHealthSnapshotReceipt({ consent: "" })` → assert `saved: false`,
  no new file in receipts dir
- Run `saveHealthSnapshotReceipt({ consent: CORRECT_PHRASE })` → assert
  `saved: true`, receipt file exists in receipts dir

Proves consent gating is functional, not cosmetic.

### 4. `receipt_integrity`

Read the receipt written by probe 3. Recompute
`sha256(stableStringify(attests))`. Assert it matches `content_hash`.
Proves the receipt wasn't corrupted between write and read.

### 5. `tamper_detection`

Take the receipt from probe 3. Clone it, mutate one attests field
(e.g., `mission_verdict: "TAMPERED"`). Recompute hash. Assert the
recomputed hash does NOT match the original `content_hash`. Proves
the integrity check isn't vacuous.

## Execution flow

1. Create isolated `DEMA_HOME` (tmpdir)
2. Bootstrap minimal state via `setupIntegrity()` (or equivalent)
3. Snapshot receipts dir (before)
4. Run probe 1: execute health-snapshot, snapshot after, diff, classify
5. Run probe 2: two `buildHealthSnapshot()` calls with fixed timestamp
6. Run probe 3: empty consent → no write; correct consent → write
7. Run probe 4: read receipt from probe 3, verify hash
8. Run probe 5: clone receipt, mutate attests, assert hash mismatch
9. Cleanup tmpdir
10. Derive verdict, render report

## Exit codes

```
CLEAN  (5/5 PASS)      → exit 0
REVIEW (partial PASS)   → exit 0
FAILED (any FAIL)       → exit 1
internal error           → exit 2
```

## Output: plain text

```
Behavioral Mission Probe v0.1
==========================================
  Target:   health-snapshot
  Probes:   5 behavioral invariants
  Home:     /tmp/dema-probe-xxxx (isolated)

  1. boundary_observed_v0_1    PASS
       fs_write=true:          OBSERVED (1 new file)
       network_used=false:     STATIC_CHECKED (0 forbidden imports)
       runtime_exec=false:     STATIC_CHECKED
       model_loaded=false:     STATIC_CHECKED
       consent_collected=true: OBSERVED
       remaining keys:         DECLARED_NOT_OBSERVABLE_V0_1
  2. determinism               PASS
       2 runs, same content_hash
  3. consent_gate              PASS
       no-consent → no file written
       with-consent → file written
  4. receipt_integrity         PASS
       sha256 recomputed and matches
  5. tamper_detection          PASS
       mutated attests → hash mismatch detected

  Verdict: CLEAN (5/5 PASS)
==========================================
```

## Output: JSON envelope

```json
{
  "schema": "bizra.dema.mission_probe.v0.1",
  "target": "health_snapshot",
  "verdict": "CLEAN",
  "probes_total": 5,
  "probes_passing": 5,
  "probes": [
    {
      "name": "boundary_observed_v0_1",
      "pass": true,
      "evidence": {
        "fs_write": { "level": "OBSERVED", "new_files": 1 },
        "network_used": { "level": "STATIC_CHECKED", "forbidden_imports": 0 },
        "runtime_exec": { "level": "STATIC_CHECKED", "forbidden_imports": 0 },
        "model_loaded": { "level": "STATIC_CHECKED", "forbidden_imports": 0 },
        "consent_collected": { "level": "OBSERVED" },
        "not_observable_count": 7
      }
    },
    {
      "name": "determinism",
      "pass": true,
      "evidence": { "runs": 2, "hashes_match": true }
    },
    {
      "name": "consent_gate",
      "pass": true,
      "evidence": {
        "no_consent_saved": false,
        "with_consent_saved": true
      }
    },
    {
      "name": "receipt_integrity",
      "pass": true,
      "evidence": { "hash_match": true }
    },
    {
      "name": "tamper_detection",
      "pass": true,
      "evidence": { "tampered_hash_differs": true }
    }
  ],
  "isolated_home": "/tmp/dema-probe-xxxx",
  "boundary": {
    "read_only_report": true,
    "network_used": false,
    "operator_home_touched": false
  }
}
```

## Error cases

| Condition                                   | Behavior                                                             |
| ------------------------------------------- | -------------------------------------------------------------------- |
| Health-snapshot build fails                 | Probe 1 FAIL, remaining probes skipped, verdict FAILED, exit 1       |
| Static import analysis can't resolve a file | That key gets DECLARED_NOT_OBSERVABLE_V0_1 instead of STATIC_CHECKED |
| Consent phrase unknown                      | Use the constant from health-snapshot.js (it's exported)             |
| Internal crash                              | Error envelope with exit 2                                           |

## Testing

- Probe 1: boundary observation with known receipt → correct evidence levels
- Probe 2: determinism with fixed timestamp → same hash
- Probe 3: empty consent → no write; correct consent → write
- Probe 4: valid receipt → hash matches
- Probe 5: tampered receipt → hash mismatch
- Full probe run → CLEAN verdict
- Forced failure (mock a boundary lie) → FAILED verdict + exit 1
- JSON envelope schema assertion

## Boundaries

- All execution in isolated tmpdir — operator's `~/.dema/` never touched
- No network access
- Report is ephemeral — not persisted to disk
- Uses existing `sha256` + `stableStringify` + `buildHealthSnapshot` +
  `saveHealthSnapshotReceipt` from the mission package
- Static import analysis reads `.js` files but does not execute them

## What this is NOT

- Not a runtime profiler or telemetry system
- Not a full network interceptor (that's v0.2+ with eBPF or socket hooks)
- Not a replacement for the test suite (the probe tests behavior, not code)
- `STATIC_CHECKED` is not a runtime proof — it is evidence from static
  analysis that no forbidden import or call surface was detected
