# Mission Closeout Evidence Report v0.1

**Date:** 2026-05-26
**Status:** Approved
**Sparse point:** After Health Snapshot Mission shipped (HEAD b8be5e7)

## Purpose

Convert a completed mission's receipt into a structured, verifiable
evidence summary. Proves the mission ran, what it touched, what it
didn't, and its verdict — grounded in the receipt already on disk.

Read-only. No new state written. No network. No re-probing.

## Architecture

```
packages/mission/src/mission-closeout.js   ← core logic
apps/cli/src/index.js                      ← dispatch wiring
tests/mission-closeout.test.js             ← unit tests
```

## Data flow

```
DEMA_HOME/receipts/ → find receipt → parse → verify content_hash → render
```

1. **Resolve mission ID**: If provided, substring-match against receipt
   filenames (`mission-*-{id}*.json`). If omitted, find the most recent
   `mission-*.json` by mtime.
2. **Parse**: `JSON.parse` the receipt file.
3. **Verify**: Recompute `sha256(stableStringify(attests))`, compare to
   `content_hash`. Reuses the canonical hashing from
   `packages/mission/src/health-snapshot.js`.
4. **Render**: Human-readable plain text or `--json` envelope.

## CLI surface

```
dema mission closeout [mission-id] [--json] [--no-color]
```

- No args → latest mission receipt by mtime
- With ID → substring match against receipt filenames
- `--json` → JSON envelope (schema `bizra.dema.mission_closeout.v0.1`)
- Exit 0 always (informational — hash mismatch is reported, not enforced)

## Output: plain text

```
Mission Closeout Evidence Report
════════════════════════════════════════
  Mission ID:     health_snapshot_0c00967e67c0
  Type:           health_snapshot
  Executed:       2026-05-25T22:23:42.522Z
  Verdict:        ATTENTION
  Content Hash:   sha256:0c00967e67c0...
  Hash Verified:  ✓ PASS

  Results:
    Setup:    INTACT (7 checks, 0 missing)
    Harness:  CLEAN (5/5 gates, 6 hooks)
    Doctor:   1 ok / 3 fail / 1 warn (of 5)
    Witness:  not present
    Memory:   7 entries

  Boundary (16 keys):
    filesystem_write: YES | consent_collected: YES
    All others: NO

  Integrity: content_hash recomputed and matches.
════════════════════════════════════════
```

## Output: JSON envelope

```json
{
  "schema": "bizra.dema.mission_closeout.v0.1",
  "mission_id": "health_snapshot_0c00967e67c0",
  "source_receipt": "mission-health-b8299ecbe7f63655.json",
  "source_path": "<DEMA_HOME>/receipts/mission-health-b8299ecbe7f63655.json",
  "verification": {
    "content_hash_match": true,
    "recomputed_hash": "0c00967e67c0...",
    "original_hash": "0c00967e67c0..."
  },
  "summary": {
    "type": "health_snapshot",
    "executed_at": "2026-05-25T22:23:42.522Z",
    "verdict": "ATTENTION",
    "results": {
      "setup": { "verdict": "INTACT", "checks": 7, "missing": 0 },
      "harness": {
        "verdict": "CLEAN",
        "gaps": 0,
        "gates": "5/5 passing",
        "hooks": 6
      },
      "doctor": { "predicates": 5, "ok": 1, "fail": 3, "warn": 1 },
      "witness": { "exists": false, "verdict": null },
      "memory": { "entries": 7 }
    },
    "boundary": {
      "filesystem_write_performed": true,
      "consent_collected": true,
      "all_others_false": true,
      "total_keys": 16,
      "true_count": 2,
      "false_count": 14
    }
  }
}
```

## Error cases

| Condition                   | Behavior                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------- |
| No `receipts/` dir          | Error message: "No mission receipts found. Run a mission first." Exit 1.            |
| No matching ID              | Error message: "No receipt matching '{id}' found." Exit 1.                          |
| No `mission-*` files at all | Same as no receipts dir message. Exit 1.                                            |
| Hash mismatch               | Report renders with `Hash Verified: ✗ MISMATCH` showing expected vs actual. Exit 0. |
| Receipt missing `attests`   | Error: "Receipt is malformed — missing attests block." Exit 1.                      |

## Testing

- Parse a known receipt fixture → verify closeout output shape
- Content hash verification: positive case (matching) + negative case (tampered)
- Latest-receipt resolution with multiple files (mtime ordering)
- Substring ID matching: exact, partial, no-match
- JSON envelope schema assertion (`bizra.dema.mission_closeout.v0.1`)
- Empty receipts dir → error message
- Boundary summary computation (true_count, false_count)

## Boundaries

- No files written to disk
- No network access
- No re-probing of system state
- No dependency on witness, harness, or doctor being available
- Only reads from `DEMA_HOME/receipts/`
- Uses existing `sha256` + `stableStringify` utilities

## What this is NOT

- Not a re-assessment of current system state (that's `dema doctor`)
- Not a new receipt or evidence chain entry (that's Approach C, deferred)
- Not an investor-grade audit package (that's the `--audit` flag, deferred)
